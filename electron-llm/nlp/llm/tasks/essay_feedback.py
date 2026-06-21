from __future__ import annotations

from pathlib import Path
from typing import Any, Callable, TYPE_CHECKING

from nlp.llm.tasks.paragraph_feedback import _run_json_schema_chat

if TYPE_CHECKING:
    from app.settings import AppConfig
    from services.llm_service import LlmService


PROMPT_DIR = Path(__file__).resolve().parents[3] / "prompts" / "essay_feedback"
StatusCallback = Callable[[str], None]


def _load_prompt(filename: str) -> str:
    return (PROMPT_DIR / filename).read_text(encoding="utf-8").strip()


def _identify_paragraphs_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "introduction_paragraph": {"type": "string"},
            "body_paragraphs": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "body_paragraph": {"type": "string"},
                            },
                            "required": ["body_paragraph"],
                            "additionalProperties": False,
                        },
                    }
                },
                "required": ["items"],
                "additionalProperties": False,
            },
            "conclusion_paragraph": {"type": "string"},
        },
        "required": ["introduction_paragraph", "body_paragraphs", "conclusion_paragraph"],
        "additionalProperties": False,
    }


def _sanitize_identified_paragraphs(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    introduction = obj.get("introduction_paragraph")
    conclusion = obj.get("conclusion_paragraph")
    body = obj.get("body_paragraphs")

    if not isinstance(introduction, str) or not introduction.strip():
        raise RuntimeError("Identify-paragraphs response missing introduction_paragraph.")
    if not isinstance(conclusion, str) or not conclusion.strip():
        raise RuntimeError("Identify-paragraphs response missing conclusion_paragraph.")
    if not isinstance(body, dict):
        raise RuntimeError("Identify-paragraphs response missing body_paragraphs object.")

    raw_items = body.get("items")
    if not isinstance(raw_items, list):
        raise RuntimeError("Identify-paragraphs response missing body_paragraphs.items array.")

    items: list[dict[str, str]] = []
    for raw_item in raw_items:
        if not isinstance(raw_item, dict):
            continue
        paragraph = raw_item.get("body_paragraph")
        if not isinstance(paragraph, str):
            continue
        normalized = paragraph.strip()
        if normalized:
            items.append({"body_paragraph": normalized})

    if not items:
        raise RuntimeError("Identify-paragraphs response did not include any body paragraphs.")

    return {
        "introduction_paragraph": introduction.strip(),
        "body_paragraphs": {"items": items},
        "conclusion_paragraph": conclusion.strip(),
    }


def run_identify_paragraphs(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    essay_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_essay = essay_text.strip()
    if not normalized_essay:
        raise RuntimeError("Essay text is required for identify_paragraphs.")

    knowledge = _load_prompt("essay_knowledge.md")
    task = _load_prompt("identify_paragraphs.md")
    user_prompt = "\n Here is an essay:" + normalized_essay + "\n" + task

    if on_status is not None:
        on_status("Identifying introduction, body paragraphs, and conclusion...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=knowledge,
        user=user_prompt,
        name="identify_paragraphs",
        schema=_identify_paragraphs_schema(),
        sanitizer=_sanitize_identified_paragraphs,
    )


def _thesis_statement_feedback_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "thesis_statement": {"type": "string"},
            "verdict": {"type": "string"},
            "improvements": {"type": "string"},
        },
        "required": ["thesis_statement", "verdict", "improvements"],
        "additionalProperties": False,
    }


