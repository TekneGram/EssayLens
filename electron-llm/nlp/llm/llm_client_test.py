from __future__ import annotations

import json
from pathlib import Path

import pytest
import requests

from config.llm_request_config import LlmRequestConfig
from nlp.llm.llm_client import OpenAICompatChatClient


def _request_cfg() -> LlmRequestConfig:
    return LlmRequestConfig.from_values(
        max_tokens=128,
        temperature=0.0,
        top_p=None,
        top_k=None,
        repeat_penalty=None,
        seed=None,
        stop=None,
        response_format=None,
        stream=True,
    )


class _FakeStreamingResponse:
    def __init__(self, lines: list[bytes]) -> None:
        self._lines = lines
        self.encoding = "latin-1"

    def raise_for_status(self) -> None:
        return None

    def iter_lines(self, decode_unicode: bool = False):
        if decode_unicode:
            for line in self._lines:
                yield line.decode(self.encoding, errors="replace")
            return
        for line in self._lines:
            yield line

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_chat_stream_decodes_utf8_chunks_without_mojibake(monkeypatch) -> None:
    expected_text = "Hello! 😊 I’m your teacher."
    sse_lines = [
        f"data: {json.dumps({'choices': [{'delta': {'content': expected_text}}]})}\n".encode("utf-8"),
        b"data: [DONE]\n",
    ]
    fake_response = _FakeStreamingResponse(sse_lines)

    def fake_post(*args, **kwargs):  # noqa: ANN002, ANN003
        return fake_response

    monkeypatch.setattr(requests, "post", fake_post)

    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="qwen",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
    )

    response = client.aggregate_stream_events(client.chat_stream(system="sys", user="user"))

    assert response.content == expected_text
    assert "ð" not in response.content
    assert "â" not in response.content


def test_parse_json_schema_content_reports_finish_reason_and_length() -> None:
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="qwen",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
    )

    malformed = {
        "choices": [
            {
                "finish_reason": "length",
                "message": {"content": '{"verdict":"perfect","reason":"cut off'},
            }
        ]
    }

    with pytest.raises(RuntimeError) as exc_info:
        client._parse_json_schema_content(malformed)  # noqa: SLF001 - deliberate unit coverage

    text = str(exc_info.value)
    assert "finish_reason='length'" in text
    assert "content_len=" in text


def test_build_payload_sets_no_think_chat_template_kwargs_for_instruct_think() -> None:
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="gemma",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
    ).with_reasoning_mode("no_think")

    payload = client._build_payload(system="sys", user="user")  # noqa: SLF001 - deliberate unit coverage

    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["messages"][1]["content"] == "user /no_think"


def test_build_payload_uses_openai_style_messages() -> None:
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="qwen",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
    )

    payload = client._build_payload(system="sys", user="user")  # noqa: SLF001 - deliberate unit coverage

    assert payload["messages"] == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "user"},
    ]


def test_build_payload_uses_openai_style_messages_with_no_think() -> None:
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="gemma",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
    ).with_reasoning_mode("no_think")

    payload = client._build_payload(system="sys", user="user")  # noqa: SLF001 - deliberate unit coverage

    assert payload["chat_template_kwargs"] == {"enable_thinking": False}
    assert payload["messages"] == [
        {"role": "system", "content": "sys"},
        {"role": "user", "content": "user /no_think"},
    ]


def test_log_payload_writes_exact_payload_when_enabled(tmp_path: Path) -> None:
    log_path = tmp_path / "payloads.log"
    template_path = tmp_path / "chat_template.jinja"
    template_path.write_text(
        "{{ bos_token }}{% for message in messages %}<|turn>{{ message['role'] }}\n{{ message['content'] }}<turn|>\n{% endfor %}{% if add_generation_prompt %}<|turn>model\n{% endif %}",
        encoding="utf-8",
    )
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="gemma",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
        log_outbound_payload=True,
        chat_template_path=template_path,
        payload_log_path=log_path,
    ).with_reasoning_mode("no_think")

    payload = client._build_payload(system="sys", user="user")  # noqa: SLF001 - deliberate unit coverage
    client._log_payload(payload, request_kind="chat")  # noqa: SLF001 - deliberate unit coverage

    content = log_path.read_text(encoding="utf-8")
    assert "===== essaylens llm payload =====" in content
    assert "request_kind: chat" in content
    assert "reasoning_mode: no_think" in content
    assert json.dumps(payload, ensure_ascii=False, indent=2) in content
    assert "rendered_prompt_preview:" in content
    assert "<|turn>system\nsys<turn|>" in content
    assert "<|turn>user\nuser /no_think<turn|>" in content
    assert "<|turn>model" in content


def test_log_payload_is_silent_when_disabled(tmp_path: Path) -> None:
    log_path = tmp_path / "payloads.log"
    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="qwen",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
        log_outbound_payload=False,
        payload_log_path=log_path,
    )

    payload = client._build_payload(system="sys", user="user")  # noqa: SLF001 - deliberate unit coverage
    client._log_payload(payload, request_kind="chat")  # noqa: SLF001 - deliberate unit coverage

    assert not log_path.exists()


def test_chat_logs_payload_before_request_when_enabled(monkeypatch, tmp_path: Path) -> None:
    payload_holder: dict[str, object] = {}
    log_path = tmp_path / "payloads.log"
    template_path = tmp_path / "chat_template.jinja"
    template_path.write_text(
        "{% for message in messages %}[{{ message['role'] }}]{{ message['content'] }}{% endfor %}",
        encoding="utf-8",
    )

    class _FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, object]:
            return {
                "choices": [{"finish_reason": "stop", "message": {"content": "ok"}}],
                "model": "gemma",
            }

    def fake_post(*args, **kwargs):  # noqa: ANN002, ANN003
        payload_holder["payload"] = kwargs["json"]
        return _FakeResponse()

    monkeypatch.setattr(requests, "post", fake_post)

    client = OpenAICompatChatClient(
        server_url="http://127.0.0.1:8080/v1/chat/completions",
        model_name="gemma",
        model_family="instruct/think",
        request_cfg=_request_cfg(),
        log_outbound_payload=True,
        chat_template_path=template_path,
        payload_log_path=log_path,
    ).with_reasoning_mode("no_think")

    client.chat(system="sys", user="user")

    content = log_path.read_text(encoding="utf-8")
    assert "request_kind: chat" in content
    assert json.dumps(payload_holder["payload"], ensure_ascii=False, indent=2) in content
    assert "[system]sys[user]user /no_think" in content
