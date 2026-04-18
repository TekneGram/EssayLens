from __future__ import annotations

from typing import Any, Callable

from app.container import build_container
from app.runtime_lifecycle import RuntimeLifecycle
from app.settings import build_settings_from_payload
from nlp.llm.tasks.simple_chat import build_system_prompt


DEFAULT_CHAT_SESSION_KEY = "__default_simple_chat_session__"
_SESSION_SYSTEM_PROMPTS: dict[str, str] = {}


class WorkerActionError(Exception):
    def __init__(self, message: str, *, code: str = "PY_ACTION_FAILED", details: Any = None):
        super().__init__(message)
        self.code = code
        self.details = details


def _extract_session_turns(payload: dict[str, Any]) -> list[dict[str, str]]:
    raw_turns = payload.get("sessionTurns")
    if raw_turns is None:
        return []
    if not isinstance(raw_turns, list):
        raise WorkerActionError("payload.sessionTurns must be an array when provided.")

    turns: list[dict[str, str]] = []
    for item in raw_turns:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        content = item.get("content")
        if role not in {"teacher", "assistant", "system"}:
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        turns.append({"role": role, "content": content.strip()})
    return turns


def _extract_context_text(payload: dict[str, Any]) -> str | None:
    context_text = payload.get("contextText")
    if isinstance(context_text, str) and context_text.strip():
        return context_text.strip()
    return None


def _extract_system_prompt(payload: dict[str, Any]) -> str | None:
    system_prompt = payload.get("systemPrompt")
    if isinstance(system_prompt, str) and system_prompt.strip():
        return system_prompt.strip()
    return None


def _extract_message(payload: dict[str, Any]) -> str:
    message = payload.get("message")
    if not isinstance(message, str):
        message = payload.get("content")
    if not isinstance(message, str) or not message.strip():
        raise ValueError("payload.message must be a non-empty string")
    return message.strip()


def _extract_fake_reply(payload: dict[str, Any]) -> str | None:
    settings = payload.get("settings")
    if not isinstance(settings, dict):
        return None
    if settings.get("use_fake_reply") is not True:
        return None

    fake_reply = settings.get("fake_reply_text")
    if isinstance(fake_reply, str) and fake_reply.strip():
        return fake_reply.strip()
    return "LLM is not configured yet."


def _extract_client_request_id(payload: dict[str, Any]) -> str | None:
    value = payload.get("clientRequestId")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _extract_session_id(payload: dict[str, Any]) -> str:
    value = payload.get("sessionId")
    if isinstance(value, str) and value.strip():
        return value.strip()
    return DEFAULT_CHAT_SESSION_KEY


def _extract_essay(payload: dict[str, Any]) -> str | None:
    essay = payload.get("essay")
    if isinstance(essay, str) and essay.strip():
        return essay.strip()
    return None


def _extract_rubric_category(payload: dict[str, Any]) -> str:
    value = payload.get("rubricCategory")
    if not isinstance(value, str) or not value.strip():
        raise WorkerActionError("payload.rubricCategory must be a non-empty string")
    return value.strip()


