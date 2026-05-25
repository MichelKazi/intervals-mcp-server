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
