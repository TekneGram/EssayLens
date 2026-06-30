from __future__ import annotations

from nlp.llm.tasks.essay_feedback import (
    run_conclusion_final_comment,
    run_identify_paragraphs,
    run_paragraph_evaluation,
    run_summary_feedback,
    run_summarize_main_idea,
    run_thesis_restatement_feedback,
    run_thesis_statement_feedback,
)
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
                content='{"thesis_statement":"Students should read more.","verdict":"reasonable","comments":"Add one concrete reason to make the claim more specific."}',
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
        "verdict": "reasonable",
        "comments": "Add one concrete reason to make the claim more specific.",
    }
    assert statuses == ["Extracting and evaluating the thesis statement..."]
    assert service.calls[0]["system"]


def test_run_summarize_main_idea_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"main_idea":"Students benefit from reading because it builds knowledge and imagination."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_summarize_main_idea(
        llm_service=service,
        app_cfg=app_cfg,
        essay_text="Introduction.\nBody.\nConclusion.",
        on_status=statuses.append,
    )

    assert result == {
        "main_idea": "Students benefit from reading because it builds knowledge and imagination.",
    }
    assert statuses == ["Summarizing the essay's main idea..."]
    assert service.calls[0]["system"]


def test_run_paragraph_evaluation_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"verdict":"contributes to the main idea well","comments":"The paragraph stays focused on the essay\\'s central claim and supports it with relevant detail."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_paragraph_evaluation(
        llm_service=service,
        app_cfg=app_cfg,
        introduction_text="Introduction.",
        body_paragraph_text="Reading builds vocabulary. It also expands knowledge.",
        main_idea_text="Reading helps students grow.",
        on_status=statuses.append,
    )

    assert result == {
        "verdict": "contributes to the main idea well",
        "comments": "The paragraph stays focused on the essay's central claim and supports it with relevant detail.",
    }
    assert statuses == ["Evaluating how the body paragraph supports the main idea..."]
    assert service.calls[0]["system"]


def test_run_thesis_restatement_feedback_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"verdict":"strong paraphrase","comments":"The conclusion restates the thesis clearly without copying it exactly."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_thesis_restatement_feedback(
        llm_service=service,
        app_cfg=app_cfg,
        thesis_statement_text="Students should read more books.",
        conclusion_first_sentence_text="Reading more books helps students learn and imagine more.",
        on_status=statuses.append,
    )

    assert result == {
        "verdict": "strong paraphrase",
        "comments": "The conclusion restates the thesis clearly without copying it exactly.",
    }
    assert statuses == ["Evaluating how well the conclusion restates the thesis..."]
    assert service.calls[0]["system"] == "You are a paraphrase judge."


def test_run_summary_feedback_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"verdict":"summarizes key points effectively","comments":"The conclusion revisits the essay\\'s main points clearly."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_summary_feedback(
        llm_service=service,
        app_cfg=app_cfg,
        essay_text="Introduction.\nBody.\nConclusion.",
        on_status=statuses.append,
    )

    assert result == {
        "verdict": "summarizes key points effectively",
        "comments": "The conclusion revisits the essay's main points clearly.",
    }
    assert statuses == ["Evaluating how effectively the conclusion summarizes the essay..."]
    assert service.calls[0]["system"] == "Here is an essay: \nIntroduction.\nBody.\nConclusion."


def test_run_conclusion_final_comment_returns_expected_structure_and_status() -> None:
    service = _FakeLlmService(
        responses=[
            ChatResponse(
                content='{"verdict":"gives a confident suggestion","comments":"The final sentence ends with a clear and confident takeaway."}',
                reasoning_content=None,
                finish_reason="stop",
                model="m",
                usage=None,
            )
        ]
    )
    app_cfg = _DummyAppConfig(max_tokens=128)
    statuses: list[str] = []

    result = run_conclusion_final_comment(
        llm_service=service,
        app_cfg=app_cfg,
        essay_text="Introduction.\nBody.\nConclusion.",
        final_sentence_text="Students should keep reading every day.",
        on_status=statuses.append,
    )

    assert result == {
        "verdict": "gives a confident suggestion",
        "comments": "The final sentence ends with a clear and confident takeaway.",
    }
    assert statuses == ["Evaluating the final sentence of the conclusion..."]
    assert service.calls[0]["system"] == "Here is an essay: \nIntroduction.\nBody.\nConclusion."
