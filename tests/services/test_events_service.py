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
        assert "/events/ev1" in url  # intervals.icu single-event GET is plural /events/{id}
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_event("ev1")
    assert isinstance(result, dict)
    assert result["id"] == "ev1"


@pytest.mark.asyncio
async def test_get_event_uses_plural_events_url(monkeypatch):
    captured_url = {}

    async def fake_request(url, **kwargs):
        captured_url["url"] = url
        return SAMPLE_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.get_event("ev42")
    # intervals.icu returns 404 for /event/{id} (singular); the working path is plural.
    assert "/athlete/i1/events/ev42" in captured_url["url"]


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

    # GET used the plural /events/ URL (intervals.icu 404s on singular /event/)
    assert "/athlete/i1/events/ev1" in calls[0]["url"]

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


# --- pair_activity ---

@pytest.mark.asyncio
async def test_pair_activity_preserves_fields_and_sets_id(monkeypatch):
    """PUT must set paired_activity_id while preserving all original fields."""
    calls = []

    async def fake_request(url, **kwargs):
        calls.append({"url": url, "method": kwargs.get("method", "GET"), "data": kwargs.get("data")})
        if kwargs.get("method", "GET") == "GET":
            return REALISTIC_EVENT
        return kwargs.get("data")

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.pair_activity("ev1", 987654)

    put_call = next(c for c in calls if c["method"] == "PUT")
    assert "/athlete/i1/events/ev1" in put_call["url"]
    put_data = put_call["data"]
    assert put_data["paired_activity_id"] == 987654
    # original fields preserved
    assert put_data["name"] == "Kaweah"
    assert put_data["workout_doc"] == REALISTIC_EVENT["workout_doc"]
    assert put_data["icu_training_load"] == 75
    assert result["paired_activity_id"] == 987654


@pytest.mark.asyncio
async def test_pair_activity_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "forbidden", "status_code": 403}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.pair_activity("ev1", 123)
    assert exc_info.value.status_code == 403


# --- unpair_activity ---

@pytest.mark.asyncio
async def test_unpair_activity_sets_null(monkeypatch):
    calls = []

    async def fake_request(url, **kwargs):
        calls.append({"method": kwargs.get("method", "GET"), "data": kwargs.get("data")})
        if kwargs.get("method", "GET") == "GET":
            return {**REALISTIC_EVENT, "paired_activity_id": 555}
        return kwargs.get("data")

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.unpair_activity("ev1")

    put_call = next(c for c in calls if c["method"] == "PUT")
    assert put_call["data"]["paired_activity_id"] is None
    assert put_call["data"]["name"] == "Kaweah"
    assert result["paired_activity_id"] is None


