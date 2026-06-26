"""
JSON routes for calendar/events data: list, get, create, update, delete, move, mark-done.

Each route is a thin delegation to the events service.
Auth is enforced via the require_token dependency on the router.
"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, ConfigDict

from intervals_mcp_server.services.events import (
    create_event,
    delete_event,
    get_compliance,
    get_event,
    list_events,
    mark_done,
    move_event,
    pair_activity,
    unpair_activity,
    update_event,
)
from intervals_mcp_server.web.auth import require_token

router = APIRouter(prefix="/api/events", dependencies=[Depends(require_token)])


class EventBody(BaseModel):
    """Permissive body for create/update — passes all fields through to the service."""

    model_config = ConfigDict(extra="allow")


class MoveBody(BaseModel):
    """Body for the move (reschedule) endpoint."""

    start_date: str


class PairBody(BaseModel):
    """Body for the pair endpoint."""

    activity_id: int | str


@router.get("")
async def events_list(
    oldest: str | None = Query(default=None),
    newest: str | None = Query(default=None),
    athlete_id: str | None = Query(default=None),
):
    """List events within a date range."""
    return await list_events(oldest=oldest, newest=newest, athlete_id=athlete_id)


@router.get("/{event_id}")
async def event_detail(event_id: str, athlete_id: str | None = Query(default=None)):
    """Get a single event by ID."""
    return await get_event(event_id, athlete_id=athlete_id)


@router.post("")
async def event_create(body: EventBody, athlete_id: str | None = Query(default=None)):
    """Create a new event."""
    return await create_event(body.model_dump(), athlete_id=athlete_id)


@router.put("/{event_id}")
async def event_update(
    event_id: str, body: EventBody, athlete_id: str | None = Query(default=None)
):
    """Update an existing event."""
    return await update_event(event_id, body.model_dump(), athlete_id=athlete_id)


@router.delete("/{event_id}")
async def event_delete(event_id: str, athlete_id: str | None = Query(default=None)):
    """Delete an event."""
    return await delete_event(event_id, athlete_id=athlete_id)


@router.post("/{event_id}/move")
async def event_move(
    event_id: str, body: MoveBody, athlete_id: str | None = Query(default=None)
):
    """Reschedule an event to a new date (drag-and-drop)."""
    return await move_event(event_id, body.start_date, athlete_id=athlete_id)


@router.post("/{event_id}/mark-done")
async def event_mark_done(event_id: str, athlete_id: str | None = Query(default=None)):
    """Mark an event as done."""
    return await mark_done(event_id, athlete_id=athlete_id)


@router.post("/{event_id}/pair")
async def event_pair(
    event_id: str, body: PairBody, athlete_id: str | None = Query(default=None)
):
    """Link a completed activity to a planned event."""
    return await pair_activity(event_id, body.activity_id, athlete_id=athlete_id)


@router.post("/{event_id}/unpair")
async def event_unpair(event_id: str, athlete_id: str | None = Query(default=None)):
    """Unlink the paired activity from an event."""
    return await unpair_activity(event_id, athlete_id=athlete_id)


@router.get("/{event_id}/compliance")
async def event_compliance(event_id: str, athlete_id: str | None = Query(default=None)):
    """Return planned-vs-actual compliance for an event."""
    return await get_compliance(event_id, athlete_id=athlete_id)
