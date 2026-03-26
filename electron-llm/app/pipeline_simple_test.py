from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import pytest

from app.pipeline_simple import (
    _SESSION_SYSTEM_PROMPTS,
    WorkerActionError,
    clear_cached_session,
    run_chat_stream,
)
from nlp.llm.llm_types import ChatStreamEvent


@dataclass
class _FakeTaskService:
    calls: list[dict[str, str]]

    def simple_chat_stream(self, *, app_cfg: Any, system_prompt: str, user_text: str):
        self.calls.append({"system_prompt": system_prompt, "user_text": user_text})

        def _stream():
            yield ChatStreamEvent(channel="content", text="Reply", done=False)
            return "Reply"

        return _stream()


def _success_response(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {"requestId": request_id, "ok": True, "data": data}


def test_clear_cached_session_returns_cleared_flag() -> None:
    _SESSION_SYSTEM_PROMPTS.clear()
    _SESSION_SYSTEM_PROMPTS["sess-1"] = "cached"

    cleared = clear_cached_session({"sessionId": "sess-1"})
    assert cleared == {"sessionId": "sess-1", "cleared": True}
    assert "sess-1" not in _SESSION_SYSTEM_PROMPTS

    not_cleared = clear_cached_session({"sessionId": "sess-1"})
    assert not_cleared == {"sessionId": "sess-1", "cleared": False}


def test_run_chat_stream_requires_essay_on_first_message() -> None:
    _SESSION_SYSTEM_PROMPTS.clear()

    with pytest.raises(WorkerActionError, match="missing essay context"):
        run_chat_stream(
            payload={"sessionId": "sess-1", "message": "hello", "settings": {"use_fake_reply": False}},
            request_id="req-1",
            lifecycle=object(),  # not reached before the error
            emit_stream_event=lambda _event_type, _data: None,
            success_response_factory=_success_response,
        )


def test_run_chat_stream_reuses_cached_essay_prompt(monkeypatch: pytest.MonkeyPatch) -> None:
    _SESSION_SYSTEM_PROMPTS.clear()
    fake_task_service = _FakeTaskService(calls=[])

    def _fake_build_runtime(_payload: dict[str, Any], _lifecycle: Any):
        return object(), fake_task_service

    monkeypatch.setattr("app.pipeline_simple._build_runtime", _fake_build_runtime)

    stream_events: list[tuple[str, dict[str, Any]]] = []
    emitter: Callable[[str, dict[str, Any]], None] = lambda event_type, data: stream_events.append((event_type, data))

    first = run_chat_stream(
        payload={
            "sessionId": "sess-1",
            "essay": "Student essay text.",
            "message": "How is cohesion?",
            "settings": {"use_fake_reply": False},
        },
        request_id="req-1",
        lifecycle=object(),
        emit_stream_event=emitter,
        success_response_factory=_success_response,
    )
    second = run_chat_stream(
        payload={
            "sessionId": "sess-1",
            "message": "What about grammar?",
            "settings": {"use_fake_reply": False},
        },
        request_id="req-2",
        lifecycle=object(),
        emit_stream_event=emitter,
        success_response_factory=_success_response,
    )

    assert first == {"requestId": "req-1", "ok": True, "data": {"reply": "Reply"}}
    assert second == {"requestId": "req-2", "ok": True, "data": {"reply": "Reply"}}
    assert len(fake_task_service.calls) == 2
    assert "Student essay text." in fake_task_service.calls[0]["system_prompt"]
    assert fake_task_service.calls[0]["system_prompt"] == fake_task_service.calls[1]["system_prompt"]
