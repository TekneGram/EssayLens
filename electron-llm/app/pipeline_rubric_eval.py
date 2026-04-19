from __future__ import annotations

from typing import Any
from app.runtime_lifecycle import RuntimeLifecycle
from app.pipeline_builders import build_runtime
from app.pipeline_errors import WorkerActionError
from prompts.rubric_evaluations.rubric_eval_prompt import build_rubric_evaluation_prompt


def run_evaluate_with_rubric(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> str:

    system_prompt, user_text = build_rubric_evaluation_prompt(payload)
    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    _, _, llm_request = app_cfg.require_real_config()

    try:
        response = llm_task_service.llm_service.with_mode("no_think").chat(
            system=system_prompt,
            user=user_text,
            max_tokens=llm_request.max_tokens,
            temperature=llm_request.temperature,
            top_p=llm_request.top_p,
            top_k=llm_request.top_k,
            repeat_penalty=llm_request.repeat_penalty,
            seed=llm_request.seed,
            stop=llm_request.stop,
            response_format=llm_request.response_format,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc

    reply = response.content.strip() if isinstance(response.content, str) else ""
    if not reply:
        raise WorkerActionError("LLM request failed: task did not return textual content.")
    return reply