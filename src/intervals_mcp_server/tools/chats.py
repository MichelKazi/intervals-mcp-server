"""
Chat/messaging MCP tools for Intervals.icu.

This module contains tools for managing athlete chats and messages.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_chat(chat: dict[str, Any]) -> str:
    """Format chat data into a readable string."""
    lines = []
    lines.append(f"Chat ID: {chat.get('id', 'N/A')}")
    if chat.get("name"):
        lines.append(f"Name: {chat['name']}")
    if chat.get("participants"):
        parts = [p.get("name", "?") for p in chat["participants"] if isinstance(p, dict)]
        lines.append(f"Participants: {', '.join(parts)}")
    if chat.get("lastMessage"):
        lines.append(f"Last Message: {chat['lastMessage']}")
    if chat.get("updated"):
        lines.append(f"Updated: {chat['updated']}")
    return "\n".join(lines)


def _format_message(msg: dict[str, Any]) -> str:
    """Format a chat message into a readable string."""
    lines = []
    lines.append(f"From: {msg.get('name', msg.get('athleteId', 'Unknown'))}")
    if msg.get("created"):
        lines.append(f"Date: {msg['created']}")
    lines.append(f"Content: {msg.get('content', '')}")
    return "\n".join(lines)


@mcp.tool()
async def get_chats(
    athlete_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Get all chats for an athlete from Intervals.icu.

    Args:
        athlete_id: The Intervals.icu athlete ID (optional, will use ATHLETE_ID from .env if not provided)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
    if error_msg:
        return error_msg

    result = await make_intervals_request(
        url=f"/athlete/{athlete_id_to_use}/chats", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching chats: {result.get('message')}"

    if not result:
        return f"No chats found for athlete {athlete_id_to_use}."

    if isinstance(result, list):
        output = "Chats:\n\n"
        for chat in result:
            if isinstance(chat, dict):
                output += _format_chat(chat) + "\n\n"
        return output

    return f"Chats:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def get_chat(
    chat_id: str,
    api_key: str | None = None,
) -> str:
    """Get a specific chat by ID from Intervals.icu.

    Args:
        chat_id: The chat ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/chats/{chat_id}", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching chat: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return f"No chat found with ID {chat_id}."

    return f"Chat Details:\n\n{_format_chat(result)}"


@mcp.tool()
async def get_chat_messages(
    chat_id: str,
    api_key: str | None = None,
) -> str:
    """Get messages in a specific chat from Intervals.icu.

    Args:
        chat_id: The chat ID
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    result = await make_intervals_request(
        url=f"/chats/{chat_id}/messages", api_key=api_key
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error fetching chat messages: {result.get('message')}"

    if not result:
        return f"No messages found in chat {chat_id}."

    if isinstance(result, list):
        output = f"Messages in chat {chat_id}:\n\n"
        for msg in result:
            if isinstance(msg, dict):
                output += _format_message(msg) + "\n\n"
        return output

    return f"Messages in chat {chat_id}:\n\n{json.dumps(result, indent=2)}"


@mcp.tool()
async def send_chat_message(
    content: str,
    athlete_id: str | None = None,
    chat_id: str | None = None,
    api_key: str | None = None,
) -> str:
    """Send a message in a chat on Intervals.icu.

    Args:
        content: The message text to send
        athlete_id: Recipient athlete ID (used if no chat_id, to start a new conversation)
        chat_id: Existing chat ID to send to (optional)
        api_key: The Intervals.icu API key (optional, will use API_KEY from .env if not provided)
    """
    data: dict[str, Any] = {"content": content}
    if chat_id:
        data["chatId"] = chat_id
    if athlete_id:
        data["athleteId"] = athlete_id

    result = await make_intervals_request(
        url="/chats/send-message",
        api_key=api_key,
        method="POST",
        data=data,
    )

    if isinstance(result, dict) and "error" in result:
        return f"Error sending message: {result.get('message')}"

    if not result or not isinstance(result, dict):
        return "Message sent."

    return f"Message sent (ID: {result.get('id', 'unknown')})."
