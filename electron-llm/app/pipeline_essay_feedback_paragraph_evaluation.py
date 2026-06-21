from __future__ import annotations

from typing import Any, Callable

from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from app.runtime_lifecycle import RuntimeLifecycle
from nlp.llm.tasks.essay_feedback import run_paragraph_evaluation


def run_essay_feedback_paragraph_evaluation(
    payload: dict[str, Any],
    lifecycle: RuntimeLifecycle,
    on_status: Callable[[str], None] | None = None,
) -> dict[str, Any]:
    introduction = payload.get("introduction")
    body_paragraph = payload.get("bodyParagraph")
    main_idea = payload.get("mainIdea")
    if not isinstance(introduction, str) or not introduction.strip():
        raise WorkerActionError("payload.introduction must be a non-empty string")
    if not isinstance(body_paragraph, str) or not body_paragraph.strip():
        raise WorkerActionError("payload.bodyParagraph must be a non-empty string")
    if not isinstance(main_idea, str) or not main_idea.strip():
        raise WorkerActionError("payload.mainIdea must be a non-empty string")

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)

    try:
        return run_paragraph_evaluation(
            llm_service=llm_service,
            app_cfg=app_cfg,
            introduction_text=introduction,
            body_paragraph_text=body_paragraph,
            main_idea_text=main_idea,
            on_status=on_status,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc
