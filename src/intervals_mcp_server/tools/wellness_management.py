"""
Wellness management MCP tools for Intervals.icu.

This module contains tools for creating and updating wellness entries.
The read-only get_wellness_data tool is in the wellness module.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.formatting import format_wellness_entry
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def get_wellness_by_date(
    date: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get a single wellness record for a specific date from Intervals.icu.

    Args:
        date: Date in YYYY-MM-DD format
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness/{date}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching wellness data: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No wellness data found for {date}."

    return format_wellness_entry(result, include_all_fields=True)


@mcp.tool()
async def update_wellness(
    date: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update a wellness record for a specific date on Intervals.icu.

    Common fields: weight, restingHR, hrv, hrvSDNN, sleepSecs, sleepQuality (1-4),
    soreness (1-10), fatigue (1-10), stress (1-10), mood (1-10), motivation (1-10),
    injury (1-10), spO2, systolic, diastolic, hydration (1-10), kcalConsumed,
    steps, comments.

    Args:
        date: Date in YYYY-MM-DD format
        updates: Dictionary of wellness fields to update (e.g. {"weight": 72.5, "restingHR": 52, "mood": 8})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    updates["id"] = date

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness/{date}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating wellness data: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating wellness data."

    return f"Successfully updated wellness for {date}.\n\n{format_wellness_entry(result, include_all_fields=True)}"


@mcp.tool()
async def bulk_update_wellness(
    entries: list[dict[str, Any]],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update multiple wellness records at once on Intervals.icu.

    Each entry must include an "id" field with the date in YYYY-MM-DD format.

    Args:
        entries: List of wellness entry dicts, each with "id" (date) and fields to update
                 Example: [{"id": "2024-01-15", "weight": 72.5}, {"id": "2024-01-16", "weight": 72.3}]
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness-bulk",
        api_key=api_key,
        method="PUT",
        data=entries,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error bulk updating wellness data: {result.get('message')}"

    return f"Successfully updated {len(entries)} wellness records."
