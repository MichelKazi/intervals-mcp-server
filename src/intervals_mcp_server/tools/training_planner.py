"""Training block planner — builds a week-by-week menu using directeur state + TR library."""

from datetime import date, timedelta

from intervals_mcp_server.directeur_client import get_planning_context
from intervals_mcp_server.mcp_instance import mcp
from intervals_mcp_server.trainerroad.library import search_library


ZONE_REASONING = {
    "threshold": "builds sustained power at FTP",
    "vo2max": "expands aerobic ceiling and VO2max capacity",
    "sweet-spot": "high training stimulus with manageable fatigue",
    "anaerobic": "develops short-duration repeatability",
    "endurance": "aerobic base and fat oxidation",
    "tempo": "muscular endurance at moderate intensity",
    "sprint": "neuromuscular power and peak wattage",
}

ZONE_TO_ADAPTATION = {
    "threshold": "threshold_power",
    "vo2max": "vo2max",
    "sweet-spot": "threshold_power",
    "anaerobic": "anaerobic_capacity",
    "endurance": "aerobic_base",
    "tempo": "tempo_endurance",
    "sprint": "sprint_power",
}

ZONE_INTENSITY_CEILING = {
    "endurance": 80,
    "recovery": 60,
    "tempo": 95,
    "sweet-spot": 105,
}


def _format_duration(secs: int) -> str:
    h, remainder = divmod(secs, 3600)
    m, _ = divmod(remainder, 60)
    if h:
        return f"{h}h{m:02d}m"
    return f"{m}m"


def _compute_week_tss_targets(
    baseline_tss: float,
    weeks: int,
    recovery_pattern: str,
) -> list[dict]:
    parts = recovery_pattern.split(":")
    hard_weeks = int(parts[0]) if len(parts) == 2 else 3
    recovery_weeks = int(parts[1]) if len(parts) == 2 else 1
    cycle_len = hard_weeks + recovery_weeks

    targets = []
    for i in range(weeks):
        pos_in_cycle = i % cycle_len
        if pos_in_cycle >= hard_weeks:
            targets.append({"tss": baseline_tss * 0.6, "type": "recovery"})
        else:
            overload = 1.0 + (pos_in_cycle * 0.05)
            targets.append({"tss": baseline_tss * overload, "type": "build"})
    return targets


def _assign_zones_to_days(
    hard_days_per_week: int,
    target_zones: list[str],
) -> list[str]:
    assigned = []
    for i in range(hard_days_per_week):
        assigned.append(target_zones[i % len(target_zones)])
    return assigned


def _find_confound_dates(planning_context: dict) -> set[date]:
    blocked = set()
    upcoming = planning_context.get("confounds_upcoming", [])
    for c in upcoming:
        d = c.get("date")
        if d:
            try:
                event_date = date.fromisoformat(d)
                blocked.add(event_date)
                blocked.add(event_date + timedelta(days=1))
            except ValueError:
                pass
    return blocked


def _build_workout_reasoning(
    workout: dict,
    zone: str,
    zone_delta: dict | None,
    week_type: str,
) -> str:
    pattern = workout.get("interval_pattern", "")
    zone_desc = ZONE_REASONING.get(zone, zone)

    parts = [f"{zone.replace('-', ' ').title()} work — {zone_desc}."]
    if pattern:
        pattern_label = pattern.replace("_", " ")
        if not pattern_label.endswith("intervals"):
            pattern_label += " intervals"
        parts.append(f"Structure: {pattern_label}.")

    if zone_delta:
        delta = zone_delta.get("personal_delta")
        if delta is not None:
            if delta > 0:
                parts.append(f"Your {zone} delta is +{delta:.1f} (improving) — maintain stimulus.")
            elif delta < 0:
                parts.append(f"Your {zone} delta is {delta:.1f} (declining) — rebuild with focused work.")
            else:
                parts.append(f"Your {zone} is stable — this pushes adaptation.")

    if week_type == "recovery":
        parts.append("Reduced volume for recovery week — shorter variant OK.")

    return " ".join(parts)


def _format_workout_option(
    workout: dict,
    label: str,
    reasoning: str,
) -> str:
    name = workout.get("name", "?")
    wid = workout.get("tr_workout_id", "?")
    dur = _format_duration(workout.get("duration_secs", 0))
    tss = workout.get("tss", 0)
    pattern = workout.get("interval_pattern", "")
    is_race = workout.get("race_specific", False)

    line = f"    Option {label}: {name} [{wid}] — {dur}, TSS {tss:.0f}"
    if pattern:
        line += f", {pattern} pattern"
    if is_race:
        line += " [RACE-SPECIFIC]"
    line += f"\n      Why: {reasoning}"
    return line


