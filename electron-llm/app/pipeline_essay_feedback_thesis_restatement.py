from __future__ import annotations

from typing import Any, Callable

from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from app.runtime_lifecycle import RuntimeLifecycle
from nlp.llm.tasks.essay_feedback import run_thesis_restatement_feedback


def run_essay_feedback_thesis_restatement(
    payload: dict[str, Any],
    lifecycle: RuntimeLifecycle,
    on_status: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    thesis_statement = payload.get("thesisStatement")
    conclusion_first_sentence = payload.get("conclusionFirstSentence")
    if not isinstance(thesis_statement, str) or not thesis_statement.strip():
        raise WorkerActionError("payload.thesisStatement must be a non-empty string")
    if not isinstance(conclusion_first_sentence, str) or not conclusion_first_sentence.strip():
        raise WorkerActionError("payload.conclusionFirstSentence must be a non-empty string")

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)

    try:
        return run_thesis_restatement_feedback(
            llm_service=llm_service,
            app_cfg=app_cfg,
            thesis_statement_text=thesis_statement,
            conclusion_first_sentence_text=conclusion_first_sentence,
            on_status=on_status,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc
