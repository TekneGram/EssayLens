from __future__ import annotations

from typing import Any
from prompts.rubric_evaluations.extractions import extract_essay, extract_rubric_category, extract_rubric_entries
from prompts.prompt_errors import PromptDevelopmentError

def build_rubric_evaluation_prompt(payload: dict[str, Any]) -> tuple[str, str]:
    essay = extract_essay(payload)
    if not essay:
        raise PromptDevelopmentError("payload.essay must be a non-empty string")
    
    category = extract_rubric_category(payload)
    entries = extract_rubric_entries(payload)

    system_lines: list[str] = [f'Here is a rubric for the "{category}" category of the essay assessment.']
    for entry in entries:
        system_lines.append(f"## {entry['scoreValue']}")
        system_lines.append(str(entry["description"]))
    system_lines.append("Read the essay and determine which description best fits this category.")
    system_lines.append("Explain your decision briefly, citing the relevant rubric language.")
    system_lines.append("Your explanation should be directed to the student, using words such as 'you' and 'your'.")

    user_lines = [
        f"Rubric category: {category}",
        "---Essay Here---",
        essay
    ]

    return "\n".join(system_lines), "\n".join(user_lines)