"""Distilled coaching principles from training science research.

Sources:
- Friel, J. (2018). The Cyclist's Training Bible, 5th Edition.
- Neal et al. (2013). Six weeks of polarized training-intensity distribution.
- Selles-Perez et al. (2019). Polarized and Pyramidal Training Intensity Distribution (JSSM).
- Bakken, M. (2025). The Norwegian Model Revisited.
- Gallo et al. (2022). How do world-class Giro d'Italia finishers train?
- Muriel et al. (2022). Durability and repeatability during a Grand Tour.
- Michel Kazi training history (2020-2026), 1133 activities.

Each principle has:
- context: when it applies (used for filtering)
- principle: the actionable rule
- evidence: source and key finding
- threshold: quantitative trigger (if applicable)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass
class CoachingPrinciple:
    id: str
    context: list[str]
    principle: str
    evidence: str
    threshold: str | None = None
    recommendation: str | None = None


PRINCIPLES: list[CoachingPrinciple] = [
    # --- INTENSITY DISTRIBUTION ---
    CoachingPrinciple(
        id="polarized_distribution",
        context=["zone_distribution", "intensity", "base_building", "planning"],
        principle="Polarized intensity distribution (80/5/15 in Z1/Z2/Z3) produces greater physiological adaptation than threshold-heavy models in trained cyclists.",
        evidence="Neal et al. 2013: 6-week crossover study in trained cyclists. POL increased peak power output (+8%), lactate threshold (+6%), and time to exhaustion vs threshold-only model. Zone 3 work more effective than zone 2 for adaptation.",
        threshold="Zone 2 (tempo/sweet-spot) should be <10% of total training time during base periods",
        recommendation="Keep 80%+ of volume in Z1, minimize Z2 (tempo/sweet-spot), concentrate quality in Z3 (VO2max/threshold intervals). This athlete's 2023 trap confirms: 44 Z3 rides + low volume = decline.",
    ),
    CoachingPrinciple(
        id="pyramidal_not_useless",
        context=["zone_distribution", "intensity", "recreational"],
        principle="Pyramidal distribution (75-80/15-20/3-5) is not inferior for recreational athletes in long events — zone 2 time correlates with race performance in events >4h.",
        evidence="Selles-Perez et al. 2019: In half-Ironman triathletes, zone 2 training time inversely correlated with race time in both POL and PYR groups. For very long events, some threshold work has value.",
        threshold=None,
        recommendation="For events significantly longer than 1 hour (gran fondos, gravel races), some tempo work is justified. For criteriums and short road races, stick with polarized.",
    ),
    # --- VOLUME & LOAD ---
    CoachingPrinciple(
        id="volume_before_intensity",
        context=["planning", "base_building", "volume", "rebuilding"],
        principle="Aerobic volume is the foundation — intensity without adequate aerobic base produces no gains and accelerates decline.",
        evidence="Friel CTB Ch.7: aerobic endurance is the most critical basic ability. Michel's history: 2022 peak (363W) built on 2 years of 400-540h/year. 2023 had most Z3 rides ever (44) but lowest volume (318h) — FTP declined.",
        threshold="Minimum 350h/year for meaningful FTP progression in this athlete. Current plan targets 400h+ annualized.",
        recommendation="Do not increase intensity until volume is stabilized. For Michel specifically: 7-10h/week minimum before adding quality sessions.",
    ),
    CoachingPrinciple(
        id="ctl_to_ftp_lag",
        context=["planning", "expectations", "patience"],
        principle="CTL base translates to peak FTP with approximately 6-12 month lag. High fitness now produces peak power later, not immediately.",
        evidence="Michel's data: CTL peaked May 2021 (124.9), FTP peaked April 2022 (363W) — 11-month lag. Friel CTB: 'Success won't come quickly. Cycling is a patience sport.'",
        threshold=None,
        recommendation="Set expectations: current CTL building will yield power gains 6+ months from now. Don't judge plan effectiveness by FTP in the first 3 months.",
    ),
    CoachingPrinciple(
        id="monotony_overtraining",
        context=["fatigue_risk", "overtraining", "load_management"],
        principle="Training monotony above 2.0 is associated with increased illness and injury risk. Vary daily load even within high-volume weeks.",
        evidence="Friel CTB Ch.10: monotony (mean daily load / SD of daily load) >2.0 correlates with illness. Foster et al. research on training strain = load × monotony.",
        threshold="Monotony > 2.0",
        recommendation="If monotony >2.0 for the week, increase load variability — add a rest day or make one session significantly easier/harder than the others.",
    ),
    CoachingPrinciple(
        id="acwr_injury_risk",
        context=["fatigue_risk", "load_management", "injury"],
        principle="Acute:Chronic Workload Ratio (ACWR) above 1.3 sharply increases soft-tissue injury risk. Above 1.5 is the danger zone.",
        evidence="Gabbett 2016: ACWR 1.0-1.3 is the 'sweet spot' for adaptation. >1.3 exponentially increases injury risk. >1.5 is high-risk zone.",
        threshold="ACWR > 1.3",
        recommendation="If ACWR exceeds 1.3: reduce volume 20-30% for 3-5 days, maintain intensity on fewer intervals. If >1.5: forced recovery week.",
    ),
    CoachingPrinciple(
        id="ramp_rate",
        context=["load_management", "planning", "volume"],
        principle="Week-over-week load increase should not exceed 10% (conservative) to 20% (aggressive). Chronic ramp rates above 7 TSS/day are high-risk.",
        evidence="Friel CTB: progressive overload must be gradual. Gabbett: spike in load is the primary injury predictor, not absolute load. Michel's history: rapid load increases preceded every illness/breakdown.",
        threshold="Ramp rate > 7 TSS/day or weekly load increase > 20%",
        recommendation="Target 5-10% weekly load progression. After missed training (>1 week), return at 60% of previous load and rebuild over 2-3 weeks.",
    ),
    # --- RECOVERY & PERIODIZATION ---
    CoachingPrinciple(
        id="recovery_frequency",
        context=["periodization", "recovery", "planning"],
        principle="Recovery weeks every 3rd week (for older/slower-recovering athletes) or every 4th week are essential. Reduce load by 40-60% during recovery weeks.",
        evidence="Friel CTB Ch.7 Table 7.4: over-50 or slow-recovery athletes need 3-week mesocycles. Under-50 fast-recovery can use 4-week. Recovery weeks reduce load significantly while maintaining some intensity.",
        threshold=None,
        recommendation="For Michel: use 3-week mesocycles (2 hard + 1 recovery). His recovery capacity at current fitness level and with tirzepatide favors shorter build blocks.",
    ),
    CoachingPrinciple(
        id="taper_duration",
        context=["tapering", "race_prep", "peaking"],
        principle="Optimal taper is 2-3 weeks. Reduce volume 40-60% while maintaining intensity. Frequency stays the same or decreases slightly.",
        evidence="Friel CTB Ch.13: taper reduces fatigue while maintaining fitness, producing 'form'. Mujika research: reduce volume, maintain intensity. Too-long tapers (>3 weeks) risk fitness loss.",
        threshold=None,
        recommendation="For A-priority races: 2-week taper (1 peak week + 1 race week). Reduce volume by 50%, keep intensity at 95-100% of peak-week values. Last hard session 5-7 days before race.",
    ),
    CoachingPrinciple(
        id="missed_training_protocol",
        context=["missed_training", "illness", "returning"],
        principle="After 1-2 weeks missed: return to previous base period, rebuild aerobic endurance until EF matches pre-illness levels. After >2 weeks: back up one full period.",
        evidence="Friel CTB Ch.8: 4-6 missed sessions — treat as recovery week, reschedule BT workouts. 7-14 days missed — return to base 3. >14 days — back up one full period. Never jump straight back to build-phase intensity.",
        threshold=None,
        recommendation="Monitor efficiency factor (power:HR ratio) on return. Don't advance to harder training until EF is within 5% of pre-break values.",
    ),
    # --- AEROBIC DEVELOPMENT ---
    CoachingPrinciple(
        id="cardiac_drift_threshold",
        context=["aerobic_development", "base_building", "drift"],
        principle="Cardiac drift (HR:power decoupling) under 5% on rides >90min indicates adequate aerobic development for that duration. Above 5% suggests more base work needed.",
        evidence="Friel CTB: aerobic threshold test uses efficiency factor — if HR rises >5% relative to power in the second half, aerobic fitness is insufficient for that intensity/duration. Used as gate for advancing from base to build.",
        threshold="Decoupling > 5% on rides > 90min",
        recommendation="If drift consistently >5% on 90-minute endurance rides, extend base phase. Do not advance to build until drift is controlled at target endurance duration.",
    ),
    CoachingPrinciple(
        id="efficiency_factor_tracking",
        context=["aerobic_development", "progress"],
        principle="Efficiency Factor (normalized power / average HR) trending upward indicates improving aerobic fitness. Stagnation or decline signals overtraining or detraining.",
        evidence="Friel CTB Ch.14: EF is one of the most reliable indicators of aerobic development. Should rise through base period. Plateau is expected in build. Decline warrants investigation.",
        threshold=None,
        recommendation="Track weekly average EF on endurance rides. Rising = aerobic gains. Flat for >3 weeks in base = increase duration or reconsider approach. Declining = possible overreaching.",
    ),
    # --- THRESHOLD & VO2MAX ---
    CoachingPrinciple(
        id="norwegian_threshold_model",
        context=["threshold", "intervals", "vo2max", "build_phase"],
        principle="Double-threshold sessions (2× per day at lactate threshold) with lactate monitoring are highly effective for threshold development. Intervals preferred over continuous efforts for better adaptation-to-fatigue ratio.",
        evidence="Bakken 2025 (Norwegian Model Revisited): intervals offer higher return relative to muscular load vs continuous threshold efforts. Key insight: consider the COST of a session, not just intensity-minutes. Double sessions allow more threshold stimulus with less cumulative fatigue.",
        threshold=None,
        recommendation="For threshold development: prefer 4-6 × 8-12min intervals over 2×20min continuous. Intervals produce same stimulus with less muscular cost. Consider AM/PM doubles in build phase if lifestyle allows.",
    ),
    CoachingPrinciple(
        id="vo2max_interval_structure",
        context=["vo2max", "intervals", "build_phase"],
        principle="VO2max intervals of 3-5 minutes at 106-120% FTP with equal or slightly shorter recovery are the primary driver of aerobic ceiling improvement.",
        evidence="Neal et al. 2013: zone 3 work (>VT2) drove the significant differences in adaptation vs threshold-only training. Friel CTB: anaerobic endurance intervals at 106-120% FTP for 3-5 min. Michel's TrainerRoad plan: 3-5 min @ 110-120% FTP, progressing from 5 to 8 intervals over build phase.",
        threshold=None,
        recommendation="Build-phase VO2max prescription: start at 5×3min @115-120% FTP, progress to 6×4min or 5×5min over 6 weeks. Maintain work:rest ratio of 1:1 to 1:0.75.",
    ),
    # --- DURABILITY & RACE-SPECIFIC ---
    CoachingPrinciple(
        id="durability_for_racing",
        context=["race_prep", "durability", "criterium"],
        principle="Durability (ability to maintain power output as fatigue accumulates) is a key differentiator in racing. It requires race-specific training that simulates fatigue + surges.",
        evidence="Muriel et al. 2022: professional Grand Tour cyclists show remarkable durability — maintaining power profile even after 4+ hours. Gallo et al. 2022: world-class Giro finishers train with progressive specificity as races approach. For crits: surge repeatability after sustained tempo is the key demand.",
        threshold=None,
        recommendation="For criterium prep: include workouts that simulate pack pace + surges (e.g., 45min @85-90% FTP with 10×10sec sprints embedded). Group rides that naturally produce this stimulus are ideal.",
    ),
    CoachingPrinciple(
        id="race_specificity_progression",
        context=["periodization", "build_phase", "race_prep"],
        principle="Training must progressively become more race-like as the event approaches. Early season = general fitness. Final 6-8 weeks = race-simulation.",
        evidence="Friel CTB Ch.7-8: fundamental periodization philosophy — 'the closer in time you get to your A-priority race, the more like the race your training must become.' Gallo et al. 2022: world-class pros shift from volume-heavy to intensity-specific in final 8 weeks before a Grand Tour.",
        threshold=None,
        recommendation="Final 6-8 weeks before A race: workouts should replicate race demands (duration, terrain, surge patterns). For criteriums: high-intensity repeatability. For time trials: sustained threshold.",
    ),
    # --- STRENGTH & FORCE ---
    CoachingPrinciple(
        id="strength_periodization",
        context=["strength", "force", "planning"],
        principle="Maximal strength (MS) phase should precede hard on-bike training — never overlap heavy lifting with build-phase intensity work. Maintain with 1x/week after MS phase.",
        evidence="Friel CTB Ch.12: 'You can't mix the most challenging gym workouts with very challenging bike workouts in the same weeks.' MS phase in base 1-2, then shift to SM (maintenance) 1x/week through build/peak. Never skip directly from no lifting to build phase.",
        threshold=None,
        recommendation="Strength work in base phase only (heavy loads). Once build starts: maintenance 1x/week, brief sessions that don't compromise next day's ride quality.",
    ),
    # --- RECOVERY INDICATORS ---
    CoachingPrinciple(
        id="readiness_indicators",
        context=["readiness", "recovery", "wellness"],
        principle="Readiness to train hard is best assessed by: sleep quality + HRV trend + subjective fatigue + TSB. No single metric is sufficient — use the combination.",
        evidence="Friel CTB Ch.11: fatigue is multifactorial. Noakes central governor theory: brain integrates all signals. Research shows HRV alone has poor predictive value, but HRV + sleep + subjective markers together are reliable.",
        threshold="TSB < -25 AND (sleep < 6h OR HRV below 7-day baseline)",
        recommendation="Hard session green light: TSB > -15, sleep > 7h, HRV within normal band, subjective fatigue ≤ 3/5. Any two red flags = easy day or rest.",
    ),
    CoachingPrinciple(
        id="sleep_and_performance",
        context=["recovery", "wellness", "sleep"],
        principle="Consistent sleep below 7 hours degrades both recovery capacity and next-day performance. Sleep is the single most important recovery modality.",
        evidence="Friel CTB: sleep is when adaptation occurs. Halson 2014: sleep restriction impairs glycogen repletion, hormonal recovery, and cognitive function. Michel's recovery_patterns tool can correlate sleep→performance directly.",
        threshold="< 7h sleep for 3+ consecutive days",
        recommendation="If sleep <7h for 3+ days: reduce training load 20-30%, prioritize sleep over early morning sessions. Never sacrifice sleep for training — the adaptation happens during sleep, not during the ride.",
    ),
    # --- NUTRITION ---
    CoachingPrinciple(
        id="fueling_quality_sessions",
        context=["nutrition", "intervals", "performance"],
        principle="Never do high-intensity interval sessions fasted. Fuel before and during for quality. Fasted riding is only appropriate for easy Z1 rides under 90 minutes.",
        evidence="Michel's nutrition guide: 'Never do interval sessions fasted.' Eat 2-3h before with 400-600 cal (carbs + moderate protein). During rides >90min: 30-60g carbs/hour. Above 2.5h: 60-80g/hour.",
        threshold=None,
        recommendation="Before intervals: minimum 400 cal meal 2-3h prior. If time-crunched: banana + coffee 30-60min before. During: sip carb drink throughout. Post: 30-40g protein within 90min.",
    ),
    CoachingPrinciple(
        id="deficit_and_performance",
        context=["nutrition", "weight_loss", "performance"],
        principle="Caloric deficit must never exceed 200 cal/day during build phase and should be zero during peak/taper. Performance decline >10% on same workouts = eat more.",
        evidence="Michel's nutrition guide: Phase 2 (build) = -100 cal/day. Phase 3 (peak build) = -100 cal/day. Phase 4 (peak/taper) = maintenance. 'Add 100-200 cal/day if power declining >10% on same workouts.'",
        threshold="Power decline > 10% on repeated workouts",
        recommendation="If athlete reports power dropping on standard workouts: first check fueling, then check sleep, then check load. Caloric deficit is the most common silent performance thief.",
    ),
    # --- ATHLETE-SPECIFIC (MICHEL) ---
    CoachingPrinciple(
        id="michel_what_works",
        context=["planning", "athlete_specific"],
        principle="Michel's proven formula: high aerobic volume (400h+/year) → moderate structured intensity (20-25 Z3 sessions/year) → consistency over 12+ months. Indoor structured work (40+ rides/year) is essential.",
        evidence="Training history 2020-2026: peak FTP (363W) came from 2 years of 400-540h/year with 20-21 Z3 rides. 2023 trap: 44 Z3 rides on 318h volume = decline. Consistency > intensity.",
        threshold=None,
        recommendation="Target: 400h/year, 20-25 quality sessions, 40+ indoor structured rides. Don't exceed 30 Z3 rides without proportional volume increase.",
    ),
    CoachingPrinciple(
        id="michel_what_fails",
        context=["planning", "athlete_specific", "anti_pattern"],
        principle="What fails for Michel: high intensity without volume (2023), long unstructured stretches (2024-25), using group rides as fitness tests.",
        evidence="2023: 44 Z3 rides on 318h = FTP decline. 2024-25: near-complete loss of structure, CTL fell from 100+ to 60, FTP from 363W to 254W. Group ride racing leads to poor pacing, bad data, confidence erosion.",
        threshold=None,
        recommendation="Red flags: >30 Z3 sessions with <350h volume, >2 weeks without structured training, multiple group rides used as 'tests'. Intervene early.",
    ),
    CoachingPrinciple(
        id="michel_weight_targets",
        context=["weight", "athlete_specific", "nutrition"],
        principle="Historical racing weight is 175-183 lbs. Weight targets below 175 have no historical support. Don't chase scale at expense of performance.",
        evidence="Michel's training history: raced at 175-183 lbs across all peak performances. Never raced below 175. Target of 165 has no support — push back firmly if raised.",
        threshold=None,
        recommendation="Acceptable race weight range: 175-183 lbs. Below 175 is untested territory with no evidence of benefit. Weight loss rate should never exceed 1 lb/week during training.",
    ),
]


def get_principles_for_context(contexts: list[str]) -> list[CoachingPrinciple]:
    """Return principles matching any of the given context tags."""
    return [p for p in PRINCIPLES if any(c in p.context for c in contexts)]


def format_principles(principles: list[CoachingPrinciple]) -> str:
    """Format principles as a readable string for MCP resource output."""
    if not principles:
        return "No matching principles found."

    lines = []
    for p in principles:
        lines.append(f"## {p.id}")
        lines.append(f"**Principle:** {p.principle}")
        if p.threshold:
            lines.append(f"**Trigger:** {p.threshold}")
        if p.recommendation:
            lines.append(f"**Action:** {p.recommendation}")
        lines.append(f"_Evidence: {p.evidence}_")
        lines.append("")
    return "\n".join(lines)


def format_all_principles() -> str:
    """Format all principles as the full coaching knowledge base."""
    lines = [
        "# Coaching Principles — Distilled from Research",
        "",
        "These principles are derived from sports science research and validated",
        "against this athlete's 6-year training history (1,133 activities).",
        "",
        "## Sources",
        "- Friel (2018) The Cyclist's Training Bible, 5th Ed.",
        "- Neal et al. (2013) Polarized training > threshold in trained cyclists",
        "- Selles-Perez et al. (2019) POL vs PYR in half-Ironman triathletes",
        "- Bakken (2025) The Norwegian Model Revisited",
        "- Gallo et al. (2022) World-class Giro d'Italia finishers training",
        "- Muriel et al. (2022) Durability in Grand Tour professionals",
        "- Michel Kazi training history 2020-2026",
        "",
    ]
    lines.append(format_principles(PRINCIPLES))
    return "\n".join(lines)


# Context tags used for filtering by analytics tools:
CONTEXT_TAGS: dict[str, list[str]] = {
    "fatigue_risk": ["acwr_injury_risk", "ramp_rate", "monotony_overtraining", "sleep_and_performance"],
    "aerobic_development": ["cardiac_drift_threshold", "efficiency_factor_tracking", "volume_before_intensity"],
    "zone_distribution": ["polarized_distribution", "pyramidal_not_useless"],
    "readiness": ["readiness_indicators", "sleep_and_performance"],
    "planning": ["volume_before_intensity", "ctl_to_ftp_lag", "recovery_frequency", "race_specificity_progression", "michel_what_works", "michel_what_fails"],
    "nutrition": ["fueling_quality_sessions", "deficit_and_performance"],
    "race_prep": ["taper_duration", "durability_for_racing", "race_specificity_progression"],
    "recovery": ["recovery_frequency", "missed_training_protocol", "readiness_indicators", "sleep_and_performance"],
    "build_phase": ["norwegian_threshold_model", "vo2max_interval_structure", "strength_periodization"],
}


def get_annotation(principle_id: str) -> str | None:
    """Get a short annotation string for inline use in tool output."""
    for p in PRINCIPLES:
        if p.id == principle_id:
            short = p.principle.split(".")[0] + "."
            if p.threshold:
                return f"{short} (trigger: {p.threshold})"
            return short
    return None
