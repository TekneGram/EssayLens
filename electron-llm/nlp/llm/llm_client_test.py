from __future__ import annotations

import json

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
