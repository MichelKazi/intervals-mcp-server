"""
Gear/equipment MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_gear(gear: dict[str, Any]) -> str:
    lines = []
    lines.append(f"ID: {gear.get('id', 'N/A')}")
    lines.append(f"Name: {gear.get('name', 'Unnamed')}")
    if gear.get("type"):
        lines.append(f"Type: {gear['type']}")
    if gear.get("brand"):
        lines.append(f"Brand: {gear['brand']}")
    if gear.get("model"):
        lines.append(f"Model: {gear['model']}")
    if gear.get("distance") is not None:
        lines.append(f"Distance: {gear['distance']}m")
    if gear.get("moving_time") is not None:
        lines.append(f"Moving Time: {gear['moving_time'] / 3600:.1f} hours")
    if gear.get("activities") is not None:
        lines.append(f"Activities: {gear['activities']}")
    if gear.get("retired") is not None:
        lines.append(f"Retired: {gear['retired']}")
    return "\n".join(lines)


@mcp.tool()
async def manage_gear(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    gear_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage gear/equipment on Intervals.icu.

    Args:
        action: One of: list, create, update, delete, recalculate
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        gear_id: Required for update, delete, recalculate
        data: For create: {"name": "...", "type": "Bike", ...}. For update: fields to change.
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/gear", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No gear found."
        if isinstance(result, list):
            return "Gear:\n\n" + "\n\n".join(_format_gear(g) for g in result if isinstance(g, dict))
        return json.dumps(result, indent=2)

    elif action == "create":
        if not data:
            return "Error: 'data' required for create (must include 'name' and 'type')"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/gear", api_key=api_key, method="POST", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Created gear (ID: {result.get('id')}).\n\n{_format_gear(result)}"
        return "Unexpected response."

    elif action == "update":
        if not gear_id:
            return "Error: 'gear_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated gear {gear_id}.\n\n{_format_gear(result)}"
        return "Unexpected response."

    elif action == "delete":
        if not gear_id:
            return "Error: 'gear_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted gear {gear_id}."

    elif action == "recalculate":
        if not gear_id:
            return "Error: 'gear_id' required for recalculate"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}/calc", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Recalculated stats for gear {gear_id}."

    return f"Invalid action '{action}'. Must be one of: list, create, update, delete, recalculate"
