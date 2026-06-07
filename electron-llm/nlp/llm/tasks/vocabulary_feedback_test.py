from __future__ import annotations

from nlp.llm.llm_types import ChatResponse
from nlp.llm.tasks.paragraph_feedback import _ReasoningLeakCollector
from nlp.llm.tasks.vocabulary_feedback import run_vocabulary_feedback


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

    def json_schema_chat_response(self, **kwargs):
        self.calls.append(kwargs)
        response = self.responses.pop(0)
        if isinstance(response, Exception):
            raise response
        return response


def test_run_vocabulary_feedback_returns_items() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"items":[{"simple_vocabulary":"good","text_context":"a good plan","precise_vocabulary":"effective"}]}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            ),
        ]
    )

    result = run_vocabulary_feedback(
        llm_service=service,
        app_cfg=_DummyAppConfig(),
        paragraph_text="A paragraph.",
    )

    assert result == {
        "items": [
            {
                "simple_vocabulary": "good",
                "text_context": "a good plan",
                "precise_vocabulary": "effective",
            }
        ]
    }


def test_run_vocabulary_feedback_collects_reasoning_content() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"items":[]}',
                reasoning_content="Hidden reasoning",
                finish_reason="stop",
                model="m",
                usage=None,
            ),
        ]
    )
    collector = _ReasoningLeakCollector()

    run_vocabulary_feedback(
        llm_service=service,
        app_cfg=_DummyAppConfig(),
        paragraph_text="A paragraph.",
        reasoning_collector=collector,
    )

    assert collector.combined() == "Hidden reasoning"
