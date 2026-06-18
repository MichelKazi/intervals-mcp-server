"""Tests for TR workout library search — particularly JSONB array filtering."""

from json import dumps as json_dumps
from unittest.mock import MagicMock, patch

import pytest

from intervals_mcp_server.trainerroad.library import search_library


SAMPLE_RESULTS = [
    {
        "tr_workout_id": "123",
        "name": "Kaweah",
        "duration_secs": 3600,
        "tss": 75.0,
        "zone_focus": ["threshold"],
        "tags": ["over-under"],
        "intensity_min": 90,
        "intensity_max": 105,
        "interval_count": 4,
        "sport_type": "Ride",
        "is_outside": False,
        "adaptation_target": "threshold_power",
        "interval_pattern": "over_under",
        "race_specific": False,
        "work_duration_avg": 480,
        "recovery_duration_avg": 120,
    },
]


@pytest.fixture
def mock_supabase():
    """Mock supabase client that tracks query chain calls."""
    mock_client = MagicMock()
    mock_query = MagicMock()
    mock_client.table.return_value.select.return_value = mock_query

    mock_query.filter.return_value = mock_query
    mock_query.eq.return_value = mock_query
    mock_query.gte.return_value = mock_query
    mock_query.lte.return_value = mock_query
    mock_query.ilike.return_value = mock_query
    mock_query.contains.return_value = mock_query
    mock_query.order.return_value = mock_query
    mock_query.limit.return_value = mock_query

    mock_result = MagicMock()
    mock_result.data = SAMPLE_RESULTS
    mock_query.limit.return_value.execute.return_value = mock_result
    mock_query.order.return_value.limit.return_value.execute.return_value = mock_result

    with patch("intervals_mcp_server.trainerroad.library.get_supabase", return_value=mock_client):
        yield mock_query


class TestSearchLibraryZoneFocus:
    def test_zone_focus_uses_filter_not_contains(self, mock_supabase):
        """The zone_focus filter must use .filter('cs', json) not .contains() which breaks."""
        search_library(zone_focus="threshold")
        mock_supabase.filter.assert_called_once_with(
            "zone_focus", "cs", json_dumps(["threshold"])
        )
        mock_supabase.contains.assert_not_called()

    def test_tags_uses_filter_not_contains(self, mock_supabase):
        """Tags filter must use .filter('cs', json) not .contains()."""
        search_library(tags=["over-under", "progressive"])
        calls = mock_supabase.filter.call_args_list
        assert any(
            c == (("tags", "cs", json_dumps(["over-under"])),) or
            c[0] == ("tags", "cs", json_dumps(["over-under"]))
            for c in calls
        )
        assert any(
            c == (("tags", "cs", json_dumps(["progressive"])),) or
            c[0] == ("tags", "cs", json_dumps(["progressive"]))
            for c in calls
        )
        mock_supabase.contains.assert_not_called()


class TestSearchLibraryAdaptationTarget:
    def test_adaptation_target_uses_eq(self, mock_supabase):
        """Adaptation target uses simple .eq() — no JSONB containment needed."""
        search_library(adaptation_target="threshold_power")
        mock_supabase.eq.assert_any_call("adaptation_target", "threshold_power")

    def test_combined_filters(self, mock_supabase):
        """Multiple filters chain correctly without exception."""
        results = search_library(
            adaptation_target="vo2max",
            duration_max=5400,
            indoor_only=True,
            limit=3,
        )
        assert results == SAMPLE_RESULTS
        mock_supabase.eq.assert_any_call("adaptation_target", "vo2max")
        mock_supabase.lte.assert_any_call("duration_secs", 5400)
        mock_supabase.eq.assert_any_call("is_outside", False)


class TestSearchLibraryReturnsEmpty:
    def test_no_client_returns_empty(self):
        """When Supabase is not configured, returns empty list."""
        with patch("intervals_mcp_server.trainerroad.library.get_supabase", return_value=None):
            results = search_library(zone_focus="threshold")
        assert results == []

    def test_exception_returns_empty(self, mock_supabase):
        """Exceptions are caught and return empty list."""
        mock_supabase.order.return_value.limit.return_value.execute.side_effect = Exception("DB error")
        results = search_library(adaptation_target="threshold_power")
        assert results == []