def _extract_rubric_entries(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_entries = payload.get("rubricEntries")
    if not isinstance(raw_entries, list) or len(raw_entries) == 0:
        raise WorkerActionError("payload.rubricEntries must be a non-empty array")

    entries: list[dict[str, Any]] = []
    for item in raw_entries:
        if not isinstance(item, dict):
            raise WorkerActionError("payload.rubricEntries items must be objects")
        score_value = item.get("scoreValue")
        description = item.get("description")
        if not isinstance(score_value, int):
            raise WorkerActionError("payload.rubricEntries.scoreValue must be an integer")
        if not isinstance(description, str) or not description.strip():
            raise WorkerActionError("payload.rubricEntries.description must be a non-empty string")
        entries.append({"scoreValue": score_value, "description": description.strip()})

    return entries


def _build_rubric_system_prompt(category: str, entries: list[dict[str, Any]], essay: str) -> str:
    lines: list[str] = [f'Here is a rubric for the "{category}" of the essay']
    for entry in sorted(entries, key=lambda item: (-int(item["scoreValue"]), str(item["description"]))):
        lines.append(f'## {entry["scoreValue"]}')
        lines.append(str(entry["description"]))
    lines.append("Read the essay below and decide which category the essay best suits")
    lines.append("---Essay Here---")
    lines.append(essay)
    lines.append("Explain your decision. Be concise")
    return "\n".join(lines)


def _get_cached_system_prompt(payload: dict[str, Any]) -> str:
    session_id = _extract_session_id(payload)
    cached_prompt = _SESSION_SYSTEM_PROMPTS.get(session_id)
    if isinstance(cached_prompt, str) and cached_prompt.strip():
        return cached_prompt

    essay = _extract_essay(payload)
    if not essay:
        raise WorkerActionError(
            "Simple chat session is missing essay context. Provide payload.essay for the first message in a session."
        )
    system_prompt = build_system_prompt(essay)
    _SESSION_SYSTEM_PROMPTS[session_id] = system_prompt
    return system_prompt


def clear_cached_session(payload: dict[str, Any]) -> dict[str, Any]:
    session_id = _extract_session_id(payload)
    cleared = _SESSION_SYSTEM_PROMPTS.pop(session_id, None) is not None
    return {
        "sessionId": session_id,
        "cleared": cleared,
    }


def _build_runtime(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> tuple[Any, Any]:
    try:
        app_cfg = build_settings_from_payload(payload)
    except ValueError as exc:
        raise WorkerActionError(f"Invalid LLM settings: {exc}") from exc

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


def _compose_prompt(message: str, context_text: str | None, session_turns: list[dict[str, str]]) -> str:
    blocks: list[str] = []
    if context_text:
        blocks.append("Context:\n" + context_text)
    if session_turns:
        history_lines: list[str] = []
        for turn in session_turns:
            role = turn.get("role")
            content = turn.get("content")
            if role not in {"teacher", "assistant", "system"} or not isinstance(content, str):
                continue
            if role == "teacher":
                prefix = "Teacher"
            elif role == "assistant":
                prefix = "Assistant"
            else:
                prefix = "System"
            history_lines.append(f"{prefix}: {content}")
        if history_lines:
            blocks.append("Conversation History:\n" + "\n".join(history_lines))
    blocks.append("Teacher:\n" + message)
    return "\n\n".join(blocks)


def _build_rubric_evaluation_prompt(payload: dict[str, Any]) -> tuple[str, str]:
    essay = _extract_essay(payload)
    if not essay:
        raise WorkerActionError("payload.essay must be a non-empty string")

    category = _extract_rubric_category(payload)
    entries = _extract_rubric_entries(payload)

    system_lines: list[str] = [f'Here is a rubric for the "{category}" category of the essay.']
    for entry in entries:
        system_lines.append(f"## {entry['scoreValue']}")
        system_lines.append(str(entry["description"]))
    system_lines.append("Read the essay and determine which score best fits this category.")
    system_lines.append("Explain your decision briefly and cite the relevant rubric language.")

    user_lines = [
        f"Rubric category: {category}",
        "---Essay Here---",
        essay,
    ]
    return "\n".join(system_lines), "\n".join(user_lines)


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

    _build_runtime(payload, lifecycle)
    status = lifecycle.get_status()
    return {
        "warmed": bool(status.get("serverRunning")),
        "fakeMode": False,
        "serverRunning": bool(status.get("serverRunning")),
    }


def run_chat(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> str:
    fake_reply = _extract_fake_reply(payload)
    if fake_reply is not None:
        return fake_reply

    system_prompt = _extract_system_prompt(payload)
    message = _extract_message(payload)
    if system_prompt is not None:
        app_cfg, llm_task_service = _build_runtime(payload, lifecycle)
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

    context_text = _extract_context_text(payload)
    session_turns = _extract_session_turns(payload)
    prompt_text = message
    if session_turns:
        prompt_text = _compose_prompt(message, context_text, session_turns)
    elif context_text:
        prompt_text = _compose_prompt(message, context_text, [])
    app_cfg, llm_task_service = _build_runtime(payload, lifecycle)

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


def run_evaluate_with_rubric(payload: dict[str, Any], lifecycle: RuntimeLifecycle) -> str:
    fake_reply = _extract_fake_reply(payload)
    if fake_reply is not None:
        return fake_reply

    system_prompt, user_text = _build_rubric_evaluation_prompt(payload)
    app_cfg, llm_task_service = _build_runtime(payload, lifecycle)
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


def run_chat_stream(
    payload: dict[str, Any],
    request_id: str,
    lifecycle: RuntimeLifecycle,
    emit_stream_event: Callable[[str, dict[str, Any]], None],
    success_response_factory: Callable[[str, dict[str, Any]], dict[str, Any]],
) -> dict[str, Any]:
    client_request_id = _extract_client_request_id(payload)
    explicit_system_prompt = _extract_system_prompt(payload)
    system_prompt = explicit_system_prompt if explicit_system_prompt is not None else _get_cached_system_prompt(payload)
    message = _extract_message(payload)
    context_text = _extract_context_text(payload)
    session_turns = _extract_session_turns(payload)
    if explicit_system_prompt is None:
        user_text = message
        if session_turns:
            user_text = _compose_prompt(message, context_text, session_turns)
        elif context_text:
            user_text = _compose_prompt(message, context_text, [])
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

    fake_reply = _extract_fake_reply(payload)
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

    app_cfg, llm_task_service = _build_runtime(payload, lifecycle)
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
