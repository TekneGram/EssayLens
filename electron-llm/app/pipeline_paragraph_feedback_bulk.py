from __future__ import annotations

import json
from typing import Any, Callable
from app.runtime_lifecycle import RuntimeLifecycle
from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from nlp.llm.tasks.paragraph_feedback import run_paragraph_feedback_bundle


def run_paragraph_feedback_bulk(
    payload: dict[str, Any],
    lifecycle: RuntimeLifecycle,
    on_status: Callable[[str], None] | None = None,
) -> str:
    essay = payload.get("essay")
    if not isinstance(essay, str) or not essay.strip():
        raise WorkerActionError("payload.essay must be a non-empty string")

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)

    try:
        feedback_bundle = run_paragraph_feedback_bundle(
            llm_service=llm_service,
            app_cfg=app_cfg,
            paragraph_text=essay.strip(),
            on_status=on_status,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc

    reply = json.dumps(feedback_bundle, ensure_ascii=False).strip()
    if not reply:
        raise WorkerActionError("LLM request failed: task did not return textual content.")
    return reply
