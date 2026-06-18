"""Classify TrainerRoad workouts by zone focus, adaptation target, interval pattern, and tags."""

from intervals_mcp_server.trainerroad.models import TRIntervalData, TRWorkoutDetails

ZONE_THRESHOLDS = {
    "recovery": (0, 55),
    "endurance": (56, 75),
    "tempo": (76, 87),
    "sweet-spot": (88, 94),
    "threshold": (95, 105),
    "vo2max": (106, 120),
    "anaerobic": (121, 150),
    "sprint": (151, 999),
}

ADAPTATION_TARGETS = {
    "recovery": ["recovery"],
    "aerobic_base": ["endurance"],
    "tempo_endurance": ["tempo"],
    "threshold_power": ["sweet-spot", "threshold"],
    "vo2max": ["vo2max"],
    "anaerobic_capacity": ["anaerobic"],
    "sprint_power": ["sprint"],
}

INTERVAL_PATTERNS = [
    "steady_state",
    "over_under",
    "short_intervals",
    "long_intervals",
    "pyramid",
    "descending",
    "ascending",
    "tabata",
    "sprint_repeats",
    "microbursts",
    "progressive",
    "race_simulation",
]


def _get_zone(power_pct: int) -> str:
    for zone, (low, high) in ZONE_THRESHOLDS.items():
        if low <= power_pct <= high:
            return zone
    return "recovery"


def _main_set_intervals(intervals: list[TRIntervalData]) -> list[TRIntervalData]:
    """Strip warmup/cooldown from edges but keep inter-set rest intact."""
    work = [iv for iv in intervals if iv.name != "Workout"]
    if not work:
        return []

    if all(iv.start_target_power_percent == 0 for iv in work):
        return []

    while work and work[0].start_target_power_percent <= 65:
        work = work[1:]
    while work and work[-1].start_target_power_percent <= 65:
        work = work[:-1]

    return work


def _work_intervals(intervals: list[TRIntervalData]) -> list[TRIntervalData]:
    """Filter to active work intervals only (no warmup, cooldown, or inter-set rest)."""
    main_set = _main_set_intervals(intervals)
    return [iv for iv in main_set if iv.start_target_power_percent > 65]


def classify_zones(intervals: list[TRIntervalData]) -> list[str]:
    """Determine zone focus from the work intervals' power targets."""
    work = _work_intervals(intervals)
    if not work:
        return ["endurance"]

    # Weight by duration in each zone
    zone_time: dict[str, int] = {}
    for iv in work:
        zone = _get_zone(iv.start_target_power_percent)
        zone_time[zone] = zone_time.get(zone, 0) + iv.duration_secs

    total_time = sum(zone_time.values()) or 1
    # Include zones that account for >= 20% of work time
    significant = [z for z, t in zone_time.items() if t / total_time >= 0.20]

    if not significant:
        # Fall back to the zone with the most time
        return [max(zone_time, key=zone_time.get)]  # type: ignore[arg-type]

    # Order by descending time
    return sorted(significant, key=lambda z: zone_time.get(z, 0), reverse=True)


def classify_tags(workout: TRWorkoutDetails) -> list[str]:
    """Derive training tags from workout structure and description."""
    tags: list[str] = []
    main_set = _main_set_intervals(workout.intervals)
    if not main_set:
        return tags

    powers = [iv.start_target_power_percent for iv in main_set]
    durations = [iv.duration_secs for iv in main_set]

    # Over-under detection: alternating above/below threshold
    if len(main_set) >= 4:
        above_below = [p > 100 for p in powers]
        alternations = sum(1 for i in range(1, len(above_below)) if above_below[i] != above_below[i - 1])
        if alternations >= 3:
            tags.append("over-under")

    # Short intervals (< 2min work bouts)
    short_count = sum(1 for d in durations if d <= 120)
    if short_count >= 4:
        tags.append("short-intervals")

    # Long intervals (> 5min work bouts at high intensity)
    long_high = sum(1 for d, p in zip(durations, powers) if d >= 300 and p >= 88)
    if long_high >= 2:
        tags.append("long-intervals")

    # Progressive (power increases through the set)
    if len(powers) >= 3:
        increasing = all(powers[i] <= powers[i + 1] for i in range(len(powers) - 1))
        if increasing and powers[-1] - powers[0] >= 10:
            tags.append("progressive")

    # Steady state (all work intervals at same power ± 3%)
    if len(powers) >= 2:
        avg_p = sum(powers) / len(powers)
        if all(abs(p - avg_p) <= 3 for p in powers):
            tags.append("steady-state")

    # Tabata-style (very short, very high)
    tabata_count = sum(1 for d, p in zip(durations, powers) if d <= 30 and p >= 120)
    if tabata_count >= 4:
        tags.append("tabata")

    # Ramp
    desc_lower = (workout.description or "").lower()
    if "ramp" in desc_lower:
        tags.append("ramp")

    return tags


def compute_intensity_range(intervals: list[TRIntervalData]) -> tuple[int, int]:
    """Get min/max power % from work intervals."""
    work = _work_intervals(intervals)
    if not work:
        return (0, 0)
    powers = [iv.start_target_power_percent for iv in work]
    return (min(powers), max(powers))


def count_work_intervals(intervals: list[TRIntervalData]) -> int:
    """Count non-warmup/cooldown intervals."""
    return len(_work_intervals(intervals))


