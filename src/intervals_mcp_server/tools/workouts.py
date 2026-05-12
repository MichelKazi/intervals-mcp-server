"""
Workout library MCP tools for Intervals.icu.

This module contains tools for managing saved workouts in the workout library.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.formatting import format_workout
from intervals_mcp_server.utils.types import WorkoutDoc
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def get_workouts(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get saved workouts from the workout library on Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching workouts: {result.get('message')}"

    if not result:
        return f"No workouts found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Workout Library:\n\n"
        for workout in result:
            if isinstance(workout, dict):
                output += format_workout(workout) + "\n"
        return output

    return f"Workout Library:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_workout_by_id(
    workout_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get a specific workout from the library on Intervals.icu.

    Args:
        workout_id: The workout ID
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching workout: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No workout found with ID {workout_id}."

    return f"Workout Details:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def create_workout(
    name: str,
    workout_type: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    description: str | None = None,
    workout_doc: WorkoutDoc | None = None,
    folder_id: int | None = None,
    moving_time: int | None = None,
    distance: int | None = None,
) -> str:
    """Create a new workout in the library on Intervals.icu.

    Args:
        name: Workout name
        workout_type: Workout type (e.g. Ride, Run, Swim, Walk, Row)
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
        description: Workout description (optional)
        workout_doc: Structured workout definition with steps (optional)
        folder_id: Folder ID to place the workout in (optional)
        moving_time: Expected moving time in seconds (optional)
        distance: Expected distance in meters (optional)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    data: dict[str, Any] = {"name": name, "type": workout_type}
    if description is not None:
        data["description"] = description
    if workout_doc is not None:
        data["workout_doc"] = str(workout_doc)
    if folder_id is not None:
        data["folder_id"] = folder_id
    if moving_time is not None:
        data["moving_time"] = moving_time
    if distance is not None:
        data["distance"] = distance

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error creating workout: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when creating workout."

    return f"Successfully created workout (ID: {result.get('id')}).\n\n{format_workout(result)}"


@mcp.tool()
async def update_workout(
    workout_id: str,
    updates: dict[str, Any],
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Update a workout in the library on Intervals.icu.

    Args:
        workout_id: The workout ID to update
        updates: Dictionary of fields to update (e.g. {"name": "Sweet Spot 2x20", "type": "Ride"})
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}",
        api_key=api_key,
        method="PUT",
        data=updates,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error updating workout: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Error: Unexpected response when updating workout."

    return f"Successfully updated workout {workout_id}.\n\n{format_workout(result)}"


@mcp.tool()
async def delete_workout(
    workout_id: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Delete a workout from the library on Intervals.icu.

    Args:
        workout_id: The workout ID to delete
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workouts/{workout_id}",
        api_key=api_key,
        method="DELETE",
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error deleting workout: {result.get('message')}"

    return f"Successfully deleted workout {workout_id}."


@mcp.tool()
async def get_workout_tags(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all workout tags for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/workout-tags", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching workout tags: {result.get('message')}"

    if not result:
        return f"No workout tags found for athlete {athlete_id_to_use}."

    return f"Workout Tags:\n\n{json.dumps(result, indent=2)}"
