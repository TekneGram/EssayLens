from __future__ import annotations

import json
import sys
import traceback
from datetime import datetime, timezone
from typing import Any

from app.pipeline_simple import (
    WorkerActionError,
    clear_cached_session,
    run_chat,
    run_chat_stream,
    warm_runtime,
)
from app.runtime_lifecycle import RuntimeLifecycle


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _write_response(resp: dict[str, Any]) -> None:
    # IMPORTANT: stdout must be JSON lines only
    sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _failure(request_id: str, code: str, message: str, details: Any = None) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "ok": False,
        "error": {
            "code": code,
            "message": message,
            "details": details,
        },
        "timestamp": _now_iso(),
    }


def _success(request_id: str, data: dict[str, Any]) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "ok": True,
        "data": data,
        "timestamp": _now_iso(),
    }


def _stream_event(
    request_id: str,
    event_type: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    return {
        "requestId": request_id,
        "type": event_type,
        "data": data,
        "timestamp": _now_iso(),
    }


SIMPLE_CHAT_PIPELINE_KEY = "simple-chat"
EVALUATE_SIMPLE_PIPELINE_KEY = "evaluate-simple"
EVALUATE_WITH_RUBRIC_PIPELINE_KEY = "evaluate-with-rubric"
BULK_EVALUATE_PIPELINE_KEY = "bulk-evaluate"

ACTION_TO_PIPELINE: dict[str, tuple[str, str]] = {
    "llm.chat": (SIMPLE_CHAT_PIPELINE_KEY, "chat"),
    "llm.chatStream": (SIMPLE_CHAT_PIPELINE_KEY, "chatStream"),
    "llm.evaluate.simple": (EVALUATE_SIMPLE_PIPELINE_KEY, "evaluate"),
    "llm.evaluate.withRubric": (EVALUATE_WITH_RUBRIC_PIPELINE_KEY, "evaluate"),
    "llm.evaluate.bulk": (BULK_EVALUATE_PIPELINE_KEY, "evaluate"),
}

SERVER_START_ACTION = "llm.server.start"
SERVER_STOP_ACTION = "llm.server.stop"
SERVER_STATUS_ACTION = "llm.server.status"
SESSION_CREATE_ACTION = "llm.session.create"
SESSION_CLEAR_ACTION = "llm.session.clear"
SIMPLE_CHAT_CLEAR_CACHE_ACTION = "llm.simpleChat.clearSessionCache"


def _handle_request(req: dict[str, Any], lifecycle: RuntimeLifecycle) -> dict[str, Any]:
    request_id = req.get("requestId")
    action = req.get("action")
    payload = req.get("payload")

    if not isinstance(request_id, str) or not request_id:
        return _failure("invalid-request-id", "PY_ACTION_FAILED", "requestId must be a non-empty string.")

    if not isinstance(action, str) or not action:
        return _failure(request_id, "PY_ACTION_FAILED", "action must be a non-empty string.")

    if not isinstance(payload, dict):
        return _failure(request_id, "PY_ACTION_FAILED", "payload must be an object.")

    try:
        if action == SERVER_START_ACTION:
            return _success(request_id, warm_runtime(payload, lifecycle))
        if action == SERVER_STOP_ACTION:
            lifecycle.shutdown()
            status = lifecycle.get_status()
            return _success(
                request_id,
                {
                    "stopped": True,
                    "hasRuntime": status.get("hasRuntime"),
                    "serverRunning": status.get("serverRunning"),
                },
            )
        if action == SERVER_STATUS_ACTION:
            return _success(request_id, lifecycle.get_status())
        if action == SESSION_CREATE_ACTION:
            return _failure(
                request_id,
                "PY_ACTION_FAILED",
                "Action deprecated: llm.session.create is now handled by Electron session repository.",
            )
        if action == SESSION_CLEAR_ACTION:
            return _failure(
                request_id,
                "PY_ACTION_FAILED",
                "Action deprecated: llm.session.clear is now handled by Electron session repository.",
            )
        if action == SIMPLE_CHAT_CLEAR_CACHE_ACTION:
            return _success(request_id, clear_cached_session(payload))

        route = ACTION_TO_PIPELINE.get(action)
        if route is not None:
            pipeline_key, pipeline_action = route
            if pipeline_key == SIMPLE_CHAT_PIPELINE_KEY:
                if pipeline_action == "chat":
                    reply = run_chat(payload, lifecycle)
                    return _success(request_id, {"reply": reply})
                if pipeline_action == "chatStream":
                    return run_chat_stream(
                        payload,
                        request_id,
                        lifecycle,
                        emit_stream_event=lambda event_type, data: _write_response(
                            _stream_event(request_id, event_type, data)
                        ),
                        success_response_factory=_success,
                    )
                return _failure(
                    request_id,
                    "PY_ACTION_FAILED",
                    f"Unsupported pipeline action '{pipeline_action}' for {pipeline_key}.",
                )
            if pipeline_key in {
                EVALUATE_SIMPLE_PIPELINE_KEY,
                EVALUATE_WITH_RUBRIC_PIPELINE_KEY,
                BULK_EVALUATE_PIPELINE_KEY,
            }:
                return _failure(
                    request_id,
                    "PY_ACTION_FAILED",
                    f"Action not implemented yet: {pipeline_key}",
                )
            return _failure(
                request_id,
                "PY_ACTION_FAILED",
                f"Unsupported pipeline key: {pipeline_key}",
            )

        # Keep contract with electron orchestrator supported actions
        if action in {"llm.assessEssay", "llm.generateFeedbackSummary"}:
            return _failure(request_id, "PY_ACTION_FAILED", f"Action not implemented yet: {action}")

        return _failure(request_id, "PY_ACTION_FAILED", f"Unsupported action: {action}")
    except WorkerActionError as exc:
        return _failure(request_id, exc.code, str(exc), exc.details)


def main() -> None:
    runtime_lifecycle = RuntimeLifecycle()

    try:
        for raw_line in sys.stdin:
            line = raw_line.strip()
            if not line:
                continue

            request_id = "unknown-request"
            try:
                parsed = json.loads(line)
                if not isinstance(parsed, dict):
                    raise ValueError("Request must be a JSON object.")

                if isinstance(parsed.get("requestId"), str):
                    request_id = parsed["requestId"]

                response = _handle_request(parsed, runtime_lifecycle)
                _write_response(response)
            except WorkerActionError as exc:
                _write_response(
                    _failure(
                        request_id,
                        exc.code,
                        str(exc),
                        exc.details,
                    )
                )
            except Exception as exc:
                _write_response(
                    _failure(
                        request_id,
                        "PY_ACTION_FAILED",
                        str(exc),
                        {
                            "type": exc.__class__.__name__,
                            "traceback": traceback.format_exc(),
                        },
                    )
                )
    finally:
        runtime_lifecycle.shutdown()


if __name__ == "__main__":
    main()