def classify_adaptation_target(zones: list[str], tags: list[str]) -> str:
    """Infer adaptation target from zone focus and structural tags."""
    if not zones:
        return "aerobic_base"

    primary = zones[0]

    # Over-unders are specifically threshold_power training
    if "over-under" in tags and primary in ("threshold", "sweet-spot"):
        return "threshold_power"

    # Race simulation patterns
    if "race_simulation" in tags:
        return "repeatability"

    for target, target_zones in ADAPTATION_TARGETS.items():
        if primary in target_zones:
            return target

    # Mixed zone work (e.g. vo2max + threshold alternating)
    if len(zones) > 1 and "vo2max" in zones:
        return "repeatability"

    return "aerobic_base"


def classify_interval_pattern(intervals: list[TRIntervalData], tags: list[str]) -> str:
    """Classify the interval structure pattern."""
    main_set = _main_set_intervals(intervals)
    if not main_set:
        return "steady_state"

    powers = [iv.start_target_power_percent for iv in main_set]
    durations = [iv.duration_secs for iv in main_set]

    # Check for existing tag matches (order matters — most specific first)
    if "tabata" in tags:
        return "tabata"
    if "over-under" in tags:
        return "over_under"
    if "progressive" in tags:
        return "progressive"

    # Microbursts: very short intervals (15-30s) at high power
    microburst_count = sum(1 for d, p in zip(durations, powers) if d <= 30 and p >= 110)
    if microburst_count >= 6:
        return "microbursts"

    # Sprint repeats: very short (< 30s), very high (> 150%)
    sprint_count = sum(1 for d, p in zip(durations, powers) if d <= 30 and p >= 150)
    if sprint_count >= 3:
        return "sprint_repeats"

    # Short intervals: 30s-2min work bouts
    short_count = sum(1 for d in durations if 30 <= d <= 120)
    if short_count >= 4 and short_count / len(main_set) >= 0.4:
        return "short_intervals"

    # Pyramid: power goes up then comes back down
    if len(powers) >= 5:
        mid = len(powers) // 2
        rising = all(powers[i] <= powers[i + 1] for i in range(mid - 1))
        falling = all(powers[i] >= powers[i + 1] for i in range(mid, len(powers) - 1))
        if rising and falling:
            return "pyramid"

    # Descending: power decreases through set
    if len(powers) >= 3:
        if all(powers[i] >= powers[i + 1] for i in range(len(powers) - 1)):
            if powers[0] - powers[-1] >= 5:
                return "descending"

    # Ascending: power increases through set (progressive already caught above)
    if len(powers) >= 3:
        if all(powers[i] <= powers[i + 1] for i in range(len(powers) - 1)):
            if powers[-1] - powers[0] >= 5:
                return "ascending"

    # Long intervals: > 5min work at high intensity
    long_count = sum(1 for d, p in zip(durations, powers) if d >= 300 and p >= 88)
    if long_count >= 2:
        return "long_intervals"

    # Steady state: all work at same power (± 3%)
    if len(powers) >= 2:
        avg_p = sum(powers) / len(powers)
        if all(abs(p - avg_p) <= 3 for p in powers):
            return "steady_state"

    # Default
    return "steady_state"


def classify_race_specificity(workout: TRWorkoutDetails, tags: list[str], pattern: str) -> bool:
    """Determine if a workout mimics race demands (variable power, surges, incomplete recovery)."""
    desc_lower = (workout.description or "").lower()

    # Explicit race keywords in description
    race_keywords = ["race", "crit", "criterium", "road race", "surge", "attack", "sprint finish"]
    if any(kw in desc_lower for kw in race_keywords):
        return True

    # Over-unders with short recovery simulate race surges
    if pattern in ("over_under", "microbursts", "sprint_repeats"):
        work = _work_intervals(workout.intervals)
        if work:
            powers = [iv.start_target_power_percent for iv in work]
            power_variance = max(powers) - min(powers)
            if power_variance >= 40:
                return True

    return False


def compute_work_recovery_durations(intervals: list[TRIntervalData]) -> dict:
    """Compute typical work and recovery interval durations from the main set."""
    main_set = _main_set_intervals(intervals)
    if not main_set:
        return {"work_duration_avg": 0, "recovery_duration_avg": 0}

    work_durations = []
    recovery_durations = []
    for iv in main_set:
        if iv.start_target_power_percent > 65:
            work_durations.append(iv.duration_secs)
        else:
            recovery_durations.append(iv.duration_secs)

    return {
        "work_duration_avg": int(sum(work_durations) / len(work_durations)) if work_durations else 0,
        "recovery_duration_avg": int(sum(recovery_durations) / len(recovery_durations)) if recovery_durations else 0,
    }


def classify_workout(workout: TRWorkoutDetails) -> dict:
    """Full classification of a workout. Returns fields for Supabase upsert."""
    zones = classify_zones(workout.intervals)
    tags = classify_tags(workout)
    intensity_min, intensity_max = compute_intensity_range(workout.intervals)
    interval_count = count_work_intervals(workout.intervals)

    pattern = classify_interval_pattern(workout.intervals, tags)
    adaptation = classify_adaptation_target(zones, tags)
    race_specific = classify_race_specificity(workout, tags, pattern)
    durations = compute_work_recovery_durations(workout.intervals)

    # Add pattern and race-specificity to tags for searchability
    if pattern not in tags:
        tags.append(pattern)
    if race_specific and "race-specific" not in tags:
        tags.append("race-specific")

    return {
        "zone_focus": zones,
        "tags": tags,
        "intensity_min": intensity_min,
        "intensity_max": intensity_max,
        "interval_count": interval_count,
        "adaptation_target": adaptation,
        "interval_pattern": pattern,
        "race_specific": race_specific,
        "work_duration_avg": durations["work_duration_avg"],
        "recovery_duration_avg": durations["recovery_duration_avg"],
    }
