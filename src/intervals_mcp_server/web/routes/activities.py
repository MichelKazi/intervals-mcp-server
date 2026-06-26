"""
JSON routes for activities data: list, detail, intervals, and streams.

Each route is a thin delegation to the activities service.
Auth is enforced via the require_token dependency on the router.
"""

from fastapi import APIRouter, Depends, Query

from intervals_mcp_server.services.activities import (
    get_activity,
    get_intervals,
    get_streams,
    list_activities,
)
from intervals_mcp_server.web.auth import require_token

router = APIRouter(prefix="/api/activities", dependencies=[Depends(require_token)])


@router.get("")
async def activities_list(
    oldest: str | None = Query(default=None),
    newest: str | None = Query(default=None),
    limit: int = Query(default=10),
    include_unnamed: bool = Query(default=False),
    athlete_id: str | None = Query(default=None),
):
    """List activities within a date range."""
    return await list_activities(
        oldest=oldest,
        newest=newest,
        limit=limit,
        include_unnamed=include_unnamed,
        athlete_id=athlete_id,
    )


@router.get("/{activity_id}")
async def activity_detail(activity_id: str):
    """Get a single activity by ID."""
    return await get_activity(activity_id)


@router.get("/{activity_id}/intervals")
async def activity_intervals(activity_id: str):
    """Get interval data for an activity."""
    return await get_intervals(activity_id)


@router.get("/{activity_id}/streams")
async def activity_streams(
    activity_id: str,
    types: str | None = Query(default=None),
):
    """Get time-series stream data for an activity."""
    return await get_streams(activity_id, types=types)
