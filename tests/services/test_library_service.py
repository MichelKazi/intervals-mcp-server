import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest
from unittest.mock import MagicMock

from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.services.library import (
    _alternative_bands,
    _build_workout_doc,
    find_alternatives,
    get_library_workout,
    search_library_workouts,
    create_custom_workout_svc,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_supabase(rows=None, count=None):
    """Build a mock supabase client returning given rows."""
    client = MagicMock()
    result = MagicMock()
    result.data = rows if rows is not None else []
    result.count = count
    # Chain: .table().select().eq().limit().execute() and .table().select("*").eq().limit().execute()
    chain = MagicMock()
    chain.select.return_value = chain
    chain.eq.return_value = chain
    chain.limit.return_value = chain
    chain.execute.return_value = result
    client.table.return_value = chain
    return client, chain


SAMPLE_WORKOUT = {
    "tr_workout_id": "w1",
    "name": "Kaweah",
    "duration_secs": 3600,
    "tss": 75.0,
    "zone_focus": ["threshold"],
    "adaptation_target": "threshold_power",
    "interval_pattern": "over_under",
    "intensity_min": 90,
    "intensity_max": 105,
    "interval_count": 4,
    "sport_type": "Ride",
    "is_outside": False,
    "race_specific": False,
    "work_duration_avg": 480,
    "recovery_duration_avg": 120,
    "intervals_json": '[{"start": 0, "end": 600, "name": "WU", "power_pct": 60}]',
    "description": "Over-under threshold workout.",
}


# ---------------------------------------------------------------------------
# _alternative_bands
# ---------------------------------------------------------------------------

class TestAlternativeBands:
    def _ref(self, tss=100.0, duration_secs=3600, adaptation="threshold_power"):
        return {"tss": tss, "duration_secs": duration_secs, "adaptation_target": adaptation}

    def test_similar_default(self):
        ref = self._ref()
        b = _alternative_bands(ref, None, None, None)
        assert b["duration_min_secs"] == int(3600 * 0.85)
        assert b["duration_max_secs"] == int(3600 * 1.15)
        assert b["tss_min"] == pytest.approx(85.0)
        assert b["tss_max"] == pytest.approx(115.0)
        assert b["search_adaptation"] == "threshold_power"

    def test_shorter(self):
        ref = self._ref()
        b = _alternative_bands(ref, "shorter", None, None)
        assert b["duration_max_secs"] == int(3600 * 0.8)
        assert b["duration_min_secs"] == int(3600 * 0.4)
        assert b["tss_min"] == pytest.approx(50.0)
        assert b["tss_max"] == pytest.approx(90.0)

    def test_longer(self):
        ref = self._ref()
        b = _alternative_bands(ref, "longer", None, None)
        assert b["duration_min_secs"] == int(3600 * 1.1)
        assert b["duration_max_secs"] == int(3600 * 1.8)
        assert b["tss_min"] == pytest.approx(100.0)
        assert b["tss_max"] == pytest.approx(180.0)

    def test_easier(self):
        ref = self._ref()
        b = _alternative_bands(ref, "easier", None, None)
        assert b["duration_min_secs"] == int(3600 * 0.7)
        assert b["duration_max_secs"] == int(3600 * 1.1)
        assert b["tss_max"] == pytest.approx(85.0)
        assert b["tss_min"] == pytest.approx(40.0)

    def test_harder(self):
        ref = self._ref()
        b = _alternative_bands(ref, "harder", None, None)
        assert b["duration_min_secs"] == int(3600 * 0.9)
        assert b["duration_max_secs"] == int(3600 * 1.3)
        assert b["tss_min"] == pytest.approx(110.0)
        assert b["tss_max"] == pytest.approx(180.0)

    def test_target_zone_overrides_adaptation(self):
        ref = self._ref(adaptation="threshold_power")
        b = _alternative_bands(ref, None, "vo2max", None)
        assert b["search_adaptation"] == "vo2max"

    def test_max_duration_cap(self):
        ref = self._ref(duration_secs=3600)
        b = _alternative_bands(ref, "longer", None, 60)
        assert b["duration_max_secs"] == 60 * 60

    def test_max_duration_pushes_min_down(self):
        # shorter band sets min to 40% of 3600 = 1440, max to 80% = 2880
        # cap at 30min = 1800 → min should stay 1440 (below cap)
        ref = self._ref(duration_secs=3600)
        b = _alternative_bands(ref, "shorter", None, 30)
        assert b["duration_max_secs"] == 30 * 60
        # min was 1440, cap is 1800 → min unchanged
        assert b["duration_min_secs"] == int(3600 * 0.4)

    def test_max_duration_forces_min_below_cap(self):
        # similar band: min=3060, max=4140. Cap=45min=2700 → min > cap → reset to cap*0.5
        ref = self._ref(duration_secs=3600)
        b = _alternative_bands(ref, "similar", None, 45)
        assert b["duration_max_secs"] == 45 * 60
        assert b["duration_min_secs"] == int(45 * 60 * 0.5)


# ---------------------------------------------------------------------------
# _build_workout_doc
# ---------------------------------------------------------------------------

class TestBuildWorkoutDoc:
    def test_basic_step(self):
        steps = [{"power": 95, "duration": 300}]
        doc = _build_workout_doc(steps)
        assert doc["steps"][0]["power"] == {"value": 95, "units": "%ftp"}
        assert doc["steps"][0]["duration"] == 300

    def test_repeat_block(self):
        steps = [{"reps": 3, "steps": [{"power": 120, "duration": 180}]}]
        doc = _build_workout_doc(steps)
        assert doc["steps"][0]["reps"] == 3
        assert len(doc["steps"][0]["steps"]) == 1

    def test_description_included(self):
        doc = _build_workout_doc([], "test desc")
        assert doc["description"] == "test desc"

    def test_no_description(self):
        doc = _build_workout_doc([])
        assert "description" not in doc


# ---------------------------------------------------------------------------
# search_library_workouts
# ---------------------------------------------------------------------------

class TestSearchLibraryWorkouts:
    @pytest.mark.asyncio
    async def test_converts_minutes_to_secs(self, monkeypatch):
        captured = {}

        def fake_search(**kwargs):
            captured.update(kwargs)
            return []

        monkeypatch.setattr("intervals_mcp_server.services.library.search_library", fake_search)
        await search_library_workouts(duration_min_minutes=30, duration_max_minutes=60)
        assert captured["duration_min"] == 30 * 60
        assert captured["duration_max"] == 60 * 60

    @pytest.mark.asyncio
    async def test_none_minutes_passes_none(self, monkeypatch):
        captured = {}

        def fake_search(**kwargs):
            captured.update(kwargs)
            return []

        monkeypatch.setattr("intervals_mcp_server.services.library.search_library", fake_search)
        await search_library_workouts()
        assert captured["duration_min"] is None
        assert captured["duration_max"] is None

    @pytest.mark.asyncio
    async def test_returns_results(self, monkeypatch):
        monkeypatch.setattr(
            "intervals_mcp_server.services.library.search_library",
            lambda **kwargs: [SAMPLE_WORKOUT],
        )
        result = await search_library_workouts(zone_focus="threshold")
        assert len(result) == 1
        assert result[0]["name"] == "Kaweah"

    @pytest.mark.asyncio
    async def test_returns_empty_list(self, monkeypatch):
        monkeypatch.setattr(
            "intervals_mcp_server.services.library.search_library",
            lambda **kwargs: [],
        )
        result = await search_library_workouts()
        assert result == []


# ---------------------------------------------------------------------------
# get_library_workout
# ---------------------------------------------------------------------------

class TestGetLibraryWorkout:
    @pytest.mark.asyncio
    async def test_returns_workout(self, monkeypatch):
        client, _ = _make_supabase([SAMPLE_WORKOUT])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        result = await get_library_workout("w1")
        assert result["name"] == "Kaweah"

    @pytest.mark.asyncio
    async def test_parses_intervals_json_string(self, monkeypatch):
        client, _ = _make_supabase([SAMPLE_WORKOUT])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        result = await get_library_workout("w1")
        assert isinstance(result["intervals_json"], list)
        assert result["intervals_json"][0]["name"] == "WU"

    @pytest.mark.asyncio
    async def test_404_when_missing(self, monkeypatch):
        client, _ = _make_supabase([])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        with pytest.raises(ServiceError) as exc_info:
            await get_library_workout("missing")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_503_when_no_supabase(self, monkeypatch):
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: None)
        with pytest.raises(ServiceError) as exc_info:
            await get_library_workout("w1")
        assert exc_info.value.status_code == 503


