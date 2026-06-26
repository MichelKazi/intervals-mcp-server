"""
Wellness service: thin async wrapper around the Intervals.icu wellness API.

Raises ServiceError on upstream failure; callers get clean typed errors.
"""

from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.utils.dates import get_default_end_date, get_default_start_date
from intervals_mcp_server.utils.validation import resolve_athlete_id


def _check_error(result: Any) -> None:
    """Raise ServiceError if result is an error dict."""
    if isinstance(result, dict) and result.get("error"):
        status = result.get("status_code", 502)
        message = result.get("message", "Upstream error")
        raise ServiceError(status_code=int(status), message=str(message))


async def wellness_series(
    oldest: str | None = None,
    newest: str | None = None,
    athlete_id: str | None = None,
) -> list[dict[str, Any]]:
    """Return a list of wellness dicts for an athlete.

    Args:
        oldest: Start date in YYYY-MM-DD format (defaults to ~42 days ago).
        newest: End date in YYYY-MM-DD format (defaults to today).
        athlete_id: Override athlete ID (uses config default if None).

    Raises:
        ServiceError: On upstream API failure.
    """
    config = get_config()
    athlete_id_to_use, err = resolve_athlete_id(athlete_id, config.athlete_id)
    if err:
        raise ServiceError(status_code=400, message=err)

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness",
        params={
            "oldest": oldest or get_default_start_date(days_ago=42),
            "newest": newest or get_default_end_date(),
        },
    )
    _check_error(result)

    if isinstance(result, list):
        return result
    return []
