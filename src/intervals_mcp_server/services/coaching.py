"""
Coaching service: coaching state, dashboard composite.

Wraps directeur_client.get_coaching_snapshot and stitches together
next_workout + latest_activity + readiness into a single dashboard dict.
"""

from datetime import datetime

from intervals_mcp_server.directeur_client import get_coaching_snapshot
from intervals_mcp_server.services.activities import list_activities
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.services.events import list_events
from intervals_mcp_server.utils.dates import get_default_end_date, get_default_future_end_date, get_default_start_date


async def coaching_state(zone: str = "threshold") -> dict:
    """Return the coaching snapshot dict from directeur.

    Args:
        zone: Progression zone to include (default threshold).

    Raises:
        ServiceError: If directeur is unconfigured or returns an error.
    """
    result = await get_coaching_snapshot(zone=zone)
    if "error" in result:
        raise ServiceError(status_code=503, message=result["error"])
    return result


async def dashboard(athlete_id: str | None = None) -> dict:
    """Return a composite dashboard dict with next workout, latest activity, and readiness.

    Never raises — coaching failures set readiness to None rather than 500-ing.

    Args:
        athlete_id: Override athlete ID (uses config default if None).
    """
    today = get_default_end_date()
    two_weeks_out = get_default_future_end_date(days_ahead=14)
    thirty_days_ago = get_default_start_date(days_ago=30)

    # next_workout: first future WORKOUT event in the next 14 days
    next_workout = None
    try:
        events = await list_events(oldest=today, newest=two_weeks_out, athlete_id=athlete_id)
        workout_events = [e for e in events if e.get("category") == "WORKOUT"]
        # sort ascending by date; pick earliest with start >= today
        workout_events.sort(key=lambda e: e.get("start_date_local") or e.get("start_date") or "")
        for event in workout_events:
            start = event.get("start_date_local") or event.get("start_date") or ""
            if start[:10] >= today:
                next_workout = event
                break
    except Exception:
        next_workout = None

    # latest_activity: most recent activity in the last 30 days
    latest_activity = None
    try:
        activities = await list_activities(
            oldest=thirty_days_ago,
            newest=today,
            limit=1,
            include_unnamed=True,
            athlete_id=athlete_id,
        )
        latest_activity = activities[0] if activities else None
    except Exception:
        latest_activity = None

    # readiness: extract sub-key if present, else whole snapshot; None on failure
    readiness = None
    try:
        snapshot = await coaching_state()
        readiness = snapshot.get("readiness", snapshot)
    except Exception:
        readiness = None

    return {
        "next_workout": next_workout,
        "latest_activity": latest_activity,
        "readiness": readiness,
    }
