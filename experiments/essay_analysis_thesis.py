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

def determine_thesis_statement(
    essay,
    knowledge_path,
    introduction,
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
    user_prompt = "\n Here is your knowledge about essays:" + knowledge + "\n" + "Here is the introduction again:" + introduction + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You analyze the following essay: \n" + essay},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "determine_thesis_statement",
                "schema": {
                    "type": "object",
                    "properties": {
                        "has_thesis_statement": { "type": "string", "enum": ["yes", "no clear statement"] },
                        "thesis_statement": { "type": "string" }
                    },
                    "required": ["has_thesis_statement", "thesis_statement"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def thesis_statement_characteristics(
    essay,
    knowledge_path,
    thesis_statement,
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
    user_prompt = "\n Here is your knowledge about essays:" + knowledge + "\n" + "Here is the thesis statement from the introduction: " + thesis_statement + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You analyze the following essay: \n" + essay},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "thesis_statement_characteristics",
                "schema": {
                    "type": "object",
                    "properties": {
                        "main_idea": { "type": "string", "enum": ["yes", "no"] },
                        "clear_goal": { "type": "string", "enum": ["yes", "no"] },
                        "preview_topics": { "type": "string", "enum": ["yes", "no"] },
                        "writer_opinion": { "type": "string", "enum": ["yes", "no"] }
                    },
                    "required": ["main_idea", "clear_goal", "preview_topics", "writer_opinion"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def thesis_statement_advice(
    essay,
    knowledge_path,
    thesis_statement,
    feature_count,
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
    user_prompt = "\n Here is your knowledge about thesis statements in essays:" + knowledge + "\n" + "The writer wrote this thesis statement: " + thesis_statement + "\n" + "The writer originally used " + feature_count + " features of a thesis statement in their introduction." + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You give advice on the thesis statement for the following essay: \n" + essay},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "thesis_statement_advice",
                "schema": {
                    "type": "object",
                    "properties": {
                        "praise_advice": { "type": "string", "enum": ["Your thesis statement is good so far, but it can be improved as follows:", "Your introduction is coming along nicely, but you need to work on your thesis statement. Try this:"] },
                        "example_thesis": { "type": "string" },
                        "explain_example": { "type": "string" },
                    },
                    "required": ["praise_advice", "example_thesis", "explain_example"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def thesis_statement_comment(
    essay,
    knowledge_path,
    thesis_statement,
    what_is_missing,
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
    user_prompt = "\n Here is your knowledge about thesis statements in essays:" + knowledge + "\n" + "The writer wrote this thesis statement: " + thesis_statement + "\n" + "The writer's thesis statement has missing features as follows:" + what_is_missing + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You make comments on the thesis statement for the following essay: \n" + essay},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "thesis_statement_comments",
                "schema": {
                    "type": "object",
                    "properties": {
                        "praise": { "type": "string", "enum": ["Your thesis statement is very nicely written.", "Well done on your thesis statement.", "Excellent work on your thesis statement."] },
                        "comment": { "type": "string" },
                        "advice": { "type": "string" },
                    },
                    "required": ["praise", "comment", "advice"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def thesis_statement_heap_praise(
    essay,
    knowledge_path,
    thesis_statement,
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
    user_prompt = "\n Here is your knowledge about thesis statements in essays:" + knowledge + "The writer wrote this thesis statement: " + thesis_statement + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You offer praise on the thesis statement for the following essay: \n" + essay},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": { "enable_thinking": False },
        "response_format": {
            "type": "json_schema",
            "json_schema": {
                "name": "thesis_statement_comments",
                "schema": {
                    "type": "object",
                    "properties": {
                        "praise": { "type": "string", "enum": ["A very impressive thesis statement.", "Outstanding thesis statement.", "Great work on your amazing thesis statement."] },
                        "comment": { "type": "string" },
                    },
                    "required": ["praise", "comment"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data