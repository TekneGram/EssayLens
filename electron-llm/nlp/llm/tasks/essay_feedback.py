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
