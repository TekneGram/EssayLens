from pathlib import Path
import requests

def get_thesis_statement_feedback(
        system_knowledge_path,
        essay_path,
        task_path,
        introduction,
        base_url,
        max_tokens,
        temperature
):
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    essay_path = repo_root / essay_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    essay = essay_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "\n Here is an essay: \n" + essay + "\n" + "The introduction is: \n" + introduction + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "identify_paragraphs",
                "schema": {
                    "type": "object",
                    "properties": {
                        "thesis_statement": {"type": "string"},
                        "verdict": { "type": "string" },
                        "improvements": { "type": "string" }
                    },
                    "required": ["thesis_statement", "verdict", "improvements"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data