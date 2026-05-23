"""
Custom items MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_custom_item(item: dict[str, Any]) -> str:
    lines = [f"ID: {item.get('id', 'N/A')}"]
    if item.get("name"):
        lines.append(f"Name: {item['name']}")
    if item.get("type"):
        lines.append(f"Type: {item['type']}")
    if item.get("category"):
        lines.append(f"Category: {item['category']}")
    if item.get("value") is not None:
        lines.append(f"Value: {item['value']}")
    if item.get("start_date_local"):
        lines.append(f"Date: {item['start_date_local']}")
    return "\n".join(lines)


@mcp.tool()
async def manage_custom_items(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    item_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage custom items (user-defined tracking fields) on Intervals.icu.

    Args:
        action: One of: list, get, create, update, delete
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        item_id: Required for get, update, delete
        data: For create/update: item fields dict
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/custom-items", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No custom items found."
        if isinstance(result, list):
            return "Custom Items:\n\n" + "\n\n".join(_format_custom_item(i) for i in result if isinstance(i, dict))
        return json.dumps(result, indent=2)

    elif action == "get":
        if not item_id:
            return "Error: 'item_id' required for get"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/custom-items/{item_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Custom Item:\n\n{json.dumps(result, indent=2)}"
        return "Not found."

    elif action == "create":
        if not data:
            return "Error: 'data' required for create"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/custom-items", api_key=api_key, method="POST", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Created custom item (ID: {result.get('id')}).\n\n{_format_custom_item(result)}"
        return "Unexpected response."

    elif action == "update":
        if not item_id:
            return "Error: 'item_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/custom-items/{item_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated custom item {item_id}.\n\n{_format_custom_item(result)}"
        return "Unexpected response."

    elif action == "delete":
        if not item_id:
            return "Error: 'item_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/custom-items/{item_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted custom item {item_id}."

    return f"Invalid action '{action}'. Must be one of: list, get, create, update, delete"
