"""
JSON routes for coaching state, wellness series, and dashboard composite.

Each route delegates to the coaching or wellness service.
Auth is enforced via the require_token dependency on the router.
"""

from fastapi import APIRouter, Depends, Query

from intervals_mcp_server.services.coaching import coaching_state, dashboard
from intervals_mcp_server.services.wellness import wellness_series
from intervals_mcp_server.web.auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])


@router.get("/api/coaching/state")
async def coaching_state_route(zone: str = Query(default="threshold")):
    """Return coaching snapshot (readiness, patterns, levels, progression)."""
    return await coaching_state(zone=zone)


@router.get("/api/wellness")
async def wellness_route(
    oldest: str | None = Query(default=None),
    newest: str | None = Query(default=None),
    athlete_id: str | None = Query(default=None),
):
    """Return wellness time series."""
    return await wellness_series(oldest=oldest, newest=newest, athlete_id=athlete_id)


@router.get("/api/dashboard")
async def dashboard_route(athlete_id: str | None = Query(default=None)):
    """Return composite dashboard: next workout, latest activity, readiness."""
    return await dashboard(athlete_id=athlete_id)
