import os
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / "src"))
os.environ.setdefault("API_KEY", "test")
os.environ.setdefault("ATHLETE_ID", "i1")

import pytest

from intervals_mcp_server.services.errors import ServiceError


SAMPLE_EVENT = {
    "id": "ev1",
    "name": "Morning Ride",
    "type": "Ride",
    "start_date_local": "2024-01-15T00:00:00",
    "category": "WORKOUT",
}

SAMPLE_EVENT_LIST = [SAMPLE_EVENT, {**SAMPLE_EVENT, "id": "ev2", "name": "Afternoon Run"}]


# --- list_events ---

@pytest.mark.asyncio
async def test_list_events_returns_list(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_EVENT_LIST

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.list_events(oldest="2024-01-01", newest="2024-01-31")
    assert isinstance(result, list)
    assert len(result) == 2
    assert result[0]["name"] == "Morning Ride"


@pytest.mark.asyncio
async def test_list_events_defaults_used_when_no_dates(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["params"] = kwargs.get("params", {})
        return []

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.list_events()
    assert "oldest" in captured["params"]
    assert "newest" in captured["params"]


@pytest.mark.asyncio
async def test_list_events_empty_response(monkeypatch):
    async def fake_request(url, **kwargs):
        return []

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.list_events()
    assert result == []


@pytest.mark.asyncio
async def test_list_events_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "upstream error", "status_code": 502}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.list_events()
    assert exc_info.value.status_code == 502
    assert "upstream error" in exc_info.value.message


@pytest.mark.asyncio
async def test_list_events_error_defaults_502(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "bad gateway"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.list_events()
    assert exc_info.value.status_code == 502


# --- get_event ---

@pytest.mark.asyncio
async def test_get_event_returns_dict(monkeypatch):
    async def fake_request(url, **kwargs):
        assert "/event/ev1" in url  # singular /event/, not /events/
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_event("ev1")
    assert isinstance(result, dict)
    assert result["id"] == "ev1"


@pytest.mark.asyncio
async def test_get_event_uses_singular_event_url(monkeypatch):
    captured_url = {}

    async def fake_request(url, **kwargs):
        captured_url["url"] = url
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.get_event("ev42")
    assert "/event/ev42" in captured_url["url"]
    assert "/events/ev42" not in captured_url["url"]


@pytest.mark.asyncio
async def test_get_event_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.get_event("missing")
    assert exc_info.value.status_code == 404


# --- create_event ---

@pytest.mark.asyncio
async def test_create_event_passthrough(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["method"] = kwargs.get("method")
        captured["data"] = kwargs.get("data")
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    payload = {"name": "Morning Ride", "type": "Ride", "start_date_local": "2024-01-15T00:00:00"}
    result = await svc.create_event(payload)
    assert captured["method"] == "POST"
    assert captured["data"]["name"] == "Morning Ride"
    assert isinstance(result, dict)


@pytest.mark.asyncio
async def test_create_event_builds_start_date_local_from_start_date(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["data"] = kwargs.get("data")
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    payload = {"name": "Ride", "type": "Ride", "start_date": "2024-03-01"}
    await svc.create_event(payload)
    assert captured["data"]["start_date_local"] == "2024-03-01T00:00:00"


@pytest.mark.asyncio
async def test_create_event_preserves_existing_start_date_local(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["data"] = kwargs.get("data")
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    payload = {
        "name": "Ride",
        "type": "Ride",
        "start_date": "2024-03-01",
        "start_date_local": "2024-03-01T09:00:00",
    }
    await svc.create_event(payload)
    assert captured["data"]["start_date_local"] == "2024-03-01T09:00:00"


@pytest.mark.asyncio
async def test_create_event_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "bad request", "status_code": 400}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.create_event({"name": "Ride", "type": "Ride", "start_date_local": "2024-01-01T00:00:00"})
    assert exc_info.value.status_code == 400


# --- update_event ---

@pytest.mark.asyncio
async def test_update_event_uses_put(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["method"] = kwargs.get("method")
        captured["url"] = url
        return {**SAMPLE_EVENT, "name": "Updated Ride"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.update_event("ev1", {"name": "Updated Ride"})
    assert captured["method"] == "PUT"
    assert "/events/ev1" in captured["url"]
    assert result["name"] == "Updated Ride"


@pytest.mark.asyncio
async def test_update_event_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "forbidden", "status_code": 403}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.update_event("ev1", {"name": "X"})
    assert exc_info.value.status_code == 403


# --- delete_event ---

@pytest.mark.asyncio
async def test_delete_event_returns_deleted_dict(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["method"] = kwargs.get("method")
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.delete_event("ev1")
    assert result == {"deleted": "ev1"}
    assert captured["method"] == "DELETE"


@pytest.mark.asyncio
async def test_delete_event_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.delete_event("ev99")
    assert exc_info.value.status_code == 404


# --- move_event ---

# A realistic event with workout fields that must survive the round-trip.
REALISTIC_EVENT = {
    "id": "ev1",
    "name": "Kaweah",
    "type": "Ride",
    "start_date_local": "2024-01-15T00:00:00",
    "category": "WORKOUT",
    "workout_doc": {"steps": [{"duration": 300, "power": {"value": 95, "units": "%ftp"}}]},
    "icu_training_load": 75,
    "icu_atl": 42.5,
}


@pytest.mark.asyncio
async def test_move_event_preserves_workout_fields(monkeypatch):
    """PUT payload must contain the new date AND preserve all original workout fields."""
    calls = []

    async def fake_request(url, **kwargs):
        calls.append({"url": url, "method": kwargs.get("method", "GET"), "data": kwargs.get("data")})
        if "method" not in kwargs or kwargs.get("method") == "GET":
            return REALISTIC_EVENT
        # Simulate the API echoing back the updated event
        return {**REALISTIC_EVENT, "start_date_local": "2024-02-10T00:00:00"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.move_event("ev1", "2024-02-10")

    # GET used the singular /event/ URL
    assert "/event/ev1" in calls[0]["url"]

    # PUT used the plural /events/ URL with the new date
    put_call = next(c for c in calls if c["method"] == "PUT")
    assert "/events/ev1" in put_call["url"]
    put_data = put_call["data"]
    assert put_data["start_date_local"] == "2024-02-10T00:00:00"

    # Workout fields from the fetched event must be preserved unchanged
    assert put_data["name"] == "Kaweah"
    assert put_data["type"] == "Ride"
    assert put_data["workout_doc"] == REALISTIC_EVENT["workout_doc"]

    assert result["start_date_local"] == "2024-02-10T00:00:00"


@pytest.mark.asyncio
async def test_move_event_error_on_get_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.move_event("ev99", "2024-02-10")
    assert exc_info.value.status_code == 404


# --- mark_done ---

@pytest.mark.asyncio
async def test_mark_done_posts_to_mark_done_url(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["url"] = url
        captured["method"] = kwargs.get("method")
        return {"id": "act123"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.mark_done("ev1")
    assert "/events/ev1/mark-done" in captured["url"]
    assert captured["method"] == "POST"
    assert result["id"] == "act123"


@pytest.mark.asyncio
async def test_mark_done_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "server error", "status_code": 500}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.mark_done("ev1")
    assert exc_info.value.status_code == 500
