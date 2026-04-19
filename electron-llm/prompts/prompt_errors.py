from __future__ import annotations
from typing import Any

class PromptDevelopmentError(Exception):
    def __init__(self, message: str, *, code: str = "PY_ACTION_FAILED", details: Any = None):
        super().__init__(message)
        self.code = code
        self.details = details