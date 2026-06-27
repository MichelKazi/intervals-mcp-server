"""
JSON routes for FTP goal validation and plan generation.

The dashboard pre-computes goal feasibility deterministically and only posts
physically-possible goals here. This layer wraps directeur's LLM validation,
merging its qualitative fields while keeping the numeric computation
authoritative. The LLM may only lower confidence, never raise it.
"""

from fastapi import APIRouter, Depends, Request

from intervals_mcp_server import directeur_client
from intervals_mcp_server.config import get_config
from intervals_mcp_server.web.auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])


@router.post("/api/coaching/ftp-goal")
async def ftp_goal_route(request: Request) -> dict:
    """Validate a pre-computed FTP goal context and return a GoalAssessment."""
    computed = await request.json()
    base_confidence = computed.get("baseConfidence", 100)

    # athlete_id selects the per-athlete profile skill in directeur. Default to
    # the configured athlete so the profile applies without the client sending it.
    athlete_id = request.query_params.get("athlete_id") or get_config().athlete_id

    result = await directeur_client.validate_ftp_goal(computed, athlete_id=athlete_id)
    if result is None:
        result = {
            "coaching_note": computed.get("validationMessage", ""),
            "risk_factors": [],
            "confidence_pct": computed.get("baseConfidence", 50),
        }

    confidence = result.get("confidence_pct", base_confidence)
    confidence = max(5, min(int(confidence), base_confidence))

    return {
        "computed": computed,
        "coaching_note": result.get("coaching_note", ""),
        "risk_factors": result.get("risk_factors", []),
        "confidence_pct": confidence,
    }


@router.post("/api/coaching/ftp-plan")
async def ftp_plan_route(request: Request) -> dict:
    """Generate an FTP training plan. Degrades gracefully when directeur is down."""
    body = await request.json()
    assessment = body.get("assessment", {})
    availability = body.get("availability", {})

    plan = await directeur_client.generate_ftp_plan(assessment, availability)
    if plan is None:
        return {"plan": None, "message": "Plan generation unavailable."}
    return plan
