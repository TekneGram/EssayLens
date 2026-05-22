from pathlib import Path
import requests

def topic_sentence_identifier(
        system_knowledge_path, 
        paragraph_path, 
        task_path, 
        base_url, 
        max_tokens, 
        temperature):
    
    # Get prompts and concatenate
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
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False}
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def topic_sentence_controlling_idea(
        system_knowledge_path, 
        topic_sentence,
        task_path, 
        base_url, 
        max_tokens, 
        temperature
):
    # Get prompts and concatenate
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "\n Here is a topic sentence: \n" + topic_sentence + "\n" + task
    
    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False}
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data


def topic_sentence_judgement(
        system_knowledge_path, 
        paragraph_path, 
        task_path,
        topic_sentence,
        controlling_idea, 
        base_url, 
        max_tokens, 
        temperature):
    
    # Get prompts and concatenate
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    paragraph_path = repo_root / paragraph_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    paragraph = paragraph_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "\n Here is a paragraph: \n" + paragraph + "\n Here is a topic sentence in the paragraph: \n" + topic_sentence + "\n Here is the controlling idea in the topic sentence: \n" + controlling_idea + "\n" + task
    
    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": { 
            "type": "json_schema",
            "json_schema": {
                "name": "topic_sentence_judgement",
                "schema": {
                    "type": "object",
                    "properties": {
                        "verdict": { "type": "string", "enum": ["too general", "too specific", "perfect"]},
                        "reason": { "type": "string" },
                        "revision_suggestion": { "type": "string"}
                    },
                    "required": ["verdict", "reason", "revision_suggestion"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data