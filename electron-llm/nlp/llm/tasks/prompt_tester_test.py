from __future__ import annotations

from dataclasses import dataclass

from config.llm_request_config import LlmRequestConfig
from nlp.llm.llm_types import ChatResponse, ChatStreamEvent
from nlp.llm.tasks.prompt_tester import SYSTEM_PROMPT, build_stream_tester, run_stream_prompt_tester


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

    def chat_stream(self, **_: object):
        yield ChatStreamEvent(channel="content", text="Hello ", done=False)
        yield ChatStreamEvent(channel="content", text="world", done=False)


@dataclass
class _FakeAppCfg:
    llm_request: LlmRequestConfig

    @property
    def llm_server(self):
        return type("ServerCfg", (), {"llm_n_parallel": 1})()

    def require_real_config(self):
        return (object(), object(), self.llm_request)


def _app_cfg_with_temperature(temp: float) -> _FakeAppCfg:
    return _FakeAppCfg(
        llm_request=LlmRequestConfig.from_values(
            max_tokens=123,
            temperature=temp,
            top_p=0.9,
            top_k=50,
            repeat_penalty=1.1,
            seed=42,
            stop=None,
            response_format=None,
            stream=True,
        )
    )


def test_build_stream_tester_builds_expected_chat_request() -> None:
    app_cfg = _app_cfg_with_temperature(0.37)
    request = build_stream_tester("Essay text", app_cfg)
    assert request.system == SYSTEM_PROMPT
    assert request.user == "Essay text"
    assert request.temperature == 0.37
    assert request.max_tokens == 123
    assert request.top_p == 0.9
    assert request.top_k == 50
    assert request.repeat_penalty == 1.1
    assert request.seed == 42


def test_run_stream_prompt_tester_streams_and_aggregates_reply() -> None:
    service = _FakeLlmService(client=_FakeClient())
    app_cfg = _app_cfg_with_temperature(0.37)
    stream = run_stream_prompt_tester(service, app_cfg, "Essay text")

    chunks = []
    while True:
        try:
            chunks.append(next(stream))
        except StopIteration as stop:
            final_reply = stop.value
            break

    assert [chunk.text for chunk in chunks] == ["Hello ", "world"]
    assert final_reply == "Hello world"
