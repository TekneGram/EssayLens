from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

@dataclass(frozen=True, slots=True)
class LlmConfig:
    llm_gguf_path: Path | None = None
    llm_mmproj_path: Path | None = None

    @staticmethod
    def from_string(
        llm_gguf_path: str | Path | None = None,
        llm_mmproj_path: str | Path | None = None,
    ) -> "LlmConfig":
        return LlmConfig(
            llm_gguf_path=LlmConfig._norm_optional_path(llm_gguf_path),
            llm_mmproj_path=LlmConfig._norm_optional_path(llm_mmproj_path)
        )
    
    def validate(self) -> None:
        if self.llm_gguf_path is not None:
            if not self.llm_gguf_path.exists():
                raise ValueError(f"llm_gguf path does not exist: {self.llm_gguf_path}")
            if not self.llm_gguf_path.is_file():
                raise ValueError(f"llm_gguf_path is not a file: {self.llm_gguf_path}")
            
        if self.llm_mmproj_path is not None:
            if not self.llm_mmproj_path.exists():
                raise ValueError(f"llm_mmproj path does not exist: {self.llm_mmproj_path}")
            if not self.llm_mmproj_path.is_file():
                raise ValueError(f"llm_mmproj_path is not a file: {self.llm_mmproj_path}")
            
    @staticmethod
    def _norm_optional_path(p: str | Path | None) -> Path | None:
        if p is None:
            return None
        if isinstance(p, str) and not p.strip():
            return None
        return Path(p).expanduser().resolve()

    @staticmethod
    def _norm_optional_text(value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            return None
        return value