@pytest.mark.asyncio
async def test_unpair_activity_error_raises_service_error(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.unpair_activity("ev99")
    assert exc_info.value.status_code == 404


# --- get_compliance ---

def _patch_compliance(monkeypatch, event, activity=None, activity_raises=None):
    """Patch get_event (via make_intervals_request) and get_activity."""

    async def fake_request(url, **kwargs):
        return event

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    async def fake_get_activity(activity_id):
        if activity_raises is not None:
            raise activity_raises
        return activity

    monkeypatch.setattr(
        "intervals_mcp_server.services.activities.get_activity", fake_get_activity
    )


@pytest.mark.asyncio
async def test_compliance_on_target(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": 100, "moving_time": 3600}
    activity = {"icu_training_load": 100, "moving_time": 3600, "icu_intensity": 85}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["paired"] is True
    assert result["actual"]["load"] == 100
    assert result["compliance"]["load_pct"] == 100
    assert result["compliance"]["duration_pct"] == 100
    assert result["compliance"]["verdict"] == "on_target"


@pytest.mark.asyncio
async def test_compliance_under(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": 100, "moving_time": 3600}
    activity = {"icu_training_load": 80, "moving_time": 3000, "icu_intensity": 70}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["compliance"]["load_pct"] == 80
    assert result["compliance"]["verdict"] == "under"


@pytest.mark.asyncio
async def test_compliance_over(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": 100, "moving_time": 3600}
    activity = {"icu_training_load": 130, "moving_time": 4000, "icu_intensity": 95}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["compliance"]["load_pct"] == 130
    assert result["compliance"]["verdict"] == "over"


@pytest.mark.asyncio
async def test_compliance_unknown_when_not_paired(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": None, "icu_training_load": 100, "moving_time": 3600}
    _patch_compliance(monkeypatch, event, activity=None)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["paired"] is False
    assert result["actual"] is None
    assert result["compliance"]["load_pct"] is None
    assert result["compliance"]["verdict"] == "unknown"


@pytest.mark.asyncio
async def test_compliance_planned_load_none_no_crash(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": None, "moving_time": 3600}
    activity = {"icu_training_load": 90, "moving_time": 3600, "icu_intensity": 80}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["compliance"]["load_pct"] is None
    assert result["compliance"]["verdict"] == "unknown"
    # duration still computable
    assert result["compliance"]["duration_pct"] == 100


@pytest.mark.asyncio
async def test_compliance_planned_load_zero_no_crash(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": 0, "moving_time": 3600}
    activity = {"icu_training_load": 90, "moving_time": 3600, "icu_intensity": 80}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["compliance"]["load_pct"] is None
    assert result["compliance"]["verdict"] == "unknown"


@pytest.mark.asyncio
async def test_compliance_uses_load_target_fallback(monkeypatch):
    event = {"id": "ev1", "paired_activity_id": "i9", "load_target": 100, "moving_time": 3600}
    activity = {"icu_training_load": 100, "moving_time": 3600, "icu_intensity": 85}
    _patch_compliance(monkeypatch, event, activity)

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["planned"]["load"] == 100
    assert result["compliance"]["load_pct"] == 100
    assert result["compliance"]["verdict"] == "on_target"


@pytest.mark.asyncio
async def test_compliance_activity_fetch_fails_returns_unknown(monkeypatch):
    """A Strava-restricted / inaccessible paired activity must not 500."""
    event = {"id": "ev1", "paired_activity_id": "i9", "icu_training_load": 100, "moving_time": 3600}
    _patch_compliance(
        monkeypatch, event, activity_raises=ServiceError(status_code=403, message="Forbidden")
    )

    from intervals_mcp_server.services import events as svc
    result = await svc.get_compliance("ev1")
    assert result["paired"] is True
    assert result["actual"] is None
    assert result["compliance"]["load_pct"] is None
    assert result["compliance"]["verdict"] == "unknown"


@pytest.mark.asyncio
async def test_compliance_event_fetch_error_raises(monkeypatch):
    async def fake_request(url, **kwargs):
        return {"error": True, "message": "not found", "status_code": 404}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.get_compliance("missing")
    assert exc_info.value.status_code == 404


# --- create_time_off ---

SAMPLE_HOLIDAY_EVENT = {
    "id": "to1",
    "category": "HOLIDAY",
    "name": "Time off",
    "start_date_local": "2026-08-15T00:00:00",
}


@pytest.mark.asyncio
async def test_create_time_off_default_kind(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["method"] = kwargs.get("method")
        captured["data"] = kwargs.get("data")
        return SAMPLE_HOLIDAY_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.create_time_off(start_date="2026-08-15")
    assert captured["method"] == "POST"
    assert captured["data"]["category"] == "HOLIDAY"
    assert captured["data"]["name"] == "Time off"
    assert captured["data"]["start_date_local"] == "2026-08-15T00:00:00"
    assert result["id"] == "to1"


@pytest.mark.asyncio
async def test_create_time_off_sick_with_note(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["data"] = kwargs.get("data")
        return {"id": "to2", "category": "SICK", "name": "Under the weather"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.create_time_off(start_date="2026-08-10", kind="SICK", note="Under the weather")
    assert captured["data"]["category"] == "SICK"
    assert captured["data"]["name"] == "Under the weather"


@pytest.mark.asyncio
async def test_create_time_off_multi_day(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["data"] = kwargs.get("data")
        return SAMPLE_HOLIDAY_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.create_time_off(start_date="2026-08-15", end_date="2026-08-20", kind="HOLIDAY")
    assert captured["data"]["start_date_local"] == "2026-08-15T00:00:00"
    assert captured["data"]["end_date_local"] == "2026-08-20T00:00:00"


@pytest.mark.asyncio
async def test_create_time_off_invalid_kind_raises():
    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.create_time_off(start_date="2026-08-15", kind="WORKOUT")
    assert exc_info.value.status_code == 400
    assert "HOLIDAY" in exc_info.value.message


@pytest.mark.asyncio
async def test_create_time_off_kind_case_insensitive(monkeypatch):
    captured = {}

    async def fake_request(url, **kwargs):
        captured["data"] = kwargs.get("data")
        return {"id": "to3", "category": "INJURED"}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    await svc.create_time_off(start_date="2026-08-15", kind="injured")
    assert captured["data"]["category"] == "INJURED"


# --- list_time_off ---

SAMPLE_EVENTS_MIXED = [
    {"id": "ev1", "category": "WORKOUT", "name": "Ride"},
    {"id": "to1", "category": "HOLIDAY", "name": "Time off"},
    {"id": "to2", "category": "SICK", "name": "Sick"},
    {"id": "to3", "category": "INJURED", "name": "Injured"},
    {"id": "ev2", "category": "NOTE", "name": "A note"},
]


@pytest.mark.asyncio
async def test_list_time_off_filters_categories(monkeypatch):
    async def fake_request(url, **kwargs):
        return SAMPLE_EVENTS_MIXED

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.list_time_off()
    assert len(result) == 3
    assert all(e["category"] in {"HOLIDAY", "SICK", "INJURED"} for e in result)


@pytest.mark.asyncio
async def test_list_time_off_empty_when_none_found(monkeypatch):
    async def fake_request(url, **kwargs):
        return [{"id": "ev1", "category": "WORKOUT", "name": "Ride"}]

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.list_time_off()
    assert result == []


# --- auto_link_day ---

SAMPLE_WORKOUT_EVENT = {
    "id": "ev10",
    "category": "WORKOUT",
    "type": "Ride",
    "name": "Threshold Ride",
    "start_date_local": "2024-06-01T00:00:00",
    "paired_activity_id": None,
}

SAMPLE_ACCESSIBLE_ACTIVITY = {
    "id": "act10",
    "type": "Ride",
    "name": "Morning Ride",
    "source": "GARMIN",
}


@pytest.mark.asyncio
async def test_auto_link_day_pairs_compatible(monkeypatch):
    """A Ride activity pairs with a Ride workout event."""
    call_count = {"n": 0}

    async def fake_request(url, **kwargs):
        call_count["n"] += 1
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return [SAMPLE_WORKOUT_EVENT]
        if method == "GET" and "/activities" in url:
            return [SAMPLE_ACCESSIBLE_ACTIVITY]
        # GET for pair_activity's get_event call
        if method == "GET" or method is None:
            return SAMPLE_WORKOUT_EVENT
        # PUT for pair_activity
        if method == "PUT":
            return {**SAMPLE_WORKOUT_EVENT, "paired_activity_id": "act10"}
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_day("2024-06-01")
    assert result["date"] == "2024-06-01"
    assert len(result["linked"]) == 1
    assert result["linked"][0]["event_id"] == "ev10"
    assert result["linked"][0]["activity_id"] == "act10"
    assert result["unmatched_workouts"] == []


@pytest.mark.asyncio
async def test_auto_link_day_skips_already_paired(monkeypatch):
    paired_event = {**SAMPLE_WORKOUT_EVENT, "paired_activity_id": 999}

    async def fake_request(url, **kwargs):
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return [paired_event]
        if method == "GET" and "/activities" in url:
            return [SAMPLE_ACCESSIBLE_ACTIVITY]
        return SAMPLE_WORKOUT_EVENT

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_day("2024-06-01")
    assert result["linked"] == []
    assert result["unmatched_activities"] == [{"activity_id": "act10", "name": "Morning Ride"}]


@pytest.mark.asyncio
async def test_auto_link_day_no_sport_match(monkeypatch):
    run_activity = {**SAMPLE_ACCESSIBLE_ACTIVITY, "id": "act11", "type": "Run", "name": "Morning Run"}

    async def fake_request(url, **kwargs):
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return [SAMPLE_WORKOUT_EVENT]  # Ride workout
        if method == "GET" and "/activities" in url:
            return [run_activity]  # Run activity
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_day("2024-06-01")
    assert result["linked"] == []
    assert len(result["unmatched_workouts"]) == 1
    assert len(result["unmatched_activities"]) == 1


@pytest.mark.asyncio
async def test_auto_link_day_virtual_ride_matches_ride(monkeypatch):
    virtual_activity = {**SAMPLE_ACCESSIBLE_ACTIVITY, "id": "act12", "type": "VirtualRide"}

    async def fake_request(url, **kwargs):
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return [SAMPLE_WORKOUT_EVENT]
        if method == "GET" and "/activities" in url:
            return [virtual_activity]
        if method == "GET" or method is None:
            return SAMPLE_WORKOUT_EVENT
        if method == "PUT":
            return {**SAMPLE_WORKOUT_EVENT, "paired_activity_id": "act12"}
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_day("2024-06-01")
    assert len(result["linked"]) == 1
    assert result["linked"][0]["activity_id"] == "act12"


@pytest.mark.asyncio
async def test_auto_link_day_empty_day(monkeypatch):
    async def fake_request(url, **kwargs):
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return []
        if method == "GET" and "/activities" in url:
            return []
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_day("2024-06-01")
    assert result["linked"] == []
    assert result["unmatched_workouts"] == []
    assert result["unmatched_activities"] == []


# --- auto_link_range ---

@pytest.mark.asyncio
async def test_auto_link_range_cap_exceeded():
    from intervals_mcp_server.services import events as svc
    with pytest.raises(ServiceError) as exc_info:
        await svc.auto_link_range("2024-01-01", "2024-05-01")
    assert exc_info.value.status_code == 400
    assert "60" in exc_info.value.message


@pytest.mark.asyncio
async def test_auto_link_range_aggregates(monkeypatch):
    """Two days, each with one workout + one activity → 2 linked total."""

    async def fake_request(url, **kwargs):
        method = kwargs.get("method", "GET")
        if method == "GET" and "/events" in url and "/events/" not in url:
            return [SAMPLE_WORKOUT_EVENT]
        if method == "GET" and "/activities" in url:
            return [SAMPLE_ACCESSIBLE_ACTIVITY]
        if method == "GET" or method is None:
            return SAMPLE_WORKOUT_EVENT
        if method == "PUT":
            return {**SAMPLE_WORKOUT_EVENT, "paired_activity_id": "act10"}
        return {}

    monkeypatch.setattr("intervals_mcp_server.services.events.make_intervals_request", fake_request)
    monkeypatch.setattr("intervals_mcp_server.services.activities.make_intervals_request", fake_request)

    from intervals_mcp_server.services import events as svc
    result = await svc.auto_link_range("2024-06-01", "2024-06-02")
    assert result["oldest"] == "2024-06-01"
    assert result["newest"] == "2024-06-02"
    assert len(result["linked"]) == 2
