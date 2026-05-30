from __future__ import annotations

from typing import Any, Callable

from app.pipeline_simple import (
    run_chat,
    run_chat_stream,
    warm_runtime,
)
from app.pipeline_rubric_eval import run_evaluate_with_rubric
from app.pipeline_paragraph_feedback_bulk import run_paragraph_feedback_bulk
from controllers.responses import success
from app.runtime_lifecycle import RuntimeLifecycle
from app.pipeline_errors import WorkerActionError
from prompts.chats.caches import clear_cached_session

# define constants

SIMPLE_CHAT_PIPELINE_KEY = "simple-chat"
EVALUATE_SIMPLE_PIPELINE_KEY = "evaluate-simple"
EVALUATE_WITH_RUBRIC_PIPELINE_KEY = "evaluate-with-rubric"
PARAGRAPH_FEEDBACK_BULK_PIPELINE_KEY = "paragraph-feedback-bulk"

ACTION_TO_PIPELINE: dict[str, tuple[str, str]] = {
    "llm.chat": (SIMPLE_CHAT_PIPELINE_KEY, "chat"),
    "llm.chatStream": (SIMPLE_CHAT_PIPELINE_KEY, "chatStream"),
    "llm.evaluate.simple": (EVALUATE_SIMPLE_PIPELINE_KEY, "evaluate"),
    "llm.evaluate.withRubric": (EVALUATE_WITH_RUBRIC_PIPELINE_KEY, "evaluate"),
    "llm.paragraph.feedback.bulk": (PARAGRAPH_FEEDBACK_BULK_PIPELINE_KEY, "evaluate"),
}

SERVER_START_ACTION = "llm.server.start"
SERVER_STOP_ACTION = "llm.server.stop"
SERVER_STATUS_ACTION = "llm.server.status"
SESSION_CREATE_ACTION = "llm.session.create"
SESSION_CLEAR_ACTION = "llm.session.clear"
SIMPLE_CHAT_CLEAR_CACHE_ACTION = "llm.simpleChat.clearSessionCache"

class HandleRequest:
    def __init__(self, lifecycle: RuntimeLifecycle, emit_stream_event: Callable[[str, dict[str, Any]], None]):
        self.lifecycle = lifecycle
        self.emit_stream_event = emit_stream_event

    def __call__(self, req: dict[str, Any]) -> dict[str, Any]:
        request_id = req.get("requestId")
        action = req.get("action")
        payload = req.get("payload")

        if not isinstance(request_id, str) or not request_id:
            raise WorkerActionError(
                "requestId must be a non-empty string.",
                details={"requestId": request_id},
            )

        if not isinstance(action, str) or not action:
            raise WorkerActionError("action must be a non-empty string.")

        if not isinstance(payload, dict):
            raise WorkerActionError("payload must be an object.")

        if action == SERVER_START_ACTION:
            return success(request_id, warm_runtime(payload, self.lifecycle))
        if action == SERVER_STOP_ACTION:
            self.lifecycle.shutdown()
            status = self.lifecycle.get_status()
            return success(
                request_id,
                {
                    "stopped": True,
                    "hasRuntime": status.get("hasRuntime"),
                    "serverRunning": status.get("serverRunning"),
                },
            )
        if action == SERVER_STATUS_ACTION:
            return success(request_id, self.lifecycle.get_status())
        if action == SESSION_CREATE_ACTION:
            raise WorkerActionError(
                "Action deprecated: llm.session.create is now handled by Electron session repository.",
            )
        if action == SESSION_CLEAR_ACTION:
            raise WorkerActionError(
                "Action deprecated: llm.session.clear is now handled by Electron session repository.",
            )
        if action == SIMPLE_CHAT_CLEAR_CACHE_ACTION:
            return success(request_id, clear_cached_session(payload))

        route = ACTION_TO_PIPELINE.get(action)
        if route is not None:
            pipeline_key, pipeline_action = route

            if pipeline_key == SIMPLE_CHAT_PIPELINE_KEY:
                if pipeline_action == "chat":
                    reply = run_chat(payload, self.lifecycle)
                    return success(request_id, {"reply": reply})
                if pipeline_action == "chatStream":
                    return run_chat_stream(
                        payload,
                        request_id,
                        self.lifecycle,
                        emit_stream_event=self.emit_stream_event,
                        success_response_factory=success,
                    )
                raise WorkerActionError(
                    f"Unsupported pipeline action '{pipeline_action}' for {pipeline_key}.",
                )

            if pipeline_key in {
                EVALUATE_SIMPLE_PIPELINE_KEY,
                EVALUATE_WITH_RUBRIC_PIPELINE_KEY,
                PARAGRAPH_FEEDBACK_BULK_PIPELINE_KEY,
            }:
                if pipeline_key == EVALUATE_WITH_RUBRIC_PIPELINE_KEY:
                    reply = run_evaluate_with_rubric(payload, self.lifecycle)
                    return success(request_id, {"reply": reply})
                if pipeline_key == PARAGRAPH_FEEDBACK_BULK_PIPELINE_KEY:
                    seq = 0
                    client_request_id = payload.get("clientRequestId")
                    if not isinstance(client_request_id, str):
                        client_request_id = ""

                    def emit_status(text: str) -> None:
                        nonlocal seq
                        seq += 1
                        self.emit_stream_event(
                            "stream_chunk",
                            {
                                "clientRequestId": client_request_id,
                                "channel": "meta",
                                "text": text,
                                "done": False,
                                "seq": seq,
                            },
                        )

                    reply = run_paragraph_feedback_bulk(payload, self.lifecycle, on_status=emit_status)
                    return success(request_id, {"reply": reply})
                raise WorkerActionError(f"Action not implemented yet: {pipeline_key}")
            raise WorkerActionError(f"Unsupported pipeline key: {pipeline_key}")

        if action in {"llm.assessEssay", "llm.generateFeedbackSummary"}:
            raise WorkerActionError(f"Action not implemented yet: {action}")

        raise WorkerActionError(f"Unsupported action: {action}")
