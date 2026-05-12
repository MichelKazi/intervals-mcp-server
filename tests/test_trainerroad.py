"""Unit tests for TrainerRoad models and converter."""

from intervals_mcp_server.trainerroad.models import (
    TRCalendarActivity,
    TRIntervalData,
    TRMemberInfo,
    TRWorkoutDetails,
)
from intervals_mcp_server.trainerroad.converter import (
    build_structure_text,
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
