"""
Workout library MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.formatting import format_workout
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def manage_workouts(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    workout_id: str | None = None,
    data: dict[str, Any] | None = None,
) -> str:
    """Manage saved workouts in the workout library on Intervals.icu.

    Args:
        action: One of: list, get, create, update, delete, tags
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        workout_id: Required for get, update, delete
        data: For create: {"name": "...", "type": "Ride", ...}. For update: fields to change.
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    action = action.lower().strip()

    if action == "list":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workouts", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No workouts found."
        if isinstance(result, list):
            return "Workout Library:\n\n" + "\n".join(format_workout(w) for w in result if isinstance(w, dict))
        return json.dumps(result, indent=2)

    elif action == "get":
        if not workout_id:
            return "Error: 'workout_id' required for get"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Workout Details:\n\n{json.dumps(result, indent=2)}"
        return "Not found."

    elif action == "create":
        if not data:
            return "Error: 'data' required for create (must include 'name' and 'type')"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workouts", api_key=api_key, method="POST", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Created workout (ID: {result.get('id')}).\n\n{format_workout(result)}"
        return "Unexpected response."

    elif action == "update":
        if not workout_id:
            return "Error: 'workout_id' required for update"
        if not data:
            return "Error: 'data' required for update"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}", api_key=api_key, method="PUT", data=data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Updated workout {workout_id}.\n\n{format_workout(result)}"
        return "Unexpected response."

    elif action == "delete":
        if not workout_id:
            return "Error: 'workout_id' required for delete"
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}", api_key=api_key, method="DELETE"
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Deleted workout {workout_id}."

    elif action == "tags":
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/workout-tags", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No workout tags found."
        return f"Workout Tags:\n\n{json.dumps(result, indent=2)}"

    return f"Invalid action '{action}'. Must be one of: list, get, create, update, delete, tags"
