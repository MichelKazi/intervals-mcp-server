"""Risk flag management — writes/resolves flags in Supabase risk_flags table."""

import logging
from datetime import datetime
from typing import Any

from intervals_mcp_server.config import get_config
from intervals_mcp_server.supabase_client import get_supabase, supabase_upsert

logger = logging.getLogger("intervals_icu_mcp_server")


def raise_risk_flag(
    flag_type: str,
    severity: str,
    context: dict[str, Any],
    source_tool: str,
) -> None:
    """Upsert a risk flag. Deduplicates by (athlete_id, flag_type, date)."""
    client = get_supabase()
    if client is None:
        return

    config = get_config()

    row = {
        "athlete_id": config.athlete_id,
        "flag_type": flag_type,
        "severity": severity,
        "context": context,
        "source_tool": source_tool,
        "detected_at": datetime.now().isoformat(),
    }

    supabase_upsert("risk_flags", row, on_conflict="athlete_id,flag_type,detected_date")


def get_active_flags() -> list[dict[str, Any]]:
    """Return all active (unresolved) risk flags for the current athlete."""
    client = get_supabase()
    if client is None:
        return []

    config = get_config()
    try:
        result = (
            client.table("risk_flags")
            .select("flag_type,severity,context,source_tool,detected_at")
            .eq("athlete_id", config.athlete_id)
            .is_("resolved_at", "null")
            .execute()
        )
        return [
            {"flag": r["flag_type"], "severity": r["severity"], "context": r.get("context", {})}
            for r in (result.data or [])
        ]
    except Exception as e:
        logger.warning("Failed to fetch active risk flags: %s", e)
        return []


def resolve_risk_flag(flag_type: str) -> None:
    """Resolve an active risk flag (set resolved_at)."""
    client = get_supabase()
    if client is None:
        return

    config = get_config()
    try:
        (
            client.table("risk_flags")
            .update({"resolved_at": datetime.now().isoformat()})
            .eq("athlete_id", config.athlete_id)
            .eq("flag_type", flag_type)
            .is_("resolved_at", "null")
            .execute()
        )
    except Exception as e:
        logger.warning("Failed to resolve risk flag %s: %s", flag_type, e)
