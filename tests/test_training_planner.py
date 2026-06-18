"""Unit tests for the training block planner."""

from datetime import date, timedelta
from unittest.mock import AsyncMock, patch

import pytest

from intervals_mcp_server.tools.training_planner import (
    _assign_zones_to_days,
    _compute_week_tss_targets,
    _find_confound_dates,
    build_training_block,
)


class TestComputeWeekTssTargets:
    def test_3_1_pattern_4_weeks(self):
        targets = _compute_week_tss_targets(350.0, 4, "3:1")
        assert len(targets) == 4
        assert targets[0]["type"] == "build"
        assert targets[1]["type"] == "build"
        assert targets[2]["type"] == "build"
        assert targets[3]["type"] == "recovery"
        assert targets[3]["tss"] == pytest.approx(210.0)

    def test_2_1_pattern(self):
        targets = _compute_week_tss_targets(300.0, 3, "2:1")
        assert targets[0]["type"] == "build"
        assert targets[1]["type"] == "build"
        assert targets[2]["type"] == "recovery"

    def test_progressive_overload(self):
        targets = _compute_week_tss_targets(400.0, 3, "3:1")
        assert targets[0]["tss"] == pytest.approx(400.0)
        assert targets[1]["tss"] == pytest.approx(420.0)
        assert targets[2]["tss"] == pytest.approx(440.0)


class TestAssignZonesToDays:
    def test_two_zones_two_days(self):
        result = _assign_zones_to_days(2, ["threshold", "vo2max"])
        assert result == ["threshold", "vo2max"]

    def test_three_days_two_zones_wraps(self):
        result = _assign_zones_to_days(3, ["threshold", "vo2max"])
        assert result == ["threshold", "vo2max", "threshold"]

    def test_single_zone(self):
        result = _assign_zones_to_days(2, ["sweet-spot"])
        assert result == ["sweet-spot", "sweet-spot"]


class TestFindConfoundDates:
    def test_extracts_dates_and_next_day(self):
        ctx = {
            "confounds_upcoming": [
                {"date": "2026-06-18", "event_type": "tirzepatide_dose", "impact_duration_days": 7}
            ]
        }
        result = _find_confound_dates(ctx)
        assert date(2026, 6, 18) in result
        assert date(2026, 6, 19) in result

    def test_empty_confounds(self):
        assert _find_confound_dates({}) == set()
        assert _find_confound_dates({"confounds_upcoming": []}) == set()

    def test_invalid_date_skipped(self):
        ctx = {"confounds_upcoming": [{"date": "not-a-date"}]}
        assert _find_confound_dates(ctx) == set()


MOCK_PLANNING_CONTEXT = {
    "zone_distribution": {"threshold": {"count": 15, "pct": 8}},
    "zone_deltas": {
        "threshold": {"personal_delta": 1.0, "adaptation_target": "threshold_power"},
        "vo2max": {"personal_delta": 0.0, "adaptation_target": "vo2max"},
    },
    "active_patterns": [],
    "readiness": {"verdict": "green", "confounds": {}},
    "confounds_upcoming": [],
    "volume_trend_weekly": [5, 6, 5, 4],
    "weekly_tss": [380.0, 410.0, 350.0, 390.0],
    "total_scored_recent": 200,
}

MOCK_WORKOUTS_THRESHOLD = [
    {
        "tr_workout_id": "tr-123",
        "name": "Kaweah +2",
        "duration_secs": 4500,
        "tss": 82.0,
        "zone_focus": ["threshold"],
        "interval_pattern": "over_under",
        "adaptation_target": "threshold_power",
        "race_specific": False,
        "intensity_min": 90,
        "intensity_max": 105,
        "interval_count": 4,
        "work_duration_avg": 480,
        "recovery_duration_avg": 120,
    },
    {
        "tr_workout_id": "tr-456",
        "name": "Mount Baldy -1",
        "duration_secs": 3600,
        "tss": 65.0,
        "zone_focus": ["threshold"],
        "interval_pattern": "long_intervals",
        "adaptation_target": "threshold_power",
        "race_specific": False,
        "intensity_min": 95,
        "intensity_max": 100,
        "interval_count": 3,
        "work_duration_avg": 600,
        "recovery_duration_avg": 180,
    },
]

MOCK_WORKOUTS_VO2MAX = [
    {
        "tr_workout_id": "tr-789",
        "name": "Brasted +5",
        "duration_secs": 4500,
        "tss": 95.0,
        "zone_focus": ["vo2max"],
        "interval_pattern": "short_intervals",
        "adaptation_target": "vo2max",
        "race_specific": False,
        "intensity_min": 110,
        "intensity_max": 120,
        "interval_count": 8,
        "work_duration_avg": 30,
        "recovery_duration_avg": 15,
    },
]


@pytest.fixture(autouse=True)
def reset_directeur_client():
    import intervals_mcp_server.directeur_client as dc
    dc._client = None
    yield
    dc._client = None


@pytest.fixture
def mock_config(monkeypatch):
    from intervals_mcp_server.config import Config
    import intervals_mcp_server.config as cfg
    cfg._config_instance = Config(
        api_key="test",
        athlete_id="i1",
        intervals_api_base_url="https://intervals.icu/api/v1",
        user_agent="test-agent",
        trainerroad_username="",
        trainerroad_password="",
        trainerroad_cookie="",
        trainerroad_member_id="",
        supabase_url="",
        supabase_service_role_key="",
        second_brain_mcp_url="",
        directeur_url="http://localhost:8080",
        directeur_api_key="test-key",
    )
    yield
    cfg._config_instance = None


