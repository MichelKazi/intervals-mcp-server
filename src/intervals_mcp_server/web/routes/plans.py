"""
JSON routes for training plan persistence and naming.

Thin proxies to directeur. Each degrades gracefully when directeur is
unavailable: the dashboard keeps its deterministic plan in hand, so these
endpoints return usable fallbacks rather than erroring.
"""

from fastapi import APIRouter, Depends, HTTPException, Request

from intervals_mcp_server import directeur_client
from intervals_mcp_server.config import get_config
from intervals_mcp_server.web.auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])


@router.post("/api/coaching/ftp-goal/plan-name")
async def plan_name_route(request: Request) -> dict:
    """Suggest a plan name via directeur, falling back to a deterministic name."""
    body = await request.json()
    result = await directeur_client.suggest_plan_name(
        body.get("computed", {}),
        body.get("hard_weekdays", []),
        body.get("weeks", 0),
    )
    if result is None:
        gain = body.get("computed", {}).get("gainRequired", "?")
        return {"name": f"{gain}W Build"}
    return result


@router.post("/api/plans")
async def save_plan_route(request: Request) -> dict:
    """Persist a plan via directeur. Echoes the plan unpersisted when directeur is down."""
    body = await request.json()
    result = await directeur_client.save_plan(body)
    if result is None:
        return {**body, "persisted": False}
    return result


@router.get("/api/plans/active")
async def active_plan_route(request: Request) -> dict:
    """Fetch the latest active plan. Returns {plan: null} when none or directeur is down."""
    athlete_id = request.query_params.get("athlete_id") or get_config().athlete_id
    if not athlete_id:
        raise HTTPException(status_code=400, detail="athlete_id is required")
    result = await directeur_client.get_active_plan(athlete_id)
    if result is None:
        return {"plan": None}
    return result


@router.post("/api/plans/{plan_id}/archive")
async def archive_plan_route(plan_id: str) -> dict:
    """Archive a plan via directeur. Returns {archived: false} when directeur is down."""
    result = await directeur_client.archive_plan(plan_id)
    if result is None:
        return {"archived": False}
    return result
