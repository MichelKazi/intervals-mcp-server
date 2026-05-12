"""
Folder/plan management MCP tools for Intervals.icu.

This module contains tools for managing workout folders and training plans.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_folder(folder: dict[str, Any]) -> str:
    """Format a folder into a readable string."""
    lines = []
    lines.append(f"ID: {folder.get('id', 'N/A')}")
    lines.append(f"Name: {folder.get('name', 'Unnamed')}")
    if folder.get("type"):
        lines.append(f"Type: {folder['type']}")
    if folder.get("description"):
        lines.append(f"Description: {folder['description']}")
    if folder.get("startDate"):
        lines.append(f"Start Date: {folder['startDate']}")
    if folder.get("weeks") is not None:
        lines.append(f"Weeks: {folder['weeks']}")
    return "\n".join(lines)


@mcp.tool()
async def get_folders(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get workout folders and training plans from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/folders", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching folders: {result.get('message')}"

    if not result:
        return f"No folders found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Folders & Plans:\n\n"
        for folder in result:
            if isinstance(folder, dict):
                output += _format_folder(folder) + "\n\n"
        return output

    return f"Folders & Plans:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def create_folder(
    name: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    folder_type: str | None = None,
    description: str | None = None,
    start_date: str | None = None,
    weeks: int | None = None,
) -> str:
    """Create a new workout folder or training plan on Intervals.icu.

    Args:
        name: Folder/plan name
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        folder_type: Folder type - "FOLDER" or "PLAN" (optional)
        description: Description (optional)
        start_date: Plan start date in YYYY-MM-DD format (optional, for plans)
        weeks: Number of weeks (optional, for plans)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data: dict[str, Any] = {"name": name}
    if folder_type is not None:
        data["type"] = folder_type
    if description is not None:
        data["description"] = description
    if start_date is not None:
        data["startDate"] = start_date
    if weeks is not None:
        data["weeks"] = weeks

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/folders",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating folder: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when creating folder."

    return f"Successfully created folder (ID: {result.get('id')}).\n\n{_format_folder(result)}"


@mcp.tool()
async def update_folder(
    folder_id: int,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update a workout folder or training plan on Intervals.icu.

    Args:
        folder_id: The folder ID to update
        updates: Dictionary of fields to update (e.g. {"name": "New Name", "description": "Updated"})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/folders/{folder_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating folder: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating folder."

    return f"Successfully updated folder {folder_id}.\n\n{_format_folder(result)}"


@mcp.tool()
async def delete_folder(
    folder_id: int,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Delete a workout folder or training plan from Intervals.icu.

    Args:
        folder_id: The folder ID to delete
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/folders/{folder_id}",
        api_key=api_key,
        method="DELETE",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error deleting folder: {result.get('message')}"

    return f"Successfully deleted folder {folder_id}."
