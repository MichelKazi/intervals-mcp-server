"""
MCP parity bridge: HTTP routes that invoke any registered MCP tool by name.

This gives the web UI full parity with the MCP server without duplicating
tool implementations. All tools registered via @mcp.tool() are accessible.

Routes:
    GET  /api/mcp/tools          → list of {name, description}
    POST /api/mcp/{tool_name}    → {result: "<string>"} or error
"""

# Importing server registers all @mcp.tool() decorators. The __main__ guard
# in server.py means this import does NOT start the stdio server.
import intervals_mcp_server.server  # noqa: F401

from fastapi import APIRouter, Depends, Request

from intervals_mcp_server.mcp_instance import mcp
from intervals_mcp_server.services.errors import ServiceError
from intervals_mcp_server.web.auth import require_token

router = APIRouter(prefix="/api/mcp", dependencies=[Depends(require_token)])


def _extract_text(result: object) -> str:
    """Extract a plain string from the various shapes FastMCP call_tool returns.

    FastMCP call_tool returns one of:
    - A plain str
    - A list of content objects each with a .text attribute (e.g. TextContent)
    - A tuple whose first element is such a list (the second is a structured dict)
    Falls back to str(result) for anything unexpected.
    """
    if isinstance(result, str):
        return result

    # Tuple: (list_of_content, structured_dict)
    if isinstance(result, tuple) and len(result) >= 1:
        first = result[0]
        if isinstance(first, list):
            result = first  # fall through to list handling below
        elif isinstance(first, str):
            return first

    if isinstance(result, list):
        if not result:
            return ""
        # List of content objects with .text
        if hasattr(result[0], "text"):
            return "\n".join(item.text for item in result if hasattr(item, "text"))
        # List of plain strings
        if isinstance(result[0], str):
            return "\n".join(result)

    return str(result)


@router.get("/tools")
async def list_tools():
    """Return all registered MCP tools with name and description."""
    tools = await mcp.list_tools()
    return [{"name": t.name, "description": t.description or ""} for t in tools]


@router.post("/{tool_name}")
async def call_tool(tool_name: str, request: Request):
    """Invoke a registered MCP tool by name with arbitrary JSON arguments.

    Body: arbitrary JSON object of tool arguments (can be empty {}).
    Returns: {"result": "<string output of the tool>"}
    Unknown tool name → 404. Tool errors → 500 (or 400 for validation errors).
    """
    # Verify tool exists before calling
    tools = await mcp.list_tools()
    known = {t.name for t in tools}
    if tool_name not in known:
        raise ServiceError(404, f"Unknown tool: {tool_name}")

    body = await request.json() if request.headers.get("content-type", "").startswith(
        "application/json"
    ) else {}
    if not isinstance(body, dict):
        body = {}

    try:
        result = await mcp.call_tool(tool_name, body)
    except Exception as exc:
        msg = str(exc)
        # Pydantic validation errors are client mistakes
        if "validation" in msg.lower() or "field required" in msg.lower():
            raise ServiceError(400, msg) from exc
        raise ServiceError(500, msg) from exc

    return {"result": _extract_text(result)}