# ---------------------------------------------------------------------------
# find_alternatives
# ---------------------------------------------------------------------------

class TestFindAlternatives:
    def _ref_row(self):
        return {
            "name": "Kaweah",
            "duration_secs": 3600,
            "tss": 75.0,
            "zone_focus": ["threshold"],
            "adaptation_target": "threshold_power",
            "interval_pattern": "over_under",
            "intensity_min": 90,
            "intensity_max": 105,
            "interval_count": 4,
            "work_duration_avg": 480,
            "is_outside": False,
            "race_specific": False,
        }

    def _alt_row(self, wid="w2", name="Mary Austin"):
        return {
            "tr_workout_id": wid,
            "name": name,
            "duration_secs": 3600,
            "tss": 80.0,
            "adaptation_target": "threshold_power",
        }

    @pytest.mark.asyncio
    async def test_returns_alternatives(self, monkeypatch):
        client, _ = _make_supabase([self._ref_row()])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        monkeypatch.setattr(
            "intervals_mcp_server.services.library.search_library",
            lambda **kwargs: [self._alt_row()],
        )
        result = await find_alternatives("w1")
        assert len(result) == 1
        assert result[0]["name"] == "Mary Austin"

    @pytest.mark.asyncio
    async def test_excludes_reference_workout(self, monkeypatch):
        alt = self._alt_row(wid="w1", name="Same workout")
        client, _ = _make_supabase([self._ref_row()])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        monkeypatch.setattr(
            "intervals_mcp_server.services.library.search_library",
            lambda **kwargs: [alt],
        )
        result = await find_alternatives("w1")
        assert result == []

    @pytest.mark.asyncio
    async def test_404_when_ref_missing(self, monkeypatch):
        client, _ = _make_supabase([])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        with pytest.raises(ServiceError) as exc_info:
            await find_alternatives("missing")
        assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_503_when_no_supabase(self, monkeypatch):
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: None)
        with pytest.raises(ServiceError) as exc_info:
            await find_alternatives("w1")
        assert exc_info.value.status_code == 503

    @pytest.mark.asyncio
    async def test_fallback_looser_search_on_empty(self, monkeypatch):
        """When first search returns empty, falls back to looser constraints."""
        client, _ = _make_supabase([self._ref_row()])
        monkeypatch.setattr("intervals_mcp_server.services.library.get_supabase", lambda: client)
        call_count = {"n": 0}

        def fake_search(**kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return []  # first search: empty
            return [self._alt_row()]  # fallback

        monkeypatch.setattr("intervals_mcp_server.services.library.search_library", fake_search)
        result = await find_alternatives("w1")
        assert call_count["n"] == 2
        assert len(result) == 1


# ---------------------------------------------------------------------------
# create_custom_workout_svc
# ---------------------------------------------------------------------------

class TestCreateCustomWorkoutSvc:
    STEPS = [{"power": 95, "duration": 300}]

    @pytest.mark.asyncio
    async def test_creates_without_schedule(self, monkeypatch):
        async def fake_request(url, **kwargs):
            return {"id": "wk-99"}

        monkeypatch.setattr(
            "intervals_mcp_server.services.library.make_intervals_request", fake_request
        )
        result = await create_custom_workout_svc("My Workout", "Ride", self.STEPS)
        assert result["workout_id"] == "wk-99"
        assert result["scheduled"] is False
        assert result["event_id"] is None
        assert result["schedule_error"] is None

    @pytest.mark.asyncio
    async def test_creates_with_schedule(self, monkeypatch):
        call_count = {"n": 0}

        async def fake_request(url, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return {"id": "wk-99"}
            return {"id": "ev-42"}

        monkeypatch.setattr(
            "intervals_mcp_server.services.library.make_intervals_request", fake_request
        )
        result = await create_custom_workout_svc(
            "My Workout", "Ride", self.STEPS, schedule_date="2026-07-01"
        )
        assert result["workout_id"] == "wk-99"
        assert result["scheduled"] is True
        assert result["event_id"] == "ev-42"
        assert result["schedule_error"] is None

    @pytest.mark.asyncio
    async def test_raises_service_error_on_create_failure(self, monkeypatch):
        async def fake_request(url, **kwargs):
            return {"error": True, "message": "bad request", "status_code": 400}

        monkeypatch.setattr(
            "intervals_mcp_server.services.library.make_intervals_request", fake_request
        )
        with pytest.raises(ServiceError) as exc_info:
            await create_custom_workout_svc("Bad", "Ride", self.STEPS)
        assert exc_info.value.status_code == 400
        assert "bad request" in exc_info.value.message

    @pytest.mark.asyncio
    async def test_schedule_failure_surfaces_error(self, monkeypatch):
        """When schedule_date given and event POST fails, schedule_error contains the message."""
        call_count = {"n": 0}

        async def fake_request(url, **kwargs):
            call_count["n"] += 1
            if call_count["n"] == 1:
                return {"id": "wk-99"}
            return {"error": True, "message": "boom"}

        monkeypatch.setattr(
            "intervals_mcp_server.services.library.make_intervals_request", fake_request
        )
        result = await create_custom_workout_svc(
            "My Workout", "Ride", self.STEPS, schedule_date="2026-07-01"
        )
        assert result["workout_id"] == "wk-99"
        assert result["scheduled"] is False
        assert result["event_id"] is None
        assert result["schedule_error"] is not None
        assert "boom" in result["schedule_error"]
