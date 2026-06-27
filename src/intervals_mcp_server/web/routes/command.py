"""
Natural-language command bar routes.

POST /api/command       — interpret free text; reads execute immediately, writes
                          return a preview (needs_confirm) WITHOUT executing.
POST /api/command/execute — execute a confirmed action list (stateless: the client
                          re-sends the actions returned by /api/command).

Auth is enforced via the require_token dependency on the router.
"""

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from intervals_mcp_server.services.command import execute_actions, interpret_command
from intervals_mcp_server.web.auth import require_token

router = APIRouter(prefix="/api/command", dependencies=[Depends(require_token)])


class CommandBody(BaseModel):
    text: str
    today_date: str | None = None


class ExecuteBody(BaseModel):
    actions: list[dict[str, Any]]


@router.post("")
async def command(body: CommandBody):
    """Interpret a command. Reads run now; writes return a confirm preview."""
    proposal = await interpret_command(body.text, today_date=body.today_date)
    actions = proposal["actions"]

    if not actions:
        return {"summary": proposal["intent_summary"], "results": [], "actions": [], "executed": False}

    if proposal["needs_confirm"]:
        return {
            "summary": proposal["intent_summary"],
            "proposed_actions": actions,
            "actions": actions,
            "executed": False,
            "needs_confirm": True,
        }

    result = await execute_actions(actions)
    # For executed reads, the result summaries carry the readable content; the raw
    # tool-signature intent_summary would just be noise as a header.
    summary = " ".join(r["summary"] for r in result["results"]) or proposal["intent_summary"]
    return {"summary": summary, "results": result["results"], "executed": True}


@router.post("/execute")
async def command_execute(body: ExecuteBody):
    """Execute a confirmed action list (writes)."""
    result = await execute_actions(body.actions)
    return {"results": result["results"], "executed": True}
