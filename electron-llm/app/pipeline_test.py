from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = APP_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.runtime_lifecycle import RuntimeLifecycle
from main import _handle_request


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _base_settings() -> dict[str, object]:
    return {
        "llm_server_path": "/bin/echo",
        "llm_gguf_path": "/tmp/does-not-exist.gguf",
        "llm_mmproj_path": None,
        "llm_server_url": "http://127.0.0.1:8080/v1/chat/completions",
        "llm_host": "127.0.0.1",
        "llm_port": 8080,
        "llm_n_ctx": 1024,
        "llm_n_threads": 2,
        "llm_n_gpu_layers": 0,
        "llm_n_batch": 128,
        "llm_n_parallel": 1,
        "llm_seed": 42,
        "llm_rope_freq_base": None,
        "llm_rope_freq_scale": None,
        "llm_use_jinja": True,
        "llm_cache_prompt": True,
        "llm_flash_attn": False,
        "max_tokens": 64,
        "temperature": 0.0,
        "top_p": None,
        "top_k": None,
        "repeat_penalty": None,
        "request_seed": None,
        "use_fake_reply": False,
        "fake_reply_text": None,
    }


def run_smoke() -> None:
    lifecycle = RuntimeLifecycle()
    try:
        fake_req = {
            "requestId": "smoke-fake-1",
            "action": "llm.chat",
            "payload": {
                "message": "hello",
                "settings": {
                    "use_fake_reply": True,
                    "fake_reply_text": "Fake mode OK",
                },
            },
            "timestamp": _now_iso(),
        }
        fake_resp = _handle_request(fake_req, lifecycle)
        assert fake_resp["ok"] is True, json.dumps(fake_resp, ensure_ascii=False)
        assert fake_resp["data"]["reply"] == "Fake mode OK", json.dumps(fake_resp, ensure_ascii=False)

        real_req = {
            "requestId": "smoke-real-invalid-gguf-1",
            "action": "llm.chat",
            "payload": {
                "message": "hello",
                "settings": _base_settings(),
            },
            "timestamp": _now_iso(),
        }
        real_resp = _handle_request(real_req, lifecycle)
        assert real_resp["ok"] is False, json.dumps(real_resp, ensure_ascii=False)
        message = str(real_resp.get("error", {}).get("message", ""))
        assert "gguf" in message.lower() or "model" in message.lower(), json.dumps(real_resp, ensure_ascii=False)

        print("PASS fake mode response and invalid gguf failure smoke checks.")
    finally:
        lifecycle.shutdown()


if __name__ == "__main__":
    print(f"Running worker smoke checks from {PROJECT_ROOT}")
    run_smoke()
