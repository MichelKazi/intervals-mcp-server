"""Training insights MCP tool — dense server-side analytics via polars."""

from datetime import datetime, timedelta
from typing import Any

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _seconds_to_hms(secs: int | float | None) -> str:
    if not secs:
        return "0:00"
    s = int(secs)
    h, m = divmod(s, 3600)
    m, sec = divmod(m, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m{sec:02d}s"


def _format_load_trend(trend: dict[str, Any]) -> list[str]:
    lines = ["Load Progression:"]
    for w in trend["weeks"]:
        week_str = str(w["week"])[:10]
        load = w["total_load"] or 0
        delta = w.get("load_delta")
        monotony = w.get("monotony")
        sessions = w["session_count"]
        dur = _seconds_to_hms(w["total_duration"])

        parts = [f"  {week_str}: Load={load:.0f}"]
        if delta is not None:
            parts.append(f"Δ{delta:+.0f}")
        parts.append(f"{sessions} sessions, {dur}")
        if monotony is not None:
            parts.append(f"Monotony={monotony:.1f}")
        lines.append(" | ".join(parts))

    if trend.get("load_trend_pct") is not None:
        pct = trend["load_trend_pct"]
        direction = "Building" if pct > 5 else "Tapering" if pct < -5 else "Maintaining"
        lines.append(f"  → {direction} ({pct:+.1f}% over period)")
    return lines


def _format_efficiency(eff: dict[str, Any]) -> list[str]:
    lines = ["Aerobic Efficiency:"]
    for w in eff["weeks"]:
        week_str = str(w["week"])[:10]
        ratio = w["avg_pwr_hr"]
        n = w["n"]
        ef = w.get("avg_ef")
        dc = w.get("avg_decouple")

        parts = [f"  {week_str}: Pwr:HR={ratio:.3f} (n={n})"]
        if ef is not None:
            parts.append(f"EF={ef:.2f}")
        if dc is not None:
            parts.append(f"Decouple={dc:.1f}%")
        lines.append(" | ".join(parts))

    if eff.get("trend_pct") is not None:
        pct = eff["trend_pct"]
        if pct > 3:
            lines.append(f"  → Improving (+{pct:.1f}%)")
        elif pct < -3:
            lines.append(f"  → Declining ({pct:.1f}%)")
        else:
            lines.append(f"  → Stable ({pct:+.1f}%)")
    return lines


def _format_wellness(wellness: dict[str, Any]) -> list[str]:
    lines = ["Wellness Signals:"]

    tsb = wellness.get("tsb")
    ctl = wellness.get("ctl")
    atl = wellness.get("atl")
    if tsb is not None:
        if tsb > 15:
            form = "Very Fresh"
        elif tsb > 5:
            form = "Fresh"
        elif tsb > -10:
            form = "Neutral"
        elif tsb > -25:
            form = "Fatigued"
        else:
            form = "Very Fatigued"
        lines.append(f"  Form: TSB={tsb} ({form}) | CTL={ctl} | ATL={atl}")

    for col, label, unit in [
        ("hrv", "HRV", "ms"),
        ("resting_hr", "RHR", "bpm"),
        ("sleep_secs", "Sleep", "s"),
        ("weight", "Weight", "kg"),
    ]:
        data = wellness.get(col)
        if not data:
            continue
        current = data["current"]
        mean = data["mean_28d"]
        z = data.get("z_score")

        if col == "sleep_secs":
            current_fmt = f"{current/3600:.1f}h"
            mean_fmt = f"{mean/3600:.1f}h"
        else:
            current_fmt = f"{current}{unit}"
            mean_fmt = f"{mean}{unit}"

        part = f"  {label}: {current_fmt} (28d avg: {mean_fmt}"
        if z is not None:
            flag = ""
            if col == "resting_hr" and z > 1.5:
                flag = " ⚠ elevated"
            elif col == "hrv" and z < -1.5:
                flag = " ⚠ suppressed"
            elif col == "sleep_secs" and z < -1.5:
                flag = " ⚠ sleep deficit"
            part += f", z={z:+.1f}{flag}"
        part += ")"
        lines.append(part)

    return lines


def _format_standouts(standouts: list[dict[str, Any]]) -> list[str]:
    if not standouts:
        return []
    lines = ["Notable Efforts:"]
    for s in standouts:
        lines.append(f"  {s['date']} {s['name']}: {s['metric']}={s['value']} (z={s['z_score']:+.1f})")
    return lines


def _format_sport_dist(dist: list[dict[str, Any]]) -> list[str]:
    if not dist:
        return []
    total_load = sum(d["total_load"] for d in dist)
    lines = ["Sport Mix:"]
    for d in dist:
        pct = round(d["total_load"] / total_load * 100) if total_load else 0
        lines.append(
            f"  {d['type']}: {d['count']}x, {_seconds_to_hms(d['total_time'])}, "
            f"{d['total_distance']/1000:.0f}km, {pct}% of load"
        )
    return lines


@mcp.tool()
async def get_training_insights(
    athlete_id: str | None = None,
    api_key: str | None = None,
    period: str = "6w",
) -> str:
    """START HERE for any general training question. Comprehensive server-side analytics in one call.

    Returns load progression with monotony/strain, aerobic efficiency trend,
    wellness z-scores vs 28-day baseline, standout efforts (statistical outliers),
    and sport distribution. Replaces calling get_activities + get_wellness + manual math.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        period: Analysis window — e.g. "4w", "6w", "8w", "12w" (optional, defaults to "6w")
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    weeks = int(period.rstrip("w")) if period.endswith("w") else 6
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(weeks=weeks)).strftime("%Y-%m-%d")

    # Fetch data
    act_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/activities",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date, "limit": 500},
    )
    well_result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/wellness",
        api_key=api_key,
        params={"oldest": start_date, "newest": end_date},
    )

    activities = [a for a in (act_result if isinstance(act_result, list) else []) if isinstance(a, dict) and a.get("name")]
    wellness_data = [w for w in (well_result if isinstance(well_result, list) else []) if isinstance(w, dict)]

    if not activities:
        return f"No activities found for {athlete_id_to_use} in the last {weeks} weeks."

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(activities)
    wf = analytics.wellness_frame(wellness_data) if wellness_data else None

    now = datetime.now()
    lines = [f"Training Insights (generated {now.strftime('%Y-%m-%d %H:%M')}, period {start_date} to {end_date}, {len(activities)} activities):"]
    lines.append("")

    # Load trend
    load = analytics.load_trend(af, weeks=weeks)
    lines.extend(_format_load_trend(load))
    lines.append("")

    # Efficiency
    eff = analytics.efficiency_trend(af, weeks=weeks)
    if eff["weeks"]:
        lines.extend(_format_efficiency(eff))
        lines.append("")

    # Wellness
    if wf is not None and not wf.is_empty():
        well_trends = analytics.wellness_trends(wf, days=28)
        if well_trends:
            lines.extend(_format_wellness(well_trends))
            lines.append("")

    # Standout efforts
    standouts = analytics.standout_efforts(af, days=min(weeks * 7, 28))
    if standouts:
        lines.extend(_format_standouts(standouts))
        lines.append("")

    # Sport distribution
    dist = analytics.sport_distribution(af)
    if dist:
        lines.extend(_format_sport_dist(dist))

    return "\n".join(lines)
