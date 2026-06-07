from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, TYPE_CHECKING

if TYPE_CHECKING:
    from app.settings import AppConfig
    from services.llm_service import LlmService


PROMPT_DIR = Path(__file__).resolve().parents[3] / "prompts" / "paragraph_feedback"
StatusCallback = Callable[[str], None]
MAX_SCHEMA_ATTEMPTS = 4
RETRY_SCHEMA_MAX_TOKENS_CAP = 3072
RETRY_SCHEMA_NON_TRUNCATION_MARKERS = (
    "LLM Server connection failed",
    "timed out",
    "Server Error",
)


@dataclass
class _ReasoningLeakCollector:
    parts: list[str] = field(default_factory=list)

    def add(self, text: str | None) -> None:
        if not isinstance(text, str):
            return
        normalized = text.strip()
        if not normalized:
            return
        if normalized in self.parts:
            return
        self.parts.append(normalized)

    def detected(self) -> bool:
        return bool(self.parts)

    def combined(self) -> str:
        return "\n\n".join(self.parts).strip()


def _load_prompt(filename: str) -> str:
    return (PROMPT_DIR / filename).read_text(encoding="utf-8").strip()


def _run_chat(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    system: str,
    user: str,
    reasoning_collector: _ReasoningLeakCollector | None = None,
) -> str:
    _, _, llm_request = app_cfg.require_real_config()
    response = llm_service.chat(
        system=system,
        user=user,
        max_tokens=llm_request.max_tokens,
        temperature=llm_request.temperature,
        top_p=llm_request.top_p,
        top_k=llm_request.top_k,
        repeat_penalty=llm_request.repeat_penalty,
        seed=llm_request.seed,
        stop=llm_request.stop,
        response_format=llm_request.response_format,
    )
    if reasoning_collector is not None:
        reasoning_collector.add(response.reasoning_content)
    text = response.content.strip() if isinstance(response.content, str) else ""
    if not text:
        raise RuntimeError("Paragraph feedback task returned an empty text response.")
    return text


def _run_json_schema_chat(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    system: str,
    user: str,
    name: str,
    schema: dict[str, Any],
    reasoning_collector: _ReasoningLeakCollector | None = None,
) -> dict[str, Any]:
    _, _, llm_request = app_cfg.require_real_config()
    wrapped_schema = {
        "type": "json_schema",
        "json_schema": {
            "name": name,
            "schema": schema,
        },
    }

    def _call(*, user_text: str, max_tokens: int) -> dict[str, Any]:
        response = llm_service.json_schema_chat_response(
            system=system,
            user=user_text,
            schema=wrapped_schema,
            max_tokens=max_tokens,
            temperature=0.0,
            top_p=1.0,
            top_k=None,
            repeat_penalty=None,
            seed=llm_request.seed,
            stop=None,
        )
        if reasoning_collector is not None:
            reasoning_collector.add(response.reasoning_content)
        try:
            obj = _parse_schema_response_content(response.content)
        except RuntimeError as exc:
            raise RuntimeError(
                f"{exc} (finish_reason={response.finish_reason!r}, content_len={len(response.content)})"
            ) from exc
        if not isinstance(obj, dict):
            raise RuntimeError("Paragraph feedback task returned a non-object JSON schema response.")
        return _sanitize_schema_object(obj=obj, schema=schema)

    base_max_tokens = llm_request.max_tokens
    attempt_max_tokens = (
        base_max_tokens,
        min(RETRY_SCHEMA_MAX_TOKENS_CAP, max(base_max_tokens + 256, base_max_tokens * 2)),
        min(RETRY_SCHEMA_MAX_TOKENS_CAP, max(base_max_tokens + 512, base_max_tokens * 3)),
        RETRY_SCHEMA_MAX_TOKENS_CAP,
    )
    last_exc: Exception | None = None
    for attempt in range(MAX_SCHEMA_ATTEMPTS):
        max_tokens = attempt_max_tokens[attempt]
        if attempt == 0:
            user_text = user
        elif attempt == 1:
            user_text = (
                f"{user}\n\n"
                "Output only a single valid JSON object that exactly matches the requested schema. "
                "Do not include markdown, code fences, or any extra text."
            )
        else:
            user_text = (
                f"{user}\n\n"
                "Output only a single valid JSON object that exactly matches the requested schema. "
                "Keep every string concise and within the schema length limits. "
                "Do not include markdown, code fences, or any extra text."
            )
        try:
            return _call(user_text=user_text, max_tokens=max_tokens)
        except Exception as exc:
            if _is_non_truncation_schema_error(exc):
                raise RuntimeError(
                    f"JSON schema chat failed for schema '{name}' on attempt {attempt + 1}/{MAX_SCHEMA_ATTEMPTS} "
                    f"(max_tokens={max_tokens}): {exc}"
                ) from exc
            last_exc = exc

    raise RuntimeError(
        f"JSON schema chat failed after {MAX_SCHEMA_ATTEMPTS} attempts for schema '{name}': {last_exc}"
    ) from last_exc


