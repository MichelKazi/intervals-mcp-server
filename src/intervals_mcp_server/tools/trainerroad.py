"""TrainerRoad sync MCP tools for Intervals.icu.

Provides tools to fetch planned workouts from TrainerRoad and sync them
to the Intervals.icu calendar. Auth uses username/password (preferred)
or a manual cookie.

Sync is idempotent: creates new events, updates changed ones, and deletes
stale TR-tagged events that no longer appear in the TR plan.
"""

import logging
from datetime import datetime, timedelta
from typing import Any

import httpx

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.trainerroad.client import TRAuthError, TRClient
from intervals_mcp_server.trainerroad.converter import (
    build_structure_text,
    format_tr_calendar_compact,
    is_tr_synced_event,
    plain_event_payload,
    race_event_payload,
    strength_event_payload,
    workout_to_intervals_event,
    _format_duration,
    _strip_html,
)
from intervals_mcp_server.trainerroad.models import (
    TR_ACTIVITY_TYPE_REST,
    TRWorkoutDetails,
)
from intervals_mcp_server.utils.validation import resolve_athlete_id

logger = logging.getLogger("intervals_icu_mcp_server.trainerroad")

config = get_config()

_TR_NOT_CONFIGURED = (
    "TrainerRoad is not configured. Set TRAINERROAD_USERNAME and TRAINERROAD_PASSWORD "
    "environment variables (preferred), or TRAINERROAD_COOKIE as a fallback."
)


def _parse_member_id() -> int | None:
    """Parse TRAINERROAD_MEMBER_ID from config, returning None if unset."""
    raw = config.trainerroad_member_id
    if raw and raw.isdigit():
        return int(raw)
    return None


def _get_tr_client(cookie_override: str | None = None) -> TRClient | None:
    """Create a TRClient from config, returning None if nothing is configured."""
    member_id = _parse_member_id()
    if config.trainerroad_username and config.trainerroad_password:
        return TRClient(
            username=config.trainerroad_username,
            password=config.trainerroad_password,
            member_id=member_id,
        )
    effective_cookie = cookie_override or config.trainerroad_cookie
    if effective_cookie:
        return TRClient(cookie=effective_cookie, member_id=member_id)
    return None


def _default_end_date() -> str:
    """Default end date: 6 months from today to capture full training plans."""
    return (datetime.now() + timedelta(days=180)).strftime("%Y-%m-%d")


def _infer_plan_info(activities: list) -> dict | None:
    """No-op fallback — plan info now comes from get_training_plan()."""
    return None


def _event_date(event: dict) -> str:
    """Extract YYYY-MM-DD from an Intervals.icu event."""
    date = event.get("start_date_local", "")
    if "T" in date:
        date = date.split("T")[0]
    return date


async def _fetch_existing_events(
    athlete_id: str,
    start_date: str,
    end_date: str,
    api_key: str | None,
) -> list[dict[str, Any]]:
    """Fetch all Intervals.icu events in the date range."""
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/events",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date},
    )
    if isinstance(result, list):
        return [e for e in result if isinstance(e, dict)]
    return []


