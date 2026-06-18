"""Recovery pattern analysis MCP tool — correlates wellness signals with performance."""

from datetime import datetime, timedelta

from intervals_mcp_server.analytics.engine import TrainingAnalytics
from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()

_METRIC_LABELS = {
    "hrv": "HRV",
    "resting_hr": "Resting HR",
    "sleep_secs": "Sleep Duration",
    "soreness": "Soreness",
    "fatigue": "Fatigue",
    "stress": "Stress",
    "mood": "Mood",
    "motivation": "Motivation",
}


def _label_for(metric: str) -> str:
    """Human-readable label for a metric, including custom fields."""
    if metric in _METRIC_LABELS:
        return _METRIC_LABELS[metric]
    # Custom fields: bpc157_mcg → BPC-157 (mcg), tb500_mg → TB-500 (mg)
    return metric.replace("_", " ").title()

_PERF_LABELS = {
    "load": "Training Load",
    "avg_power": "Avg Power",
    "if_": "Intensity Factor",
}


@mcp.tool()
async def get_recovery_patterns(
    athlete_id: str | None = None,
    api_key: str | None = None,
    days: int = 60,
    detail: str = "full",
) -> str:
    """Use when asking "what predicts my good days?" or about sleep/HRV/recovery impact on performance.

    Correlates prior-day wellness (sleep, HRV, resting HR, mood, soreness, etc.)
    with next-day performance (load achieved, power output, intensity). Shows which
    signals are most predictive for THIS athlete specifically, and their "good day" vs
    "bad day" wellness profile.

    Set detail='brief' for a compact summary (≤10 lines).

    Args:
        athlete_id: The Intervals.icu athlete ID (optional)
        api_key: The Intervals.icu API key (optional)
        days: Lookback period in days (optional, defaults to 60)
        detail: "full" (default) for verbose output, "brief" for compact ≤4 line summary
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

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
        return f"No activities found for {athlete_id_to_use} in the last {days} days."
    if not wellness_data:
        return f"No wellness data found for {athlete_id_to_use} in the last {days} days."

    analytics = TrainingAnalytics()
    af = analytics.activities_frame(activities)
    wf = analytics.wellness_frame(wellness_data)

    patterns = analytics.recovery_patterns(af, wf, lookback_days=days)

    if patterns["sample_size"] < 8:
        return (
            f"Insufficient paired data ({patterns['sample_size']} days with both "
            "wellness and activity data). Need at least 8 to detect patterns. "
            "Log wellness data consistently for better insights."
        )

    # Brief mode - compact summary
    if detail == "brief":
        brief_lines = ["Recovery Patterns (brief):"]

        correlations = patterns.get("correlations", [])
        good_bad = patterns.get("patterns", [])

        # Strongest predictor metric + correlation
        if correlations:
            top_c = correlations[0]
            w_label = _label_for(top_c["wellness_metric"])
            brief_lines.append(f"  Strongest predictor: {w_label} (r={top_c['correlation']:+.3f}, {top_c['strength']})")
        else:
            brief_lines.append("  Strongest predictor: no significant correlations found")

        # Good-day profile summary
        if good_bad:
            top = good_bad[0]
            top_label = _label_for(top["metric"])
            if top["metric"] == "sleep_secs":
                good_fmt = f"{top['good_day_avg']/3600:.1f}h"
                bad_fmt = f"{top['bad_day_avg']/3600:.1f}h"
            else:
                good_fmt = f"{top['good_day_avg']:.1f}"
                bad_fmt = f"{top['bad_day_avg']:.1f}"
            brief_lines.append(f"  Good-day profile: {top_label} good={good_fmt} vs bad={bad_fmt} (d={top['effect_size']:+.2f})")
        else:
            brief_lines.append("  Good-day profile: insufficient contrast")

        # Key takeaway
        if good_bad:
            top = good_bad[0]
            top_label = _label_for(top["metric"])
            if top["metric"] == "sleep_secs":
                diff_mins = abs(top["good_day_avg"] - top["bad_day_avg"]) / 60
                brief_lines.append(f"  Takeaway: ~{diff_mins:.0f}min more sleep separates good and bad days")
            elif top["metric"] == "hrv":
                diff = abs(top["good_day_avg"] - top["bad_day_avg"])
                brief_lines.append(f"  Takeaway: ~{diff:.0f}ms HRV difference between good and bad days")
            else:
                brief_lines.append(f"  Takeaway: {top_label} is your strongest performance lever")
        elif correlations:
            top_c = correlations[0]
            w_label = _label_for(top_c["wellness_metric"])
            brief_lines.append(f"  Takeaway: {w_label} is your strongest signal")
        else:
            brief_lines.append("  Takeaway: no clear patterns yet, keep logging daily")

        return "\n".join(brief_lines)

    lines = [f"Recovery Pattern Analysis ({days}-day lookback, {patterns['sample_size']} paired days):"]

    # Correlations
    correlations = patterns.get("correlations", [])
    if correlations:
        lines.append("")
        lines.append("Predictive Signals (prior-day wellness → next-day performance):")
        for c in correlations:
            w_label = _label_for(c["wellness_metric"])
            p_label = _PERF_LABELS.get(c["performance_metric"], c["performance_metric"])
            r = c["correlation"]
            strength = c["strength"]
            direction = "↑" if c["direction"] == "positive" else "↓"
            lines.append(
                f"  {w_label} {direction} {p_label}: r={r:+.3f} ({strength}, n={c['n']})"
            )
    else:
        lines.append("")
        lines.append("  No significant correlations found (|r| > 0.2).")
        lines.append("  This can mean: wellness logging is inconsistent, or your")
        lines.append("  performance isn't strongly affected by day-to-day wellness swings.")

    # Good day vs bad day patterns
    good_bad = patterns.get("patterns", [])
    if good_bad:
        lines.append("")
        lines.append("Good Day vs Bad Day Profile (top vs bottom quartile by load):")
        for p in good_bad:
            metric_label = _label_for(p["metric"])
            good_val = p["good_day_avg"]
            bad_val = p["bad_day_avg"]
            effect = p["effect_size"]

            if p["metric"] == "sleep_secs":
                good_fmt = f"{good_val/3600:.1f}h"
                bad_fmt = f"{bad_val/3600:.1f}h"
            else:
                good_fmt = f"{good_val:.1f}"
                bad_fmt = f"{bad_val:.1f}"

            strength = "strong" if abs(effect) > 0.8 else "moderate"
            lines.append(
                f"  {metric_label}: good days={good_fmt}, bad days={bad_fmt} "
                f"(d={effect:+.2f}, {strength})"
            )
            lines.append(f"    → {p['interpretation']}")

    # Actionable summary
    lines.append("")
    lines.append("Key Takeaways:")
    if good_bad:
        top = good_bad[0]
        top_label = _label_for(top["metric"])
        lines.append(f"  Your strongest predictor is {top_label} (effect size d={top['effect_size']:+.2f})")
        if top["metric"] == "sleep_secs":
            diff_mins = abs(top["good_day_avg"] - top["bad_day_avg"]) / 60
            lines.append(f"  ~{diff_mins:.0f} minutes more sleep separates your good and bad days")
        elif top["metric"] == "hrv":
            diff = abs(top["good_day_avg"] - top["bad_day_avg"])
            lines.append(f"  ~{diff:.0f}ms HRV difference between your good and bad days")
    elif correlations:
        top_c = correlations[0]
        w_label = _label_for(top_c["wellness_metric"])
        lines.append(f"  Your strongest signal is {w_label} (r={top_c['correlation']:+.3f})")
    else:
        lines.append("  No clear patterns yet. Keep logging wellness daily for better signal.")

    return "\n".join(lines)
