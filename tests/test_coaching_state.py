"""Unit tests for directeur coaching state integration."""

from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import pytest

from intervals_mcp_server.directeur_client import _staleness_note, get_coaching_snapshot, get_readiness


@pytest.fixture(autouse=True)
def reset_client():
    """Reset the module-level httpx client singleton between tests."""
    import intervals_mcp_server.directeur_client as dc
    dc._client = None
    yield
    dc._client = None


@pytest.fixture
def mock_config_with_directeur(monkeypatch):
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


@pytest.fixture
def mock_config_no_directeur(monkeypatch):
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
        directeur_url="",
        directeur_api_key="",
    )
    yield
    cfg._config_instance = None


class TestStalenessNote:
    def test_fresh_data(self):
        now = datetime.now(timezone.utc).isoformat()
        assert _staleness_note(now) is None

    def test_stale_data(self):
        old = (datetime.now(timezone.utc) - timedelta(hours=30)).isoformat()
        note = _staleness_note(old)
        assert note is not None
        assert "stale" in note
        assert "30h" in note

    def test_none_input(self):
        assert _staleness_note(None) is None

    def test_invalid_timestamp(self):
        assert _staleness_note("not-a-date") is None


class TestGetReadiness:
    @pytest.mark.asyncio
    async def test_not_configured(self, mock_config_no_directeur):
        result = await get_readiness()
        assert result is None

    @pytest.mark.asyncio
    async def test_success(self, mock_config_with_directeur):
        response_data = {
            "date": "2026-06-18",
            "verdict": "yellow",
            "confounds": {"fatigue": "mild", "sleep": "poor"},
            "reasoning": "Low HRV",
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }

        class FakeResponse:
            def raise_for_status(self): pass
            def json(self): return response_data

        mock_http = AsyncMock()
        mock_http.get = AsyncMock(return_value=FakeResponse())

        with patch("intervals_mcp_server.directeur_client._get_client", return_value=mock_http):
            result = await get_readiness()

        assert result["verdict"] == "yellow"
        assert result["reasoning"] == "Low HRV"

    @pytest.mark.asyncio
    async def test_directeur_down(self, mock_config_with_directeur):
        mock_http = AsyncMock()
        mock_http.get = AsyncMock(side_effect=Exception("Connection refused"))

        with patch("intervals_mcp_server.directeur_client._get_client", return_value=mock_http):
            result = await get_readiness()

        assert result is None


class TestGetCoachingSnapshot:
    @pytest.mark.asyncio
    async def test_not_configured(self, mock_config_no_directeur):
        result = await get_coaching_snapshot()
        assert "error" in result

    @pytest.mark.asyncio
    async def test_happy_path(self, mock_config_with_directeur):
        readiness_data = {
            "verdict": "green",
            "reasoning": "Well rested",
            "computed_at": datetime.now(timezone.utc).isoformat(),
        }
        patterns_data = {
            "patterns": [{"pattern_type": "volume_collapse", "severity": 3, "context": {"evidence": "dropped 50%"}}]
        }
        progression_data = {
            "zone": "threshold",
            "tr_anchored_level": 85,
            "personal_delta": 1.5,
            "scored_at": datetime.now(timezone.utc).isoformat(),
        }

        with patch("intervals_mcp_server.directeur_client.get_readiness", new_callable=AsyncMock, return_value=readiness_data), \
             patch("intervals_mcp_server.directeur_client.get_active_patterns", new_callable=AsyncMock, return_value=patterns_data), \
             patch("intervals_mcp_server.directeur_client.get_progression", new_callable=AsyncMock, return_value=progression_data):
            result = await get_coaching_snapshot()

        assert result["readiness"]["verdict"] == "green"
        assert len(result["patterns"]["patterns"]) == 1
        assert "threshold" in result["progression"]

    @pytest.mark.asyncio
    async def test_partial_failure(self, mock_config_with_directeur):
        readiness_data = {"verdict": "green", "reasoning": "OK", "computed_at": datetime.now(timezone.utc).isoformat()}

        with patch("intervals_mcp_server.directeur_client.get_readiness", new_callable=AsyncMock, return_value=readiness_data), \
             patch("intervals_mcp_server.directeur_client.get_active_patterns", new_callable=AsyncMock, return_value=None), \
             patch("intervals_mcp_server.directeur_client.get_progression", new_callable=AsyncMock, return_value=None):
            result = await get_coaching_snapshot()

        assert result["readiness"]["verdict"] == "green"
        assert result["patterns"] is None
        assert result["progression"] == {}


class TestCoachingStateTool:
    @pytest.mark.asyncio
    async def test_not_configured(self, mock_config_no_directeur):
        from intervals_mcp_server.tools.coaching_state import get_coaching_state
        result = await get_coaching_state()
        assert "unavailable" in result.lower() or "not configured" in result.lower()

    @pytest.mark.asyncio
    async def test_formatted_output(self, mock_config_with_directeur):
        from intervals_mcp_server.tools.coaching_state import get_coaching_state

        snapshot = {
            "readiness": {
                "verdict": "yellow",
                "reasoning": "Poor sleep",
                "confounds": {"sleep": "poor", "fatigue": "mild", "medical": "none"},
                "computed_at": datetime.now(timezone.utc).isoformat(),
            },
            "patterns": {"patterns": []},
            "progression": {
                "threshold": {
                    "tr_anchored_level": 85,
                    "personal_delta": 1.0,
                    "scored_at": datetime.now(timezone.utc).isoformat(),
                    "context": '{"execution_quality": 0.85, "activity_name": "Whiteleaf +2"}',
                }
            },
        }

        with patch("intervals_mcp_server.tools.coaching_state.get_coaching_snapshot", new_callable=AsyncMock, return_value=snapshot):
            result = await get_coaching_state()

        assert "YELLOW" in result
        assert "Poor sleep" in result
        assert "sleep=poor" in result
        assert "none active" in result
        assert "Whiteleaf +2" in result
        assert "execution 0.85" in result
        assert "medical" not in result  # filtered out since "none"

    @pytest.mark.asyncio
    async def test_stale_readiness(self, mock_config_with_directeur):
        from intervals_mcp_server.tools.coaching_state import get_coaching_state

        old_time = (datetime.now(timezone.utc) - timedelta(hours=36)).isoformat()
        snapshot = {
            "readiness": {
                "verdict": "green",
                "reasoning": "OK",
                "confounds": {},
                "computed_at": old_time,
            },
            "patterns": {"patterns": []},
            "progression": {},
        }

        with patch("intervals_mcp_server.tools.coaching_state.get_coaching_snapshot", new_callable=AsyncMock, return_value=snapshot):
            result = await get_coaching_state()

        assert "stale" in result
        assert "36h" in result
