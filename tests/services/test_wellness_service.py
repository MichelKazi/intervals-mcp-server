import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_WELLNESS = [
    {"date": "2026-06-25", "ctl": 55.2, "atl": 48.1, "tsb": 7.1},
    {"date": "2026-06-24", "ctl": 54.8, "atl": 49.0, "tsb": 5.8},
]


@pytest.mark.asyncio
async def test_wellness_series_happy(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_WELLNESS

    monkeypatch.setattr(
        "intervals_mcp_server.services.wellness.make_intervals_request", fake_request
    )
    from intervals_mcp_server.services import wellness as svc
    result = await svc.wellness_series(oldest="2026-06-01", newest="2026-06-26")
    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["date"] == "2026-06-25"


@pytest.mark.asyncio
async def test_wellness_series_uses_default_dates(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["params"] = kwargs.get("params", {})
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.services.wellness.make_intervals_request", fake_request
    )
    from intervals_mcp_server.services import wellness as svc
    await svc.wellness_series()
    assert "oldest" in captured["params"]
    assert "newest" in captured["params"]


@pytest.mark.asyncio
async def test_wellness_series_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "upstream error", "status_code": 502}

    monkeypatch.setattr(
        "intervals_mcp_server.services.wellness.make_intervals_request", fake_request
    )
    from intervals_mcp_server.services import wellness as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.wellness_series()
    assert exc_info.value.status_code == 502
    assert "upstream error" in exc_info.value.message


@pytest.mark.asyncio
async def test_wellness_series_error_defaults_502(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "bad gateway"}

    monkeypatch.setattr(
        "intervals_mcp_server.services.wellness.make_intervals_request", fake_request
    )
    from intervals_mcp_server.services import wellness as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.wellness_series()
    assert exc_info.value.status_code == 502


@pytest.mark.asyncio
async def test_wellness_series_empty_list(monkeypatch):
    async def fake_request(url, **kwargs):
        return []

    monkeypatch.setattr(
        "intervals_mcp_server.services.wellness.make_intervals_request", fake_request
    )
    from intervals_mcp_server.services import wellness as svc
    result = await svc.wellness_series()
    assert result == []
