"""Tool response warnings — appended to tool outputs when actionable issues are detected.

Each warning check is a lightweight Supabase query. Warnings include a suggested
tool call so Claude can offer to resolve the issue without the user needing to
remember the right tool name.
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.config import get_config
from intervals_mcp_server.supabase_client import get_supabase

logger = logging.getLogger("intervals_icu_mcp_server")

config = get_config()


def _check_unlinked_race_reports() -> list[dict[str, Any]]:
    """Find race reports with no activity linked."""
    client = get_supabase()
    if client is None:
        return []
    try:
        result = (
            client.table("race_reports")
            .select("date,race_name,vault_path")
            .eq("athlete_id", config.athlete_id)
            .or_("intervals_activity_id.is.null,intervals_activity_id.eq.")
            .order("date", desc=True)
            .limit(5)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.debug("Warning check failed (unlinked_race_reports): %s", e)
        return []


def _check_pending_vault_writes() -> list[dict[str, Any]]:
    """Find race reports where the vault write failed and needs retry."""
    client = get_supabase()
    if client is None:
        return []
    try:
        result = (
            client.table("race_reports")
            .select("date,race_name,intervals_activity_id")
            .eq("athlete_id", config.athlete_id)
            .eq("vault_write_ok", False)
            .limit(5)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.debug("Warning check failed (pending_vault_writes): %s", e)
        return []


def _check_unresolved_risk_flags() -> list[dict[str, Any]]:
    """Find active (unresolved) risk flags."""
    client = get_supabase()
    if client is None:
        return []
    try:
        result = (
            client.table("risk_flags")
            .select("flag_type,severity,detected_at")
            .eq("athlete_id", config.athlete_id)
            .is_("resolved_at", "null")
            .limit(5)
            .execute()
        )
        return result.data or []
    except Exception as e:
        logger.debug("Warning check failed (unresolved_risk_flags): %s", e)
        return []


async def _check_race_activities_for_unlinked(
    unlinked_reports: list[dict[str, Any]],
) -> list[dict[str, str]]:
    """For each unlinked report, find candidate activities on that date."""
    if not unlinked_reports:
        return []

    from intervals_mcp_server.api.client import make_intervals_request

    candidates = []
    for report in unlinked_reports:
        race_date = report["date"]
        result = await make_intervals_request(
            url=f"/athlete/{config.athlete_id}/activities",
            params={"oldest": race_date, "newest": race_date},
        )
        if isinstance(result, list) and result:
            activity_options = []
            for a in result:
                if isinstance(a, dict) and a.get("type") in ("Ride", "VirtualRide", "Run"):
                    name = a.get("name", "Unnamed")
                    aid = a.get("id", "?")
                    duration_min = round((a.get("moving_time") or 0) / 60)
                    activity_options.append(f"{aid} \"{name}\" ({duration_min}min)")

            if activity_options:
                candidates.append({
                    "race_name": report["race_name"],
                    "date": race_date,
                    "candidate_activities": activity_options,
                })
    return candidates


async def collect_warnings() -> str:
    """Run all warning checks and return formatted warning block (or empty string)."""
    warnings: list[str] = []

    # 1. Unlinked race reports with candidate activities
    unlinked = _check_unlinked_race_reports()
    if unlinked:
        candidates = await _check_race_activities_for_unlinked(unlinked)
        for c in candidates:
            acts = ", ".join(c["candidate_activities"])
            warnings.append(
                f"UNLINKED_RACE_REPORT: \"{c['race_name']}\" ({c['date']}) has no activity linked. "
                f"Candidates: [{acts}]. "
                f"Fix: link_race_report(activity_id=<chosen_id>, date=\"{c['date']}\")"
            )
        # Reports with no candidates on that date
        linked_dates = {c["date"] for c in candidates}
        for report in unlinked:
            if report["date"] not in linked_dates:
                warnings.append(
                    f"UNLINKED_RACE_REPORT: \"{report['race_name']}\" ({report['date']}) has no activity linked "
                    f"and no matching activities found on that date. Activity may not be uploaded yet."
                )

    # 2. Pending vault writes
    pending = _check_pending_vault_writes()
    for p in pending:
        warnings.append(
            f"PENDING_VAULT_WRITE: Race report \"{p['race_name']}\" ({p['date']}) vault write failed. "
            f"Fix: write_race_report(...) with same parameters to retry."
        )

    # 3. Unresolved risk flags
    risk_flags = _check_unresolved_risk_flags()
    for rf in risk_flags:
        warnings.append(
            f"ACTIVE_RISK_FLAG: {rf['flag_type']} (severity: {rf['severity']}, "
            f"since: {rf.get('detected_at', '?')[:10]}). "
            f"Review: coaching_get_risk_flags()"
        )

    if not warnings:
        return ""

    header = "\n\n---\n⚠️ WARNINGS ({} issue{}):\n".format(
        len(warnings), "s" if len(warnings) > 1 else ""
    )
    return header + "\n".join(f"  • {w}" for w in warnings)