def _mock_search(adaptation_target=None, zone_focus=None, **kwargs):
    if adaptation_target == "threshold_power":
        return MOCK_WORKOUTS_THRESHOLD
    if adaptation_target == "vo2max":
        return MOCK_WORKOUTS_VO2MAX
    if zone_focus == "threshold":
        return MOCK_WORKOUTS_THRESHOLD
    if zone_focus == "vo2max":
        return MOCK_WORKOUTS_VO2MAX
    return []


class TestBuildTrainingBlock:
    @pytest.mark.asyncio
    async def test_happy_path(self, mock_config):
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=MOCK_PLANNING_CONTEXT), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=4, hard_days_per_week=2)

        assert "Training Block: 4 weeks" in result
        assert "Kaweah +2" in result
        assert "Brasted +5" in result
        assert "threshold" in result
        assert "vo2max" in result
        assert "Option A" in result
        assert "Week 4 (Recovery)" in result

    @pytest.mark.asyncio
    async def test_directeur_unavailable(self, mock_config):
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=None), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=2, hard_days_per_week=1, target_zones=["threshold"])

        assert "Directeur planning context unavailable" in result
        assert "Kaweah +2" in result

    @pytest.mark.asyncio
    async def test_empty_library_for_zone(self, mock_config):
        def empty_search(**kwargs):
            return []

        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=MOCK_PLANNING_CONTEXT), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   return_value=[]):
            result = await build_training_block(weeks=1, target_zones=["sprint"])

        assert "No workouts found" in result
        assert "search_workout_library" in result

    @pytest.mark.asyncio
    async def test_recovery_week(self, mock_config):
        ctx = {**MOCK_PLANNING_CONTEXT, "volume_trend_weekly": [5, 5, 5, 5]}
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=4, recovery_pattern="3:1")

        assert "Recovery" in result
        assert "No structured intensity" in result

    @pytest.mark.asyncio
    async def test_volume_collapse_constraint(self, mock_config):
        ctx = {
            **MOCK_PLANNING_CONTEXT,
            "active_patterns": [{"pattern_type": "volume_collapse", "severity": 5, "context": {}}],
        }
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=2)

        assert "volume_collapse" in result
        assert "Conservative" in result

    @pytest.mark.asyncio
    async def test_confound_constraint_listed(self, mock_config):
        tomorrow = (date.today() + timedelta(days=1)).isoformat()
        ctx = {
            **MOCK_PLANNING_CONTEXT,
            "confounds_upcoming": [
                {"date": tomorrow, "event_type": "tirzepatide_dose", "impact_duration_days": 7}
            ],
        }
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=1)

        assert "confounds block hard work" in result

    @pytest.mark.asyncio
    async def test_baseline_tss_from_weekly_tss(self, mock_config):
        """Bug fix: TSS baseline should come from weekly_tss, not ride counts."""
        ctx = {
            **MOCK_PLANNING_CONTEXT,
            "weekly_tss": [350.0, 400.0, 380.0, 0.0],
        }
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=4, hard_days_per_week=2)

        assert "~0" not in result
        assert "Baseline TSS/week: ~377" in result

    @pytest.mark.asyncio
    async def test_baseline_tss_fallback_no_weekly_tss(self, mock_config):
        """When weekly_tss is absent, falls back to ride count heuristic."""
        ctx = {
            **MOCK_PLANNING_CONTEXT,
            "weekly_tss": [],
            "volume_trend_weekly": [5, 4, 5, 6],
        }
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=2)

        assert "~0" not in result
        assert "Baseline TSS/week: ~350" in result

    @pytest.mark.asyncio
    async def test_searches_by_adaptation_target(self, mock_config):
        """Bug fix: workout search uses adaptation_target, not zone_focus."""
        search_calls = []

        def tracking_search(**kwargs):
            search_calls.append(kwargs)
            return _mock_search(**kwargs)

        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=MOCK_PLANNING_CONTEXT), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=tracking_search):
            result = await build_training_block(
                weeks=1, target_zones=["threshold", "vo2max"]
            )

        assert len(search_calls) >= 2
        assert search_calls[0]["adaptation_target"] == "threshold_power"
        assert search_calls[1]["adaptation_target"] == "vo2max"
        assert "Kaweah +2" in result
        assert "Brasted +5" in result

    @pytest.mark.asyncio
    async def test_progressive_overload_nonzero(self, mock_config):
        """Bug fix: build weeks must show increasing TSS, not all zero."""
        ctx = {
            **MOCK_PLANNING_CONTEXT,
            "weekly_tss": [400.0, 380.0, 420.0, 390.0],
        }
        with patch("intervals_mcp_server.tools.training_planner.get_planning_context",
                   new_callable=AsyncMock, return_value=ctx), \
             patch("intervals_mcp_server.tools.training_planner.search_library",
                   side_effect=_mock_search):
            result = await build_training_block(weeks=4, recovery_pattern="3:1")

        assert "Week 1 (Build)" in result
        assert "Week 2 (Build)" in result
        assert "Week 3 (Build)" in result
        assert "Week 4 (Recovery)" in result
        # Week 2 TSS should be higher than Week 1
        assert "Target TSS: ~398" in result  # week 1: baseline * 1.0
        assert "Target TSS: ~417" in result  # week 2: baseline * 1.05
        assert "Target TSS: ~437" in result  # week 3: baseline * 1.10