def _is_non_truncation_schema_error(exc: Exception) -> bool:
    message = str(exc)
    if "Malformed JSON schema response" in message and "finish_reason='length'" in message:
        return False
    if "Malformed JSON schema response" in message:
        return False
    return any(marker in message for marker in RETRY_SCHEMA_NON_TRUNCATION_MARKERS)


def _sanitize_schema_object(*, obj: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    properties = schema.get("properties")
    required = schema.get("required")
    if not isinstance(properties, dict) or not isinstance(required, list):
        return obj

    out: dict[str, Any] = {}
    for field in required:
        if not isinstance(field, str):
            continue
        if field not in obj:
            raise RuntimeError(f"Schema response missing required field: {field}")
        field_schema = properties.get(field) if isinstance(properties, dict) else None
        out[field] = _sanitize_field_value(field=field, value=obj[field], field_schema=field_schema)
    return out


def _parse_schema_response_content(content: str) -> Any:
    normalized = content.strip() if isinstance(content, str) else ""
    try:
        return json.loads(normalized)
    except Exception as exc:
        tail = normalized[-220:]
        raise RuntimeError(f"Malformed JSON schema response content: {tail}") from exc


def _sanitize_field_value(*, field: str, value: Any, field_schema: Any) -> Any:
    if not isinstance(field_schema, dict):
        if not isinstance(value, str):
            raise RuntimeError(f"Schema field '{field}' must be a string.")
        return value.strip()

    field_type = field_schema.get("type")

    if field_type == "array":
        if not isinstance(value, list):
            raise RuntimeError(f"Schema field '{field}' must be an array.")
        item_schema = field_schema.get("items")
        return [
            _sanitize_field_value(
                field=f"{field}[{index}]",
                value=item,
                field_schema=item_schema,
            )
            for index, item in enumerate(value)
        ]

    if field_type == "object":
        if not isinstance(value, dict):
            raise RuntimeError(f"Schema field '{field}' must be an object.")
        properties = field_schema.get("properties")
        required = field_schema.get("required")
        if not isinstance(properties, dict) or not isinstance(required, list):
            return value
        out: dict[str, Any] = {}
        for nested_field in required:
            if not isinstance(nested_field, str):
                continue
            if nested_field not in value:
                raise RuntimeError(f"Schema field '{field}' is missing required field: {nested_field}")
            out[nested_field] = _sanitize_field_value(
                field=f"{field}.{nested_field}",
                value=value[nested_field],
                field_schema=properties.get(nested_field),
            )
        return out

    if not isinstance(value, str):
        raise RuntimeError(f"Schema field '{field}' must be a string.")
    result = value.strip()

    enum_values = field_schema.get("enum")
    if isinstance(enum_values, list) and enum_values:
        if result not in enum_values:
            raise RuntimeError(f"Schema field '{field}' has invalid enum value: {result!r}")
    max_length = field_schema.get("maxLength")
    if isinstance(max_length, int) and max_length > 0 and len(result) > max_length:
        result = result[:max_length].rstrip()
    return result


def _build_prefix_context(paragraph_text: str) -> str:
    # Centralized prefix keeps the expensive shared context stable across calls and
    # prepares this flow for native KV-cache reuse when runtime support is added.
    return f"Here is a paragraph:\n{paragraph_text.strip()}"


def _run_topic_sentence_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    system_prompt: str,
    prefix_context: str,
    on_status: StatusCallback | None = None,
    reasoning_collector: _ReasoningLeakCollector | None = None,
) -> dict[str, str]:
    _emit_status(on_status, "Identifying the topic sentence")
    topic_sentence = _run_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system_prompt,
        user=f"{prefix_context}\n\n{_load_prompt('topic_sentence_1.md')}",
        reasoning_collector=reasoning_collector,
    )
    _emit_status(on_status, "Identifying the controlling idea")
    controlling_idea = _run_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system_prompt,
        user=f"Here is a topic sentence:\n{topic_sentence}\n\n{_load_prompt('topic_sentence_2.md')}",
        reasoning_collector=reasoning_collector,
    )
    _emit_status(on_status, "Judging the topic sentence")
    judgement = _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system_prompt,
        user=(
            f"{prefix_context}\n\n"
            f"Here is a topic sentence in the paragraph:\n{topic_sentence}\n\n"
            f"Here is the controlling idea in the topic sentence:\n{controlling_idea}\n\n"
            f"{_load_prompt('topic_sentence_3.md')}"
        ),
        name="topic_sentence_judgement",
        reasoning_collector=reasoning_collector,
        schema={
            "type": "object",
            "properties": {
                "verdict": {"type": "string", "enum": ["too general", "too specific", "perfect"]},
                "reason": {"type": "string", "maxLength": 560},
                "revision_suggestion": {"type": "string", "maxLength": 640},
            },
            "required": ["verdict", "reason", "revision_suggestion"],
            "additionalProperties": False,
        },
    )
    return {
        "verdict": str(judgement.get("verdict", "")).strip(),
        "reason": str(judgement.get("reason", "")).strip(),
        "revision_suggestion": str(judgement.get("revision_suggestion", "")).strip(),
    }


