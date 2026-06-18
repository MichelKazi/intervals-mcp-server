"""Progression level tools — query and correct athlete levels per zone."""

from intervals_mcp_server.directeur_client import (
    get_levels,
    post_level_correction,
    recompute_levels,
)
from intervals_mcp_server.mcp_instance import mcp


VALID_ZONES = ["endurance", "tempo", "sweet_spot", "threshold", "vo2max", "anaerobic", "sprint"]


def _format_levels_output(data: dict) -> str:
    """Format levels response for Claude consumption."""
    zones = data.get("zones", {})
    ftp = data.get("ftp")

    if not zones:
        return "No progression levels computed yet. Use recompute=true to trigger computation."

    parts = []
    parts.append(f"Athlete Progression Levels (FTP: {ftp}W)")
    parts.append("=" * 50)

    sorted_zones = sorted(zones.items(), key=lambda x: x[1].get("level", 0), reverse=True)

    for zone, info in sorted_zones:
        level = info.get("level", "?")
        delta = info.get("delta", 0)
        confidence = info.get("confidence", "?")
        reasoning = info.get("reasoning", "")
        is_correction = info.get("is_correction", False)

        delta_str = f" ({delta:+.1f})" if delta else ""
        conf_flag = " [LOW CONFIDENCE]" if confidence == "low" else ""
        correction_flag = " [ATHLETE OVERRIDE]" if is_correction else ""

        parts.append(f"\n{zone.replace('_', ' ').title()}: {level}/10{delta_str}{conf_flag}{correction_flag}")
        if reasoning:
            parts.append(f"  {reasoning}")

    # Asymmetry summary
    asymmetry_notes = set()
    for info in zones.values():
        note = info.get("asymmetry_note")
        if note:
            asymmetry_notes.add(note)

    if asymmetry_notes:
        parts.append("\n" + "-" * 50)
        parts.append("Zone Asymmetry:")
        for note in asymmetry_notes:
            parts.append(f"  {note}")

    return "\n".join(parts)


def _format_correction_output(data: dict) -> str:
    """Format correction response."""
    parts = []
    parts.append(f"Level Correction Applied: {data['zone'].replace('_', ' ').title()}")
    parts.append(f"  Original computed: {data.get('original_computed_level', '?')}")
    parts.append(f"  Corrected to: {data.get('corrected_to', '?')}")
    parts.append(f"  Rationale: {data.get('rationale', '')}")
    parts.append(f"  Expires: {data.get('expires_at', '?')}")
    parts.append(f"  {data.get('blend_behavior', '')}")
    return "\n".join(parts)


@mcp.tool()
async def get_progression_levels(zone: str | None = None, recompute: bool = False) -> str:
    """Get athlete progression levels (1-10 scale) for all or a specific training zone.

    Returns the current difficulty level the athlete can handle in each zone, with
    DeepSeek-generated reasoning explaining why each level is what it is. Levels are
    FTP-relative and recency-weighted from the last 6 weeks of training.

    Also flags zone asymmetries (strengths/weaknesses) that are coaching-relevant.

    Args:
        zone: Specific zone to query (default: all zones).
              Options: endurance, tempo, sweet_spot, threshold, vo2max, anaerobic, sprint
        recompute: If true, triggers fresh computation before returning (takes ~30s).
                   Otherwise returns cached latest values.
    """
    if zone and zone not in VALID_ZONES:
        return f"Unknown zone: {zone}. Valid options: {', '.join(VALID_ZONES)}"

    if recompute:
        result = await recompute_levels()
        if not result:
            return "Level recomputation failed (directeur unreachable)."
        data = await get_levels(zone)
    else:
        data = await get_levels(zone)

    if not data:
        return "Progression levels unavailable (directeur not reachable or not configured)."

    if zone:
        # Single zone detail response
        current = data.get("current")
        if not current:
            return f"No level data for {zone}. Try recompute=true."
        history = data.get("history", [])
        parts = [_format_levels_output({"zones": {zone: current}, "ftp": current.get("ftp")})]
        if history:
            parts.append("\nRecent history:")
            for h in history:
                parts.append(f"  {h.get('computed_at', '?')[:10]}: {h.get('level', '?')}/10 ({h.get('delta', 0):+.1f})")
        return "\n".join(parts)

    return _format_levels_output(data)


@mcp.tool()
async def correct_progression_level(
    zone: str,
    proposed_level: float,
    rationale: str,
    duration_days: int = 14,
) -> str:
    """Submit an athlete correction to a progression level.

    Use when the athlete believes a computed level doesn't match their perceived ability.
    The correction blends with future computed values (70% computed / 30% correction)
    and expires after duration_days, at which point the system resumes pure computation.

    Both the original computed value and the correction are preserved — nothing is lost.

    Args:
        zone: Which zone to correct.
              Options: endurance, tempo, sweet_spot, threshold, vo2max, anaerobic, sprint
        proposed_level: The athlete's proposed level (1.0-10.0)
        rationale: Why the athlete believes the level should be different
        duration_days: How many days the correction should influence computation (default 14)
    """
    if zone not in VALID_ZONES:
        return f"Unknown zone: {zone}. Valid options: {', '.join(VALID_ZONES)}"

    if not 1.0 <= proposed_level <= 10.0:
        return "proposed_level must be between 1.0 and 10.0"

    if not rationale.strip():
        return "A rationale is required — explain why you think the level should change."

    result = await post_level_correction(zone, proposed_level, rationale, duration_days)
    if not result:
        return "Correction failed (directeur not reachable)."

    return _format_correction_output(result)
