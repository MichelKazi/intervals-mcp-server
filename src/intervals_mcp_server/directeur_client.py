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


async def get_coaching_snapshot(zone: str = "threshold") -> dict:
    """Fetch readiness + patterns concurrently, then progression for key zone."""
    config = get_config()
    if not config.directeur_url:
        return {"error": "Coaching state unavailable (DIRECTEUR_URL not configured)."}

    readiness_result, patterns_result = await asyncio.gather(
        get_readiness(),
        get_active_patterns(),
        return_exceptions=True,
    )

    results: dict = {}
    results["readiness"] = readiness_result if isinstance(readiness_result, dict) else None
    results["patterns"] = patterns_result if isinstance(patterns_result, dict) else None

    progression = await get_progression(zone)
    results["progression"] = {zone: progression} if progression else {}

    return results
