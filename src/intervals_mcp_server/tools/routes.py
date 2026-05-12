"""
Route management MCP tools for Intervals.icu.

This module contains tools for managing athlete routes.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_route(route: dict[str, Any]) -> str:
    """Format route data into a readable string."""
    lines = []
    lines.append(f"ID: {route.get('id', 'N/A')}")
    lines.append(f"Name: {route.get('name', 'Unnamed')}")
    if route.get("type"):
        lines.append(f"Type: {route['type']}")
    if route.get("distance") is not None:
        km = route["distance"] / 1000
        lines.append(f"Distance: {km:.1f} km")
    if route.get("elevation_gain") is not None:
        lines.append(f"Elevation Gain: {route['elevation_gain']}m")
    if route.get("description"):
        lines.append(f"Description: {route['description']}")
    if route.get("activities") is not None:
        lines.append(f"Activities: {route['activities']}")
    return "\n".join(lines)


@mcp.tool()
async def get_routes(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all routes for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/routes", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching routes: {result.get('message')}"

    if not result:
        return f"No routes found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Routes:\n\n"
        for route in result:
            if isinstance(route, dict):
                output += _format_route(route) + "\n\n"
        return output

    return f"Routes:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_route(
    route_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get details for a specific route from Intervals.icu.

    Args:
        route_id: The route ID
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/routes/{route_id}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching route: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No route found with ID {route_id}."

    return f"Route Details:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def update_route(
    route_id: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update a route on Intervals.icu.

    Args:
        route_id: The route ID to update
        updates: Dictionary of fields to update (e.g. {"name": "New Route Name"})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/routes/{route_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating route: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating route."

    return f"Successfully updated route {route_id}.\n\n{_format_route(result)}"


@mcp.tool()
async def compare_routes(
    route_id: str,
    other_route_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Compare two routes for similarity on Intervals.icu.

    Args:
        route_id: The first route ID
        other_route_id: The second route ID to compare against
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/routes/{route_id}/similarity/{other_route_id}",
        api_key=api_key,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error comparing routes: {result.get('message')}"

    if not result:
        return f"No similarity data found for routes {route_id} and {other_route_id}."

    return f"Route Similarity ({route_id} vs {other_route_id}):\n\n{json.dumps(result, indent=2)}"
