from pathlib import Path
import requests

def judge_paragraph_details(
    paragraph,
    task_path,
    base_url,
    max_tokens,
    temperature 
):
    repo_root = Path(__file__).resolve().parents[1]
    task_path = repo_root / task_path
    task = task_path.read_text(encoding="utf-8")

    system_prompt = "Here is a paragraph: " + "\n" + paragraph
    user_prompt = task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": system_prompt },
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "judge_restate_thesis",
                "schema": {
                    "type": "object",
                    "properties": {
                        "verdict": {"type": "string", "enum": ["highly detailed", "reasonable", "sometimes off topic", "needs more detail"]},
                        "comments": { "type": "string" }
                    },
                    "required": ["verdict", "comments"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data