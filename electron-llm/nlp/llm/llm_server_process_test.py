from __future__ import annotations

from pathlib import Path

from config.llm_config import LlmConfig
from config.llm_server_config import LlmServerConfig
from nlp.llm.llm_server_process import LlmServerProcess


class _FakeProc:
    def __init__(self) -> None:
        self.pid = 1234
        self.stdout = None
        self.stderr = None

    def poll(self):  # noqa: ANN001
        return None


def _build_server_cfg(tmp_path: Path, *, llm_use_jinja: bool, llm_chat_template_path: Path | None) -> LlmServerConfig:
    server_path = tmp_path / "llama-server"
    server_path.write_text("", encoding="utf-8")
    return LlmServerConfig.from_strings(
        llm_backend="server",
        llm_server_path=server_path,
        llm_server_url="http://127.0.0.1:8080/v1/chat/completions",
        llm_n_ctx=1024,
        llm_host="127.0.0.1",
        llm_port=8080,
        llm_n_threads=None,
        llm_n_gpu_layers=None,
        llm_n_batch=None,
        llm_n_parallel=None,
        llm_seed=None,
        llm_rope_freq_base=None,
        llm_rope_freq_scale=None,
        llm_chat_template_path=llm_chat_template_path,
        llm_use_jinja=llm_use_jinja,
        llm_cache_prompt=True,
        llm_flash_attn=False,
    )


def _build_llm_cfg(tmp_path: Path) -> LlmConfig:
    gguf_path = tmp_path / "model.gguf"
    gguf_path.write_text("", encoding="utf-8")
    return LlmConfig.from_string(llm_gguf_path=gguf_path, llm_mmproj_path=None)


def test_ensure_running_adds_chat_template_file_when_configured(monkeypatch, tmp_path: Path) -> None:
    template_path = tmp_path / "gemma_4_chat_template.jinja"
    template_path.write_text("template", encoding="utf-8")
    captured_cmd: list[str] = []

    def fake_popen(cmd, **kwargs):  # noqa: ANN001, ANN003
        captured_cmd.extend(cmd)
        return _FakeProc()

    monkeypatch.setattr("subprocess.Popen", fake_popen)

    process = LlmServerProcess(
        server_cfg=_build_server_cfg(tmp_path, llm_use_jinja=True, llm_chat_template_path=template_path),
        llm_cfg=_build_llm_cfg(tmp_path),
    )
    monkeypatch.setattr(process, "_supports_flash_attn_value", lambda: True)
    monkeypatch.setattr(process, "_is_server_ready", lambda timeout_s=1.0: False)
    monkeypatch.setattr(process, "_wait_until_ready", lambda wait_s: None)

    process.ensure_running()

    assert "--jinja" in captured_cmd
    assert "--chat-template-file" in captured_cmd
    assert str(template_path) in captured_cmd


def test_ensure_running_keeps_default_jinja_behavior_without_template(monkeypatch, tmp_path: Path) -> None:
    captured_cmd: list[str] = []

    def fake_popen(cmd, **kwargs):  # noqa: ANN001, ANN003
        captured_cmd.extend(cmd)
        return _FakeProc()

    monkeypatch.setattr("subprocess.Popen", fake_popen)

    process = LlmServerProcess(
        server_cfg=_build_server_cfg(tmp_path, llm_use_jinja=True, llm_chat_template_path=None),
        llm_cfg=_build_llm_cfg(tmp_path),
    )
    monkeypatch.setattr(process, "_supports_flash_attn_value", lambda: True)
    monkeypatch.setattr(process, "_is_server_ready", lambda timeout_s=1.0: False)
    monkeypatch.setattr(process, "_wait_until_ready", lambda wait_s: None)

    process.ensure_running()

    assert "--jinja" in captured_cmd
    assert "--chat-template-file" not in captured_cmd