def _run_coherence_feedback(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    system_prompt: str,
    prefix_context: str,
    on_status: StatusCallback | None = None,
    reasoning_collector: _ReasoningLeakCollector | None = None,
) -> dict[str, str]:
    _emit_status(on_status, "Judging paragraph coherence")
    initial = _run_json_schema_chat(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system=system_prompt,
        user=f"{prefix_context}\n\n{_load_prompt('coherence_1.md')}",
        name="determine_coherence_level",
        reasoning_collector=reasoning_collector,
        schema={
            "type": "object",
            "properties": {
                "verdict": {"type": "string", "enum": ["strong", "reasonable", "weak"]},
                "reason": {"type": "string", "maxLength": 560},
            },
            "required": ["verdict", "reason"],
            "additionalProperties": False,
        },
    )
    verdict = str(initial.get("verdict", "")).strip()
    reason = str(initial.get("reason", "")).strip()

    if verdict == "strong":
        _emit_status(on_status, "Preparing coherence praise")
        praise = _run_json_schema_chat(
            llm_service=llm_service,
            app_cfg=app_cfg,
            system=system_prompt,
            user=f"{prefix_context}\n\n{_load_prompt('coherence_3.md')}",
            name="praise_coherence",
            reasoning_collector=reasoning_collector,
            schema={
                "type": "object",
                "properties": {
                    "praise_1": {"type": "string", "maxLength": 520},
                    "praise_2": {"type": "string", "maxLength": 520},
                    "praise_3": {"type": "string", "maxLength": 520},
                },
                "required": ["praise_1", "praise_2"],
                "additionalProperties": False,
            },
        )
        praise_parts = [str(praise.get("praise_1", "")).strip(), str(praise.get("praise_2", "")).strip(), str(praise.get("praise_3", "")).strip()]
        revision_suggestion = " ".join(part for part in praise_parts if part)
    else:
        _emit_status(on_status, "Preparing coherence recommendations")
        improve = _run_json_schema_chat(
            llm_service=llm_service,
            app_cfg=app_cfg,
            system=system_prompt,
            user=f"{prefix_context}\n\n{_load_prompt('coherence_2.md')}",
            name="improve_coherence",
            reasoning_collector=reasoning_collector,
            schema={
                "type": "object",
                "properties": {
                    "improvement_1": {"type": "string", "maxLength": 520},
                    "improvement_2": {"type": "string", "maxLength": 520},
                    "improvement_3": {"type": "string", "maxLength": 520},
                },
                "required": ["improvement_1", "improvement_2"],
                "additionalProperties": False,
            },
        )
        improvements = [
            str(improve.get("improvement_1", "")).strip(),
            str(improve.get("improvement_2", "")).strip(),
            str(improve.get("improvement_3", "")).strip(),
        ]
        revision_suggestion = " ".join(part for part in improvements if part)

    return {
        "verdict": verdict,
        "reason": reason,
        "revision_suggestion": revision_suggestion.strip(),
    }


def run_paragraph_feedback_bundle(
    *,
    llm_service: "LlmService",
    app_cfg: "AppConfig",
    paragraph_text: str,
    on_status: StatusCallback | None = None,
) -> dict[str, Any]:
    paragraph = paragraph_text.strip()
    if not paragraph:
        raise ValueError("paragraph_text must be non-empty")

    system_prompt = _load_prompt("paragraph_knowledge.md")
    prefix_context = _build_prefix_context(paragraph)
    reasoning_collector = _ReasoningLeakCollector()

    topic_sentence = _run_topic_sentence_feedback(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system_prompt=system_prompt,
        prefix_context=prefix_context,
        on_status=on_status,
        reasoning_collector=reasoning_collector,
    )
    coherence = _run_coherence_feedback(
        llm_service=llm_service,
        app_cfg=app_cfg,
        system_prompt=system_prompt,
        prefix_context=prefix_context,
        on_status=on_status,
        reasoning_collector=reasoning_collector,
    )
    from nlp.llm.tasks.vocabulary_feedback import run_vocabulary_feedback

    vocabulary_feedback = run_vocabulary_feedback(
        llm_service=llm_service,
        app_cfg=app_cfg,
        paragraph_text=paragraph,
        on_status=on_status,
        reasoning_collector=reasoning_collector,
    )

    result: dict[str, Any] = {
        "paragraph_feedback": {
            "topic_sentence": topic_sentence,
            "coherence": coherence,
        },
        "vocabulary_feedback": vocabulary_feedback,
    }
    if reasoning_collector.detected():
        _emit_status(
            on_status,
            "Warning: reasoning output was detected unexpectedly during paragraph feedback. Gemma appears to have entered thinking mode."
        )
        result["reasoning_leak"] = {
            "warning": "Reasoning output was detected unexpectedly during paragraph feedback. Gemma appears to have entered thinking mode.",
            "reasoning_content": reasoning_collector.combined(),
        }
    return result


def _emit_status(on_status: StatusCallback | None, text: str) -> None:
    if on_status is not None:
        on_status(text)
