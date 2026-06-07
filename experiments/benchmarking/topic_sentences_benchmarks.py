from pathlib import Path
import requests

def identify_topic_sentence(
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
        "max_tokens": 128,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False}
    }
    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    return data
