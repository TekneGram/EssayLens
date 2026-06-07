from __future__ import annotations

from pathlib import Path

import pytest

from nlp.llm.tasks.paragraph_feedback import (
    _ReasoningLeakCollector,
    _run_json_schema_chat,
    _sanitize_field_value,
    run_paragraph_feedback_bundle,
)
from nlp.llm.llm_types import ChatResponse


PROMPT_DIR = Path(__file__).resolve().parents[3] / "prompts" / "paragraph_feedback"


class _DummyRequestConfig:
    def __init__(self, max_tokens: int = 128) -> None:
        self.max_tokens = max_tokens
        self.temperature = 0.0
        self.top_p = None
        self.top_k = None
        self.repeat_penalty = None
        self.seed = None
        self.stop = None


class _DummyAppConfig:
    def __init__(self, max_tokens: int = 128) -> None:
        self._request_cfg = _DummyRequestConfig(max_tokens=max_tokens)

    def require_real_config(self):
        return (None, None, self._request_cfg)


class _FakeLlmService:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def json_schema_chat(self, **kwargs):
        raise AssertionError("json_schema_chat should not be called directly in paragraph feedback tests.")

    def json_schema_chat_response(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response

    def chat(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def test_run_json_schema_chat_retries_on_truncation_then_succeeds() -> None:
    service = _FakeLlmService(
        responses=[
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=210): ..."),
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=190): ..."),
            ChatResponse(
                content='{"verdict":"perfect","reason":"ok","revision_suggestion":"ok"}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            ),
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)

    result = _run_json_schema_chat(
        llm_service=service,
        app_cfg=app_cfg,
        system="sys",
        user="user prompt",
        name="topic_sentence_judgement",
        schema={"type": "object"},
    )

    assert result["verdict"] == "perfect"
    assert len(service.calls) == 3
    assert service.calls[0]["max_tokens"] == 128
    assert service.calls[1]["max_tokens"] > 128
    assert service.calls[2]["max_tokens"] >= service.calls[1]["max_tokens"]
    assert "Output only a single valid JSON object" in service.calls[1]["user"]
    assert service.calls[0]["temperature"] == 0.0
    assert service.calls[0]["top_p"] == 1.0
    assert service.calls[0]["top_k"] is None
    assert service.calls[0]["repeat_penalty"] is None


def test_reasoning_leak_collector_deduplicates_and_strips() -> None:
    collector = _ReasoningLeakCollector()

    collector.add("  hidden chain  ")
    collector.add("hidden chain")
    collector.add("")
    collector.add(None)

    assert collector.detected() is True
    assert collector.combined() == "hidden chain"


def test_run_json_schema_chat_fails_after_all_attempts() -> None:
    service = _FakeLlmService(
        responses=[
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=210): ..."),
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=190): ..."),
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=175): ..."),
            RuntimeError("Malformed JSON schema response (finish_reason='length', content_len=160): ..."),
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)

    with pytest.raises(RuntimeError, match="failed after 4 attempts"):
        _run_json_schema_chat(
            llm_service=service,
            app_cfg=app_cfg,
            system="sys",
            user="user prompt",
            name="topic_sentence_judgement",
            schema={"type": "object"},
        )


def test_run_json_schema_chat_fails_fast_on_non_truncation_error() -> None:
    service = _FakeLlmService(
        responses=[RuntimeError("LLM Server connection failed: connection refused")]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)

    with pytest.raises(RuntimeError, match="attempt 1/4"):
        _run_json_schema_chat(
            llm_service=service,
            app_cfg=app_cfg,
            system="sys",
            user="user prompt",
            name="topic_sentence_judgement",
            schema={"type": "object"},
        )
    assert len(service.calls) == 1


def test_run_json_schema_chat_collects_reasoning_content() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"verdict":"perfect","reason":"ok","revision_suggestion":"ok"}',
                reasoning_content="Hidden reasoning",
                finish_reason="stop",
                model="m",
                usage=None,
            ),
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    collector = _ReasoningLeakCollector()

    _run_json_schema_chat(
        llm_service=service,
        app_cfg=app_cfg,
        system="sys",
        user="user prompt",
        name="topic_sentence_judgement",
        schema={"type": "object"},
        reasoning_collector=collector,
    )

    assert collector.combined() == "Hidden reasoning"


def test_sanitize_field_value_uses_doubled_schema_limit() -> None:
    value = "x" * 700

    result = _sanitize_field_value(
        field="reason",
        value=value,
        field_schema={"type": "string", "maxLength": 560},
    )

    assert len(result) == 560
    assert result == "x" * 560


def test_all_paragraph_feedback_prompts_include_be_concise() -> None:
    prompt_files = sorted(PROMPT_DIR.glob("*.md"))

    assert prompt_files
    for prompt_file in prompt_files:
        assert "be concise" in prompt_file.read_text(encoding="utf-8").lower()


def test_run_paragraph_feedback_bundle_reports_reasoning_leak_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(content="Topic sentence.", reasoning_content="Thought 1", finish_reason="stop", model="m", usage=None),
            ChatResponse(content="Controlling idea.", reasoning_content=None, finish_reason="stop", model="m", usage=None),
            ChatResponse(content='{"verdict":"perfect","reason":"ok","revision_suggestion":"ok"}', reasoning_content="Thought 2", finish_reason="stop", model="m", usage=None),
            ChatResponse(content='{"verdict":"strong","reason":"Coherence reason."}', reasoning_content=None, finish_reason="stop", model="m", usage=None),
            ChatResponse(content='{"praise_1":"Praise 1","praise_2":"Praise 2"}', reasoning_content=None, finish_reason="stop", model="m", usage=None),
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_paragraph_feedback_bundle(
        llm_service=service,
        app_cfg=app_cfg,
        paragraph_text="A paragraph.",
        on_status=statuses.append,
    )

    assert result["reasoning_leak"]["warning"].startswith("Reasoning output was detected unexpectedly")
    assert result["reasoning_leak"]["reasoning_content"] == "Thought 1\n\nThought 2"
    assert any("entered thinking mode" in status for status in statuses)
