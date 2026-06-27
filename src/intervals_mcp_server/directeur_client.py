"""HTTP client for the directeur coaching engine."""

import asyncio
import logging
from datetime import datetime, timezone

import httpx

from intervals_mcp_server.config import get_config

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        config = get_config()
        _client = httpx.AsyncClient(
            base_url=config.directeur_url.rstrip("/"),
            headers={"Authorization": f"Bearer {config.directeur_api_key}"},
            timeout=10.0,
        )
    return _client


def _staleness_note(computed_at: str | None) -> str | None:
    """Return a staleness warning if computed_at is >24h old."""
    if not computed_at:
        return None
    try:
        ts = datetime.fromisoformat(computed_at.replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - ts
        if age.total_seconds() > 86400:
            hours = int(age.total_seconds() / 3600)
            return f"(stale — last computed {hours}h ago)"
    except (ValueError, TypeError):
        pass
    return None


async def get_readiness() -> dict | None:
    """Fetch latest readiness verdict from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get("/readiness/")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur readiness fetch failed: %s", e)
        return None


async def get_active_patterns() -> dict | None:
    """Fetch active behavioral patterns from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get("/patterns/")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur patterns fetch failed: %s", e)
        return None


async def get_progression(zone: str) -> dict | None:
    """Fetch progression state for a zone from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get(f"/progression/{zone}")
        resp.raise_for_status()
        data = resp.json()
        if data.get("state") is None and "zone" not in data:
            return None
        return data
    except Exception as e:
        logger.warning("directeur progression/%s fetch failed: %s", zone, e)
        return None


async def get_planning_context(lookback_days: int = 28) -> dict | None:
    """Fetch planning context from directeur for training block construction."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get("/planning/context", params={"lookback_days": lookback_days})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur planning context fetch failed: %s", e)
        return None


async def trigger_activity_analysis(
    activity_id: str | None = None,
    oldest: str | None = None,
    newest: str | None = None,
    mode: str | None = None,
) -> dict | None:
    """Trigger activity analysis on directeur. Returns summary of what was analyzed."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        body: dict = {}
        if activity_id:
            body["activity_id"] = activity_id
        if oldest:
            body["oldest"] = oldest
        if newest:
            body["newest"] = newest
        if mode:
            body["mode"] = mode
        resp = await _get_client().post("/actions/analyze", json=body, timeout=120.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur activity analysis trigger failed: %s", e)
        return None


async def get_activity_analysis(activity_id: str) -> dict | None:
    """Fetch a completed activity analysis from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get(f"/analysis/{activity_id}")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur analysis fetch for %s failed: %s", activity_id, e)
        return None


async def get_recent_analyses(limit: int = 5) -> list | None:
    """Fetch recent activity analyses from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get("/analysis/recent", params={"limit": limit})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur recent analyses fetch failed: %s", e)
        return None


async def get_levels(zone: str | None = None) -> dict | None:
    """Fetch progression levels from directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        path = f"/levels/{zone}" if zone else "/levels"
        resp = await _get_client().get(path)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur levels fetch failed: %s", e)
        return None


async def recompute_levels() -> dict | None:
    """Trigger fresh level computation on directeur."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post("/levels/recompute", timeout=60.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur levels recompute failed: %s", e)
        return None


async def post_level_correction(zone: str, proposed_level: float, rationale: str, duration_days: int = 14) -> dict | None:
    """Submit an athlete correction to a progression level."""
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post(
            f"/levels/{zone}/correct",
            json={"proposed_level": proposed_level, "rationale": rationale, "duration_days": duration_days},
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur level correction for %s failed: %s", zone, e)
        return None


async def validate_ftp_goal(computed: dict) -> dict | None:
    """Validate a pre-computed FTP goal context via directeur.

    Returns directeur's {coaching_note, risk_factors, confidence_pct} or None on
    missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post("/ftp-goal/validate", json={"computed": computed}, timeout=60.0)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur ftp-goal validate failed: %s", e)
        return None


async def generate_ftp_plan(assessment: dict, availability: dict) -> dict | None:
    """Generate an FTP training plan via directeur.

    Returns directeur's plan dict or None on missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post(
            "/ftp-goal/plan",
            json={"assessment": assessment, "availability": availability},
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur ftp-goal plan failed: %s", e)
        return None


async def suggest_plan_name(computed: dict, hard_weekdays: list, weeks: int) -> dict | None:
    """Ask directeur to suggest a short motivating plan name.

    Returns directeur's {name} dict or None on missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post(
            "/ftp-goal/plan/name",
            json={"computed": computed, "hard_weekdays": hard_weekdays, "weeks": weeks},
            timeout=60.0,
        )
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur plan name suggestion failed: %s", e)
        return None


async def save_plan(plan: dict) -> dict | None:
    """Persist a training plan via directeur.

    Returns the persisted row dict or None on missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post("/plans/", json=plan)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur save plan failed: %s", e)
        return None


async def get_active_plan(athlete_id: str) -> dict | None:
    """Fetch the latest active training plan for an athlete via directeur.

    Returns directeur's response dict or None on missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().get("/plans/active", params={"athlete_id": athlete_id})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur active plan fetch failed: %s", e)
        return None


async def archive_plan(plan_id: str) -> dict | None:
    """Archive a training plan via directeur.

    Returns directeur's response dict or None on missing directeur_url or any failure.
    """
    config = get_config()
    if not config.directeur_url:
        return None
    try:
        resp = await _get_client().post(f"/plans/{plan_id}/archive")
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("directeur archive plan %s failed: %s", plan_id, e)
        return None


async def get_coaching_snapshot(zone: str = "threshold") -> dict:
    """Fetch readiness + patterns + levels concurrently, then progression for key zone."""
    config = get_config()
    if not config.directeur_url:
        return {"error": "Coaching state unavailable (DIRECTEUR_URL not configured)."}

    readiness_result, patterns_result, levels_result = await asyncio.gather(
        get_readiness(),
        get_active_patterns(),
        get_levels(),
        return_exceptions=True,
    )

    results: dict = {}
    results["readiness"] = readiness_result if isinstance(readiness_result, dict) else None
    results["patterns"] = patterns_result if isinstance(patterns_result, dict) else None
    results["levels"] = levels_result if isinstance(levels_result, dict) else None

    progression = await get_progression(zone)
    results["progression"] = {zone: progression} if progression else {}

    return results
