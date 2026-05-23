"""
Route management MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_route(route: dict[str, Any]) -> str:
    lines = [f"ID: {route.get('id', 'N/A')}", f"Name: {route.get('name', 'Unnamed')}"]
    if route.get("type"):
        lines.append(f"Type: {route['type']}")
    if route.get("distance") is not None:
        lines.append(f"Distance: {route['distance'] / 1000:.1f} km")
    if route.get("elevation_gain") is not None:
        lines.append(f"Elevation Gain: {route['elevation_gain']}m")
    if route.get("description"):
        lines.append(f"Description: {route['description']}")
    return "\n".join(lines)


@mcp.tool()
async def manage_routes(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    route_id: str | None = None,
    other_route_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage routes on Intervals.icu.

    Args:
        action: One of: list, get, update, compare
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        route_id: Required for get, update, compare
        other_route_id: Second route ID for compare action
        data: For update: fields to change
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/routes", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No routes found."
        if isinstance(result, list):
            return "Routes:\n\n" + "\n\n".join(_format_route(r) for r in result if isinstance(r, dict))
        return json.dumps(result, indent=2)

    elif action == "get":
        if not route_id:
            return "Error: 'route_id' required for get"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/routes/{route_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Route Details:\n\n{json.dumps(result, indent=2)}"
        return "Not found."

    elif action == "update":
        if not route_id:
            return "Error: 'route_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/routes/{route_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated route {route_id}.\n\n{_format_route(result)}"
        return "Unexpected response."

    elif action == "compare":
        if not route_id or not other_route_id:
            return "Error: 'route_id' and 'other_route_id' required for compare"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/routes/{route_id}/similarity/{other_route_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No similarity data found."
        return f"Route Similarity ({route_id} vs {other_route_id}):\n\n{json.dumps(result, indent=2)}"

    return f"Invalid action '{action}'. Must be one of: list, get, update, compare"
