"""Power curve progression MCP tool — performance timeline via polars."""

from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


@mcp.tool()
async def get_power_progression(
    athlete_id: str | None = None,
    api_key: str | None = None,
    sport: str = "Ride",
) -> str:
    """Power curve progression: compare last 28 days to 90-day baseline.

    Shows peak power at key durations (5s, 30s, 1min, 5min, 20min, 60min),
    how close you are to your own best, and classifies your rider profile
    (sprinter, puncheur, time trialist, all-rounder).

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        sport: Sport type for curve (default "Ride")
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    now = datetime.now()
    recent_start = (now - timedelta(days=28)).strftime("%Y-%m-%d")
    baseline_start = (now - timedelta(days=90)).strftime("%Y-%m-%d")
    end_date = now.strftime("%Y-%m-%d")

    recent_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        api_key=api_key,
        params={"oldest": recent_start, "newest": end_date, "type": sport},
    )
    baseline_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/power-curves",
        api_key=api_key,
        params={"oldest": baseline_start, "newest": end_date, "type": sport},
    )

    if isinstance(recent_result, dict) and "error" in recent_result:
        return f"Error: {recent_result.get('message')}"

    recent_curve = _normalize_curve(recent_result)
    baseline_curve = _normalize_curve(baseline_result)

    if not recent_curve and not baseline_curve:
        return f"No power curve data available for {sport}."

    analytics = TrainingAnalytics()
    progression = analytics.power_curve_progression(recent_curve, baseline_curve)

    # Fetch weight for W/kg
    athlete_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}", api_key=api_key
    )
    weight = None
    if isinstance(athlete_result, dict):
        weight = athlete_result.get("weight")

    lines = [f"Power Curve Progression ({sport}):"]
    lines.append(f"  Recent: last 28 days | Baseline: last 90 days")
    lines.append("")

    comparisons = progression.get("comparisons", [])
    if not comparisons:
        lines.append("  No data at key durations.")
        return "\n".join(lines)

    for c in comparisons:
        dur = c["duration"]
        recent_w = c.get("recent_watts")
        baseline_w = c.get("baseline_watts")
        pct = c.get("pct_of_best")

        parts = [f"  {dur:>5}:"]
        if recent_w:
            parts.append(f"{recent_w}W")
            if weight:
                parts.append(f"({recent_w/weight:.2f} W/kg)")
        if baseline_w:
            parts.append(f"best={baseline_w}W")
        if pct is not None:
            bar = _pct_bar(pct)
            if pct >= 95:
                status = "AT PEAK"
            elif pct >= 85:
                status = "near peak"
            elif pct >= 70:
                status = "building"
            else:
                status = "below form"
            parts.append(f"{bar} {pct:.0f}% ({status})")
        lines.append(" | ".join(parts))

    profile = progression.get("profile", "unknown")
    lines.append("")
    lines.append(f"  Profile: {profile}")

    # Summary
    pcts = [c["pct_of_best"] for c in comparisons if c.get("pct_of_best")]
    if pcts:
        avg_pct = sum(pcts) / len(pcts)
        lines.append("")
        if avg_pct >= 95:
            lines.append("  Status: Peak form — race-ready across the board")
        elif avg_pct >= 85:
            lines.append("  Status: Good form — key durations strong")
        elif avg_pct >= 70:
            lines.append("  Status: Building — trending toward peak")
        else:
            lines.append("  Status: Early season or recovering — well below recent bests")

    return "\n".join(lines)


def _normalize_curve(data: Any) -> list[int | float | None]:
    """Extract a flat power curve array from various API response formats."""
    if isinstance(data, list):
        if data and isinstance(data[0], (int, float, type(None))):
            return data
        # Array of dicts with "watts" or "value" keys
        if data and isinstance(data[0], dict):
            max_secs = max((d.get("secs", 0) for d in data), default=0)
            curve: list[int | float | None] = [None] * (max_secs + 1)
            for d in data:
                secs = d.get("secs")
                val = d.get("value", d.get("watts"))
                if secs is not None and val is not None:
                    curve[secs] = val
            return curve
    return []


def _pct_bar(pct: float) -> str:
    """Compact visual bar for percentage."""
    filled = int(pct / 10)
    return "█" * filled + "░" * (10 - filled)
