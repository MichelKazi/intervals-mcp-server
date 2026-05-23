"""
Chat/messaging MCP tool for Intervals.icu.
"""

import json
from typing import Any

from intervals_mcp_server.api.client import make_intervals_request
from intervals_mcp_server.config import get_config
from intervals_mcp_server.mcp_instance import mcp  # noqa: F401
from intervals_mcp_server.utils.validation import resolve_athlete_id

config = get_config()


def _format_chat(chat: dict[str, Any]) -> str:
    lines = [f"Chat ID: {chat.get('id', 'N/A')}"]
    if chat.get("name"):
        lines.append(f"Name: {chat['name']}")
    if chat.get("participants"):
        parts = [p.get("name", "?") for p in chat["participants"] if isinstance(p, dict)]
        lines.append(f"Participants: {', '.join(parts)}")
    if chat.get("lastMessage"):
        lines.append(f"Last Message: {chat['lastMessage']}")
    return "\n".join(lines)


def _format_message(msg: dict[str, Any]) -> str:
    lines = [f"From: {msg.get('name', msg.get('athleteId', 'Unknown'))}"]
    if msg.get("created"):
        lines.append(f"Date: {msg['created']}")
    lines.append(f"Content: {msg.get('content', '')}")
    return "\n".join(lines)


@mcp.tool()
async def manage_chats(
    action: str,
    athlete_id: str | None = None,
    api_key: str | None = None,
    chat_id: str | None = None,
    content: str | None = None,
) -> str:
    """Manage chats and messages on Intervals.icu.

    Args:
        action: One of: list, get, messages, send
        athlete_id: The Intervals.icu athlete ID (optional, also used as recipient for new conversations)
        api_key: The Intervals.icu API key (optional)
        chat_id: Required for get, messages, send (to existing chat)
        content: Message text for send action
    """
    action = action.lower().strip()

    if action == "list":
        athlete_id_to_use, error_msg = resolve_athlete_id(athlete_id, config.athlete_id)
        if error_msg:
            return error_msg
        result = await make_intervals_request(
            url=f"/athlete/{athlete_id_to_use}/chats", api_key=api_key
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return "No chats found."
        if isinstance(result, list):
            return "Chats:\n\n" + "\n\n".join(_format_chat(c) for c in result if isinstance(c, dict))
        return json.dumps(result, indent=2)

    elif action == "get":
        if not chat_id:
            return "Error: 'chat_id' required for get"
        result = await make_intervals_request(url=f"/chats/{chat_id}", api_key=api_key)
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if isinstance(result, dict):
            return f"Chat Details:\n\n{_format_chat(result)}"
        return "Not found."

    elif action == "messages":
        if not chat_id:
            return "Error: 'chat_id' required for messages"
        result = await make_intervals_request(url=f"/chats/{chat_id}/messages", api_key=api_key)
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        if not result:
            return f"No messages in chat {chat_id}."
        if isinstance(result, list):
            return f"Messages in chat {chat_id}:\n\n" + "\n\n".join(_format_message(m) for m in result if isinstance(m, dict))
        return json.dumps(result, indent=2)

    elif action == "send":
        if not content:
            return "Error: 'content' required for send"
        send_data: dict[str, Any] = {"content": content}
        if chat_id:
            send_data["chatId"] = chat_id
        if athlete_id:
            send_data["athleteId"] = athlete_id
        result = await make_intervals_request(
            url="/chats/send-message", api_key=api_key, method="POST", data=send_data
        )
        if isinstance(result, dict) and "error" in result:
            return f"Error: {result.get('message')}"
        return f"Message sent (ID: {result.get('id', 'unknown')})." if isinstance(result, dict) else "Message sent."

    return f"Invalid action '{action}'. Must be one of: list, get, messages, send"
