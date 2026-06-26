import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_SNAPSHOT = {
    "readiness": {"verdict": "green", "score": 85},
    "patterns": [],
    "levels": {},
    "progression": {},
}

SAMPLE_ACTIVITY = {
    "id": "act1",
    "name": "Morning Ride",
    "type": "Ride",
}

SAMPLE_EVENTS = [
    {
        "id": "ev1",
        "category": "WORKOUT",
        "start_date_local": "2026-06-28T09:00:00",
        "name": "Threshold intervals",
    },
    {
        "id": "ev2",
        "category": "WORKOUT",
        "start_date_local": "2026-06-30T09:00:00",
        "name": "VO2max sets",
    },
    {
        "id": "ev3",
        "category": "NOTE",
        "start_date_local": "2026-06-27T00:00:00",
        "name": "Rest day",
    },
]


# --- coaching_state ---

@pytest.mark.asyncio
async def test_coaching_state_happy(monkeypatch):
    async def fake_snapshot(zone="threshold"):
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr(
        "intervals_mcp_server.services.coaching.get_coaching_snapshot", fake_snapshot
    )
    from intervals_mcp_server.services import coaching as svc
    result = await svc.coaching_state(zone="threshold")
    assert result == SAMPLE_SNAPSHOT
    assert result["readiness"]["verdict"] == "green"


@pytest.mark.asyncio
async def test_coaching_state_error_raises_service_error(monkeypatch):
    async def fake_snapshot(zone="threshold"):
        return {"error": "Coaching state unavailable (DIRECTEUR_URL not configured)."}

    monkeypatch.setattr(
        "intervals_mcp_server.services.coaching.get_coaching_snapshot", fake_snapshot
    )
    from intervals_mcp_server.services import coaching as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.coaching_state(zone="threshold")
    assert exc_info.value.status_code == 503
    assert "DIRECTEUR_URL" in exc_info.value.message


# --- dashboard ---

@pytest.mark.asyncio
async def test_dashboard_composite_shape(monkeypatch):
    async def fake_list_events(oldest=None, newest=None, athlete_id=None):
        return SAMPLE_EVENTS

    async def fake_list_activities(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [SAMPLE_ACTIVITY]

    async def fake_coaching_state(zone="threshold"):
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_events", fake_list_events)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_activities", fake_list_activities)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.coaching_state", fake_coaching_state)

    from intervals_mcp_server.services import coaching as svc
    result = await svc.dashboard()
    assert "next_workout" in result
    assert "latest_activity" in result
    assert "readiness" in result
    assert result["latest_activity"]["id"] == "act1"
    assert result["readiness"] == SAMPLE_SNAPSHOT["readiness"]


@pytest.mark.asyncio
async def test_dashboard_readiness_none_when_coaching_fails(monkeypatch):
    async def fake_list_events(oldest=None, newest=None, athlete_id=None):
        return []

    async def fake_list_activities(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return []

    async def fake_coaching_state(zone="threshold"):
        raise ServiceError(503, "directeur down")

    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_events", fake_list_events)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_activities", fake_list_activities)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.coaching_state", fake_coaching_state)

    from intervals_mcp_server.services import coaching as svc
    result = await svc.dashboard()
    assert result["readiness"] is None
    assert result["next_workout"] is None
    assert result["latest_activity"] is None


@pytest.mark.asyncio
async def test_dashboard_next_workout_picks_earliest_future(monkeypatch):
    events = [
        {
            "id": "past",
            "category": "WORKOUT",
            "start_date_local": "2026-06-20T09:00:00",
        },
        {
            "id": "future1",
            "category": "WORKOUT",
            "start_date_local": "2026-06-28T09:00:00",
        },
        {
            "id": "future2",
            "category": "WORKOUT",
            "start_date_local": "2026-06-30T09:00:00",
        },
        {
            "id": "note",
            "category": "NOTE",
            "start_date_local": "2026-06-27T00:00:00",
        },
    ]

    async def fake_list_events(oldest=None, newest=None, athlete_id=None):
        return events

    async def fake_list_activities(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return []

    async def fake_coaching_state(zone="threshold"):
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_events", fake_list_events)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_activities", fake_list_activities)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.coaching_state", fake_coaching_state)

    from intervals_mcp_server.services import coaching as svc
    result = await svc.dashboard()
    # earliest future WORKOUT — "future1" has the earlier date
    assert result["next_workout"]["id"] == "future1"


@pytest.mark.asyncio
async def test_dashboard_no_workout_events_returns_none(monkeypatch):
    async def fake_list_events(oldest=None, newest=None, athlete_id=None):
        return [{"id": "n1", "category": "NOTE", "start_date_local": "2026-06-28T00:00:00"}]

    async def fake_list_activities(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return []

    async def fake_coaching_state(zone="threshold"):
        return SAMPLE_SNAPSHOT

    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_events", fake_list_events)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_activities", fake_list_activities)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.coaching_state", fake_coaching_state)

    from intervals_mcp_server.services import coaching as svc
    result = await svc.dashboard()
    assert result["next_workout"] is None


@pytest.mark.asyncio
async def test_dashboard_readiness_whole_dict_when_no_subkey(monkeypatch):
    """If snapshot has no 'readiness' sub-key, return whole dict."""
    snapshot_no_readiness_key = {"levels": {}, "patterns": [], "progression": {}}

    async def fake_list_events(oldest=None, newest=None, athlete_id=None):
        return []

    async def fake_list_activities(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return []

    async def fake_coaching_state(zone="threshold"):
        return snapshot_no_readiness_key

    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_events", fake_list_events)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.list_activities", fake_list_activities)
    monkeypatch.setattr("intervals_mcp_server.services.coaching.coaching_state", fake_coaching_state)

    from intervals_mcp_server.services import coaching as svc
    result = await svc.dashboard()
    assert result["readiness"] == snapshot_no_readiness_key
