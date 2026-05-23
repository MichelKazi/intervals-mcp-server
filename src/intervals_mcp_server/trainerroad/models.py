"""Dataclasses for TrainerRoad API responses."""

from __future__ import annotations

from dataclasses import dataclass, field

TR_ACTIVITY_TYPE_CYCLING = 1
TR_ACTIVITY_TYPE_RUN = 2
TR_ACTIVITY_TYPE_WALK = 6
TR_ACTIVITY_TYPE_STRENGTH = 8
TR_ACTIVITY_TYPE_REST = 32767

TR_INTERVALS_SPORT_MAP: dict[int, str] = {
    TR_ACTIVITY_TYPE_CYCLING: "Ride",
    TR_ACTIVITY_TYPE_RUN: "Run",
    TR_ACTIVITY_TYPE_WALK: "Walk",
    TR_ACTIVITY_TYPE_STRENGTH: "WeightTraining",
}


@dataclass
class TRMemberInfo:
    """TrainerRoad member info.

    Works with both api.trainerroad.com/api/members (Basic Auth)
    and www.trainerroad.com/app/api/member-info (Cookie).
    """

    member_id: int
    username: str
    ftp: int | None = None

    @classmethod
    def from_api(cls, data: dict) -> TRMemberInfo:
        member_id = data.get("MemberId", -1)
        if isinstance(member_id, str):
            member_id = int(member_id) if member_id.isdigit() else -1
        return cls(
            member_id=member_id,
            username=data.get("Username", ""),
            ftp=data.get("FTP"),
        )

    @property
    def is_valid(self) -> bool:
        return self.member_id > 0 and bool(self.username)


@dataclass
class TRIntervalData:
    """A single interval step within a TR workout."""

    start: int
    end: int
    name: str
    is_fake: bool
    test_interval: bool
    start_target_power_percent: int

    @classmethod
    def from_api(cls, data: dict) -> TRIntervalData:
        return cls(
            start=data.get("Start", 0),
            end=data.get("End", 0),
            name=data.get("Name", ""),
            is_fake=data.get("IsFake", False),
            test_interval=data.get("TestInterval", False),
            start_target_power_percent=data.get("StartTargetPowerPercent", 0),
        )

    @property
    def duration_secs(self) -> int:
        return self.end - self.start

    @property
    def display_name(self) -> str:
        if self.is_fake:
            return "Step"
        return self.name


@dataclass
class TRWorkoutDetails:
    """Full workout details from /app/api/workoutdetails/{id}."""

    workout_id: str
    name: str
    description: str
    is_outside: bool
    tss: float
    duration_minutes: int
    intervals: list[TRIntervalData] = field(default_factory=list)

    @classmethod
    def from_api(cls, data: dict) -> TRWorkoutDetails:
        workout = data.get("Workout", {})
        details = workout.get("Details", {})
        interval_data = workout.get("IntervalData", [])

        intervals = [TRIntervalData.from_api(i) for i in interval_data]

        return cls(
            workout_id=str(details.get("Id", "")),
            name=details.get("WorkoutName", "")[:80],
            description=details.get("WorkoutDescription", ""),
            is_outside=details.get("IsOutside", False),
            tss=details.get("Tss", details.get("TSS", 0)) or 0,
            duration_minutes=details.get("Duration", 0) or 0,
            intervals=intervals,
        )

    @property
    def sport_type(self) -> str:
        return "Ride" if self.is_outside else "VirtualRide"

    @property
    def duration_secs(self) -> int:
        return self.duration_minutes * 60


@dataclass
class TRCalendarActivity:
    """A calendar entry from /app/api/calendar/activities/{username}.

    Planned activities have Name/Duration/Tss at the top level.
    Completed activities have a CompletedRide sub-object with ride details.
    """

    activity_id: str
    date: str
    workout_name: str | None
    tss: float | None
    duration_secs: int | None
    is_completed: bool
    activity_type: int
    race_priority: int
    notes: str
    plan_name: str | None = None
    block_name: str | None = None
    week_number: int | None = None

    @classmethod
    def from_api(cls, data: dict) -> TRCalendarActivity:
        completed_ride = data.get("CompletedRide")
        is_completed = completed_ride is not None

        if is_completed and completed_ride:
            workout_name = completed_ride.get("Name")
            tss = completed_ride.get("Tss")
            duration_secs = completed_ride.get("EstimatedDuration") or completed_ride.get("Duration")
        else:
            workout_name = data.get("Name")
            tss = data.get("Tss")
            duration_secs = data.get("Duration")

        date_str = data.get("Date", "")
        if "T" in date_str:
            date_str = date_str.split("T")[0]

        raw_priority = data.get("RacePriority", "0") or "0"
        race_priority = int(raw_priority) if str(raw_priority).isdigit() else 0

        # Training plan metadata (TR includes these on calendar entries)
        plan_name = data.get("TrainingPlanName") or data.get("PlanName")
        block_name = data.get("Block") or data.get("TrainingBlock") or data.get("BlockName")
        week_raw = data.get("Week") or data.get("PlanWeek") or data.get("WeekNumber")
        week_number = int(week_raw) if week_raw and str(week_raw).isdigit() else None

        return cls(
            activity_id=str(data.get("Id", "")),
            date=date_str,
            workout_name=workout_name,
            tss=tss,
            duration_secs=duration_secs,
            is_completed=is_completed,
            activity_type=data.get("ActivityType", 0),
            race_priority=race_priority,
            notes=data.get("Notes") or "",
            plan_name=plan_name,
            block_name=block_name,
            week_number=week_number,
        )

    @property
    def is_race(self) -> bool:
        return self.race_priority > 0

    @property
    def is_strength(self) -> bool:
        return self.activity_type == TR_ACTIVITY_TYPE_STRENGTH

    @property
    def is_rest_day(self) -> bool:
        return self.activity_type == TR_ACTIVITY_TYPE_REST

    @property
    def intervals_icu_sport(self) -> str:
        return TR_INTERVALS_SPORT_MAP.get(self.activity_type, "Ride")
