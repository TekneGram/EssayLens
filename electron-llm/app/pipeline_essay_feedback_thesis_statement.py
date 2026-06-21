from __future__ import annotations

from typing import Any, Callable

from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from app.runtime_lifecycle import RuntimeLifecycle
from nlp.llm.tasks.essay_feedback import run_thesis_statement_feedback


def run_essay_feedback_thesis_statement(
    payload: dict[str, Any],
    lifecycle: RuntimeLifecycle,
    on_status: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    essay = payload.get("essay")
    introduction = payload.get("introduction")
    if not isinstance(essay, str) or not essay.strip():
        raise WorkerActionError("payload.essay must be a non-empty string")
    if not isinstance(introduction, str) or not introduction.strip():
        raise WorkerActionError("payload.introduction must be a non-empty string")

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)

    try:
        return run_thesis_statement_feedback(
            llm_service=llm_service,
            app_cfg=app_cfg,
            essay_text=essay,
            introduction_text=introduction,
            on_status=on_status,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc
