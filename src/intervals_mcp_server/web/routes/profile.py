"""JSON routes for the editable athlete profile (DB-backed metadata in directeur).

Distinct from intervals.icu athlete fields (name/FTP), which are edited via the
existing update_athlete MCP path. These cover the coaching metadata: demographics,
soft context, consent flags, and medications. Every write regenerates the
profile skill server-side.
"""

from fastapi import APIRouter, Depends, Request

from intervals_mcp_server import directeur_client
from intervals_mcp_server.config import get_config
from intervals_mcp_server.web.auth import require_token

router = APIRouter(dependencies=[Depends(require_token)])


def _athlete_id(request: Request) -> str:
    return request.query_params.get("athlete_id") or get_config().athlete_id


@router.get("/api/profile")
async def get_profile(request: Request) -> dict:
    """Full DB profile: athlete + context + meds + generated skill."""
    result = await directeur_client.get_athlete_profile_db(_athlete_id(request))
    return result if result is not None else {"profile": None}


@router.put("/api/profile/core")
async def update_core(request: Request) -> dict:
    """Update demographics (weight, sex, location, etc.)."""
    body = await request.json()
    result = await directeur_client.update_athlete_profile(_athlete_id(request), "core", body)
    return result if result is not None else {"profile": None, "saved": False}


@router.put("/api/profile/context")
async def update_context(request: Request) -> dict:
    """Update soft context + consent flags."""
    body = await request.json()
    result = await directeur_client.update_athlete_profile(_athlete_id(request), "context", body)
    return result if result is not None else {"profile": None, "saved": False}


@router.post("/api/profile/medications")
async def add_medication(request: Request) -> dict:
    """Add a medication."""
    body = await request.json()
    result = await directeur_client.add_athlete_medication(_athlete_id(request), body)
    return result if result is not None else {"profile": None, "saved": False}


@router.delete("/api/profile/medications/{med_id}")
async def remove_medication(med_id: str, request: Request) -> dict:
    """Soft-delete a medication."""
    result = await directeur_client.remove_athlete_medication(_athlete_id(request), med_id)
    return result if result is not None else {"profile": None, "saved": False}
