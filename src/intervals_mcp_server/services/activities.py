"""
Activities service: thin async wrappers around the Intervals.icu API.

Used by both the JSON routes (web API) and may be reused by other callers.
Raises ServiceError on upstream failure; callers get clean typed errors.
"""

from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.tools.activities import (
    _filter_named_activities,
    _parse_activities_from_result,
    _partition_activities,
)
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

_DEFAULT_STREAM_TYPES = "time,watts,heartrate,cadence,altitude,distance,velocity_smooth"


def _check_error(result: Any) -> None:
    """Raise ServiceError if result is an error dict."""
    if isinstance(result, dict) and result.get("error"):
        status = result.get("status_code", 502)
        message = result.get("message", "Upstream error")
        raise ServiceError(status_code=int(status), message=str(message))


async def list_activities(
    oldest: str | None,
    newest: str | None,
    limit: int,
    include_unnamed: bool = False,
    athlete_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return a list of activity dicts for an athlete.

    Args:
        oldest: Start date in YYYY-MM-DD format (or None for default).
        newest: End date in YYYY-MM-DD format (or None for default).
        limit: Maximum number of activities to return.
        include_unnamed: Whether to include unnamed / "Unnamed" activities.
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    start, end = resolve_date_params(oldest, newest)
    api_limit = limit * 3 if not include_unnamed else limit

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities",
        params={"oldest": start, "newest": end, "limit": api_limit},
    )
    _check_error(result)

    all_activities = _parse_activities_from_result(result)
    accessible, _restricted = _partition_activities(all_activities)

    if not include_unnamed:
        accessible = _filter_named_activities(accessible)

    return accessible[:limit]


async def get_activity(activity_id: str) -> dict[str, Any]:
    """Return a single activity dict.

    Args:
        activity_id: Intervals.icu activity ID.

    Raises:
        ServiceError: On upstream API failure.
    """
    result = await make_intervals_request(url=f"/activity/{activity_id}")
    _check_error(result)

    if isinstance(result, list) and result:
        return result[0]
    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected response for activity {activity_id}")


async def get_intervals(activity_id: str) -> dict[str, Any]:
    """Return raw interval data dict ({icu_intervals, icu_groups, ...}).

    Args:
        activity_id: Intervals.icu activity ID.

    Raises:
        ServiceError: On upstream API failure.
    """
    result = await make_intervals_request(url=f"/activity/{activity_id}/intervals")
    _check_error(result)

    if isinstance(result, dict):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected interval format for activity {activity_id}")


async def get_streams(activity_id: str, types: str | None = None) -> list[dict[str, Any]]:
    """Return a list of stream dicts ({type, data}).

    Args:
        activity_id: Intervals.icu activity ID.
        types: Comma-separated stream types (defaults to standard set).

    Raises:
        ServiceError: On upstream API failure.
    """
    params = {"types": types or _DEFAULT_STREAM_TYPES}
    result = await make_intervals_request(
        url=f"/activity/{activity_id}/streams",
        params=params,
    )
    _check_error(result)

    if isinstance(result, list):
        return result
    raise ServiceError(status_code=502, message=f"Unexpected streams format for activity {activity_id}")
