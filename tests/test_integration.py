"""Integration tests against live TrainerRoad and Intervals.icu APIs.

These tests hit real endpoints using credentials from .env. They are read-only
and safe to run at any time. Skip automatically if credentials are missing.

Run with: uv run --with pytest pytest tests/test_integration.py -v -s
"""

import asyncio
import json
import os
from pathlib import Path

import pytest

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")
except ImportError:
    pass


def _has_tr_creds() -> bool:
    return bool(os.getenv("TRAINERROAD_USERNAME") and os.getenv("TRAINERROAD_PASSWORD"))


def _has_intervals_creds() -> bool:
    return bool(os.getenv("API_KEY") and os.getenv("ATHLETE_ID"))


skip_no_tr = pytest.mark.skipif(not _has_tr_creds(), reason="TR credentials not set")
skip_no_intervals = pytest.mark.skipif(not _has_intervals_creds(), reason="Intervals.icu credentials not set")


def _make_tr_client():
    from intervals_mcp_server.trainerroad.client import TRClient
    return TRClient(
        username=os.getenv("TRAINERROAD_USERNAME"),
        password=os.getenv("TRAINERROAD_PASSWORD"),
        member_id=int(os.getenv("TRAINERROAD_MEMBER_ID", "0")) or None,
    )


@skip_no_tr
class TestTrainerRoadAPI:
    """Live read-only tests against TrainerRoad."""

    def test_auth_and_member_info(self):
        client = _make_tr_client()

        async def run():
            member = await client.validate_and_get_member()
            assert member.is_valid
            assert member.member_id > 0
            assert member.username
            print(f"\n  Member: {member.username} (id={member.member_id})")

        asyncio.run(run())

    def test_calendar_activities_returns_list(self):
        client = _make_tr_client()

        async def run():
            activities = await client.get_calendar_activities("2026-05-22", "2026-06-10")
            assert isinstance(activities, list)
            print(f"\n  Got {len(activities)} calendar activities")
            for act in activities[:5]:
                print(f"    {act.date} | {act.workout_name} | type={act.activity_type} | race_priority={act.race_priority}")

        asyncio.run(run())

    def test_raw_calendar_fields(self):
        """Dump raw JSON fields to understand TR API schema for races/phases."""
        client = _make_tr_client()

        async def run():
            raw = await client._get_raw_calendar("2026-05-22", "2026-06-10")
            assert isinstance(raw, list)
            print(f"\n  Raw calendar entries: {len(raw)}")

            all_keys: set[str] = set()
            for entry in raw:
                if isinstance(entry, dict):
                    all_keys.update(entry.keys())
            print(f"  All fields: {sorted(all_keys)}")

            for i, entry in enumerate(raw[:3]):
                print(f"\n  --- Entry {i} ---")
                print(f"  {json.dumps(entry, indent=4, default=str)}")

        asyncio.run(run())

    def test_raw_calendar_race_entries(self):
        """Find entries around June 3 to see how races look in raw JSON."""
        client = _make_tr_client()

        async def run():
            raw = await client._get_raw_calendar("2026-06-01", "2026-06-05")
            assert isinstance(raw, list)
            print(f"\n  Entries around race day (Jun 1-5): {len(raw)}")
            for entry in raw:
                if isinstance(entry, dict):
                    print(f"\n  {json.dumps(entry, indent=4, default=str)}")

        asyncio.run(run())

    def test_training_plan_endpoint(self):
        """Check what the training plan endpoint returns."""
        client = _make_tr_client()

        async def run():
            plan = await client.get_training_plan()
            print(f"\n  Training plan response: {json.dumps(plan, indent=2, default=str)}")

        asyncio.run(run())

    def test_calendar_has_race_on_june_3(self):
        """Verify the C race on June 3 is detectable."""
        client = _make_tr_client()

        async def run():
            activities = await client.get_calendar_activities("2026-06-03", "2026-06-03")
            races = [a for a in activities if a.is_race]
            print(f"\n  June 3 activities: {len(activities)}, races: {len(races)}")
            for act in activities:
                print(f"    {act.date} | name={act.workout_name} | type={act.activity_type} | race_priority={act.race_priority} | notes={act.notes[:50] if act.notes else ''}")
            if not races:
                print("  ⚠ No races detected — check raw fields above for race indicator")

        asyncio.run(run())


@skip_no_intervals
class TestIntervalsICUAPI:
    """Live read-only tests against Intervals.icu."""

    def test_fetch_activities(self):
        from intervals_mcp_server.api.client import make_intervals_request

        async def run():
            result = await make_intervals_request(
                url=f"/athlete/{os.getenv('ATHLETE_ID')}/activities",
                params={"oldest": "2026-05-01", "newest": "2026-05-22", "limit": 10},
            )
            assert isinstance(result, list)
            print(f"\n  Got {len(result)} activities")
            for act in result[:3]:
                if isinstance(act, dict):
                    print(f"    {act.get('start_date_local', '')[:10]} | {act.get('name')} | load={act.get('icu_training_load')}")

        asyncio.run(run())

    @pytest.mark.xfail(reason="httpx event loop cleanup race in sequential asyncio.run() calls")
    def test_fetch_wellness(self):
        from intervals_mcp_server.api.client import make_intervals_request

        async def run():
            result = await make_intervals_request(
                url=f"/athlete/{os.getenv('ATHLETE_ID')}/wellness",
                params={"oldest": "2026-05-15", "newest": "2026-05-22"},
            )
            assert isinstance(result, list)
            print(f"\n  Got {len(result)} wellness entries")
            if result and isinstance(result[0], dict):
                print(f"  Sample keys: {sorted(result[0].keys())}")

        asyncio.run(run())

    def test_fetch_events(self):
        from intervals_mcp_server.api.client import make_intervals_request

        async def run():
            result = await make_intervals_request(
                url=f"/athlete/{os.getenv('ATHLETE_ID')}/events",
                params={"oldest": "2026-05-22", "newest": "2026-06-10"},
            )
            assert isinstance(result, list)
            print(f"\n  Got {len(result)} events")
            for ev in result[:5]:
                if isinstance(ev, dict):
                    print(f"    {ev.get('start_date_local', '')[:10]} | {ev.get('name')} | cat={ev.get('category')} | type={ev.get('type')}")

        asyncio.run(run())
