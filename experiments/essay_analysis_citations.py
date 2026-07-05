from pathlib import Path
import requests

def identify_paragraphs(
    essay_path,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params,
    request_timeout=120,
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

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=request_timeout)
    r.raise_for_status()
    data = r.json()
    return data

def identify_citations(
    essay,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params,
    request_timeout=120,
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = "\n Here is an essay:" + essay + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You check to see if the essay contains in-text citations: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "identify_sentences_with_citations",
                "schema": {
                    "type": "object",
                    "properties": {
                        "has_citations": { "type": "string", "enum": ["yes", "no"]},
                        "sentences": { 
                            "type": "object",
                            "properties": {
                                "items" : {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sentence": { "type": "string" }
                                        },
                                        "required": ["sentence"],
                                        "additionalProperties": False
                                    },
                                },
                            },
                        },
                    },
                    "required": ["has_citations", "sentences"],
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

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=request_timeout)
    r.raise_for_status()
    data = r.json()
    return data

def check_references_no_citation(
    essay,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params,
    request_timeout=120,
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = "\n Here is an essay:" + essay + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You find references after an essay that have no citations in the essay: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "reference_has_no_citation",
                "schema": {
                    "type": "object",
                    "properties": {
                        "reference_has_no_citation": {
                            "type": "object",
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "reference": {"type": "string"},
                                            "missing_citation": {
                                                "type": "string",
                                                "enum": [
                                                    "This reference has no in-text citation; either remove the reference or add the relevant in-text citation."
                                                ]
                                            }
                                        },
                                        "required": [
                                            "reference",
                                            "missing_citation"
                                        ],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": ["items"],
                            "additionalProperties": False
                        }
                    },
                    "required": [
                        "reference_has_no_citation"
                    ],
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

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=request_timeout)
    r.raise_for_status()
    data = r.json()
    return data

def check_citation_no_reference(
    essay,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature,
    sampling_params,
    request_timeout=120,
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = "\n Here is an essay:" + essay + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You find citations in the essay that have no references after the essay: \n" + knowledge},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "find_citations_with_no_references",
                "schema": {
                    "type": "object",
                    "properties": {
                        "citation_has_no_reference": {
                            "type": "object",
                            "properties": {
                                "items": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "sentence_with_citation": {"type": "string"},
                                            "missing_reference": {
                                                "type": "string",
                                                "enum": ["Reference missing for this citation"]
                                            }
                                        },
                                        "required": [
                                            "sentence_with_citation",
                                            "missing_reference"
                                        ],
                                        "additionalProperties": False
                                    }
                                }
                            },
                            "required": ["items"],
                            "additionalProperties": False
                        },
                    },
                    "required": [
                        "citation_has_no_reference"
                    ],
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
        
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=request_timeout)
    r.raise_for_status()
    data = r.json()
    return data
