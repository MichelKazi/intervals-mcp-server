"""TrainerRoad sync MCP tools for Intervals.icu.

Provides tools to fetch planned workouts from TrainerRoad and sync them
to the Intervals.icu calendar. Auth uses username/password (preferred)
or a manual cookie.
"""

import logging
from datetime import datetime, timedelta

import httpx

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.trainerroad.client import TRAuthError, TRClient
from intervals_mcp_server.trainerroad.converter import (
    build_structure_text,
    format_tr_calendar_compact,
    workout_to_intervals_event,
    _format_duration,
    _strip_html,
)
from intervals_mcp_server.trainerroad.models import TRWorkoutDetails
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


async def _fetch_existing_events(
    athlete_id: str,
    start_date: str,
    end_date: str,
    api_key: str | None,
) -> dict[str, set[str]]:
    """Fetch existing Intervals.icu events and return {date: {name_lower}} for dedup."""
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id}/events",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date},
    )
    existing: dict[str, set[str]] = {}
    if isinstance(result, list):
        for event in result:
            if not isinstance(event, dict):
                continue
            date = event.get("start_date_local", "")
            if "T" in date:
                date = date.split("T")[0]
            name = (event.get("name") or "").lower()
            existing.setdefault(date, set()).add(name)
    return existing


async def _resolve_workout_details(
    client: TRClient,
    activities: list,
) -> dict[str, TRWorkoutDetails]:
    """For each planned cycling activity, find the workout details by searching TR's library.

    Calendar entries don't include a workout ID directly — the workout name is used
    to search TR's library, then we fetch the full details for the match.
    """
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


@mcp.tool()
async def sync_trainerroad_calendar(
    start_date: str | None = None,
    end_date: str | None = None,
    athlete_id: str | None = None,
    api_key: str | None = None,
    dry_run: bool = False,
) -> str:
    """Sync planned workouts from TrainerRoad to the Intervals.icu calendar.

    Fetches upcoming workouts from the TR calendar, looks up each workout's
    interval structure, and creates them as events on your Intervals.icu calendar.
    Skips workouts that already exist on the same date with the same name.
    Uses TRAINERROAD_USERNAME/PASSWORD for auth (auto-login, no manual cookie needed).

    Args:
        start_date: Start date in YYYY-MM-DD (defaults to today)
        end_date: End date in YYYY-MM-DD (defaults to 6 months out to capture full plans)
        athlete_id: Intervals.icu athlete ID (optional, uses env var)
        api_key: Intervals.icu API key (optional, uses env var)
        dry_run: If True, show what would be synced without creating events
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

    planned = [a for a in activities if not a.is_completed and a.workout_name]
    if not planned:
        return f"No planned workouts found on TrainerRoad ({start} to {end})."

    existing = await _fetch_existing_events(athlete_id_to_use, start, end, api_key)
    workout_details = await _resolve_workout_details(client, planned)

    synced = 0
    skipped = 0
    failed = 0
    lines = [f"TrainerRoad Sync ({member.username}): {start} to {end}"]

    for act in planned:
        date_names = existing.get(act.date, set())
        name = act.workout_name or ""
        if name.lower() in date_names:
            skipped += 1
            lines.append(f"  = {act.date} {name} (already exists)")
            continue

        wd = workout_details.get(act.activity_id)

        if dry_run:
            if wd:
                structure = build_structure_text(wd.intervals)
                step_count = structure.count("\n") + 1 if structure else 0
                lines.append(f"  > {act.date} {wd.name} (TSS:{wd.tss:.0f}, {step_count} steps)")
            else:
                dur = _format_duration(act.duration_secs or 0)
                lines.append(f"  > {act.date} {name} ({dur}, no interval data)")
            synced += 1
            continue

        if wd:
            event_payload = workout_to_intervals_event(wd, act.date)
        else:
            event_payload = {
                "start_date_local": f"{act.date}T00:00:00",
                "name": name,
                "type": "Ride",
                "category": "WORKOUT",
                "moving_time": act.duration_secs or 0,
                "icu_training_load": act.tss or 0,
            }

        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/events",
            api_key=api_key,
            method="POST",
            data=event_payload,
        )

        if isinstance(result, dict) and "error" in result:
            failed += 1
            lines.append(f"  x {act.date} {name} ({result.get('message', 'unknown error')})")
        else:
            synced += 1
            lines.append(f"  + {act.date} {name}")

    action = "Would sync" if dry_run else "Synced"
    lines.append(f"\n{action}: {synced} | Skipped: {skipped} | Failed: {failed}")
    return "\n".join(lines)


@mcp.tool()
async def get_trainerroad_workouts(
    start_date: str | None = None,
    end_date: str | None = None,
    include_details: bool = False,
) -> str:
    """Fetch upcoming planned workouts from your TrainerRoad calendar (read-only).

    Returns a compact list of planned workouts with dates, names, TSS, and duration.
    Does not modify anything on Intervals.icu.

    Args:
        start_date: Start date in YYYY-MM-DD (defaults to today)
        end_date: End date in YYYY-MM-DD (defaults to 6 months out)
        include_details: If True, also fetches interval structure for each workout
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

    try:
        activities = await client.get_calendar_activities(start, end)
    except httpx.HTTPStatusError as e:
        return f"Error fetching TR calendar: {e}"

    details_map: dict[str, TRWorkoutDetails] | None = None
    if include_details:
        planned = [a for a in activities if not a.is_completed and a.workout_name]
        details_map = await _resolve_workout_details(client, planned)

    return format_tr_calendar_compact(activities, details_map)


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
