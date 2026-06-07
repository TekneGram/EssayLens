from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING, Any

from nlp.llm.tasks.paragraph_feedback import (
    _ReasoningLeakCollector,
    _append_debug_log,
    _build_prefix_context,
    _emit_status,
    _load_prompt as _load_paragraph_prompt,
    _run_json_schema_chat,
)

if TYPE_CHECKING:
    from app.settings import AppConfig
    from services.llm_service import LlmService
    from nlp.llm.tasks.paragraph_feedback import StatusCallback


PROMPT_DIR = Path(__file__).resolve().parents[3] / "prompts" / "vocabulary_feedback"


def _load_prompt(filename: str) -> str:
    return (PROMPT_DIR / filename).read_text(encoding="utf-8").strip()


def run_vocabulary_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    paragraph_text: str,
    on_status: "StatusCallback | None" = None,
    reasoning_collector: _ReasoningLeakCollector | None = None,
) -> dict[str, Any]:
    paragraph = paragraph_text.strip()
    if not paragraph:
        raise ValueError("paragraph_text must be non-empty")
    _append_debug_log(
        "[vocabulary_feedback] start",
        {
            "paragraph_length": len(paragraph),
        },
    )

    system_prompt = _load_paragraph_prompt("paragraph_knowledge.md")
    prefix_context = _build_prefix_context(paragraph)

    _emit_status(on_status, "Finding simple vocabulary")
    result = _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system_prompt,
        user=f"{prefix_context}\n\n{_load_prompt('vocabulary_simple.md')}",
        name="vocabulary_feedback",
        reasoning_collector=reasoning_collector,
        schema={
            "type": "object",
            "properties": {
                "items": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "simple_vocabulary": {"type": "string", "maxLength": 160},
                            "text_context": {"type": "string", "maxLength": 360},
                            "precise_vocabulary": {"type": "string", "maxLength": 220},
                        },
                        "required": [
                            "simple_vocabulary",
                            "text_context",
                            "precise_vocabulary",
                        ],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["items"],
            "additionalProperties": False,
        },
    )

    raw_items = result.get("items")
    if not isinstance(raw_items, list):
        raise RuntimeError("Vocabulary feedback task returned a non-array items field.")

    items: list[dict[str, str]] = []
    for item in raw_items:
        if not isinstance(item, dict):
            raise RuntimeError("Vocabulary feedback task returned a non-object item.")
        simple_vocabulary = str(item.get("simple_vocabulary", "")).strip()
        text_context = str(item.get("text_context", "")).strip()
        precise_vocabulary = str(item.get("precise_vocabulary", "")).strip()
        if not simple_vocabulary or not text_context or not precise_vocabulary:
            continue
        items.append(
            {
                "simple_vocabulary": simple_vocabulary,
                "text_context": text_context,
                "precise_vocabulary": precise_vocabulary,
            }
        )

    _append_debug_log(
        "[vocabulary_feedback] end",
        {
            "items_count": len(items),
            "items_preview": items[:3],
        },
    )
    return {"items": items}
