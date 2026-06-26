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
