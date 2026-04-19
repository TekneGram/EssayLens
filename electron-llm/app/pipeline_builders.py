from __future__ import annotations
from typing import Any
from app.runtime_lifecycle import RuntimeLifecycle
from app.settings import build_settings_from_payload
from app.pipeline_errors import WorkerActionError
from app.container import build_container

def build_runtime(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> tuple[Any, Any]:
    try:
        app_cfg = build_settings_from_payload(payload)
    except ValueError as exc:
        raise WorkerActionError(f"Invalid LLM Settings: {exc}") from exc
    
    if app_cfg.use_fake_reply:
        raise WorkerActionError("Invalid configuration: use_fake_reply should be handled before runtime setup.")
    
    deps = lifecycle.get_or_create_llm_runtime(app_cfg, build_container)
    server_proc = deps.get("server_proc")
    llm_task_service = deps.get("llm_task_service")

    if server_proc is None or llm_task_service is None:
        raise WorkerActionError("LLM dependencies are not available in container.")
    
    try:
        server_proc.ensure_running()
    except FileNotFoundError as exc:
        raise WorkerActionError(str(exc)) from exc
    except TimeoutError as exc:
        raise WorkerActionError(str(exc)) from exc
    except RuntimeError as exc:
        raise WorkerActionError(f"Failed to start llama-server: {exc}") from exc
    
    return app_cfg, llm_task_service
