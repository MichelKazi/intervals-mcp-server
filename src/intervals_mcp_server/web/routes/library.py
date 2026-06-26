"""
JSON routes for the TR workout library: search, lookup, alternatives, and custom workout creation.

IMPORTANT: /api/library/alternatives is registered BEFORE /api/library/{tr_workout_id}
so the literal path segment "alternatives" is not captured as a path param.

Auth is enforced via the require_token dependency on the router.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from intervals_mcp_server.services.library import (
    create_custom_workout_svc,
    find_alternatives,
    get_library_workout,
    search_library_workouts,
)
from intervals_mcp_server.web.auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])


class CustomWorkout(BaseModel):
    name: str
    workout_type: str
    steps: list[dict[str, Any]]
    description: str | None = None
    tags: list[str] | None = None
    schedule_date: str | None = None


@router.get("/api/library/search")
async def library_search(
    zone_focus: str | None = Query(default=None),
    adaptation_target: str | None = Query(default=None),
    interval_pattern: str | None = Query(default=None),
    race_specific: bool | None = Query(default=None),
    duration_min_minutes: int | None = Query(default=None),
    duration_max_minutes: int | None = Query(default=None),
    tss_min: float | None = Query(default=None),
    tss_max: float | None = Query(default=None),
    intensity_min: int | None = Query(default=None),
    intensity_max: int | None = Query(default=None),
    work_duration_min_sec: int | None = Query(default=None),
    work_duration_max_sec: int | None = Query(default=None),
    indoor_only: bool | None = Query(default=None),
    name_search: str | None = Query(default=None),
    limit: int = Query(default=15),
):
    """Search the TR workout library with multi-axis filters."""
    return await search_library_workouts(
        zone_focus=zone_focus,
        adaptation_target=adaptation_target,
        interval_pattern=interval_pattern,
        race_specific=race_specific,
        duration_min_minutes=duration_min_minutes,
        duration_max_minutes=duration_max_minutes,
        tss_min=tss_min,
        tss_max=tss_max,
        intensity_min=intensity_min,
        intensity_max=intensity_max,
        work_duration_min_sec=work_duration_min_sec,
        work_duration_max_sec=work_duration_max_sec,
        indoor_only=indoor_only,
        name_search=name_search,
        limit=limit,
    )


# MUST be defined before /{tr_workout_id} so "alternatives" is not captured as a path param.
@router.get("/api/library/alternatives")
async def library_alternatives(
    tr_workout_id: str = Query(...),
    adjustment: str | None = Query(default=None),
    target_zone: str | None = Query(default=None),
    max_duration_minutes: int | None = Query(default=None),
    indoor_only: bool | None = Query(default=None),
    limit: int = Query(default=5),
):
    """Find alternative workouts relative to a reference workout."""
    return await find_alternatives(
        tr_workout_id=tr_workout_id,
        adjustment=adjustment,
        target_zone=target_zone,
        max_duration_minutes=max_duration_minutes,
        indoor_only=indoor_only,
        limit=limit,
    )


@router.get("/api/library/{tr_workout_id}")
async def library_workout(tr_workout_id: str):
    """Get full details of a single workout by TR workout ID."""
    return await get_library_workout(tr_workout_id)


@router.post("/api/workouts/custom")
async def custom_workout(body: CustomWorkout):
    """Create a custom workout in intervals.icu, optionally scheduling it."""
    return await create_custom_workout_svc(
        name=body.name,
        workout_type=body.workout_type,
        steps=body.steps,
        description=body.description,
        tags=body.tags,
        schedule_date=body.schedule_date,
    )
