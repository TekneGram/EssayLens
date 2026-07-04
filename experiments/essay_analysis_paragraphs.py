from pathlib import Path
import requests

def identify_paragraphs(
    essay_path,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params
):
    repo_root = Path(__file__).resolve().parents[1]
    essay_path = repo_root / essay_path
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    essay = essay_path.read_text(encoding="utf-8")
    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = "\n Here is an essay:" + essay + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You separate essays into individual paragraphs and the references section if there is one. Here is knowledge about essays: \n" + knowledge},
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
                        "introduction_paragraph": { "type": "string" },
                        "body_paragraphs": { 
                            "type": "object",
                            "properties": {
                                "items" : {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "body_paragraph": { "type": "string" }
                                        },
                                        "required": ["body_paragraph"],
                                        "additionalProperties": False
                                    },
                                },
                            },
                        },
                        "conclusion_paragraph": { "type": "string" },
                        "contains_references": { "type": "string", "enum": ["yes", "no"]},
                        "references_section": { "type": "string"}
                    },
                    "required": ["introduction_paragraph", "body_paragraphs", "conclusion_paragraph", "contains_references", "references_section"],
                    "additionalProperties": False
                }
            }
        }
    }
    if sampling_params.top_k is not None:
        payload["top_k"] = sampling_params.top_k
    if sampling_params.top_p is not None:
        payload["top_p"] = sampling_params.top_p
    if sampling_params.min_p is not None:
        payload["min_p"] = sampling_params.min_p

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def encourage_development(
    essay,
    body_paragraph,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You look for areas in the body paragraph of an essay that could be further developed using this knowledge: \n" + knowledge + "\n Here is the essay: \n" + essay + "\n Here is the body paragraph from the essay: \n" + body_paragraph},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "encourage_development",
                "schema": {
                    "type": "object",
                    "properties": {
                        "sentence": { "type": "string"},
                        "feedback": { "type": "string" },
                    },
                    "required": [ "sentence", "feedback" ],
                    "additionalProperties": False
                }
            }
        }
    }
    if sampling_params.top_k is not None:
        payload["top_k"] = sampling_params.top_k
    if sampling_params.top_p is not None:
        payload["top_p"] = sampling_params.top_p
    if sampling_params.min_p is not None:
        payload["min_p"] = sampling_params.min_p

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def anything_unclear(
    essay,
    body_paragraph,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You look for key points in the body paragraph that are not well explained and that could be further developed: \n" + knowledge + "\n Here is the essay: \n" + essay + "\n Here is the body paragraph you are examining: \n" + body_paragraph},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "encourage_development",
                "schema": {
                    "type": "object",
                    "properties": {
                        "all_clear": { "type": "string", "enum": ["yes", "no"]},
                        "sentence": { "type": "string"},
                        "feedback": { "type": "string" },
                    },
                    "required": [ "all_clear", "sentence", "feedback" ],
                    "additionalProperties": False
                }
            }
        }
    }
    if sampling_params.top_k is not None:
        payload["top_k"] = sampling_params.top_k
    if sampling_params.top_p is not None:
        payload["top_p"] = sampling_params.top_p
    if sampling_params.min_p is not None:
        payload["min_p"] = sampling_params.min_p
        
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data