from pathlib import Path
import requests

def identify_paragraphs(
    system_knowledge_path,
    essay_path,
    task_path,
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
    user_prompt = "\n Here is an essay:" + essay + "\n" + task

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
                        "conclusion_paragraph": { "type": "string" }
                    },
                    "required": ["introduction_paragraph", "body_paragraphs", "conclusion_paragraph"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

def essay_overall_idea(
    system_knowledge_path,
    essay,
    task_path,
    base_url,
    max_tokens,
    temperature
):
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "\n Here is an essay: \n" + essay + "\n" + task

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
                "name": "judge_body_development",
                "schema": {
                    "type": "object",
                    "properties": {
                        "main_idea": {"type": "string" }
                    },
                    "required": ["main_idea"],
                    "additionalProperties": False
                }
            }
        }
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data

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

def judge_develop_thesis(
    system_knowledge_path,
    introduction_paragraph,
    body_paragraph,
    main_idea,
    task_path,
    base_url,
    max_tokens,
    temperature      
):
    repo_root = Path(__file__).resolve().parents[1]
    system_knowledge_path = repo_root / system_knowledge_path
    task_path = repo_root / task_path

    knowledge = system_knowledge_path.read_text(encoding="utf-8")
    task = task_path.read_text(encoding="utf-8")
    system_prompt = knowledge
    user_prompt = "Here is an introduction to an essay:" + "\n" + introduction_paragraph + "\n" + "Here is the main idea of the essay:" + main_idea + "\n" + "Here is just one of the body paragraphs of the essay: \n" + body_paragraph + "\n" + task

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
                "name": "judge_body_development",
                "schema": {
                    "type": "object",
                    "properties": {
                        "verdict": {"type": "string", "enum": ["contributes to the main idea well", "contributes to the main idea a little", "seems a bit off the main idea"]},
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

def judge_restate_thesis(
    thesis_statement,
    conclusion_first_sentence,
    task_path,
    base_url,
    max_tokens,
    temperature 
):
    repo_root = Path(__file__).resolve().parents[1]
    task_path = repo_root / task_path
    task = task_path.read_text(encoding="utf-8")

    user_prompt = "Here is a restated thesis statement from the conclusion of an essay:" + conclusion_first_sentence + "\n" + "Here is the original thesis statement:" + thesis_statement + "\n" + task

    payload = {
        "model": "local-gguf",
        "messages": [
            {"role": "system", "content": "You are a paraphrase judge."},
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
                        "verdict": {"type": "string", "enum": ["strong paraphrase that includes other details from the essay", "strong paraphrase", "too similar, needs more paraphrasing", "unrelated to the original"]},
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

def judge_final_sentence(
    essay,
    final_sentence,
    task_path,
    base_url,
    max_tokens,
    temperature 
):
    repo_root = Path(__file__).resolve().parents[1]
    task_path = repo_root / task_path
    task = task_path.read_text(encoding="utf-8")

    system_prompt = "Here is an essay: " + "\n" + essay
    user_prompt = "Here is the final sentence of the whole essay in the conclusion:" + final_sentence + "\n" + task

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
                "name": "judge_restate_thesis",
                "schema": {
                    "type": "object",
                    "properties": {
                        "verdict": {"type": "string", "enum": ["hedges an idea", "is a call to action", "gives a confident suggestion", "ending could be better"]},
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

def judge_conclusion_summary(
    essay,
    task_path,
    base_url,
    max_tokens,
    temperature 
):
    repo_root = Path(__file__).resolve().parents[1]
    task_path = repo_root / task_path
    task = task_path.read_text(encoding="utf-8")

    system_prompt = "Here is an essay: " + "\n" + essay
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
                        "verdict": {"type": "string", "enum": ["summarizes key points effectively", "summary misses some points from the essay", "no clear summary present" ]},
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