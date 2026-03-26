from __future__ import annotations

from typing import TYPE_CHECKING, Generator

from nlp.llm.llm_types import ChatRequest, ChatStreamEvent

if TYPE_CHECKING:
    from app.settings import AppConfig
    from services.llm_service import LlmService


SYSTEM_PROMPT_PREFIX = (
    "You are a helpful teacher's assistant. You are an expert in analyzing second language writing and will answer the "
    "teacher's questions about the following essay:"
)
SYSTEM_PROMPT_SUFFIX = "You should focus your answers only on the essay and politely refuse to answer anything else."


def build_system_prompt(essay: str) -> str:
    return f"{SYSTEM_PROMPT_PREFIX}\n\n{essay}\n\n{SYSTEM_PROMPT_SUFFIX}"


def _build_chat_request(system_prompt: str, user_text: str, app_cfg: "AppConfig") -> ChatRequest:
    _, _, llm_request = app_cfg.require_real_config()
    return ChatRequest(
        system=system_prompt,
        user=user_text,
        max_tokens=llm_request.max_tokens,
        temperature=llm_request.temperature,
        top_p=llm_request.top_p,
        top_k=llm_request.top_k,
        repeat_penalty=llm_request.repeat_penalty,
        seed=llm_request.seed,
        stop=llm_request.stop,
        response_format=llm_request.response_format,
    )


def run_stream(
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    *,
    system_prompt: str,
    user_text: str,
) -> Generator[ChatStreamEvent, None, str]:
    request = _build_chat_request(system_prompt=system_prompt, user_text=user_text, app_cfg=app_cfg)
    events: list[ChatStreamEvent] = []

    for event in llm_service.chat_stream(
        system=request.system,
        user=request.user,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        top_p=request.top_p,
        top_k=request.top_k,
        repeat_penalty=request.repeat_penalty,
        seed=request.seed,
        stop=request.stop,
        response_format=request.response_format,
    ):
        events.append(event)
        yield event

    response = llm_service.client.aggregate_stream_events(events)
    reply = response.content.strip() if isinstance(response.content, str) else ""
    if not reply:
        raise RuntimeError("LLM request failed: stream did not return textual content.")
    return reply
