import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services.errors import ServiceError


# --- pmc_series ---

@pytest.mark.asyncio
async def test_pmc_series_shapes_tsb(monkeypatch):
    rows = [
        {"date": "2026-06-25", "ctl": 55.2, "atl": 48.1, "rampRate": 1.2},
        {"date": "2026-06-24", "ctl": 54.8, "atl": 49.0},
    ]

    async def fake_series(oldest=None, newest=None, athlete_id=None):
        return rows

    monkeypatch.setattr("intervals_mcp_server.services.analytics.wellness_series", fake_series)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.pmc_series(days=90)
    assert result[0]["date"] == "2026-06-24"  # sorted ascending
    assert result[1]["tsb"] == pytest.approx(7.1)
    assert result[1]["rampRate"] == 1.2
    assert "rampRate" not in result[0]


@pytest.mark.asyncio
async def test_pmc_series_missing_ctl_atl(monkeypatch):
    async def fake_series(oldest=None, newest=None, athlete_id=None):
        return [{"date": "2026-06-25", "ctl": None, "atl": None}]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.wellness_series", fake_series)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.pmc_series()
    assert result[0]["tsb"] is None


@pytest.mark.asyncio
async def test_pmc_series_propagates_error(monkeypatch):
    async def fake_series(oldest=None, newest=None, athlete_id=None):
        raise ServiceError(502, "boom")

    monkeypatch.setattr("intervals_mcp_server.services.analytics.wellness_series", fake_series)
    from intervals_mcp_server.services import analytics as svc
    with pytest.raises(ServiceError):
        await svc.pmc_series()


# --- power_profile ---

@pytest.mark.asyncio
async def test_power_profile_array_form(monkeypatch):
    # Flat array: index == seconds. Build a curve long enough for 3600s.
    curve = [None] * 3601
    curve[5] = 900
    curve[60] = 500
    curve[300] = 350
    curve[1200] = 300
    curve[3600] = 250

    async def fake_request(url, **kwargs):
        return curve

    monkeypatch.setattr("intervals_mcp_server.services.analytics.make_intervals_request", fake_request)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.power_profile()
    secs = [d["secs"] for d in result["durations"]]
    assert secs == [5, 60, 300, 1200, 3600]
    assert result["durations"][0]["watts"] == 900


@pytest.mark.asyncio
async def test_power_profile_dict_form(monkeypatch):
    async def fake_request(url, **kwargs):
        return [
            {"secs": 5, "value": 880, "date": "2026-06-01"},
            {"secs": 300, "watts": 340},
        ]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.make_intervals_request", fake_request)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.power_profile()
    secs = [d["secs"] for d in result["durations"]]
    assert secs == [5, 300]
    assert result["durations"][0]["date"] == "2026-06-01"


@pytest.mark.asyncio
async def test_power_profile_athlete_curve_object_form(monkeypatch):
    # Real /athlete/{id}/power-curves shape: {"list": [{secs, watts, activity_id}], "activities": {...}}
    async def fake_request(url, **kwargs):
        return {
            "list": [
                {
                    "secs": [1, 5, 60, 300, 1200, 3600],
                    "watts": [1300, 1278, 638, 358, 276, 230],
                    "activity_id": ["iA", "iA", "iB", "iC", "iC", "iD"],
                }
            ],
            "activities": {
                "iB": {"start_date_local": "2026-06-10T08:00:00"},
            },
        }

    monkeypatch.setattr("intervals_mcp_server.services.analytics.make_intervals_request", fake_request)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.power_profile()
    secs = [d["secs"] for d in result["durations"]]
    assert secs == [5, 60, 300, 1200, 3600]
    p5 = result["durations"][0]
    assert p5["watts"] == 1278
    p60 = result["durations"][1]
    assert p60["date"] == "2026-06-10"  # resolved via activities map
    p5 = result["durations"][0]
    assert p5["date"] is None  # id "iA" not in activities map


@pytest.mark.asyncio
async def test_power_profile_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "bad", "status_code": 502}

    monkeypatch.setattr("intervals_mcp_server.services.analytics.make_intervals_request", fake_request)
    from intervals_mcp_server.services import analytics as svc
    with pytest.raises(ServiceError):
        await svc.power_profile()


# --- zone_distribution ---

@pytest.mark.asyncio
async def test_zone_distribution_power(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [
            {"icu_zone_times": [600, 1200, 300, 0, 0]},
            {"icu_zone_times": [600, 600, 0, 0, 0]},
        ]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.zone_distribution(weeks=4)
    z1 = next(z for z in result["zones"] if z["zone"] == "Z1")
    assert z1["seconds"] == 1200
    assert sum(z["pct"] for z in result["zones"]) == pytest.approx(100, abs=0.2)
    assert result["target"] == []


@pytest.mark.asyncio
async def test_zone_distribution_falls_back_to_hr(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [{"icu_hr_zone_times": [300, 600, 100]}]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.zone_distribution()
    assert len(result["zones"]) == 3


@pytest.mark.asyncio
async def test_zone_distribution_no_data(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [{"name": "Ride"}]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.zone_distribution()
    assert result["zones"] == []


# --- volume_scatter ---

@pytest.mark.asyncio
async def test_volume_scatter(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [
            {"start_date_local": "2026-06-20T08:00:00", "icu_training_load": 80, "moving_time": 3600, "type": "Ride"},
            {"startTime": "2026-06-19T08:00:00", "trainingLoad": 40, "elapsed_time": 1800, "type": "Run"},
        ]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.volume_scatter(days=180)
    assert result[0] == {"date": "2026-06-20", "tss": 80, "duration_secs": 3600, "type": "Ride"}
    assert result[1]["tss"] == 40
    assert result[1]["duration_secs"] == 1800


@pytest.mark.asyncio
async def test_volume_scatter_error(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        raise ServiceError(404, "missing")

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    with pytest.raises(ServiceError):
        await svc.volume_scatter()


# --- weekly_volume ---

@pytest.mark.asyncio
async def test_weekly_volume_buckets_by_week(monkeypatch):
    async def fake_list(oldest, newest, limit, include_unnamed=False, athlete_id=None):
        return [
            {"start_date_local": "2026-06-22T08:00:00", "moving_time": 3600, "icu_training_load": 80},  # Mon
            {"start_date_local": "2026-06-24T08:00:00", "moving_time": 1800, "icu_training_load": 40},  # Wed same wk
            {"start_date_local": "2026-06-15T08:00:00", "moving_time": 7200, "icu_training_load": 120},  # prev wk
        ]

    monkeypatch.setattr("intervals_mcp_server.services.analytics.list_activities", fake_list)
    from intervals_mcp_server.services import analytics as svc
    result = await svc.weekly_volume(weeks=12)
    assert [r["week_start"] for r in result] == ["2026-06-15", "2026-06-22"]
    wk2 = result[1]
    assert wk2["sessions"] == 2
    assert wk2["hours"] == pytest.approx(1.5)
    assert wk2["tss"] == 120
