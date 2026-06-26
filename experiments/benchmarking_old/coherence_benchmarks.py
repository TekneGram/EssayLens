from pathlib import Path
import requests

def identify_signposts(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "identify_signpost",
                "schema": {
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "signpost": { "type": "string" },
                                },
                                "required": ["signpost"],
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

from pathlib import Path
import requests

def recommend_signposts(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommend_signposts",
                "schema": {
                    "type": "object",
                    "properties": {
                        "items": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "necessary_to_add": { "type": "string", "enum": ["yes", "no"]},
                                    "first_sentence": { "type": "string" },
                                    "second_sentence": { "type": "string" },
                                    "signpost": { "type": "string" },
                                },
                                "required": ["necessary_to_add", "first_sentence", "second_sentence", "signpost"],
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

def detect_transition(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommend_signposts",
                "schema": {
                    "type": "object",
                    "properties": {
                        "has_transition_sentence": { "type": "string", "enum": ["Yes", "No"] },
                        "detected_transition_sentence": { "type": "string" }
                    },
                    "required": ["has_transition_sentence", "detected_transition_sentence"],
                    "additionalProperties": False
                }
            }
        }
        
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def recommend_transition(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommend_signposts",
                "schema": {
                    "type": "object",
                    "properties": {
                        "recommended_transition_sentence": { "type": "string" },
                        "transition_sentence_placement": { "type": "string" }
                    },
                    "required": ["recommended_transition_sentence", "transition_sentence_placement"],
                    "additionalProperties": False
                }
            }
        }
        
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def detect_summary_noun(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommend_signposts",
                "schema": {
                    "type": "object",
                    "properties": {
                        "has_summary_noun_phrase": { "type": "string", "enum": ["Yes", "No"] },
                        "summary_noun_phrase": { "type": "string" },
                    },
                    "required": ["has_summary_noun_phrase", "summary_noun_phrase"],
                    "additionalProperties": False
                }
            }
        }
        
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def recommend_summary_noun(
        system_knowledge_path,
        paragraph_path,
        task_path,
        base_url,
        max_tokens,
        temperature
):
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

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    payload = {
        "model": "local-gguf",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "recommend_signposts",
                "schema": {
                    "type": "object",
                    "properties": {
                        "recommended_summary_noun_phrase": { "type": "string" },
                        "summary_noun_phrase_placement": { "type": "string" }
                    },
                    "required": ["recommended_summary_noun_phrase", "summary_noun_phrase_placement"],
                    "additionalProperties": False
                }
            }
        }
        
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data