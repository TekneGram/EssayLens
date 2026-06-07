from pathlib import Path
import requests

def improve_simple_vocabulary(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    paragraph_path = repo_root / paragraph_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    paragraph = paragraph_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "\n Here is a paragraph: \n" + paragraph + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages":[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "improve_simple_vocabulary",
                "schema": {
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "simple_vocabulary": { "type": "string" },
                                    "text_context": { "type": "string" },
                                    "precise_vocabulary": { "type": "string" },
                                },
                                "required": ["quoted_vocabulary", "full_sentence", "suggested_change"],
                                "additionalProperties": False
                            },
                        }
                    },
                    "required": ["items"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data