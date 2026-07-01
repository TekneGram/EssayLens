from pathlib import Path
import requests

def identify_paragraphs(
    essay_path,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature
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
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def analyze_conclusions(
    essay,
    conclusion,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature
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
            {"role": "system", "content": "You analyze how well the conclusion has been written using the following knowledge: \n" + knowledge + "\n Here is the essay: \n" + essay + "\n Here is the conclusion that you will analyze: \n" + conclusion},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "conclusion_analysis",
                "schema": {
                    "type": "object",
                    "properties": {
                        "restate_main_idea": { "type": "string", "enum": ["yes", "no"] },
                        "main_idea": { "type": "string" },
                        "sufficient_summary": { "type": "string", "enum": ["yes", "no"] },
                        "summary": { "type": "string" },
                        "strong_final_comment": { "type": "string", "enum": ["yes", "no"] },
                        "final_comment": { "type": "string" }
                    },
                    "required": [ "restate_main_idea", "main_idea", "sufficient_summary", "summary", "strong_final_comment", "final_comment" ],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def provide_conclusion_feedback(
    essay,
    conclusion,
    evaluation,
    knowledge_path,
    task_path,
    base_url,
    max_tokens,
    temperature
):
    repo_root = Path(__file__).resolve().parents[1]
    knowledge_path = repo_root / knowledge_path
    task_path = repo_root / task_path

    knowledge = knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    user_prompt = "Here is the evaluation of the student's conclusion" + "\n" + evaluation + "\n" + "Here is your task:" + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You provide feedback using the following knowledge: \n" + knowledge + "\n Here is the essay: \n" + essay + "\n Here is the conclusion that has already been evaluated: \n" + conclusion},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "introduction_feedback",
                "schema": {
                    "type": "object",
                    "properties": {
                        "feedback": { "type": "string" }
                    },
                    "required": [ "feedback" ],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data