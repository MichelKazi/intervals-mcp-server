"""Client for server-to-server calls to the second-brain MCP server.

Handles vault reads/writes via the Streamable HTTP transport at the
second-brain MCP endpoint. Falls back gracefully if the server is unreachable.
"""

import json
import logging
from typing import Any

import httpx

from intervals_mcp_server.config import get_config

logger = logging.getLogger("intervals_icu_mcp_server")

_request_id = 0


def _next_id() -> int:
    global _request_id
    _request_id += 1
    return _request_id


async def _mcp_call(method: str, params: dict[str, Any]) -> dict[str, Any] | None:
    """Make a JSON-RPC call to the second-brain MCP server.

    Returns the result field on success, None on failure.
    """
    config = get_config()
    if not config.second_brain_mcp_url:
        logger.debug("second-brain MCP URL not configured — skipping vault call")
        return None

    payload = {
        "jsonrpc": "2.0",
        "id": _next_id(),
        "method": "tools/call",
        "params": {
            "name": method,
            "arguments": params,
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                config.second_brain_mcp_url,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
                timeout=15.0,
            )
            resp.raise_for_status()
            body = resp.json()

            if "error" in body:
                logger.warning("MCP error from second-brain: %s", body["error"])
                return None

            result = body.get("result", {})
            if isinstance(result, dict) and result.get("content"):
                for block in result["content"]:
                    if block.get("type") == "text":
                        try:
                            return json.loads(block["text"])
                        except (json.JSONDecodeError, TypeError):
                            return {"text": block["text"]}
            return result

    except httpx.HTTPStatusError as e:
        logger.warning("second-brain MCP HTTP error: %s", e.response.status_code)
        return None
    except (httpx.RequestError, httpx.TimeoutException) as e:
        logger.warning("second-brain MCP unreachable: %s", e)
        return None


async def vault_write_with_links(
    path: str,
    content: str,
    links: list[str] | None = None,
) -> bool:
    """Write a note to the vault with optional wikilink graph edges.

    Returns True on success, False on failure.
    """
    params: dict[str, Any] = {"path": path, "content": content}
    if links:
        params["links"] = links

    result = await _mcp_call("vault_write_with_links", params)
    return result is not None


async def vault_read(path: str) -> str | None:
    """Read a note from the vault. Returns content string or None."""
    result = await _mcp_call("vault_read", {"path": path})
    if result is None:
        return None
    if isinstance(result, dict):
        return result.get("text") or result.get("content") or json.dumps(result)
    return str(result)


async def vault_update(path: str, content: str) -> bool:
    """Update an existing vault note. Returns True on success."""
    result = await _mcp_call("vault_update", {"path": path, "content": content})
    return result is not None