def _index_tr_events(events: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    """Index TR-synced events by date. Only includes events with the [TR Sync] marker."""
    by_date: dict[str, list[dict[str, Any]]] = {}
    for event in events:
        if is_tr_synced_event(event):
            date = _event_date(event)
            by_date.setdefault(date, []).append(event)
    return by_date


async def _resolve_workout_details(
    client: TRClient,
    activities: list,
) -> dict[str, TRWorkoutDetails]:
    """For each planned activity, find workout details by searching TR's library."""
    details: dict[str, TRWorkoutDetails] = {}
    seen_names: dict[str, TRWorkoutDetails | None] = {}

    for act in activities:
        if act.is_completed or not act.workout_name:
            continue
        name = act.workout_name
        if name in seen_names:
            if seen_names[name] is not None:
                details[act.activity_id] = seen_names[name]  # type: ignore[assignment]
            continue

        try:
            wd = await client.find_workout_by_name(name)
            seen_names[name] = wd
            if wd:
                details[act.activity_id] = wd
        except httpx.HTTPStatusError:
            seen_names[name] = None

    return details


def _needs_update(existing: dict[str, Any], new_payload: dict[str, Any]) -> bool:
    """Check if an existing event differs from the new payload."""
    if (existing.get("name") or "") != (new_payload.get("name") or ""):
        return True
    if (existing.get("description") or "") != (new_payload.get("description") or ""):
        return True
    if existing.get("moving_time") != new_payload.get("moving_time"):
        return True
    if existing.get("icu_training_load") != new_payload.get("icu_training_load"):
        return True
    if existing.get("category") != new_payload.get("category"):
        return True
    if bool(existing.get("race")) != bool(new_payload.get("race")):
        return True
    if existing.get("workout_doc") != new_payload.get("workout_doc"):
        return True
    return False


@mcp.tool()
async def sync_trainerroad_calendar(
    start_date: str | None = None,
    end_date: str | None = None,
    athlete_id: str | None = None,
    api_key: str | None = None,
    dry_run: bool = False,
) -> str:
    """Sync planned workouts from TrainerRoad to the Intervals.icu calendar.

    This is a full mirror sync that keeps your Intervals.icu calendar in sync
    with your TrainerRoad plan:
    - Creates new events for planned workouts not yet on the calendar
    - Updates existing TR-synced events if the workout changed (name, structure, TSS)
    - Deletes TR-synced events that no longer appear in the TR plan

    Only touches events tagged with [TR Sync] — your manually-created events are safe.
    Uses TRAINERROAD_USERNAME/PASSWORD for auth (auto-login, no manual cookie needed).

    Args:
        start_date: Start date in YYYY-MM-DD (defaults to today)
        end_date: End date in YYYY-MM-DD (defaults to 6 months out to capture full plans)
        athlete_id: Intervals.icu athlete ID (optional, uses env var)
        api_key: Intervals.icu API key (optional, uses env var)
        dry_run: If True, show what would happen without making changes
    """
    client = _get_tr_client()
    if not client:
        return _TR_NOT_CONFIGURED

    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    today = datetime.now().strftime("%Y-%m-%d")
    start = start_date or today
    end = end_date or _default_end_date()

    try:
        member = await client.validate_and_get_member()
    except (TRAuthError, httpx.HTTPStatusError) as e:
        return f"TrainerRoad auth failed: {e}"

    try:
        activities = await client.get_calendar_activities(start, end)
    except httpx.HTTPStatusError as e:
        return f"Error fetching TR calendar: {e}"

    planned = [
        a for a in activities
        if not a.is_completed and not a.is_rest_day and (a.workout_name or a.is_race)
    ]

    try:
        all_events = await _fetch_existing_events(athlete_id_to_use, start, end, api_key)
    except Exception as e:
        logger.error("Failed to fetch Intervals.icu events: %s", e)
        compact = format_tr_calendar_compact(activities)
        return (
            f"⚠ Could not reach Intervals.icu ({e}). Showing TR workouts read-only:\n\n"
            + compact
        )

    tr_events_by_date = _index_tr_events(all_events)

    non_strength = [a for a in planned if not a.is_strength]
    workout_details = await _resolve_workout_details(client, non_strength)

    created = 0
    updated = 0
    deleted = 0
    unchanged = 0
    failed = 0
    now = datetime.now()
    lines = [f"TrainerRoad Sync ({member.username}): {start} to {end} (today is {now.strftime('%A %Y-%m-%d %H:%M %Z').strip()})"]

    # Show plan phase context
    plan_info = _infer_plan_info(activities)
    if plan_info:
        phase = plan_info.get("PhaseName", "")
        week = plan_info.get("Week", "")
        plan_name = plan_info.get("PlanName", "")
        phase_parts = []
        if plan_name:
            phase_parts.append(plan_name)
        if phase:
            phase_parts.append(f"Phase: {phase}")
        if week:
            phase_parts.append(f"Week {week}")
        if phase_parts:
            lines.append(f"  Plan: {' | '.join(phase_parts)}")

    # Show races prominently
    races = [a for a in planned if a.is_race]
    if races:
        lines.append("  Upcoming Races:")
        for r in races:
            priority_label = {1: "C", 2: "B", 3: "A"}.get(r.race_priority, "?")
            name = r.workout_name or "Race"
            lines.append(f"    {r.date} — [{priority_label} Race] {name}")
        lines.append("")

    claimed_event_ids: set[str] = set()

    for act in planned:
        name = act.workout_name or ""
        wd = workout_details.get(act.activity_id)

        if act.is_race and not wd:
            new_payload = race_event_payload(act)
        elif act.is_race and wd:
            new_payload = workout_to_intervals_event(wd, act.date, activity=act)
        elif act.is_strength:
            new_payload = strength_event_payload(act)
        elif wd:
            new_payload = workout_to_intervals_event(wd, act.date, activity=act)
        else:
            new_payload = plain_event_payload(
                name, act.date, act.duration_secs or 0, act.tss or 0, activity=act,
            )

        existing_on_date = tr_events_by_date.get(act.date, [])
        match = None
        for ev in existing_on_date:
            ev_id = ev.get("id", "")
            if ev_id in claimed_event_ids:
                continue
            if (ev.get("name") or "").lower() == name.lower():
                match = ev
                break
        if match is None and existing_on_date:
            for ev in existing_on_date:
                if ev.get("id", "") not in claimed_event_ids:
                    match = ev
                    break

        if match:
            match_id = match.get("id", "")
            claimed_event_ids.add(match_id)

            if not _needs_update(match, new_payload):
                unchanged += 1
                lines.append(f"  = {act.date} {name} (unchanged)")
                continue

            if dry_run:
                updated += 1
                lines.append(f"  ~ {act.date} {name} (would update)")
                continue

            try:
                result = await make_intervals_request(
                    url=f"/athlete/{athlete_id_to_use}/events/{match_id}",
                    api_key=api_key,
                    method="PUT",
                    data=new_payload,
                )
                if isinstance(result, dict) and "error" in result:
                    failed += 1
                    lines.append(f"  x {act.date} {name} (update failed: {result.get('message', '')})")
                else:
                    updated += 1
                    lines.append(f"  ~ {act.date} {name} (updated)")
            except Exception as e:
                failed += 1
                lines.append(f"  x {act.date} {name} (update error: {e})")
        else:
            if dry_run:
                if wd:
                    structure = build_structure_text(wd.intervals)
                    step_count = structure.count("\n") + 1 if structure else 0
                    lines.append(f"  + {act.date} {wd.name} (TSS:{wd.tss:.0f}, {step_count} steps)")
                else:
                    dur = _format_duration(act.duration_secs or 0)
                    lines.append(f"  + {act.date} {name} ({dur}, no interval data)")
                created += 1
                continue

            try:
                result = await make_intervals_request(
                    url=f"/athlete/{athlete_id_to_use}/events",
                    api_key=api_key,
                    method="POST",
                    data=new_payload,
                )
                if isinstance(result, dict) and "error" in result:
                    failed += 1
                    lines.append(f"  x {act.date} {name} (create failed: {result.get('message', '')})")
                else:
                    created += 1
                    lines.append(f"  + {act.date} {name}")
            except Exception as e:
                failed += 1
                lines.append(f"  x {act.date} {name} (create error: {e})")

    stale_events = []
    for date_events in tr_events_by_date.values():
        for ev in date_events:
            if ev.get("id", "") not in claimed_event_ids:
                stale_events.append(ev)

    for ev in stale_events:
        ev_id = ev.get("id", "")
        ev_name = ev.get("name", "?")
        ev_date = _event_date(ev)

        if dry_run:
            deleted += 1
            lines.append(f"  - {ev_date} {ev_name} (would delete, no longer in TR plan)")
            continue

        try:
            result = await make_intervals_request(
                url=f"/athlete/{athlete_id_to_use}/events/{ev_id}",
                api_key=api_key,
                method="DELETE",
            )
            if isinstance(result, dict) and "error" in result:
                failed += 1
                lines.append(f"  x {ev_date} {ev_name} (delete failed: {result.get('message', '')})")
            else:
                deleted += 1
                lines.append(f"  - {ev_date} {ev_name} (removed from plan)")
        except Exception as e:
            failed += 1
            lines.append(f"  x {ev_date} {ev_name} (delete error: {e})")

    verb = "Would" if dry_run else "Done"
    lines.append(f"\n{verb}: +{created} ~{updated} -{deleted} ={unchanged} x{failed}")
    if failed and not dry_run:
        lines.append("⚠ Some Intervals.icu operations failed — see 'x' lines above.")
    return "\n".join(lines)


@mcp.tool()
async def get_trainerroad_workouts(
    start_date: str | None = None,
    end_date: str | None = None,
    include_details: bool = False,
    debug_raw: bool = False,
) -> str:
    """Fetch upcoming planned workouts and races from your TrainerRoad calendar (read-only).

    Returns current training phase (Build/Base/Specialty + week number), upcoming races
    with priority (A/B/C), and planned workouts with dates, names, TSS, and duration.
    Includes current date/time as a time anchor.

    Args:
        start_date: Start date in YYYY-MM-DD (defaults to today)
        end_date: End date in YYYY-MM-DD (defaults to 6 months out)
        include_details: If True, also fetches interval structure for each workout
        debug_raw: If True, returns raw JSON from TR API for diagnosing field mapping
    """
    client = _get_tr_client()
    if not client:
        return _TR_NOT_CONFIGURED

    today = datetime.now().strftime("%Y-%m-%d")
    start = start_date or today
    end = end_date or _default_end_date()

    try:
        await client.validate_and_get_member()
    except (TRAuthError, httpx.HTTPStatusError) as e:
        return f"TrainerRoad auth failed: {e}"

    plan_info: dict | None = None
    try:
        plan_info = await client.get_training_plan()
    except (httpx.HTTPStatusError, Exception):
        pass

    try:
        activities = await client.get_calendar_activities(start, end)
    except httpx.HTTPStatusError as e:
        return f"Error fetching TR calendar: {e}"

    if debug_raw:
        import json
        raw_data = await client._get_raw_calendar(start, end)
        return json.dumps(raw_data[:5], indent=2, default=str)

    # Infer plan phase from activity metadata if API endpoint didn't return it
    if not plan_info and activities:
        plan_info = _infer_plan_info(activities)

    details_map: dict[str, TRWorkoutDetails] | None = None
    if include_details:
        planned = [
            a for a in activities
            if not a.is_completed and a.workout_name and not a.is_rest_day
        ]
        details_map = await _resolve_workout_details(client, planned)

    return format_tr_calendar_compact(activities, details_map, plan_info=plan_info)


@mcp.tool()
async def get_trainerroad_workout_details(
    workout_name: str,
) -> str:
    """Get full details and interval structure for a TrainerRoad workout by name.

    Searches the TR workout library for the given name, then returns the workout's
    description, TSS, duration, and full interval breakdown with power targets.

    Args:
        workout_name: The TrainerRoad workout name (e.g. "Autore", "King")
    """
    client = _get_tr_client()
    if not client:
        return _TR_NOT_CONFIGURED

    try:
        await client.validate_and_get_member()
    except (TRAuthError, httpx.HTTPStatusError) as e:
        return f"TrainerRoad auth failed: {e}"

    try:
        workout = await client.find_workout_by_name(workout_name)
    except httpx.HTTPStatusError as e:
        return f"Error searching for workout: {e}"

    if not workout:
        return f"No workout found matching '{workout_name}' in the TrainerRoad library."

    lines = [f"Workout: {workout.name}"]
    lines.append(f"  Sport: {workout.sport_type}")
    lines.append(f"  Duration: {_format_duration(workout.duration_secs)}")
    if workout.tss:
        lines.append(f"  TSS: {workout.tss:.0f}")

    desc = _strip_html(workout.description)
    if desc:
        lines.append(f"  Description: {desc[:200]}")

    structure = build_structure_text(workout.intervals)
    if structure:
        lines.append(f"  Structure ({len(workout.intervals)} intervals):")
        for step_line in structure.split("\n"):
            lines.append(f"    {step_line}")

    return "\n".join(lines)