def _sanitize_thesis_statement_feedback(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    thesis_statement = obj.get("thesis_statement")
    verdict = obj.get("verdict")
    improvements = obj.get("improvements")

    if not isinstance(thesis_statement, str) or not thesis_statement.strip():
        raise RuntimeError("Thesis-statement feedback response missing thesis_statement.")
    if not isinstance(verdict, str) or not verdict.strip():
        raise RuntimeError("Thesis-statement feedback response missing verdict.")
    if not isinstance(improvements, str) or not improvements.strip():
        raise RuntimeError("Thesis-statement feedback response missing improvements.")

    return {
        "thesis_statement": thesis_statement.strip(),
        "verdict": verdict.strip(),
        "improvements": improvements.strip(),
    }


def run_thesis_statement_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    essay_text: str,
    introduction_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_essay = essay_text.strip()
    normalized_introduction = introduction_text.strip()
    if not normalized_essay:
        raise RuntimeError("Essay text is required for thesis-statement feedback.")
    if not normalized_introduction:
        raise RuntimeError("Introduction text is required for thesis-statement feedback.")

    knowledge = _load_prompt("essay_knowledge.md")
    task = _load_prompt("introduction_thesis.md")
    user_prompt = (
        "\n Here is an essay: \n"
        + normalized_essay
        + "\n"
        + "The introduction is: \n"
        + normalized_introduction
        + "\n"
        + task
    )

    if on_status is not None:
        on_status("Extracting and evaluating the thesis statement...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=knowledge,
        user=user_prompt,
        name="thesis_statement_feedback",
        schema=_thesis_statement_feedback_schema(),
        sanitizer=_sanitize_thesis_statement_feedback,
    )


def _summarize_main_idea_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "main_idea": {"type": "string"},
        },
        "required": ["main_idea"],
        "additionalProperties": False,
    }


def _sanitize_summarize_main_idea(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    main_idea = obj.get("main_idea")
    if not isinstance(main_idea, str) or not main_idea.strip():
        raise RuntimeError("Summarize-main-idea response missing main_idea.")

    return {
        "main_idea": main_idea.strip(),
    }


def run_summarize_main_idea(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    essay_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_essay = essay_text.strip()
    if not normalized_essay:
        raise RuntimeError("Essay text is required for summarize-main-idea.")

    knowledge = _load_prompt("essay_knowledge.md")
    task = _load_prompt("essay_main_idea.md")
    user_prompt = "\n Here is an essay: \n" + normalized_essay + "\n" + task

    if on_status is not None:
        on_status("Summarizing the essay's main idea...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=knowledge,
        user=user_prompt,
        name="summarize_main_idea",
        schema=_summarize_main_idea_schema(),
        sanitizer=_sanitize_summarize_main_idea,
    )


def _paragraph_evaluation_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": [
                    "contributes to the main idea well",
                    "contributes to the main idea a little",
                    "seems a bit off the main idea",
                ],
            },
            "comments": {"type": "string"},
        },
        "required": ["verdict", "comments"],
        "additionalProperties": False,
    }


def _sanitize_paragraph_evaluation(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    verdict = obj.get("verdict")
    comments = obj.get("comments")

    if not isinstance(verdict, str) or not verdict.strip():
        raise RuntimeError("Paragraph-evaluation response missing verdict.")
    if not isinstance(comments, str) or not comments.strip():
        raise RuntimeError("Paragraph-evaluation response missing comments.")

    return {
        "verdict": verdict.strip(),
        "comments": comments.strip(),
    }


def run_paragraph_evaluation(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    introduction_text: str,
    body_paragraph_text: str,
    main_idea_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_introduction = introduction_text.strip()
    normalized_body_paragraph = body_paragraph_text.strip()
    normalized_main_idea = main_idea_text.strip()
    if not normalized_introduction:
        raise RuntimeError("Introduction text is required for paragraph-evaluation.")
    if not normalized_body_paragraph:
        raise RuntimeError("Body paragraph text is required for paragraph-evaluation.")
    if not normalized_main_idea:
        raise RuntimeError("Main idea text is required for paragraph-evaluation.")

    knowledge = _load_prompt("essay_knowledge.md")
    task = _load_prompt("body_judge_development.md")
    user_prompt = (
        "Here is an introduction to an essay:\n"
        + normalized_introduction
        + "\nHere is the main idea of the essay:"
        + normalized_main_idea
        + "\nHere is just one of the body paragraphs of the essay: \n"
        + normalized_body_paragraph
        + "\n"
        + task
    )

    if on_status is not None:
        on_status("Evaluating how the body paragraph supports the main idea...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=knowledge,
        user=user_prompt,
        name="paragraph_evaluation",
        schema=_paragraph_evaluation_schema(),
        sanitizer=_sanitize_paragraph_evaluation,
    )


def _conclusion_feedback_schema(verdicts: list[str]) -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "verdict": {
                "type": "string",
                "enum": verdicts,
            },
            "comments": {"type": "string"},
        },
        "required": ["verdict", "comments"],
        "additionalProperties": False,
    }


