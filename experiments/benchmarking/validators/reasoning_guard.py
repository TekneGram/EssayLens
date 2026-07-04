REASONING_MARKERS = (
    "**Reasoning:**",
    "Reasoning:",
    "<think>",
    "</think>",
)


def normalize_and_reject_reasoning(value: str, field_name: str) -> str:
    normalized = value.strip()

    for marker in REASONING_MARKERS:
        if marker in normalized:
            raise ValueError(f"{field_name} contains reasoning output.")

    return normalized
