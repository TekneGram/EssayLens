from __future__ import annotations
from typing import Any
from prompts.prompt_errors import PromptDevelopmentError
from nlp.llm.tasks.simple_chat import build_system_prompt

DEFAULT_CHAT_SESSION_KEY = "__default_simple_chat_session__"
_SESSION_SYSTEM_PROMPTS: dict[str, str] = {}

def extract_essay(payload: dict[str, Any]) -> str | None:
    essay = payload.get("essay")
    if isinstance(essay, str) and essay.strip():
        return essay.strip()
    return None

def extract_session_id(payload: dict[str, Any]) -> str:
    value = payload.get("sessionId")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return DEFAULT_CHAT_SESSION_KEY

def get_cached_system_prompt(payload: dict[str, Any]) -> str:
    session_id = extract_session_id(payload)
    cached_prompt = _SESSION_SYSTEM_PROMPTS.get(session_id)
    if isinstance(cached_prompt, str) and cached_prompt.strip():
        return cached_prompt

    essay = extract_essay(payload)
    if not essay:
        raise PromptDevelopmentError(
            "Simple chat session is missing essay context. Provide payload.essay for the first message in a session."
        )
    system_prompt = build_system_prompt(essay)
    _SESSION_SYSTEM_PROMPTS[session_id] = system_prompt
    return system_prompt

def clear_cached_session(payload: dict[str, Any]) -> dict[str, Any]:
    session_id = extract_session_id(payload)
    cleared = _SESSION_SYSTEM_PROMPTS.pop(session_id, None) is not None
    return {
        "sessionId": session_id,
        "cleared": cleared,
    }