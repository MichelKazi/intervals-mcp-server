"""
Activity management MCP tools for Intervals.icu.

This module contains tools for updating, deleting, and searching activities.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.formatting import format_activity_summary
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def update_activity(
    activity_id: str,
    updates: dict[str, Any],
    api_key: str | None = None,
) -> str:
    """Update an activity on Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        updates: Dictionary of fields to update (e.g. {"name": "Morning Ride", "description": "Easy spin"})
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating activity: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating activity."

    return f"Successfully updated activity {activity_id}.\n\n{format_activity_summary(result)}"


@mcp.tool()
async def delete_activity(
    activity_id: str,
    api_key: str | None = None,
) -> str:
    """Delete an activity from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/activity/{activity_id}",
        api_key=api_key,
        method="DELETE",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error deleting activity: {result.get('message')}"

    return f"Successfully deleted activity {activity_id}."


@mcp.tool()
async def search_activities(
    query: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Search activities for an athlete on Intervals.icu.

    Uses the Intervals.icu activity search syntax (e.g. "type:Ride", "name:Morning",
    "distance>50000", "after:2024-01-01").

    Args:
        query: Search query string using Intervals.icu search syntax
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    params = {"q": query}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities/search",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error searching activities: {result.get('message')}"

    if not result:
        return f"No activities found matching '{query}'."

    if isinstance(result, list):
        output = f"Search results for '{query}':\n\n"
        for activity in result:
            if isinstance(activity, dict):
                output += format_activity_summary(activity) + "\n"
        return output

    return f"Search results for '{query}':\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def search_activities_full(
    query: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Search activities with full details for an athlete on Intervals.icu.

    Like search_activities but returns complete activity data instead of summaries.

    Args:
        query: Search query string using Intervals.icu search syntax
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    params = {"q": query}

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities/search-full",
        api_key=api_key,
        params=params,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error searching activities: {result.get('message')}"

    if not result:
        return f"No activities found matching '{query}'."

    if isinstance(result, list):
        output = f"Full search results for '{query}':\n\n"
        for activity in result:
            if isinstance(activity, dict):
                output += format_activity_summary(activity) + "\n"
        return output

    return f"Full search results for '{query}':\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def create_manual_activity(
    name: str,
    activity_type: str,
    start_date: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    moving_time: int | None = None,
    distance: float | None = None,
    description: str | None = None,
    trainer: bool | None = None,
    commute: bool | None = None,
) -> str:
    """Create a manual activity entry on Intervals.icu.

    Args:
        name: Activity name
        activity_type: Activity type (e.g. Ride, Run, Swim, Walk, WeightTraining, Yoga)
        start_date: Start date/time in YYYY-MM-DDTHH:MM:SS format or YYYY-MM-DD
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        moving_time: Moving time in seconds (optional)
        distance: Distance in meters (optional)
        description: Activity description (optional)
        trainer: Whether the activity was on a trainer (optional)
        commute: Whether the activity was a commute (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    if "T" not in start_date:
        start_date = f"{start_date}T00:00:00"

    data: dict[str, Any] = {
        "name": name,
        "type": activity_type,
        "start_date_local": start_date,
    }
    if moving_time is not None:
        data["moving_time"] = moving_time
    if distance is not None:
        data["distance"] = distance
    if description is not None:
        data["description"] = description
    if trainer is not None:
        data["trainer"] = trainer
    if commute is not None:
        data["commute"] = commute

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities/manual",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating manual activity: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when creating manual activity."

    activity_id = result.get("id", "unknown")
    return f"Successfully created manual activity (ID: {activity_id}).\n\n{format_activity_summary(result)}"


@mcp.tool()
async def get_activities_around(
    activity_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """List activities near another activity (by date) from Intervals.icu.

    Args:
        activity_id: The Intervals.icu activity ID to find neighbors of
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities-around",
        api_key=api_key,
        params={"activity_id": activity_id},
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching nearby activities: {result.get('message')}"

    if not result:
        return f"No nearby activities found for activity {activity_id}."

    if isinstance(result, list):
        output = f"Activities around {activity_id}:\n\n"
        for activity in result:
            if isinstance(activity, dict):
                output += format_activity_summary(activity) + "\n"
        return output

    return f"Activities around {activity_id}:\n\n{json.dumps(result, indent=2)}"
