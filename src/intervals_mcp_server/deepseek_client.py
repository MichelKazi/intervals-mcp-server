"""DeepSeek API client — OpenAI-compatible, async httpx, with tool/function-calling support.

Mirrors directeur/src/directeur/deepseek.py style. Used by the natural-language
command bar to route free-text commands to tool calls.
"""

import logging
from typing import Any

import httpx

from intervals_mcp_server.config import get_config

logger = logging.getLogger(__name__)

_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client  # noqa: PLW0603 - module-level singleton
    if _client is None:
        config = get_config()
        _client = httpx.AsyncClient(
            base_url=config.deepseek_base_url,
            headers={
                "Authorization": f"Bearer {config.deepseek_api_key}",
                "Content-Type": "application/json",
            },
            timeout=60.0,
        )
    return _client


async def chat_completion(
    messages: list[dict[str, Any]],
    *,
    model: str | None = None,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: str | dict[str, Any] | None = None,
    temperature: float = 0.0,
) -> dict[str, Any]:
    """Call DeepSeek chat completions. Returns the parsed response JSON.

    Args:
        messages: OpenAI-format message list.
        model: Override model (defaults to configured deepseek_model).
        tools: OpenAI tools schema (function specs) for function-calling.
        tool_choice: "auto", "none", "required", or a forced tool dict.
        temperature: Sampling temperature.
    """
    config = get_config()
    if not config.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY not configured")

    payload: dict[str, Any] = {
        "model": model or config.deepseek_model,
        "messages": messages,
        "temperature": temperature,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = tool_choice or "auto"

    resp = await _get_client().post("/chat/completions", json=payload)
    resp.raise_for_status()
    return resp.json()


async def close() -> None:
    global _client  # noqa: PLW0603 - module-level singleton
    if _client:
        await _client.aclose()
        _client = None
