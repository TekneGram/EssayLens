from __future__ import annotations

from typing import Any, Callable

from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from app.runtime_lifecycle import RuntimeLifecycle
from nlp.llm.tasks.essay_feedback import run_conclusion_final_comment


def run_essay_feedback_conclusion_final_comment(
    payload: dict[str, Any],
    lifecycle: RuntimeLifecycle,
    on_status: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    essay = payload.get("essay")
    final_sentence = payload.get("finalSentence")
    if not isinstance(essay, str) or not essay.strip():
        raise WorkerActionError("payload.essay must be a non-empty string")
    if not isinstance(final_sentence, str) or not final_sentence.strip():
        raise WorkerActionError("payload.finalSentence must be a non-empty string")

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)

    try:
        return run_conclusion_final_comment(
            llm_service=llm_service,
            app_cfg=app_cfg,
            essay_text=essay,
            final_sentence_text=final_sentence,
            on_status=on_status,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc
