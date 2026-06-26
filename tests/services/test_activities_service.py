import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_ACTIVITY = {
    "id": "abc123",
    "name": "Morning Ride",
    "startDateLocal": "2024-01-15T07:00:00",
    "distance": 50000,
    "movingTime": 3600,
    "type": "Ride",
}

SAMPLE_INTERVALS = {
    "icu_intervals": [{"id": 1, "name": "Warmup"}],
    "icu_groups": [{"id": 1, "name": "Main Set"}],
}

SAMPLE_STREAMS = [
    {"type": "time", "data": [0, 1, 2, 3]},
    {"type": "watts", "data": [200, 210, 220, 215]},
]


# --- list_activities ---

@pytest.mark.asyncio
async def test_list_activities_returns_list(monkeypatch):
    async def fake_request(url, **kwargs):
        return [SAMPLE_ACTIVITY]

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.list_activities(oldest="2024-01-01", newest="2024-01-31", limit=10)
    assert isinstance(result, list)
    assert len(result) == 1
    assert result[0]["name"] == "Morning Ride"


@pytest.mark.asyncio
async def test_list_activities_filters_unnamed_by_default(monkeypatch):
    activities = [
        {"id": "1", "name": "Morning Ride", "type": "Ride"},
        {"id": "2", "name": "Unnamed", "type": "Ride"},
        {"id": "3", "name": "", "type": "Ride"},
    ]

    async def fake_request(url, **kwargs):
        return activities

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.list_activities(oldest="2024-01-01", newest="2024-01-31", limit=10)
    assert len(result) == 1
    assert result[0]["name"] == "Morning Ride"


@pytest.mark.asyncio
async def test_list_activities_include_unnamed(monkeypatch):
    activities = [
        {"id": "1", "name": "Morning Ride", "type": "Ride"},
        {"id": "2", "name": "Unnamed", "type": "Ride"},
    ]

    async def fake_request(url, **kwargs):
        return activities

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.list_activities(
        oldest="2024-01-01", newest="2024-01-31", limit=10, include_unnamed=True
    )
    assert len(result) == 2


@pytest.mark.asyncio
async def test_list_activities_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "upstream error", "status_code": 502}

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.list_activities(oldest="2024-01-01", newest="2024-01-31", limit=10)
    assert exc_info.value.status_code == 502
    assert "upstream error" in exc_info.value.message


@pytest.mark.asyncio
async def test_list_activities_error_defaults_502(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "bad gateway"}

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.list_activities(oldest="2024-01-01", newest="2024-01-31", limit=10)
    assert exc_info.value.status_code == 502


# --- get_activity ---

@pytest.mark.asyncio
async def test_get_activity_returns_dict(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_ACTIVITY

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.get_activity("abc123")
    assert isinstance(result, dict)
    assert result["id"] == "abc123"


@pytest.mark.asyncio
async def test_get_activity_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.get_activity("missing")
    assert exc_info.value.status_code == 404


# --- get_intervals ---

@pytest.mark.asyncio
async def test_get_intervals_returns_dict(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_INTERVALS

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.get_intervals("abc123")
    assert isinstance(result, dict)
    assert "icu_intervals" in result


@pytest.mark.asyncio
async def test_get_intervals_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "server error", "status_code": 500}

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.get_intervals("abc123")
    assert exc_info.value.status_code == 500


# --- get_streams ---

@pytest.mark.asyncio
async def test_get_streams_returns_list(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_STREAMS

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    result = await svc.get_streams("abc123", types="time,watts")
    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["type"] == "time"


@pytest.mark.asyncio
async def test_get_streams_default_types(monkeypatch):
    captured_params = {}

    async def fake_request(url, **kwargs):
        captured_params.update(kwargs.get("params", {}))
        return SAMPLE_STREAMS

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    await svc.get_streams("abc123", types=None)
    assert "types" in captured_params
    assert "time" in captured_params["types"]


@pytest.mark.asyncio
async def test_get_streams_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "forbidden", "status_code": 403}

    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import activities as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.get_streams("abc123")
    assert exc_info.value.status_code == 403
