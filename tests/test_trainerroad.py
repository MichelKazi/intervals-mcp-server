"""Unit tests for TrainerRoad models and converter."""

from intervals_mcp_server.trainerroad.models import (
    TR_ACTIVITY_TYPE_CYCLING,
    TR_ACTIVITY_TYPE_REST,
    TR_ACTIVITY_TYPE_RUN,
    TR_ACTIVITY_TYPE_STRENGTH,
    TR_ACTIVITY_TYPE_WALK,
    TRCalendarActivity,
    TRIntervalData,
    TRMemberInfo,
    TRWorkoutDetails,
)
from intervals_mcp_server.trainerroad.converter import (
    build_strength_workout_doc,
    build_structure_text,
    build_workout_doc,
    race_event_payload,
    strength_event_payload,
    workout_to_intervals_event,
    _format_duration,
    _strip_html,
)


class TestTRMemberInfo:
    def test_from_api_valid_int(self):
        data = {"MemberId": 12345, "Username": "testuser", "FTP": 280}
        member = TRMemberInfo.from_api(data)
        assert member.member_id == 12345
        assert member.username == "testuser"
        assert member.ftp == 280
        assert member.is_valid

    def test_from_api_valid_string_id(self):
        data = {"MemberId": "151360", "Username": "mkazi", "FTP": 310}
        member = TRMemberInfo.from_api(data)
        assert member.member_id == 151360
        assert member.is_valid

    def test_from_api_invalid(self):
        data = {"MemberId": -1, "Username": ""}
        member = TRMemberInfo.from_api(data)
        assert not member.is_valid

    def test_from_api_missing_fields(self):
        member = TRMemberInfo.from_api({})
        assert member.member_id == -1
        assert member.username == ""
        assert not member.is_valid


class TestTRIntervalData:
    def test_from_api(self):
        data = {
            "Start": 0,
            "End": 300,
            "Name": "Warmup",
            "IsFake": False,
            "TestInterval": False,
            "StartTargetPowerPercent": 50,
        }
        interval = TRIntervalData.from_api(data)
        assert interval.start == 0
        assert interval.end == 300
        assert interval.duration_secs == 300
        assert interval.display_name == "Warmup"
        assert interval.start_target_power_percent == 50

    def test_fake_interval_display_name(self):
        data = {
            "Start": 300,
            "End": 600,
            "Name": "Fake",
            "IsFake": True,
            "TestInterval": False,
            "StartTargetPowerPercent": 60,
        }
        interval = TRIntervalData.from_api(data)
        assert interval.display_name == "Step"


class TestTRWorkoutDetails:
    def test_from_api(self):
        data = {
            "Workout": {
                "Details": {
                    "Id": "5460",
                    "WorkoutName": "Test Workout",
                    "WorkoutDescription": "<p>A test workout</p>",
                    "IsOutside": False,
                    "Tss": 28,
                    "Duration": 60,
                },
                "IntervalData": [
                    {
                        "Start": 0,
                        "End": 3600,
                        "Name": "Workout",
                        "IsFake": False,
                        "TestInterval": False,
                        "StartTargetPowerPercent": 50,
                    },
                    {
                        "Start": 0,
                        "End": 300,
                        "Name": "Warmup",
                        "IsFake": False,
                        "TestInterval": False,
                        "StartTargetPowerPercent": 45,
                    },
                ],
            }
        }
        workout = TRWorkoutDetails.from_api(data)
        assert workout.workout_id == "5460"
        assert workout.name == "Test Workout"
        assert workout.sport_type == "VirtualRide"
        assert workout.tss == 28
        assert workout.duration_minutes == 60
        assert workout.duration_secs == 3600
        assert len(workout.intervals) == 2

    def test_outside_ride_sport_type(self):
        data = {
            "Workout": {
                "Details": {"Id": "1", "WorkoutName": "Outdoor", "IsOutside": True},
                "IntervalData": [],
            }
        }
        workout = TRWorkoutDetails.from_api(data)
        assert workout.sport_type == "Ride"


