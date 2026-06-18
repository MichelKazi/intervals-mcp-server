"""Coaching state tool — pulls pre-computed intelligence from directeur."""

import json

from intervals_mcp_server.directeur_client import (
    _staleness_note,
    get_coaching_snapshot,
    get_readiness,
)
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401


@mcp.tool()
async def get_coaching_state(zone: str = "threshold") -> str:
    """Get pre-computed coaching intelligence: readiness verdict, active patterns, and progression.

    Returns a compact snapshot from the directeur coaching engine including:
    - Today's readiness verdict (green/yellow/red) with confounds
    - Active behavioral patterns (volume_collapse, dropout risk, etc.) with severity
    - Recent progression state for the specified training zone

    Use this to answer questions like "how's my training going", "am I ready to ride hard today",
    or "what patterns should I watch for". Prefer this over raw data for coaching conversations.

    Args:
        zone: Training zone to fetch progression for (default: "threshold").
              Options: threshold, vo2max, sweet-spot, endurance, anaerobic
    """
    snapshot = await get_coaching_snapshot(zone=zone)

    if "error" in snapshot:
        return snapshot["error"]

    parts = []

    readiness = snapshot.get("readiness")
    if readiness and readiness.get("verdict"):
        verdict = readiness["verdict"].upper()
        reasoning = readiness.get("reasoning", "")
        line = f"Readiness: {verdict}"
        if reasoning:
            line += f" — {reasoning}"
        stale = _staleness_note(readiness.get("computed_at"))
        if stale:
            line += f" {stale}"
        parts.append(line)

        confounds = readiness.get("confounds")
        if confounds and isinstance(confounds, dict):
            flags = [f"{k}={v}" for k, v in confounds.items() if v and v not in ("none", "clear")]
            if flags:
                parts.append(f"  Confounds: {', '.join(flags)}")
    else:
        parts.append("Readiness: no data available")

    patterns_data = snapshot.get("patterns")
    if patterns_data:
        active = patterns_data.get("patterns", [])
        if active:
            for p in active[:5]:
                severity = p.get("severity", "?")
                pattern_type = p.get("pattern_type") or p.get("pattern_id", "unknown")
                line = f"Patterns: {pattern_type} (severity {severity}/5)"
                ctx = p.get("context")
                if ctx and isinstance(ctx, dict):
                    evidence = ctx.get("evidence") or ctx.get("recommendation")
                    if evidence:
                        line += f" — {evidence[:120]}"
                parts.append(line)
        else:
            parts.append("Patterns: none active")
    else:
        parts.append("Patterns: unavailable")

    levels_data = snapshot.get("levels")
    if levels_data and levels_data.get("zones"):
        zones = levels_data["zones"]
        sorted_zones = sorted(zones.items(), key=lambda x: x[1].get("level", 0), reverse=True)
        level_strs = [f"{z.replace('_',' ').title()}={info.get('level', '?')}" for z, info in sorted_zones]
        parts.append(f"Levels: {', '.join(level_strs)}")
        # Flag asymmetry if present
        for info in zones.values():
            note = info.get("asymmetry_note")
            if note:
                parts.append(f"  Asymmetry: {note}")
                break

    progression = snapshot.get("progression", {})
    if progression:
        for z, state in progression.items():
            level = state.get("tr_anchored_level", "?")
            delta = state.get("personal_delta")
            delta_str = "stable"
            if delta is not None:
                delta_str = f"+{delta:.1f}" if delta > 0 else f"{delta:.1f}" if delta < 0 else "stable"

            line = f"{z.title()} progression: level {level}, personal_delta={delta_str}"
            ctx = state.get("context")
            if isinstance(ctx, str):
                try:
                    ctx = json.loads(ctx)
                except (json.JSONDecodeError, TypeError):
                    ctx = None
            if ctx and isinstance(ctx, dict):
                activity_name = ctx.get("activity_name")
                execution = ctx.get("execution_quality")
                if activity_name:
                    line += f', last scored "{activity_name}"'
                if execution is not None:
                    line += f" (execution {execution:.2f})"
            stale = _staleness_note(state.get("scored_at"))
            if stale:
                line += f" {stale}"
            parts.append(line)
    else:
        parts.append(f"{zone.title()} progression: no data yet")

    return "\n".join(parts)


@mcp.tool()
async def get_readiness_verdict() -> str:
    """Get today's readiness verdict (green/yellow/red) with reasoning.

    Quick check for whether it's a good day to train hard. Returns the
    directeur's confound-aware readiness assessment accounting for:
    - Fatigue (acute:chronic workload)
    - Medical protocols (e.g., medication effects)
    - Calendar context (travel, sleep disruption)
    - Wellness markers (HRV, sleep, soreness)
    """
    data = await get_readiness()
    if not data:
        return "Readiness data unavailable (directeur not reachable or not configured)."

    if not data.get("verdict"):
        return data.get("message", "No readiness data available yet.")

    parts = [f"Verdict: {data['verdict'].upper()}"]
    if data.get("confidence"):
        parts.append(f"Confidence: {data['confidence']:.0%}")
    if data.get("reasoning"):
        parts.append(f"Reasoning: {data['reasoning']}")
    if data.get("confounds") and isinstance(data["confounds"], dict):
        flags = [f"{k}={v}" for k, v in data["confounds"].items() if v and v not in ("none", "clear")]
        if flags:
            parts.append(f"Confounds: {', '.join(flags)}")
    if data.get("date"):
        parts.append(f"Date: {data['date']}")

    stale = _staleness_note(data.get("computed_at"))
    if stale:
        parts.append(stale)

    return "\n".join(parts)
