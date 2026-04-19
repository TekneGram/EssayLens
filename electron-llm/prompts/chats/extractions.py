from __future__ import annotations
from typing import Any
from prompts.prompt_errors import PromptDevelopmentError


def extract_fake_reply(payload: dict[str, Any]) -> str | None:
    settings = payload.get("settings")
    if not isinstance(settings, dict):
        return None
    if settings.get("use_fake_reply") is not True:
        return None

    fake_reply = settings.get("fake_reply_text")
    if isinstance(fake_reply, str) and fake_reply.strip():
        return fake_reply.strip()
    return "LLM is not configured yet."

def extract_system_prompt(payload: dict[str, Any]) -> str | None:
    system_prompt = payload.get("systemPrompt")
    if isinstance(system_prompt, str) and system_prompt.strip():
        return system_prompt.strip()
    return None

def extract_message(payload: dict[str, Any]) -> str:
    message = payload.get("message")
    if not isinstance(message, str):
        message = payload.get("content")
    if not isinstance(message, str) or not message.strip():
        raise ValueError("payload.message must be a non-empty string")
    return message.strip()

def extract_context_text(payload: dict[str, Any]) -> str | None:
    context_text = payload.get("contextText")
    if isinstance(context_text, str) and context_text.strip():
        return context_text.strip()
    return None

def extract_session_turns(payload: dict[str, Any]) -> list[dict[str, str]]:
    raw_turns = payload.get("sessionTurns")
    if raw_turns is None:
        return []
    if not isinstance(raw_turns, list):
        raise PromptDevelopmentError("payload.sessionTurns must be an array when provided.")

    turns: list[dict[str, str]] = []
    for item in raw_turns:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in {"teacher", "assistant", "system"}:
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        turns.append({"role": role, "content": content.strip()})
    return turns

def extract_client_request_id(payload: dict[str, Any]) -> str | None:
    value = payload.get("clientRequestId")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None