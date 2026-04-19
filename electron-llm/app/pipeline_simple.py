from __future__ import annotations

from typing import Any, Callable

from app.runtime_lifecycle import RuntimeLifecycle
from app.settings import build_settings_from_payload

from app.pipeline_errors import WorkerActionError
from app.pipeline_builders import build_runtime

from prompts.chats.extractions import extract_fake_reply, extract_system_prompt, extract_message, extract_context_text, extract_session_turns, extract_client_request_id
from prompts.chats.compose_prompt import compose_prompt

from prompts.chats.caches import get_cached_system_prompt

def warm_runtime(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> dict[str, Any]:
    try:
        app_cfg = build_settings_from_payload(payload)
    except ValueError as exc:
        raise WorkerActionError(f"Invalid LLM settings: {exc}") from exc

    if app_cfg.use_fake_reply:
        return {
            "warmed": False,
            "fakeMode": True,
            "serverRunning": False,
        }

    build_runtime(payload, lifecycle)
    status = lifecycle.get_status()
    return {
        "warmed": bool(status.get("serverRunning")),
        "fakeMode": False,
        "serverRunning": bool(status.get("serverRunning")),
    }


def run_chat(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> str:
    fake_reply = extract_fake_reply(payload)
    if fake_reply is not None:
        return fake_reply

    system_prompt = extract_system_prompt(payload)
    message = extract_message(payload)
    if system_prompt is not None:
        app_cfg, llm_task_service = build_runtime(payload, lifecycle)
        _, _, llm_request = app_cfg.require_real_config()
        try:
            response = llm_task_service.llm_service.with_mode("no_think").chat(
                system=system_prompt,
                user=message,
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

    context_text = extract_context_text(payload)
    session_turns = extract_session_turns(payload)
    prompt_text = message
    if session_turns:
        prompt_text = compose_prompt(message, context_text, session_turns)
    elif context_text:
        prompt_text = compose_prompt(message, context_text, [])
    app_cfg, llm_task_service = build_runtime(payload, lifecycle)

    try:
        result = llm_task_service.prompt_tester_parallel(
            app_cfg=app_cfg,
            text_tasks=[prompt_text],
            max_concurrency=1,
        )
    except Exception as exc:
        raise WorkerActionError(f"LLM request failed: {exc}") from exc

    outputs = result.get("outputs", [])
    if not outputs:
        raise WorkerActionError("LLM request failed: no outputs were returned.")

    first = outputs[0]
    if isinstance(first, Exception):
        raise WorkerActionError(f"LLM request failed: {first}") from first

    reply: str | None = None
    if hasattr(first, "content"):
        reply = getattr(first, "content", None)
    elif isinstance(first, dict):
        candidate = first.get("content")
        reply = candidate if isinstance(candidate, str) else None

    if not reply or not reply.strip():
        raise WorkerActionError("LLM request failed: task did not return textual content.")

    return reply.strip()


def run_chat_stream(
    payload: dict[str, Any],
    request_id: str,
    lifecycle: RuntimeLifecycle,
    emit_stream_event: Callable[[str, dict[str, Any]], None],
    success_response_factory: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    client_request_id = extract_client_request_id(payload)
    explicit_system_prompt = extract_system_prompt(payload)
    system_prompt = explicit_system_prompt if explicit_system_prompt is not None else get_cached_system_prompt(payload)
    message = extract_message(payload)
    context_text = extract_context_text(payload)
    session_turns = extract_session_turns(payload)
    if explicit_system_prompt is None:
        user_text = message
        if session_turns:
            user_text = compose_prompt(message, context_text, session_turns)
        elif context_text:
            user_text = compose_prompt(message, context_text, [])
    else:
        user_text = message
    seq = 1

    emit_stream_event(
        "stream_start",
        {
            "clientRequestId": client_request_id,
            "channel": "meta",
            "text": "",
            "done": False,
            "seq": seq,
        },
    )

    fake_reply = extract_fake_reply(payload)
    if fake_reply is not None:
        seq += 1
        emit_stream_event(
            "stream_chunk",
            {
                "clientRequestId": client_request_id,
                "channel": "content",
                "text": fake_reply,
                "done": False,
                "seq": seq,
            },
        )
        seq += 1
        emit_stream_event(
            "stream_done",
            {
                "clientRequestId": client_request_id,
                "channel": "meta",
                "text": "",
                "done": True,
                "seq": seq,
            },
        )
        return success_response_factory(request_id, {"reply": fake_reply})

    app_cfg, llm_task_service = build_runtime(payload, lifecycle)
    stream = llm_task_service.simple_chat_stream(
        app_cfg=app_cfg,
        system_prompt=system_prompt,
        user_text=user_text,
    )

    while True:
        try:
            stream_event = next(stream)
        except StopIteration as stop:
            reply = stop.value
            break
        except Exception as exc:
            seq += 1
            emit_stream_event(
                "stream_error",
                {
                    "clientRequestId": client_request_id,
                    "channel": "meta",
                    "text": "",
                    "done": True,
                    "seq": seq,
                    "error": {
                        "code": "PY_ACTION_FAILED",
                        "message": f"LLM request failed: {exc}",
                    },
                },
            )
            raise WorkerActionError(f"LLM request failed: {exc}") from exc

        seq += 1
        emit_stream_event(
            "stream_chunk",
            {
                "clientRequestId": client_request_id,
                "channel": stream_event.channel,
                "text": stream_event.text,
                "done": stream_event.done,
                "seq": seq,
                "finishReason": stream_event.finish_reason,
                "model": stream_event.model,
                "usage": stream_event.usage,
            },
        )

    seq += 1
    emit_stream_event(
        "stream_done",
        {
            "clientRequestId": client_request_id,
            "channel": "meta",
            "text": "",
            "done": True,
            "seq": seq,
        },
    )

    return success_response_factory(request_id, {"reply": reply})
