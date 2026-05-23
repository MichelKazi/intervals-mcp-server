"""
Folder/plan management MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_folder(folder: dict[str, Any]) -> str:
    lines = [f"ID: {folder.get('id', 'N/A')}", f"Name: {folder.get('name', 'Unnamed')}"]
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
async def manage_folders(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    folder_id: int | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage workout folders and training plans on Intervals.icu.

    Args:
        action: One of: list, create, update, delete
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        folder_id: Required for update and delete
        data: For create: {"name": "...", "type": "FOLDER"|"PLAN", ...}. For update: fields to change.
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/folders", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No folders found."
        if isinstance(result, list):
            return "Folders & Plans:\n\n" + "\n\n".join(_format_folder(f) for f in result if isinstance(f, dict))
        return json.dumps(result, indent=2)

    elif action == "create":
        if not data:
            return "Error: 'data' required for create (must include 'name')"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/folders", api_key=api_key, method="POST", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Created folder (ID: {result.get('id')}).\n\n{_format_folder(result)}"
        return "Unexpected response."

    elif action == "update":
        if not folder_id:
            return "Error: 'folder_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/folders/{folder_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated folder {folder_id}.\n\n{_format_folder(result)}"
        return "Unexpected response."

    elif action == "delete":
        if not folder_id:
            return "Error: 'folder_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/folders/{folder_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted folder {folder_id}."

    return f"Invalid action '{action}'. Must be one of: list, create, update, delete"
