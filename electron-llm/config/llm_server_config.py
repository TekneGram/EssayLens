from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class LlmServerConfig:
    llm_backend: str
    llm_server_path: Path
    llm_server_url: str
    llm_n_ctx: int
    llm_host: str
    llm_port: int
    llm_n_threads: int | None
    llm_n_gpu_layers: int | None
    llm_n_batch: int | None
    llm_n_parallel: int | None
    llm_seed: int | None
    llm_rope_freq_base: float | None
    llm_rope_freq_scale: float | None
    llm_use_jinja: bool
    llm_cache_prompt: bool
    llm_flash_attn: bool

    @staticmethod
    def from_strings(
        llm_backend: str,
        llm_server_path: str | Path,
        llm_server_url: str,
        llm_n_ctx: int,
        llm_host: str,
        llm_port: int,
        llm_n_threads: int | None,
        llm_n_gpu_layers: int | None,
        llm_n_batch: int | None,
        llm_n_parallel: int | None,
        llm_seed: int | None,
        llm_rope_freq_base: float | None,
        llm_rope_freq_scale: float | None,
        llm_use_jinja: bool,
        llm_cache_prompt: bool,
        llm_flash_attn: bool,
    ) -> "LlmServerConfig":
        return LlmServerConfig(
            llm_backend=llm_backend,
            llm_server_path=LlmServerConfig._norm(llm_server_path),
            llm_server_url=llm_server_url,
            llm_n_ctx=llm_n_ctx,
            llm_host=llm_host,
            llm_port=llm_port,
            llm_n_threads=llm_n_threads,
            llm_n_gpu_layers=llm_n_gpu_layers,
            llm_n_batch=llm_n_batch,
            llm_n_parallel=llm_n_parallel,
            llm_seed=llm_seed,
            llm_rope_freq_base=llm_rope_freq_base,
            llm_rope_freq_scale=llm_rope_freq_scale,
            llm_use_jinja=llm_use_jinja,
            llm_cache_prompt=llm_cache_prompt,
            llm_flash_attn=llm_flash_attn,
        )

    def validate(self) -> None:
        required_strings: list[tuple[str, str]] = [
            ("llm_backend", self.llm_backend),
            ("llm_server_url", self.llm_server_url),
            ("llm_host", self.llm_host),
        ]
        for field_name, value in required_strings:
            if not value or not value.strip():
                raise ValueError(f"{field_name} must be a non-empty string")

        if self.llm_backend != "server":
            raise ValueError(f"llm_backend must be 'server', got: {self.llm_backend}")

        if not self.llm_server_path.exists():
            raise ValueError(f"llm_server_path does not exist: {self.llm_server_path}")
        if not self.llm_server_path.is_file():
            raise ValueError(f"llm_server_path is not a file: {self.llm_server_path}")

        if self.llm_n_ctx <= 0:
            raise ValueError("llm_n_ctx must be > 0")

        if not (1 <= self.llm_port <= 65535):
            raise ValueError("llm_port must be between 1 and 65535")

        if self.llm_n_threads is not None and self.llm_n_threads <= 0:
            raise ValueError("llm_n_threads must be > 0 when provided")
        if self.llm_n_gpu_layers is not None and self.llm_n_gpu_layers < 0:
            raise ValueError("llm_n_gpu_layers must be >= 0 when provided")
        if self.llm_n_batch is not None and self.llm_n_batch <= 0:
            raise ValueError("llm_n_batch must be > 0 when provided")
        if self.llm_n_parallel is not None and self.llm_n_parallel <= 0:
            raise ValueError("llm_n_parallel must be > 0 when provided")
        if self.llm_rope_freq_base is not None and self.llm_rope_freq_base <= 0:
            raise ValueError("llm_rope_freq_base must be > 0 when provided")
        if self.llm_rope_freq_scale is not None and self.llm_rope_freq_scale <= 0:
            raise ValueError("llm_rope_freq_scale must be > 0 when provided")

    @staticmethod
    def _norm(p: str | Path) -> Path:
        return Path(p).expanduser().resolve()