def _sanitize_conclusion_feedback(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    verdict = obj.get("verdict")
    comments = obj.get("comments")

    if not isinstance(verdict, str) or not verdict.strip():
        raise RuntimeError("Conclusion feedback response missing verdict.")
    if not isinstance(comments, str) or not comments.strip():
        raise RuntimeError("Conclusion feedback response missing comments.")

    return {
        "verdict": verdict.strip(),
        "comments": comments.strip(),
    }


def run_thesis_restatement_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    thesis_statement_text: str,
    conclusion_first_sentence_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_thesis_statement = thesis_statement_text.strip()
    normalized_conclusion_first_sentence = conclusion_first_sentence_text.strip()
    if not normalized_thesis_statement:
        raise RuntimeError("Thesis statement text is required for thesis-restatement-feedback.")
    if not normalized_conclusion_first_sentence:
        raise RuntimeError("Conclusion first sentence text is required for thesis-restatement-feedback.")

    system = "You are a paraphrase judge."
    task = _load_prompt("essay_conclusion_thesis_restatement.md")
    user_prompt = (
        "Here is a restated thesis statement from the conclusion of an essay:"
        + normalized_conclusion_first_sentence
        + "\nHere is the original thesis statement:"
        + normalized_thesis_statement
        + "\n"
        + task
    )

    if on_status is not None:
        on_status("Evaluating how well the conclusion restates the thesis...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system,
        user=user_prompt,
        name="thesis_restatement_feedback",
        schema=_conclusion_feedback_schema(
            [
                "strong paraphrase that includes other details from the essay",
                "strong paraphrase",
                "too similar, needs more paraphrasing",
                "unrelated to the original",
            ]
        ),
        sanitizer=_sanitize_conclusion_feedback,
    )


def run_summary_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    essay_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_essay = essay_text.strip()
    if not normalized_essay:
        raise RuntimeError("Essay text is required for summary-feedback.")

    system = "Here is an essay: \n" + normalized_essay
    user_prompt = _load_prompt("essay_conclusion_summary.md")

    if on_status is not None:
        on_status("Evaluating how effectively the conclusion summarizes the essay...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system,
        user=user_prompt,
        name="summary_feedback",
        schema=_conclusion_feedback_schema(
            [
                "summarizes key points effectively",
                "summary misses some points from the essay",
                "no clear summary present",
            ]
        ),
        sanitizer=_sanitize_conclusion_feedback,
    )


def run_conclusion_final_comment(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    essay_text: str,
    final_sentence_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    normalized_essay = essay_text.strip()
    normalized_final_sentence = final_sentence_text.strip()
    if not normalized_essay:
        raise RuntimeError("Essay text is required for conclusion-final-comment.")
    if not normalized_final_sentence:
        raise RuntimeError("Final sentence text is required for conclusion-final-comment.")

    system = "Here is an essay: \n" + normalized_essay
    task = _load_prompt("essay_conclusion_final_sentence.md")
    user_prompt = "Here is the final sentence of the whole essay in the conclusion:" + normalized_final_sentence + "\n" + task

    if on_status is not None:
        on_status("Evaluating the final sentence of the conclusion...")

    return _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system,
        user=user_prompt,
        name="conclusion_final_comment",
        schema=_conclusion_feedback_schema(
            [
                "hedges an idea",
                "is a call to action",
                "gives a confident suggestion",
                "ending could be better",
            ]
        ),
        sanitizer=_sanitize_conclusion_feedback,
    )
