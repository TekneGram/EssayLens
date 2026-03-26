from __future__ import annotations
from dataclasses import dataclass
import sys
import subprocess
import time
from typing import TYPE_CHECKING
import requests

if TYPE_CHECKING:
    from config.llm_server_config import LlmServerConfig
    from config.llm_config import LlmConfig

@dataclass
class LlmServerProcess:
    server_cfg: LlmServerConfig
    llm_cfg: LlmConfig
    _proc: subprocess.Popen | None = None
    _flash_attn_value_supported: bool | None = None

    def _log(self, message: str) -> None:
        sys.stderr.write(f"[llm-server] {message}\n")
        sys.stderr.flush()

    def is_running(self) -> bool:
        return self._proc is not None and (self._proc.poll() is None)

    def _health_url(self) -> str:
        return f"http://{self.server_cfg.llm_host}:{self.server_cfg.llm_port}/health"

    def _is_server_ready(self, timeout_s: float = 1.0) -> bool:
        try:
            r = requests.get(self._health_url(), timeout=timeout_s)
            if r.status_code != 200:
                return False
            try:
                data = r.json()
            except Exception:
                return True
            if not isinstance(data, dict):
                return True
            status = data.get("status")
            return status in {"ok", None}
        except Exception:
            return False

    def _validate_paths(self) -> None:
        if not self.server_cfg.llm_server_path.exists():
            raise FileNotFoundError(f"Missing llama-server binary: {self.server_cfg.llm_server_path}")
        if not self.server_cfg.llm_server_path.is_file():
            raise FileNotFoundError(f"llm_server_path is not a file: {self.server_cfg.llm_server_path}")
        if self.llm_cfg.llm_gguf_path is None:
            raise FileNotFoundError("Missing GGUF model path (llm_gguf_path).")
        if not self.llm_cfg.llm_gguf_path.exists():
            raise FileNotFoundError(f"Missing GGUF model file: {self.llm_cfg.llm_gguf_path}")
        if not self.llm_cfg.llm_gguf_path.is_file():
            raise FileNotFoundError(f"llm_gguf_path is not a file: {self.llm_cfg.llm_gguf_path}")
        if self.llm_cfg.llm_mmproj_path is not None:
            if not self.llm_cfg.llm_mmproj_path.exists():
                raise FileNotFoundError(f"Missing mmproj file: {self.llm_cfg.llm_mmproj_path}")
            if not self.llm_cfg.llm_mmproj_path.is_file():
                raise FileNotFoundError(f"llm_mmproj_path is not a file: {self.llm_cfg.llm_mmproj_path}")

    def _read_exit_logs(self) -> str:
        if self._proc is None:
            return ""
        chunks: list[str] = []
        for stream in (self._proc.stderr, self._proc.stdout):
            if stream is None:
                continue
            try:
                content = stream.read()
                if content:
                    chunks.append(content)
            except Exception:
                continue
        joined = "".join(chunks).strip()
        if not joined:
            return "No process logs captured."
        return joined[-2000:]

    def _supports_flash_attn_value(self) -> bool:
        if self._flash_attn_value_supported is not None:
            return self._flash_attn_value_supported
        try:
            help_text = subprocess.check_output(
                [str(self.server_cfg.llm_server_path), "-h"],
                stderr=subprocess.STDOUT,
                text=True,
            )
            self._flash_attn_value_supported = "--flash-attn [on|off|auto]" in help_text
        except Exception:
            # Default to modern behavior when probing fails.
            self._flash_attn_value_supported = True
        return self._flash_attn_value_supported
    
    def ensure_running(self, wait_s: float = 180.0) -> None:
        if self._is_server_ready():
            return
        if self.is_running():
            self._wait_until_ready(wait_s)
            return

        self._validate_paths()

        cmd = [
            str(self.server_cfg.llm_server_path),
            "-m", str(self.llm_cfg.llm_gguf_path),
            "--host", str(self.server_cfg.llm_host),
            "--port", str(self.server_cfg.llm_port),
            "-c", str(self.server_cfg.llm_n_ctx),
        ]
        if self.llm_cfg.llm_mmproj_path is not None:
            cmd.extend(["--mmproj", str(self.llm_cfg.llm_mmproj_path)])
        if self.server_cfg.llm_n_threads is not None:
            cmd.extend(["-t", str(self.server_cfg.llm_n_threads)])
        if self.server_cfg.llm_n_gpu_layers is not None:
            cmd.extend(["-ngl", str(self.server_cfg.llm_n_gpu_layers)])
        if self.server_cfg.llm_n_batch is not None:
            cmd.extend(["-b", str(self.server_cfg.llm_n_batch)])
        if self.server_cfg.llm_n_parallel is not None:
            cmd.extend(["-np", str(self.server_cfg.llm_n_parallel)])
        if self.server_cfg.llm_seed is not None:
            cmd.extend(["--seed", str(self.server_cfg.llm_seed)])
        if self.server_cfg.llm_rope_freq_base is not None:
            cmd.extend(["--rope-freq-base", str(self.server_cfg.llm_rope_freq_base)])
        if self.server_cfg.llm_rope_freq_scale is not None:
            cmd.extend(["--rope-freq-scale", str(self.server_cfg.llm_rope_freq_scale)])
        cmd.append("--jinja" if self.server_cfg.llm_use_jinja else "--no-jinja")
        cmd.append("--cache-prompt" if self.server_cfg.llm_cache_prompt else "--no-cache-prompt")
        if self._supports_flash_attn_value():
            cmd.extend(["--flash-attn", "on" if self.server_cfg.llm_flash_attn else "off"])
        elif self.server_cfg.llm_flash_attn:
            cmd.append("--flash-attn")

        # Start server (persistent model load)
        self._proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        self._log(f"Started llama-server pid={self._proc.pid} on {self.server_cfg.llm_host}:{self.server_cfg.llm_port}")
        self._wait_until_ready(wait_s)

    def _wait_until_ready(self, wait_s: float) -> None:
        deadline = time.time() + wait_s
        while time.time() < deadline:
            if self._is_server_ready():
                return

            if self._proc.poll() is not None:
                error_log = self._read_exit_logs()
                raise RuntimeError(f"llama-server exited before ready. Logs: {error_log}")

            time.sleep(1.0)

        raise TimeoutError(
            f"Timed out waiting for llama-server startup at {self.server_cfg.llm_host}:{self.server_cfg.llm_port}."
        )

    def start(self, wait_s: float = 180.0) -> None:
        self.ensure_running(wait_s=wait_s)

    def stop(self) -> None:
        if not self.is_running():
            return
        assert self._proc is not None
        self._log(f"Stopping llama-server pid={self._proc.pid}")
        self._proc.terminate()
        try:
            self._proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            self._proc.kill()
        self._proc = None
        
        
