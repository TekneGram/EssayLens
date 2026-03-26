from __future__ import annotations

from dataclasses import dataclass

from config.llm_request_config import LlmRequestConfig
from nlp.llm.llm_types import ChatResponse, ChatStreamEvent
from nlp.llm.tasks.simple_chat import (
    SYSTEM_PROMPT_PREFIX,
    SYSTEM_PROMPT_SUFFIX,
    build_system_prompt,
    run_stream,
)


class _FakeClient:
    @staticmethod
    def aggregate_stream_events(events: list[ChatStreamEvent]) -> ChatResponse:
        content = "".join(event.text for event in events if event.channel == "content")
        return ChatResponse(
            content=content,
            reasoning_content=None,
            finish_reason="stop",
            model="fake-model",
            usage=None,
        )


@dataclass
class _FakeLlmService:
    client: _FakeClient
    seen_system_prompts: list[str]

    def chat_stream(self, *, system: str, **_: object):
        self.seen_system_prompts.append(system)
        yield ChatStreamEvent(channel="content", text="Hello ", done=False)
        yield ChatStreamEvent(channel="content", text="teacher", done=False)


@dataclass
class _FakeAppCfg:
    llm_request: LlmRequestConfig

    def require_real_config(self):
        return (object(), object(), self.llm_request)


def _app_cfg() -> _FakeAppCfg:
    return _FakeAppCfg(
        llm_request=LlmRequestConfig.from_values(
            max_tokens=128,
            temperature=0.1,
            top_p=0.9,
            top_k=40,
            repeat_penalty=1.0,
            seed=7,
            stop=None,
            response_format=None,
            stream=True,
        )
    )


def test_build_system_prompt_includes_required_guardrails() -> None:
    prompt = build_system_prompt("Essay body")
    assert SYSTEM_PROMPT_PREFIX in prompt
    assert "Essay body" in prompt
    assert SYSTEM_PROMPT_SUFFIX in prompt


def test_run_stream_uses_supplied_system_prompt() -> None:
    llm = _FakeLlmService(client=_FakeClient(), seen_system_prompts=[])
    app_cfg = _app_cfg()
    stream = run_stream(
        llm_service=llm,
        app_cfg=app_cfg,
        system_prompt="System with essay",
        user_text="Teacher question",
    )

    chunks = []
    while True:
        try:
            chunks.append(next(stream))
        except StopIteration as stop:
            final_reply = stop.value
            break

    assert [chunk.text for chunk in chunks] == ["Hello ", "teacher"]
    assert final_reply == "Hello teacher"
    assert llm.seen_system_prompts == ["System with essay"]
