"""
Events/calendar service: thin async wrappers around the Intervals.icu API.

Used by both the JSON routes (web API) and may be reused by other callers.
Raises ServiceError on upstream failure; callers get clean typed errors.
"""

from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.utils.dates import get_default_end_date, get_default_future_end_date
from intervals_mcp_server.utils.validation import resolve_athlete_id


def _check_error(result: Any) -> None:
    """Raise ServiceError if result is an error dict."""
    if isinstance(result, dict) and result.get("error"):
        status = result.get("status_code", 502)
        message = result.get("message", "Upstream error")
        raise ServiceError(status_code=int(status), message=str(message))


async def list_events(
    oldest: str | None = None,
    newest: str | None = None,
    athlete_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return a list of event dicts for an athlete.

    Args:
        oldest: Start date in YYYY-MM-DD format (or None for today).
        newest: End date in YYYY-MM-DD format (or None for 30 days ahead).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events",
        params={
            "oldest": oldest or get_default_end_date(),
            "newest": newest or get_default_future_end_date(),
        },
    )
    _check_error(result)

    if isinstance(result, list):
        return result
    return []


async def get_event(event_id: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Return a single event dict.

    Args:
        event_id: Intervals.icu event ID.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    # intervals.icu single-event GET is /events/{id} (plural). /event/{id} 404s.
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for event {event_id}")


async def create_event(payload: dict[str, Any], athlete_id: str | None = None) -> dict[str, Any]:
    """Create a new event.

    If payload contains 'start_date' (YYYY-MM-DD) but not 'start_date_local',
    builds 'start_date_local' automatically.

    Args:
        payload: Event fields to send to the API.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    body = dict(payload)
    if "start_date" in body and "start_date_local" not in body:
        body["start_date_local"] = f"{body['start_date']}T00:00:00"

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events",
        method="POST",
        data=body,
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message="Unexpected response from event create")


async def update_event(
    event_id: str, payload: dict[str, Any], athlete_id: str | None = None
) -> dict[str, Any]:
    """Update an existing event.

    Args:
        event_id: Intervals.icu event ID.
        payload: Fields to update.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
        method="PUT",
        data=payload,
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for event update {event_id}")


async def delete_event(event_id: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Delete an event.

    Args:
        event_id: Intervals.icu event ID.
        athlete_id: Override athlete ID (uses config default if None).

    Returns:
        {"deleted": event_id}

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
        method="DELETE",
    )
    _check_error(result)

    return {"deleted": event_id}


async def move_event(
    event_id: str, start_date: str, athlete_id: str | None = None
) -> dict[str, Any]:
    """Reschedule an event to a new date (calendar drag-and-drop).

    Fetches the existing event then PUTs with the new start_date_local.

    Args:
        event_id: Intervals.icu event ID.
        start_date: New date in YYYY-MM-DD format.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    existing = await get_event(event_id, athlete_id=athlete_id)

    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    update_payload = dict(existing)
    update_payload["start_date_local"] = f"{start_date}T00:00:00"

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
        method="PUT",
        data=update_payload,
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for event move {event_id}")


async def pair_activity(
    event_id: str, activity_id: str | int, athlete_id: str | None = None
) -> dict[str, Any]:
    """Pair a completed activity to a planned event.

    Fetches the existing event then PUTs it back with paired_activity_id set,
    preserving all other fields (like move_event does).

    Args:
        event_id: Intervals.icu event ID.
        activity_id: Intervals.icu activity ID to link.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    existing = await get_event(event_id, athlete_id=athlete_id)

    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    update_payload = dict(existing)
    update_payload["paired_activity_id"] = activity_id

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
        method="PUT",
        data=update_payload,
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for event pair {event_id}")


async def unpair_activity(event_id: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Unlink the paired activity from an event.

    Fetches the existing event then PUTs it back with paired_activity_id set to
    None, preserving all other fields.

    Args:
        event_id: Intervals.icu event ID.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    existing = await get_event(event_id, athlete_id=athlete_id)

    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    update_payload = dict(existing)
    update_payload["paired_activity_id"] = None

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}",
        method="PUT",
        data=update_payload,
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for event unpair {event_id}")


def _compliance_verdict(load_pct: int | None) -> str:
    """Map a load percentage to a compliance verdict band."""
    if load_pct is None:
        return "unknown"
    if 90 <= load_pct <= 110:
        return "on_target"
    if load_pct < 90:
        return "under"
    return "over"


async def get_compliance(event_id: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Compute planned-vs-actual compliance for an event.

    Reads the event's planned load/duration, then (if paired) the linked
    activity's actual load/duration/intensity, and derives compliance
    percentages and a verdict.

    Tolerates a missing or inaccessible paired activity (e.g. Strava-restricted
    or deleted): actual is returned as None and the verdict is "unknown" rather
    than raising.

    Args:
        event_id: Intervals.icu event ID.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: If the event itself cannot be fetched.
    """
    from intervals_mcp_server.services.activities import get_activity

    event = await get_event(event_id, athlete_id=athlete_id)
    paired_id = event.get("paired_activity_id")

    planned_load = event.get("icu_training_load")
    if planned_load is None:
        planned_load = event.get("load_target")
    planned_duration = event.get("moving_time")

    actual: dict[str, Any] | None = None
    if paired_id:
        try:
            activity = await get_activity(str(paired_id))
            actual = {
                "load": activity.get("icu_training_load"),
                "duration": activity.get("moving_time"),
                "intensity": activity.get("icu_intensity"),
            }
        except Exception:
            # Strava-restricted, deleted, or otherwise inaccessible — do not 500.
            actual = None

    load_pct: int | None = None
    duration_pct: int | None = None
    if actual is not None:
        actual_load = actual.get("load")
        if actual_load is not None and planned_load:
            load_pct = round(actual_load / planned_load * 100)
        actual_duration = actual.get("duration")
        if actual_duration is not None and planned_duration:
            duration_pct = round(actual_duration / planned_duration * 100)

    return {
        "event_id": event_id,
        "paired_activity_id": paired_id,
        "paired": paired_id is not None,
        "planned": {"load": planned_load, "duration": planned_duration},
        "actual": actual,
        "compliance": {
            "load_pct": load_pct,
            "duration_pct": duration_pct,
            "verdict": _compliance_verdict(load_pct),
        },
    }


_TIME_OFF_CATEGORIES = {"HOLIDAY", "SICK", "INJURED"}

_TIME_OFF_DEFAULTS = {
    "HOLIDAY": "Time off",
    "SICK": "Sick",
    "INJURED": "Injured",
}

# Sport-type compatibility for auto-linking.
# Maps a planned event type to the set of activity types that can pair with it.
_COMPATIBLE_SPORT_TYPES: dict[str, set[str]] = {
    "Ride": {"Ride", "VirtualRide", "EBikeRide"},
    "Run": {"Run", "VirtualRun", "TrailRun"},
    "Swim": {"Swim"},
    "Walk": {"Walk", "Hike"},
    "Row": {"Rowing"},
}


async def create_time_off(
    start_date: str,
    end_date: str | None = None,
    kind: str = "HOLIDAY",
    note: str | None = None,
    athlete_id: str | None = None,
) -> dict[str, Any]:
    """Create a time-off / unavailability block on the calendar.

    Args:
        start_date: Start date in YYYY-MM-DD format.
        end_date: End date for multi-day blocks (YYYY-MM-DD). None for single day.
        kind: Category — HOLIDAY, SICK, or INJURED.
        note: Optional event name override.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: If kind is invalid or the upstream API fails.
    """
    kind = kind.upper()
    if kind not in _TIME_OFF_CATEGORIES:
        raise ServiceError(
            status_code=400,
            message=f"Invalid kind '{kind}'. Must be one of: HOLIDAY, SICK, INJURED",
        )

    body: dict[str, Any] = {
        "category": kind,
        "name": note or _TIME_OFF_DEFAULTS[kind],
        "start_date_local": f"{start_date}T00:00:00",
    }
    if end_date:
        body["end_date_local"] = f"{end_date}T00:00:00"

    return await create_event(body, athlete_id=athlete_id)


async def list_time_off(
    oldest: str | None = None,
    newest: str | None = None,
    athlete_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return time-off events (HOLIDAY, SICK, INJURED) within a date range.

    Args:
        oldest: Start date in YYYY-MM-DD format (or None for today).
        newest: End date in YYYY-MM-DD format (or None for 30 days ahead).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    events = await list_events(oldest=oldest, newest=newest, athlete_id=athlete_id)
    return [e for e in events if e.get("category") in _TIME_OFF_CATEGORIES]


def _sports_compatible(event_type: str | None, activity_type: str | None) -> bool:
    """Return True if an activity type is compatible with a planned event type."""
    if not event_type or not activity_type:
        return True
    compatible = _COMPATIBLE_SPORT_TYPES.get(event_type)
    if compatible is None:
        # Unknown event type — match on exact equality only.
        return event_type == activity_type
    return activity_type in compatible


async def auto_link_day(date: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Pair completed activities to unpaired planned workouts for a single date.

    Fetches WORKOUT events with no paired_activity_id and accessible activities
    for the given date, then matches each unpaired workout to a compatible
    activity (same/compatible sport type). Already-paired workouts are skipped.
    Idempotent.

    Args:
        date: Date in YYYY-MM-DD format.
        athlete_id: Override athlete ID (uses config default if None).

    Returns:
        dict with keys: date, linked, unmatched_workouts, unmatched_activities.

    Raises:
        ServiceError: On upstream API failure.
    """
    from intervals_mcp_server.services.activities import list_activities

    day_events = await list_events(oldest=date, newest=date, athlete_id=athlete_id)
    unpaired_workouts = [
        e for e in day_events
        if e.get("category") == "WORKOUT" and not e.get("paired_activity_id")
    ]

    day_activities = await list_activities(
        oldest=date, newest=date, limit=50, include_unnamed=True, athlete_id=athlete_id
    )

    linked: list[dict[str, Any]] = []
    remaining_activities = list(day_activities)

    for workout in unpaired_workouts:
        match = next(
            (
                a for a in remaining_activities
                if _sports_compatible(workout.get("type"), a.get("type"))
            ),
            None,
        )
        if match is None:
            continue
        remaining_activities.remove(match)
        await pair_activity(str(workout["id"]), match["id"], athlete_id=athlete_id)
        linked.append(
            {
                "event_id": workout["id"],
                "activity_id": match["id"],
                "name": workout.get("name", ""),
            }
        )

    return {
        "date": date,
        "linked": linked,
        "unmatched_workouts": [
            {"event_id": w["id"], "name": w.get("name", "")}
            for w in unpaired_workouts
            if not any(lk["event_id"] == w["id"] for lk in linked)
        ],
        "unmatched_activities": [
            {"activity_id": a["id"], "name": a.get("name", "")}
            for a in remaining_activities
        ],
    }


async def auto_link_range(
    oldest: str,
    newest: str,
    athlete_id: str | None = None,
) -> dict[str, Any]:
    """Run auto_link_day across each day in a date range and aggregate results.

    Caps the range at 60 days.

    Args:
        oldest: Start date in YYYY-MM-DD format.
        newest: End date in YYYY-MM-DD format.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: If the date range exceeds 60 days or upstream fails.
    """
    from datetime import date as _date, timedelta

    start = _date.fromisoformat(oldest)
    end = _date.fromisoformat(newest)
    if (end - start).days > 60:
        raise ServiceError(status_code=400, message="Date range exceeds 60-day limit")

    all_linked: list[dict[str, Any]] = []
    all_unmatched_workouts: list[dict[str, Any]] = []
    all_unmatched_activities: list[dict[str, Any]] = []

    current = start
    while current <= end:
        day_str = current.isoformat()
        result = await auto_link_day(day_str, athlete_id=athlete_id)
        all_linked.extend(result["linked"])
        all_unmatched_workouts.extend(result["unmatched_workouts"])
        all_unmatched_activities.extend(result["unmatched_activities"])
        current += timedelta(days=1)

    return {
        "oldest": oldest,
        "newest": newest,
        "linked": all_linked,
        "unmatched_workouts": all_unmatched_workouts,
        "unmatched_activities": all_unmatched_activities,
    }


async def mark_done(event_id: str, athlete_id: str | None = None) -> dict[str, Any]:
    """Mark an event as done.

    Args:
        event_id: Intervals.icu event ID.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}/mark-done",
        method="POST",
    )
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for mark-done {event_id}")