def _search_zone_pool(
    zone: str,
    adaptation: str | None,
    tss_floor: float,
    tss_ceiling: float,
    duration_max_secs: int,
    race_specific: bool,
    indoor_only: bool,
) -> list[dict]:
    """Search for workouts appropriate to a zone, with intensity guardrails."""
    intensity_ceiling = ZONE_INTENSITY_CEILING.get(zone)

    pool = search_library(
        adaptation_target=adaptation,
        duration_max=duration_max_secs,
        duration_min=2700,
        tss_min=tss_floor,
        tss_max=tss_ceiling,
        intensity_max=intensity_ceiling,
        race_specific=race_specific if race_specific else None,
        indoor_only=indoor_only if indoor_only else None,
        limit=12,
    )
    if not pool:
        pool = search_library(
            adaptation_target=adaptation,
            duration_max=duration_max_secs,
            tss_max=tss_ceiling,
            intensity_max=intensity_ceiling,
            race_specific=race_specific if race_specific else None,
            indoor_only=indoor_only if indoor_only else None,
            limit=12,
        )
    return pool


@mcp.tool()
async def build_training_block(
    weeks: int,
    hard_days_per_week: int = 2,
    target_zones: list[str] | None = None,
    recovery_pattern: str = "3:1",
    max_duration_minutes: int = 90,
    indoor_only: bool = False,
    race_specific: bool = False,
) -> str:
    """Build a structured training block with workout recommendations from the TR library.

    Produces a week-by-week menu where each hard-day slot has 2-3 workout options with
    coaching reasoning. Uses directeur's planning context to apply constraints (patterns,
    confounds, readiness) and progressive overload. Easy days get duration/zone prescriptions.

    Target TSS represents the total weekly training load budget (hard days + easy days combined).
    Hard-day workouts are sized to leave room for easy-day volume (estimated at 40-60 TSS/day).

    This is a recommendation tool — it does NOT schedule anything. Use create_custom_workout
    or the Intervals.icu calendar to schedule chosen workouts.

    Args:
        weeks: Block length in weeks (1-8)
        hard_days_per_week: Number of intensity days per week (1-4, default 2)
        target_zones: Zones to develop (default: ["threshold", "vo2max"]).
            Options: threshold, vo2max, sweet-spot, anaerobic, endurance, tempo, sprint
        recovery_pattern: Hard:recovery week ratio (default "3:1"). E.g. "2:1", "4:1"
        max_duration_minutes: Maximum workout duration for hard days (default 90)
        indoor_only: Only recommend indoor/trainer workouts (default false)
        race_specific: Prefer race-simulation workouts (default false)
    """
    if target_zones is None:
        target_zones = ["threshold", "vo2max"]

    weeks = max(1, min(8, weeks))
    hard_days_per_week = max(1, min(4, hard_days_per_week))

    planning_ctx = await get_planning_context()

    volume_trend = []
    zone_deltas = {}
    active_patterns = []
    readiness = {}
    confound_dates: set[date] = set()
    constraints_applied = []

    if planning_ctx:
        volume_trend = planning_ctx.get("volume_trend_weekly", [])
        zone_deltas = planning_ctx.get("zone_deltas", {})
        active_patterns = planning_ctx.get("active_patterns", [])
        readiness = planning_ctx.get("readiness", {})
        confound_dates = _find_confound_dates(planning_ctx)

    baseline_tss = 350.0
    weekly_tss = planning_ctx.get("weekly_tss", []) if planning_ctx else []
    if weekly_tss:
        nonzero_weeks = [t for t in weekly_tss if t > 0]
        if nonzero_weeks:
            baseline_tss = sum(nonzero_weeks) / len(nonzero_weeks)
    elif volume_trend and any(volume_trend):
        avg_rides = sum(volume_trend) / len(volume_trend)
        baseline_tss = avg_rides * 70.0

    volume_collapse = any(
        p.get("pattern_type") == "volume_collapse" for p in active_patterns
    )
    if volume_collapse:
        constraints_applied.append("volume_collapse detected → Week 1 conservative (-30% TSS)")

    readiness_verdict = readiness.get("verdict")
    readiness_red = readiness_verdict == "red"
    readiness_yellow = readiness_verdict == "yellow"

    if readiness_red:
        constraints_applied.append(
            "readiness RED → no structured intensity recommended this week. "
            "Consider all-easy until readiness improves."
        )
    elif readiness_yellow:
        suggested_hard = max(1, hard_days_per_week - 1)
        constraints_applied.append(
            f"readiness YELLOW → consider reducing to {suggested_hard} hard day(s). "
            f"You requested {hard_days_per_week}; menu generated as requested but "
            f"use judgment on volume."
        )

    if confound_dates:
        date_strs = sorted(d.isoformat() for d in confound_dates)
        constraints_applied.append(
            f"confounds block hard work on: {', '.join(date_strs[:6])}"
            + (" (and more)" if len(date_strs) > 6 else "")
        )

    week_targets = _compute_week_tss_targets(baseline_tss, weeks, recovery_pattern)

    if volume_collapse and week_targets:
        week_targets[0]["tss"] *= 0.7
        week_targets[0]["type"] = "conservative"

    zone_rotation = _assign_zones_to_days(hard_days_per_week, target_zones)

    duration_max_secs = max_duration_minutes * 60
    hard_budget_per_day = baseline_tss * 0.6 / max(hard_days_per_week, 1)
    easy_total_per_week = baseline_tss * 0.4
    tss_floor = hard_budget_per_day * 0.4
    tss_ceiling = hard_budget_per_day * 1.6

    lines = []
    lines.append(f"=== Training Block: {weeks} weeks ({recovery_pattern} pattern) ===")
    lines.append(
        f"Baseline TSS/week: ~{baseline_tss:.0f} | Hard days: {hard_days_per_week}/week | "
        f"Targets: {', '.join(target_zones)}"
    )
    lines.append(
        f"TSS budget: ~{hard_budget_per_day:.0f}/hard day × {hard_days_per_week} + "
        f"~{easy_total_per_week:.0f} easy/recovery = "
        f"~{hard_budget_per_day * hard_days_per_week + easy_total_per_week:.0f} total"
    )

    if constraints_applied:
        lines.append("")
        lines.append("Constraints applied:")
        for c in constraints_applied:
            lines.append(f"  - {c}")

    zone_workout_pools: dict[str, list[dict]] = {}
    for zone in target_zones:
        adaptation = ZONE_TO_ADAPTATION.get(zone)
        pool = _search_zone_pool(
            zone, adaptation, tss_floor, tss_ceiling,
            duration_max_secs, race_specific, indoor_only,
        )
        zone_workout_pools[zone] = pool

    for week_idx, week_target in enumerate(week_targets):
        week_num = week_idx + 1
        week_type = week_target["type"]
        week_tss = week_target["tss"]

        label = week_type.capitalize()
        lines.append("")
        lines.append(f"--- Week {week_num} ({label}) --- Target TSS: ~{week_tss:.0f}")

        if week_type == "recovery":
            lines.append("  All days: Z1-Z2 endurance, 45-75min. Active recovery rides OK.")
            lines.append("  No structured intensity this week. Focus on sleep and adaptation.")
            continue

        for day_idx, zone in enumerate(zone_rotation):
            day_num = day_idx + 1
            lines.append(f"  Hard Day {day_num} ({zone}):")

            pool = zone_workout_pools.get(zone, [])
            offset = week_idx * 3
            results = pool[offset:offset + 3]
            if not results:
                results = pool[:3]

            if not results:
                lines.append(
                    f"    No workouts found for {zone} — use search_workout_library "
                    f"to find alternatives."
                )
                continue

            zone_delta = zone_deltas.get(zone)
            labels = ["A", "B", "C"]

            for i, workout in enumerate(results):
                reasoning = _build_workout_reasoning(
                    workout, zone, zone_delta, week_type
                )
                lines.append(_format_workout_option(workout, labels[i], reasoning))

            if len(results) < 3:
                lines.append(
                    f"    (Only {len(results)} matching workout(s) in library — "
                    f"use search_workout_library with wider filters for more options.)"
                )

            lines.append("")

        lines.append(
            f"  Easy Days: Z1-Z2 endurance, 45-90min. "
            f"Active recovery rides OK. No structure needed."
        )

    lines.append("")
    lines.append("---")

    if race_specific:
        lines.append(
            "Note: race_specific=true filters for workouts tagged as race-simulation "
            "(variable power, surges, incomplete recovery). If few results appear, the "
            "library may not have enough race-tagged inventory for this zone/duration — "
            "try without race_specific or use search_workout_library directly."
        )

    lines.append(
        "This is a menu of options, not a rigid plan. Pick workouts based on how "
        "you feel each day. Use search_workout_library for alternatives or "
        "create_custom_workout to schedule."
    )
    lines.append(
        "Confound dates are listed but not mapped to specific calendar days here — "
        "avoid scheduling hard days on those dates when using create_custom_workout."
    )

    if not planning_ctx:
        lines.append("")
        lines.append(
            "Note: Directeur planning context unavailable — constraints not applied. "
            "Block is based on user parameters only."
        )

    return "\n".join(lines)
