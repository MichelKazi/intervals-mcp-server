"""
Wellness MCP tools for Intervals.icu.
"""

from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.utils.formatting import format_wellness_entry
from intervals_mcp_server.utils.validation import resolve_athlete_id, resolve_date_params

from intervals_mcp_server.mcp_instance import mcp  # noqa: F401

config = get_config()


@mcp.tool()
async def get_wellness(
    athlete_id: str | None = None,
    api_key: str | None = None,
    date: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    include_all_fields: bool = False,
) -> str:
    """Get wellness data from Intervals.icu — either a single date or a date range.

    If 'date' is provided, returns detailed wellness for that specific day.
    Otherwise returns a range (defaults to last 30 days).

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        date: Specific date YYYY-MM-DD for single-day lookup (optional)
        start_date: Start date YYYY-MM-DD for range (optional, defaults to 30 days ago)
        end_date: End date YYYY-MM-DD for range (optional, defaults to today)
        include_all_fields: Include custom/additional fields beyond standard set (optional, default false)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    if date:
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/wellness/{date}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result or not isinstance(result, dict):
            return f"No wellness data found for {date}."
        return format_wellness_entry(result, include_all_fields=True)

    start_date, end_date = resolve_date_params(start_date, end_date)
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness", api_key=api_key,
        params={"oldest": start_date, "newest": end_date}
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if not result:
        return "No wellness data found."

    output = "Wellness Data:\n\n"
    if isinstance(result, list):
        for entry in result:
            if isinstance(entry, dict):
                output += format_wellness_entry(entry, include_all_fields=include_all_fields) + "\n\n"
    elif isinstance(result, dict):
        for date_str, data in result.items():
            if isinstance(data, dict):
                if "date" not in data:
                    data["date"] = date_str
                output += format_wellness_entry(data, include_all_fields=include_all_fields) + "\n\n"
    return output


@mcp.tool()
async def update_wellness(
    date: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
    bulk: list[dict[str, Any]] | None = None,
) -> str:
    """Update wellness records on Intervals.icu (single day or bulk).

    For single update: provide date + updates.
    For bulk: provide bulk (list of dicts, each with "id" field as date YYYY-MM-DD).

    Common fields: weight, restingHR, hrv, hrvSDNN, sleepSecs, sleepQuality (1-4),
    soreness (1-10), fatigue (1-10), stress (1-10), mood (1-10), motivation (1-10),
    injury (1-10), spO2, systolic, diastolic, hydration (1-10), kcalConsumed, steps, comments.

    Args:
        date: Date YYYY-MM-DD for single update (ignored if bulk is provided)
        updates: Fields to update for single day (e.g. {"weight": 72.5, "mood": 8})
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        bulk: List of wellness entries for bulk update (each must have "id" as date)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    if bulk:
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/wellness-bulk", api_key=api_key, method="PUT", data=bulk
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Updated {len(bulk)} wellness records."

    updates["id"] = date
    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness/{date}", api_key=api_key, method="PUT", data=updates
    )
    if isinstance(result, dict) and "error" in result:
        return f"Error: {result.get('message')}"
    if isinstance(result, dict):
        return f"Updated wellness for {date}.\n\n{format_wellness_entry(result, include_all_fields=True)}"
    return "Unexpected response."
