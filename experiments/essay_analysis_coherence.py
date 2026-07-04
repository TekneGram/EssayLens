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

def analyze_topic_sentence_coherence(
    paragraph,
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
    user_prompt = "\n Here is a body paragraph: " + paragraph + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You analyze the coherence in the paragraph using the following knowledge about coherence: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "identify_coherence_with_topic_sentence",
                "schema": {
                    "type": "object",
                    "properties": {
                        "sentences": { 
                            "type": "object",
                            "properties": {
                                "items" : {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sentence": { "type": "string" },
                                            "behavior": { "type": "string", "enum": ["topic sentence", "elaborates an earlier sentence", "introduces a new idea"]},
                                            "comment": { "type": "string" }
                                        },
                                        "required": ["sentence", "behavior", "comment"],
                                        "additionalProperties": False
                                    },
                                },
                            },
                        },
                    },
                    "required": ["sentences"],
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

def analyze_linguistic_coherence(
    paragraph,
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
    user_prompt = "\n Here is a body paragraph: " + paragraph + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You analyze the linguistic coherence in the paragraph using the following knowledge about coherence: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "identify_linguistic_coherence",
                "schema": {
                    "type": "object",
                    "properties": {
                        "sentences": { 
                            "type": "object",
                            "properties": {
                                "items" : {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sentence": { "type": "string" },
                                            "coherence": { "type": "string", "enum": ["satisfactory", "add a contrast", "add an addition connector", "show cause and effect", "show reason", "use elaboration words"]},
                                            "comment": { "type": "string" }
                                        },
                                        "required": ["sentence", "coherence", "comment"],
                                        "additionalProperties": False
                                    },
                                },
                            },
                        },
                    },
                    "required": ["sentences"],
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

def analyze_pronouns(
    paragraph,
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
    user_prompt = "\n Here is a body paragraph: " + paragraph + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You analyze the use of pronouns in a paragraph using the following knowledge: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "analyze_pronoun_usage",
                "schema": {
                    "type": "object",
                    "properties": {
                        "sentences": { 
                            "type": "object",
                            "properties": {
                                "items" : {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sentence": { "type": "string" },
                                            "pronoun_issue": { "type": "string" },
                                            "recommendation": { "type": "string" }
                                        },
                                        "required": ["sentence", "pronoun_issue", "recommendation"],
                                        "additionalProperties": False
                                    },
                                },
                            },
                        },
                    },
                    "required": ["sentences"],
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