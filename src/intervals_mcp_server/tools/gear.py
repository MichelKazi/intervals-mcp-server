"""
Gear/equipment MCP tools for Intervals.icu.

This module contains tools for managing athlete gear and equipment.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_gear(gear: dict[str, Any]) -> str:
    """Format gear data into a readable string."""
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
        hours = gear["moving_time"] / 3600
        lines.append(f"Moving Time: {hours:.1f} hours")
    if gear.get("activities") is not None:
        lines.append(f"Activities: {gear['activities']}")
    if gear.get("retired") is not None:
        lines.append(f"Retired: {gear['retired']}")
    return "\n".join(lines)


@mcp.tool()
async def get_gear(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all gear/equipment for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/gear", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching gear: {result.get('message')}"

    if not result:
        return f"No gear found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Gear:\n\n"
        for item in result:
            if isinstance(item, dict):
                output += _format_gear(item) + "\n\n"
        return output

    return f"Gear:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def create_gear(
    name: str,
    gear_type: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    brand: str | None = None,
    model: str | None = None,
    description: str | None = None,
    link: str | None = None,
    weight: float | None = None,
) -> str:
    """Create new gear/equipment for an athlete on Intervals.icu.

    Args:
        name: Gear name (e.g. "Canyon Aeroad")
        gear_type: Gear type (e.g. "Bike", "Shoes", "Helmet", "PowerMeter")
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        brand: Gear brand (optional)
        model: Gear model (optional)
        description: Description (optional)
        link: URL link for the gear (optional)
        weight: Weight in grams (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data: dict[str, Any] = {"name": name, "type": gear_type}
    if brand is not None:
        data["brand"] = brand
    if model is not None:
        data["model"] = model
    if description is not None:
        data["description"] = description
    if link is not None:
        data["link"] = link
    if weight is not None:
        data["weight"] = weight

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/gear",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating gear: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when creating gear."

    return f"Successfully created gear (ID: {result.get('id')}).\n\n{_format_gear(result)}"


@mcp.tool()
async def update_gear(
    gear_id: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update gear/equipment for an athlete on Intervals.icu.

    Args:
        gear_id: The gear ID to update
        updates: Dictionary of fields to update (e.g. {"name": "New Name", "retired": true})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating gear: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating gear."

    return f"Successfully updated gear {gear_id}.\n\n{_format_gear(result)}"


@mcp.tool()
async def delete_gear(
    gear_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Delete gear/equipment for an athlete from Intervals.icu.

    Args:
        gear_id: The gear ID to delete
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}",
        api_key=api_key,
        method="DELETE",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error deleting gear: {result.get('message')}"

    return f"Successfully deleted gear {gear_id}."


@mcp.tool()
async def recalculate_gear_stats(
    gear_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Recalculate statistics for a piece of gear on Intervals.icu.

    Args:
        gear_id: The gear ID to recalculate
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/gear/{gear_id}/calc", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error recalculating gear stats: {result.get('message')}"

    if not result:
        return f"Gear stats recalculation triggered for gear {gear_id}."

    return f"Gear stats recalculated for {gear_id}:\n\n{json.dumps(result, indent=2)}"
