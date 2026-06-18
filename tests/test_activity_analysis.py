"""Unit tests for the activity analysis tools."""

from unittest.mock import AsyncMock, patch

import pytest

from intervals_mcp_server.tools.activity_analysis import (
    _format_analysis,
    analyze_activity,
    get_activity_analysis,
)


@pytest.fixture(autouse=True)
def reset_client():
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


MOCK_ANALYSIS = {
    "activity_id": "i131804:12345",
    "activity_name": "Kaweah +2",
    "activity_date": "2026-06-15",
    "mode": "standard",
    "overall_grade": "B+",
    "executive_summary": "Solid threshold session. Power faded slightly in the final interval.",
    "findings": [
        {
            "category": "power",
            "severity": "flag",
            "lap": 4,
            "title": "Power fade in final interval",
            "detail": "NP dropped from 285W to 268W (6% decline).",
            "metric": {"name": "np_delta", "value": -6.0, "unit": "%", "threshold": -5.0},
        },
        {
            "category": "heartrate",
            "severity": "info",
            "lap": None,
            "title": "HR drift 8%",
            "detail": "Cardiac decoupling within acceptable range.",
            "metric": None,
        },
    ],
    "lap_analyses": [
        {"lap_number": 1, "duration_seconds": 720, "avg_power": 285, "avg_hr": 165, "grade": "A", "notes": "Clean start"},
        {"lap_number": 2, "duration_seconds": 720, "avg_power": 283, "avg_hr": 168, "grade": "A", "notes": "Steady"},
        {"lap_number": 3, "duration_seconds": 720, "avg_power": 280, "avg_hr": 171, "grade": "B+", "notes": "Slight fade"},
        {"lap_number": 4, "duration_seconds": 720, "avg_power": 268, "avg_hr": 170, "grade": "B", "notes": "Dropped 6%"},
    ],
    "tactical_summary": None,
    "match_burns": None,
    "analyzed_at": "2026-06-15T22:00:00Z",
}

MOCK_RACE_ANALYSIS = {
    "activity_id": "i131804:99999",
    "activity_name": "Tuesday Night Crit",
    "activity_date": "2026-06-10",
    "mode": "race",
    "overall_grade": "A",
    "executive_summary": "Smart race, well-timed attacks.",
    "tactical_summary": "Sat in for first 20min, attacked on lap 5 climb, solo to finish.",
    "findings": [
        {
            "category": "tactical",
            "severity": "info",
            "lap": 5,
            "title": "Well-timed attack",
            "detail": "Launched at 450W on the climb when others were fatigued.",
            "metric": None,
        },
    ],
    "lap_analyses": [
        {"lap_number": 1, "duration_seconds": 300, "avg_power": 220, "avg_hr": 155, "grade": "A", "notes": "Sitting in"},
    ],
    "match_burns": [
        {"timestamp_seconds": 1200, "watts_peak": 650, "duration_seconds": 12, "context": "Closing a gap"},
        {"timestamp_seconds": 1500, "watts_peak": 450, "duration_seconds": 45, "context": "Attack on climb"},
    ],
    "analyzed_at": "2026-06-10T23:00:00Z",
}


class TestFormatAnalysis:
    def test_standard_analysis(self):
        result = _format_analysis(MOCK_ANALYSIS)
        assert "B+" in result
        assert "Kaweah +2" in result
        assert "Power fade in final interval" in result
        assert "HR drift 8%" in result
        assert "| 1 | 285W |" in result
        assert "Tactical Review" not in result
        assert "Match Burns" not in result

    def test_race_analysis(self):
        result = _format_analysis(MOCK_RACE_ANALYSIS)
        assert "race" in result
        assert "Tactical Review" in result
        assert "Match Burns" in result
        assert "650W" in result
        assert "Attack on climb" in result


class TestGetActivityAnalysis:
    @pytest.mark.asyncio
    async def test_found(self, mock_config):
        with patch("intervals_mcp_server.tools.activity_analysis._fetch_analysis",
                   new_callable=AsyncMock, return_value=MOCK_ANALYSIS):
            result = await get_activity_analysis("i131804:12345")
        assert "B+" in result
        assert "Kaweah +2" in result

    @pytest.mark.asyncio
    async def test_not_found(self, mock_config):
        with patch("intervals_mcp_server.tools.activity_analysis._fetch_analysis",
                   new_callable=AsyncMock, return_value=None):
            result = await get_activity_analysis("i131804:99999")
        assert "No analysis found" in result
        assert "analyze_activity" in result

    @pytest.mark.asyncio
    async def test_404_response(self, mock_config):
        with patch("intervals_mcp_server.tools.activity_analysis._fetch_analysis",
                   new_callable=AsyncMock, return_value={"detail": "Not Found"}):
            result = await get_activity_analysis("i131804:99999")
        assert "No analysis found" in result


class TestAnalyzeActivity:
    @pytest.mark.asyncio
    async def test_single_activity(self, mock_config):
        trigger_result = {"analyzed": ["i131804:12345"], "skipped": [], "errors": []}
        with patch("intervals_mcp_server.tools.activity_analysis.trigger_activity_analysis",
                   new_callable=AsyncMock, return_value=trigger_result):
            result = await analyze_activity(activity_id="i131804:12345")
        assert "Analyzed 1 activity" in result
        assert "get_activity_analysis" in result

    @pytest.mark.asyncio
    async def test_date_range(self, mock_config):
        trigger_result = {"analyzed": ["a1", "a2", "a3"], "skipped": ["a4"], "errors": []}
        with patch("intervals_mcp_server.tools.activity_analysis.trigger_activity_analysis",
                   new_callable=AsyncMock, return_value=trigger_result):
            result = await analyze_activity(oldest="2026-06-01", newest="2026-06-15")
        assert "Analyzed 3 activities" in result
        assert "Skipped 1" in result

    @pytest.mark.asyncio
    async def test_directeur_unavailable(self, mock_config):
        with patch("intervals_mcp_server.tools.activity_analysis.trigger_activity_analysis",
                   new_callable=AsyncMock, return_value=None):
            result = await analyze_activity(activity_id="i131804:12345")
        assert "unavailable" in result

    @pytest.mark.asyncio
    async def test_missing_params(self, mock_config):
        result = await analyze_activity()
        assert "Provide either" in result

    @pytest.mark.asyncio
    async def test_with_errors(self, mock_config):
        trigger_result = {"analyzed": [], "skipped": [], "errors": ["i131804:bad — no streams"]}
        with patch("intervals_mcp_server.tools.activity_analysis.trigger_activity_analysis",
                   new_callable=AsyncMock, return_value=trigger_result):
            result = await analyze_activity(activity_id="i131804:bad")
        assert "Errors" in result
        assert "no streams" in result
