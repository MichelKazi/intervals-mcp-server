"""
Extra event/calendar MCP tools for Intervals.icu.

This module contains tools for advanced event operations like bulk operations,
event tags, applying plans, and duplicating events.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def create_events_bulk(
    events: list[dict[str, Any]],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Create multiple events at once on Intervals.icu.

    Args:
        events: List of event dicts. Each should contain at minimum "start_date_local", "category", "name", "type".
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/bulk",
        api_key=api_key,
        method="POST",
        data=events,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating events: {result.get('message')}"

    if isinstance(result, list):
        return f"Successfully created {len(result)} events."

    return f"Events created:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_event_tags(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all event/calendar tags for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/event-tags", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching event tags: {result.get('message')}"

    if not result:
        return f"No event tags found for athlete {athlete_id_to_use}."

    return f"Event Tags:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def apply_training_plan(
    folder_id: int,
    start_date: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Apply a training plan to the calendar on Intervals.icu.

    Args:
        folder_id: The plan/folder ID to apply
        start_date: Start date in YYYY-MM-DD format
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data = {"folderId": folder_id, "startDate": start_date}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/apply-plan",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error applying training plan: {result.get('message')}"

    if isinstance(result, list):
        return f"Successfully applied training plan. {len(result)} events created."

    return f"Training plan applied:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def duplicate_events(
    source_start: str,
    source_end: str,
    target_start: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Duplicate events from one date range to another on Intervals.icu.

    Args:
        source_start: Source start date in YYYY-MM-DD format
        source_end: Source end date in YYYY-MM-DD format
        target_start: Target start date in YYYY-MM-DD format
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data = {
        "oldest": source_start,
        "newest": source_end,
        "targetStart": target_start,
    }

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/duplicate-events",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error duplicating events: {result.get('message')}"

    if isinstance(result, list):
        return f"Successfully duplicated {len(result)} events to {target_start}."

    return f"Events duplicated:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def mark_event_done(
    event_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Mark an event as done (creates a manual activity from a planned workout) on Intervals.icu.

    Args:
        event_id: The event ID to mark as done
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/events/{event_id}/mark-done",
        api_key=api_key,
        method="POST",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error marking event as done: {result.get('message')}"

    if isinstance(result, dict):
        activity_id = result.get("id", "unknown")
        return f"Event {event_id} marked as done. Activity created (ID: {activity_id})."

    return f"Event {event_id} marked as done."
