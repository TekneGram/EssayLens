from __future__ import annotations

from nlp.llm.tasks.essay_feedback import run_identify_paragraphs, run_thesis_statement_feedback
from nlp.llm.llm_types import ChatResponse


class _DummyRequestConfig:
    def __init__(self, max_tokens: int = 128) -> None:
        self.max_tokens = max_tokens
        self.temperature = 0.0
        self.top_p = None
        self.top_k = None
        self.repeat_penalty = None
        self.seed = None
        self.stop = None
        self.response_format = None


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


def test_run_identify_paragraphs_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"introduction_paragraph":"Intro.","body_paragraphs":{"items":[{"body_paragraph":"Body 1."},{"body_paragraph":"Body 2."}]},"conclusion_paragraph":"Conclusion."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_identify_paragraphs(
        llm_service=service,
        app_cfg=app_cfg,
        essay_text="Intro.\nBody 1.\nBody 2.\nConclusion.",
        on_status=statuses.append,
    )

    assert result == {
        "introduction_paragraph": "Intro.",
        "body_paragraphs": {"items": [{"body_paragraph": "Body 1."}, {"body_paragraph": "Body 2."}]},
        "conclusion_paragraph": "Conclusion.",
    }
    assert statuses == ["Identifying introduction, body paragraphs, and conclusion..."]
    assert service.calls[0]["system"]


def test_run_thesis_statement_feedback_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"thesis_statement":"Students should read more.","verdict":"Clear and focused thesis.","improvements":"Add one concrete reason to make the claim more specific."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_thesis_statement_feedback(
        llm_service=service,
        app_cfg=app_cfg,
        essay_text="Introduction.\nBody.\nConclusion.",
        introduction_text="Introduction.",
        on_status=statuses.append,
    )

    assert result == {
        "thesis_statement": "Students should read more.",
        "verdict": "Clear and focused thesis.",
        "improvements": "Add one concrete reason to make the claim more specific.",
    }
    assert statuses == ["Extracting and evaluating the thesis statement..."]
    assert service.calls[0]["system"]