class TestTRCalendarActivity:
    def test_planned_activity(self):
        data = {
            "Id": "abc123",
            "Name": "Autore",
            "Date": "2024-06-15T00:00:00",
            "Duration": 5400,
            "Tss": 67,
            "ActivityType": 1,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.date == "2024-06-15"
        assert act.workout_name == "Autore"
        assert act.duration_secs == 5400
        assert act.tss == 67
        assert not act.is_completed

    def test_completed_activity(self):
        data = {
            "Id": "abc123",
            "Date": "2024-06-15T00:00:00",
            "CompletedRide": {
                "Name": "Sweet Spot Base",
                "Tss": 50,
                "EstimatedDuration": 3600,
            },
            "ActivityType": 1,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.is_completed
        assert act.workout_name == "Sweet Spot Base"
        assert act.tss == 50
        assert act.duration_secs == 3600

    def test_strength_activity(self):
        data = {
            "Id": "def456",
            "Name": "Strength - Lower",
            "Date": "2024-06-16T00:00:00",
            "Duration": 2700,
            "ActivityType": 8,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.activity_type == 8
        assert act.workout_name == "Strength - Lower"


class TestFormatDuration:
    def test_seconds(self):
        assert _format_duration(30) == "30s"

    def test_minutes(self):
        assert _format_duration(300) == "5m"

    def test_minutes_and_seconds(self):
        assert _format_duration(210) == "3m30s"

    def test_hours(self):
        assert _format_duration(3600) == "1h"

    def test_hours_and_minutes(self):
        assert _format_duration(3900) == "1h5m"

    def test_zero(self):
        assert _format_duration(0) == "0s"


class TestStripHtml:
    def test_basic(self):
        assert _strip_html("<p>Hello <b>world</b></p>") == "Hello world"

    def test_no_html(self):
        assert _strip_html("plain text") == "plain text"


class TestBuildStructureText:
    def test_basic_conversion(self):
        intervals = [
            TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
            TRIntervalData(start=0, end=300, name="Warmup", is_fake=False, test_interval=False, start_target_power_percent=45),
            TRIntervalData(start=300, end=600, name="Fake", is_fake=True, test_interval=False, start_target_power_percent=90),
            TRIntervalData(start=600, end=1200, name="Endurance", is_fake=False, test_interval=False, start_target_power_percent=70),
        ]
        result = build_structure_text(intervals)
        lines = result.split("\n")
        assert len(lines) == 3
        assert lines[0] == "- Warmup 5m 45%"
        assert lines[1] == "- Step 5m 90%"
        assert lines[2] == "- Endurance 10m 70%"

    def test_skips_workout_summary(self):
        intervals = [
            TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
        ]
        result = build_structure_text(intervals)
        assert result == ""

    def test_empty_intervals(self):
        assert build_structure_text([]) == ""


class TestTRCalendarActivityProperties:
    def test_race_detection(self):
        data = {
            "Id": "race1",
            "Name": "Gateway II",
            "Date": "2025-08-29T00:00:00",
            "RacePriority": "2",
            "ActivityType": 1,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.is_race
        assert act.race_priority == 2
        assert not act.is_strength
        assert not act.is_rest_day

    def test_not_a_race(self):
        data = {
            "Id": "w1",
            "Name": "Brasstown",
            "Date": "2025-06-01T00:00:00",
            "RacePriority": "0",
            "ActivityType": 1,
        }
        act = TRCalendarActivity.from_api(data)
        assert not act.is_race
        assert act.race_priority == 0

    def test_null_race_priority(self):
        data = {
            "Id": "w2",
            "Name": "Recovery",
            "Date": "2025-06-01T00:00:00",
            "RacePriority": None,
            "ActivityType": 0,
        }
        act = TRCalendarActivity.from_api(data)
        assert not act.is_race
        assert act.race_priority == 0

    def test_strength_detection(self):
        data = {
            "Id": "s1",
            "Name": "Strength - Upper",
            "Date": "2025-06-01T00:00:00",
            "ActivityType": 8,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.is_strength
        assert not act.is_race

    def test_rest_day_detection(self):
        data = {
            "Id": "r1",
            "Name": "Rest Day",
            "Date": "2025-06-01T00:00:00",
            "ActivityType": 32767,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.is_rest_day
        assert not act.is_strength
        assert not act.is_race

    def test_sport_mapping(self):
        for at, expected in [
            (TR_ACTIVITY_TYPE_CYCLING, "Ride"),
            (TR_ACTIVITY_TYPE_RUN, "Run"),
            (TR_ACTIVITY_TYPE_WALK, "Walk"),
            (TR_ACTIVITY_TYPE_STRENGTH, "WeightTraining"),
        ]:
            data = {"Id": "x", "Name": "test", "Date": "2025-01-01", "ActivityType": at}
            act = TRCalendarActivity.from_api(data)
            assert act.intervals_icu_sport == expected

    def test_notes_parsed(self):
        data = {
            "Id": "n1",
            "Name": "test",
            "Date": "2025-01-01",
            "Notes": "Bring your A game",
            "ActivityType": 1,
        }
        act = TRCalendarActivity.from_api(data)
        assert act.notes == "Bring your A game"

    def test_notes_null(self):
        data = {"Id": "n2", "Name": "test", "Date": "2025-01-01", "ActivityType": 1}
        act = TRCalendarActivity.from_api(data)
        assert act.notes == ""


class TestBuildWorkoutDoc:
    def test_basic_steps(self):
        intervals = [
            TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
            TRIntervalData(start=0, end=300, name="Warmup", is_fake=False, test_interval=False, start_target_power_percent=50),
            TRIntervalData(start=300, end=600, name="Sweet Spot 1", is_fake=False, test_interval=False, start_target_power_percent=90),
            TRIntervalData(start=600, end=900, name="Fake", is_fake=True, test_interval=False, start_target_power_percent=40),
        ]
        doc = build_workout_doc(intervals)
        steps = doc["steps"]
        assert len(steps) == 3

        assert steps[0]["warmup"] is True
        assert steps[0]["power"] == {"value": 50, "units": "%ftp"}
        assert steps[0]["duration"] == 300

        assert steps[1]["power"] == {"value": 90, "units": "%ftp"}
        assert steps[1]["duration"] == 300
        assert "warmup" not in steps[1]
        assert "cooldown" not in steps[1]

        assert steps[2]["cooldown"] is True
        assert steps[2]["power"] == {"value": 40, "units": "%ftp"}

    def test_fake_intervals_use_display_name(self):
        intervals = [
            TRIntervalData(start=0, end=120, name="Fake", is_fake=True, test_interval=False, start_target_power_percent=50),
        ]
        doc = build_workout_doc(intervals)
        assert doc["steps"][0]["text"] == "Step"

    def test_skips_workout_summary(self):
        intervals = [
            TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
        ]
        doc = build_workout_doc(intervals)
        assert doc == {}

    def test_description_included(self):
        intervals = [
            TRIntervalData(start=0, end=300, name="Step", is_fake=False, test_interval=False, start_target_power_percent=70),
        ]
        doc = build_workout_doc(intervals, description="<p>A good workout</p>")
        assert doc["description"] == "A good workout"

    def test_no_warmup_if_high_power(self):
        intervals = [
            TRIntervalData(start=0, end=300, name="Threshold", is_fake=False, test_interval=False, start_target_power_percent=95),
            TRIntervalData(start=300, end=600, name="Recovery", is_fake=False, test_interval=False, start_target_power_percent=40),
        ]
        doc = build_workout_doc(intervals)
        assert "warmup" not in doc["steps"][0]
        assert doc["steps"][1].get("cooldown") is True

    def test_no_cooldown_if_high_power_last(self):
        intervals = [
            TRIntervalData(start=0, end=300, name="Warmup", is_fake=True, test_interval=False, start_target_power_percent=50),
            TRIntervalData(start=300, end=600, name="Sprint", is_fake=False, test_interval=False, start_target_power_percent=120),
        ]
        doc = build_workout_doc(intervals)
        assert doc["steps"][0].get("warmup") is True
        assert "cooldown" not in doc["steps"][1]


class TestBuildStrengthWorkoutDoc:
    def test_basic_strength(self):
        act = TRCalendarActivity(
            activity_id="s1", date="2025-06-01", workout_name="Strength - Lower",
            tss=None, duration_secs=2700, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_STRENGTH, race_priority=0, notes="",
        )
        doc = build_strength_workout_doc(act)
        assert len(doc["steps"]) == 1
        assert doc["steps"][0]["text"] == "Strength - Lower"

    def test_with_notes(self):
        act = TRCalendarActivity(
            activity_id="s2", date="2025-06-01", workout_name="Strength - Upper",
            tss=None, duration_secs=2700, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_STRENGTH, race_priority=0,
            notes="Bench press 3x8\nRows 3x10\nCurls 3x12",
        )
        doc = build_strength_workout_doc(act)
        assert len(doc["steps"]) == 4
        assert doc["steps"][0]["text"] == "Strength - Upper"
        assert doc["steps"][1]["text"] == "Bench press 3x8"
        assert doc["steps"][2]["text"] == "Rows 3x10"
        assert doc["steps"][3]["text"] == "Curls 3x12"

    def test_no_workout_name(self):
        act = TRCalendarActivity(
            activity_id="s3", date="2025-06-01", workout_name=None,
            tss=None, duration_secs=2700, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_STRENGTH, race_priority=0, notes="",
        )
        doc = build_strength_workout_doc(act)
        assert doc["steps"][0]["text"] == "Strength"


class TestStrengthEventPayload:
    def test_basic(self):
        act = TRCalendarActivity(
            activity_id="s1", date="2025-06-01", workout_name="Strength - Lower",
            tss=None, duration_secs=2700, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_STRENGTH, race_priority=0, notes="",
        )
        payload = strength_event_payload(act)
        assert payload["type"] == "WeightTraining"
        assert payload["category"] == "WORKOUT"
        assert payload["name"] == "Strength - Lower"
        assert payload["moving_time"] == 2700
        assert "workout_doc" in payload
        assert payload["workout_doc"]["steps"][0]["text"] == "Strength - Lower"


class TestRaceEventPayload:
    def test_a_race(self):
        act = TRCalendarActivity(
            activity_id="r1", date="2025-08-29", workout_name="Gateway II",
            tss=100, duration_secs=3600, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_CYCLING, race_priority=3, notes="",
        )
        payload = race_event_payload(act)
        assert payload["category"] == "RACE"
        assert payload["race"] is True
        assert payload["name"] == "Gateway II"
        assert payload["type"] == "Ride"
        assert payload["icu_training_load"] == 100
        assert "Priority: A Race" in payload["description"]

    def test_b_race(self):
        act = TRCalendarActivity(
            activity_id="r2", date="2025-08-30", workout_name="Gateway III",
            tss=80, duration_secs=3600, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_CYCLING, race_priority=2, notes="Warm up well",
        )
        payload = race_event_payload(act)
        assert "Priority: B Race" in payload["description"]
        assert "Warm up well" in payload["description"]

    def test_c_race(self):
        act = TRCalendarActivity(
            activity_id="r3", date="2025-08-28", workout_name="Gateway",
            tss=60, duration_secs=2400, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_CYCLING, race_priority=1, notes="",
        )
        payload = race_event_payload(act)
        assert "Priority: C Race" in payload["description"]


class TestWorkoutToIntervalsEventWithDoc:
    def test_includes_workout_doc(self):
        workout = TRWorkoutDetails(
            workout_id="456",
            name="Geiger",
            description="<p>Sweet spot work</p>",
            is_outside=False,
            tss=67,
            duration_minutes=60,
            intervals=[
                TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
                TRIntervalData(start=0, end=120, name="Fake", is_fake=True, test_interval=False, start_target_power_percent=50),
                TRIntervalData(start=120, end=720, name="Sweet Spot 1", is_fake=False, test_interval=False, start_target_power_percent=90),
                TRIntervalData(start=720, end=1020, name="Fake", is_fake=True, test_interval=False, start_target_power_percent=40),
            ],
        )
        event = workout_to_intervals_event(workout, "2024-06-15")
        assert "workout_doc" in event
        doc = event["workout_doc"]
        assert len(doc["steps"]) == 3
        assert doc["steps"][0]["warmup"] is True
        assert doc["steps"][1]["power"]["value"] == 90
        assert doc["steps"][2]["cooldown"] is True
        assert event["category"] == "WORKOUT"
        assert "race" not in event

    def test_race_flag_from_activity(self):
        workout = TRWorkoutDetails(
            workout_id="789",
            name="Pre-race opener",
            description="",
            is_outside=False,
            tss=30,
            duration_minutes=30,
            intervals=[
                TRIntervalData(start=0, end=600, name="Warmup", is_fake=False, test_interval=False, start_target_power_percent=50),
            ],
        )
        race_act = TRCalendarActivity(
            activity_id="r1", date="2025-08-29", workout_name="Pre-race opener",
            tss=30, duration_secs=1800, is_completed=False,
            activity_type=TR_ACTIVITY_TYPE_CYCLING, race_priority=1, notes="",
        )
        event = workout_to_intervals_event(workout, "2025-08-29", activity=race_act)
        assert event["category"] == "RACE"
        assert event["race"] is True

    def test_no_intervals_no_workout_doc(self):
        workout = TRWorkoutDetails(
            workout_id="empty",
            name="No intervals",
            description="",
            is_outside=False,
            tss=0,
            duration_minutes=30,
            intervals=[],
        )
        event = workout_to_intervals_event(workout, "2024-06-15")
        assert "workout_doc" not in event


class TestWorkoutToIntervalsEvent:
    def test_basic_conversion(self):
        workout = TRWorkoutDetails(
            workout_id="123",
            name="Sweet Spot 1",
            description="<p>A sweet spot workout</p>",
            is_outside=False,
            tss=55,
            duration_minutes=60,
            intervals=[
                TRIntervalData(start=0, end=3600, name="Workout", is_fake=False, test_interval=False, start_target_power_percent=50),
                TRIntervalData(start=0, end=300, name="Warmup", is_fake=False, test_interval=False, start_target_power_percent=45),
            ],
        )
        event = workout_to_intervals_event(workout, "2024-06-15")
        assert event["start_date_local"] == "2024-06-15T00:00:00"
        assert event["name"] == "Sweet Spot 1"
        assert event["type"] == "VirtualRide"
        assert event["category"] == "WORKOUT"
        assert event["moving_time"] == 3600
        assert event["icu_training_load"] == 55
        assert "A sweet spot workout" in event["description"]
        assert "- Warmup 5m 45%" in event["description"]
