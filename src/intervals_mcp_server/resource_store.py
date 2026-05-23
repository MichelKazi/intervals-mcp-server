"""In-memory resource store for athlete profile and training plan.

Updated as a side-effect when tools fetch data from Intervals.icu and TrainerRoad.
MCP resources and the get_athlete_context tool read from this store.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class AthleteProfile:
    ftp: int | None = None
    weight: float | None = None
    w_per_kg: float | None = None
    ctl: float | None = None
    atl: float | None = None
    tsb: float | None = None
    resting_hr: int | None = None
    max_hr: int | None = None
    lthr: int | None = None
    hrv: float | None = None
    phase: str | None = None
    phase_week: int | None = None
    zones: dict[str, Any] = field(default_factory=dict)
    updated_at: datetime | None = None

    def update_from_wellness(self, wellness: dict[str, Any]) -> None:
        ctl = wellness.get("ctl")
        atl = wellness.get("atl")
        if ctl is not None:
            self.ctl = round(ctl, 1)
        if atl is not None:
            self.atl = round(atl, 1)
        if ctl is not None and atl is not None:
            self.tsb = round(ctl - atl, 1)
        if wellness.get("restingHR"):
            self.resting_hr = wellness["restingHR"]
        if wellness.get("hrv"):
            self.hrv = wellness["hrv"]
        if wellness.get("weight"):
            self.weight = wellness["weight"]
            if self.ftp:
                self.w_per_kg = round(self.ftp / self.weight, 2)
        self.updated_at = datetime.now()

    def update_from_athlete(self, data: dict[str, Any]) -> None:
        if data.get("weight"):
            self.weight = data["weight"]
        sport_settings = data.get("sportSettings", [])
        for sport in sport_settings:
            if isinstance(sport, dict) and sport.get("type") == "Ride":
                if sport.get("ftp"):
                    self.ftp = sport["ftp"]
                if sport.get("lthr"):
                    self.lthr = sport["lthr"]
                if sport.get("max_hr"):
                    self.max_hr = sport["max_hr"]
                zones = sport.get("zones")
                if zones:
                    self.zones["power"] = zones
                break
        if self.ftp and self.weight:
            self.w_per_kg = round(self.ftp / self.weight, 2)
        self.updated_at = datetime.now()

    def update_phase(self, phase: str | None, week: int | None) -> None:
        if phase:
            self.phase = phase
        if week:
            self.phase_week = week
        self.updated_at = datetime.now()

    def format(self) -> str:
        now = datetime.now()
        lines = [f"Athlete Profile (as of {now.strftime('%Y-%m-%d %H:%M')})"]
        if self.ftp:
            parts = [f"FTP: {self.ftp}W"]
            if self.weight:
                parts.append(f"Weight: {self.weight}kg")
            if self.w_per_kg:
                parts.append(f"W/kg: {self.w_per_kg}")
            lines.append("  " + " | ".join(parts))
        if self.ctl is not None:
            form_label = _form_label(self.tsb)
            lines.append(f"  CTL: {self.ctl} | ATL: {self.atl} | TSB: {self.tsb} ({form_label})")
        if self.resting_hr or self.hrv:
            parts = []
            if self.resting_hr:
                parts.append(f"RHR: {self.resting_hr}")
            if self.hrv:
                parts.append(f"HRV: {self.hrv}")
            if self.lthr:
                parts.append(f"LTHR: {self.lthr}")
            if self.max_hr:
                parts.append(f"MaxHR: {self.max_hr}")
            lines.append("  " + " | ".join(parts))
        if self.phase:
            phase_str = f"  Phase: {self.phase}"
            if self.phase_week:
                phase_str += f" Week {self.phase_week}"
            lines.append(phase_str)
        if not any(field is not None for field in [self.ftp, self.ctl, self.phase]):
            lines.append("  (no data yet — call get_daily_summary or get_training_insights to populate)")
        return "\n".join(lines)


@dataclass
class RaceEntry:
    date: str
    name: str
    priority: str  # A, B, C


@dataclass
class PlannedWorkout:
    date: str
    name: str
    tss: float | None = None
    duration_secs: int | None = None


@dataclass
class TrainingPlan:
    phase: str | None = None
    phase_week: int | None = None
    plan_name: str | None = None
    races: list[RaceEntry] = field(default_factory=list)
    this_week_workouts: list[PlannedWorkout] = field(default_factory=list)
    today_workout: PlannedWorkout | None = None
    updated_at: datetime | None = None

    def update_from_tr_plan(self, plan_info: dict[str, Any] | None) -> None:
        if not plan_info:
            return
        phase = plan_info.get("PhaseName")
        week = plan_info.get("Week")
        name = plan_info.get("PlanName")
        if phase:
            self.phase = phase
        if week:
            self.phase_week = int(week)
        if name:
            self.plan_name = name
        self.updated_at = datetime.now()

    def update_races(self, race_activities: list[Any]) -> None:
        priority_map = {1: "C", 2: "B", 3: "A"}
        self.races = []
        for act in race_activities:
            date = act.date if hasattr(act, "date") else act.get("date", "")
            name = (act.workout_name if hasattr(act, "workout_name") else act.get("name", "")) or "Race"
            priority_int = act.race_priority if hasattr(act, "race_priority") else act.get("race_priority", 0)
            priority = priority_map.get(priority_int, "?")
            self.races.append(RaceEntry(date=date, name=name, priority=priority))
        self.races.sort(key=lambda r: r.date)
        self.updated_at = datetime.now()

    def update_this_week(self, workouts: list[Any], today: str | None = None) -> None:
        self.this_week_workouts = []
        self.today_workout = None
        today_str = today or datetime.now().strftime("%Y-%m-%d")

        for w in workouts:
            date = w.date if hasattr(w, "date") else w.get("date", "")
            name = (w.workout_name if hasattr(w, "workout_name") else w.get("name", "")) or "Workout"
            tss = w.tss if hasattr(w, "tss") else w.get("tss")
            dur = w.duration_secs if hasattr(w, "duration_secs") else w.get("duration_secs")
            pw = PlannedWorkout(date=date, name=name, tss=tss, duration_secs=dur)
            self.this_week_workouts.append(pw)
            if date == today_str:
                self.today_workout = pw

        self.updated_at = datetime.now()

    @property
    def next_race(self) -> RaceEntry | None:
        today = datetime.now().strftime("%Y-%m-%d")
        for r in self.races:
            if r.date >= today:
                return r
        return None

    def format(self) -> str:
        now = datetime.now()
        lines = [f"Training Plan (as of {now.strftime('%Y-%m-%d %H:%M')})"]

        if self.phase:
            parts = []
            if self.plan_name:
                parts.append(self.plan_name)
            parts.append(f"Phase: {self.phase}")
            if self.phase_week:
                parts.append(f"Week {self.phase_week}")
            lines.append("  " + " | ".join(parts))

        nr = self.next_race
        if nr:
            days_out = (datetime.strptime(nr.date, "%Y-%m-%d") - now).days
            lines.append(f"  Next Race: {nr.date} [{nr.priority}] {nr.name} ({days_out}d out)")

        if self.races:
            lines.append("  Race Calendar:")
            for r in self.races:
                lines.append(f"    {r.date} [{r.priority}] {r.name}")

        if self.this_week_workouts:
            lines.append("  This Week:")
            for w in self.this_week_workouts:
                parts = [f"    {w.date} {w.name}"]
                if w.tss:
                    parts.append(f"TSS:{w.tss:.0f}")
                if w.duration_secs:
                    h, m = divmod(w.duration_secs // 60, 60)
                    parts.append(f"{h}h{m:02d}m" if h else f"{m}m")
                lines.append(" ".join(parts))

        if self.today_workout:
            tw = self.today_workout
            parts = [f"  Today: {tw.name}"]
            if tw.tss:
                parts.append(f"TSS:{tw.tss:.0f}")
            if tw.duration_secs:
                h, m = divmod(tw.duration_secs // 60, 60)
                parts.append(f"{h}h{m:02d}m" if h else f"{m}m")
            lines.append(" ".join(parts))

        if not self.phase and not self.races and not self.this_week_workouts:
            lines.append("  (no data yet — call get_trainerroad_workouts or sync_trainerroad_calendar to populate)")

        return "\n".join(lines)


def _form_label(tsb: float | None) -> str:
    if tsb is None:
        return "Unknown"
    if tsb > 15:
        return "Very Fresh"
    if tsb > 5:
        return "Fresh"
    if tsb > -10:
        return "Neutral"
    if tsb > -25:
        return "Fatigued"
    return "Very Fatigued"


# Singleton instances — updated by tools, read by resources
athlete_profile = AthleteProfile()
training_plan = TrainingPlan()
