from __future__ import annotations

from typing import Any
from prompts.prompt_errors import PromptDevelopmentError

def extract_essay(payload: dict[str, Any]) -> str | None:
    essay = payload.get("essay")
    if isinstance(essay, str) and essay.strip():
        return essay.strip()
    return None

def extract_rubric_category(payload: dict[str, Any]) -> str:
    value = payload.get("rubricCategory")
    if not isinstance(value, str) or not value.strip():
        raise PromptDevelopmentError("payload.rubricCategory must be a non-empty string.")
    
def extract_rubric_entries(payload: dict[str, Any]) -> list[dict[str, Any]]:
    raw_entries = payload.get("rubricEntries")
    if not isinstance(raw_entries, list) or len(raw_entries) == 0:
        raise PromptDevelopmentError("payload.rubricEntries mus be a non-empty array")
    
    entries: list[dict[str, Any]] = []
    for item in raw_entries:
        if not isinstance(item, dict):
            raise PromptDevelopmentError("payload.rubricEntries items must be objects")
        score_value = item.get("scoreValue")
        description = item.get("description")
        if not isinstance(score_value, int):
            raise PromptDevelopmentError("payload.rurbricEntries.scoreValue must be an integer.")
        if not isinstance(description, str) or not description.strip():
            raise PromptDevelopmentError("payload.rubricEntries.desciption must be a non-empty string")
        entries.append({"scoreValue": score_value, "description": description.strip()})

    return entries