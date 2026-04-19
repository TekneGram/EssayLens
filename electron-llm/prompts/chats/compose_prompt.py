

def compose_prompt(message: str, context_text: str | None, session_turns: list[dict[str, str]]) -> str:
    blocks: list[str] = []
    if context_text:
        blocks.append("Context:\n" + context_text)
    if session_turns:
        history_lines: list[str] = []
        for turn in session_turns:
            role = turn.get("role")
            content = turn.get("content")
            if role not in {"teacher", "assistant", "system"} or not isinstance(content, str):
                continue
            if role == "teacher":
                prefix = "Teacher"
            elif role == "assistant":
                prefix = "Assistant"
            else:
                prefix = "System"
            history_lines.append(f"{prefix}: {content}")
        if history_lines:
            blocks.append("Conversation History:\n" + "\n".join(history_lines))
    blocks.append("Teacher:\n" + message)
    return "\n\n".join(blocks)