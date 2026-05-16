from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path

import requests

def wait_for_server(base_url: str, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    health_url = f"{base_url}/health"
    while time.time() < deadline:
        try:
            r = requests.get(health_url, timeout=2)
            if r.ok:
                return
        except requests.RequestException:
            pass
        time.sleep(0.5)
    raise TimeoutError(f"Server did not become healthy in {timeout_s}s: {health_url}")

def get_prompts(system_prompt_path: str, user_prompt_path: str) -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[1]
    system_prompt_path = repo_root / system_prompt_path
    user_prompt_path = repo_root / user_prompt_path

    system_prompt = system_prompt_path.read_text(encoding="utf-8")
    user_content = user_prompt_path.read_text(encoding="utf-8")

    return (system_prompt, user_content)

def select_server_for_model(model: str) -> str:
    repo_root = Path(__file__).resolve().parents[1]
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"

def multiple_decision_maker(base_url, system_prompt, user_prompt):
    tools = [
        {
            "type": "function",
            "function": {
                "name": "route_paragraph_actions",
                "description": "Select all applicable improvement actions.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "actions": {
                            "type": "array",
                            "items": {
                                "type": "string",
                                "enum": [
                                    "improve_paragraph_with_examples",
                                    "combine_short_sentences",
                                    "improve_coherence"
                                ]
                            }
                        },
                        "reason": { "type": "string" }
                    },
                    "required": ["actions", "reason"],
                    "additionalProperties": "false"
                }
            }
        }
    ]
    payload = {
            "model": "local-gguf",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 512,
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False},
            "tools": tools,
            "tool_choice": "auto"
    }

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(json.dumps(data, indent=2))
    choice = data["choices"][0]["message"]
    tool_calls = choice.get("tool_calls", [])
    if not tool_calls:
        raise RuntimeError("Model did not return a function call.")
    
    call = tool_calls[0]
    fn_name= call["function"]["name"]
    fn_args = json.loads(call["function"]["arguments"])

    print("Chosen function:", fn_name)
    print("Arguments:", json.dumps(fn_args, indent=2))

def decision_maker(args, base_url, system_prompt, user_prompt):

    tools = [
        {
            "type": "function",
            "function": {
                "name": "improve_paragraph_with_examples",
                "description": "Revise paragraph by refocusing an example as the controlling idea.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": { "type": "string" }
                    },
                    "required": ["reason"],
                    "additionalProperties": False
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "improve_paragraph_topic_sentence",
                "description": "Revise paragraph by strengthening the controlling idea in the topic sentence.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "reason": { "type": "string" }
                    },
                    "required": ["reason"],
                    "additionalProperties": False
                },
            },
        }
    ]

    payload = {
            "model": "local-gguf",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": 512,
            "temperature": 0.2,
            "chat_template_kwargs": {"enable_thinking": False},
            "tools": tools,
            "tool_choice": "auto"
    }

    r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(json.dumps(data, indent=2))
    choice = data["choices"][0]["message"]
    tool_calls = choice.get("tool_calls", [])
    if not tool_calls:
        raise RuntimeError("Model did not return a function call.")
    
    call = tool_calls[0]
    fn_name= call["function"]["name"]
    fn_args = json.loads(call["function"]["arguments"])

    print("Chosen function:", fn_name)
    print("Arguments:", json.dumps(fn_args, indent=2))

def improve_paragraph_with_examples(args, base_url, system_prompt, user_prompt):
    print("TODO")

def improve_paragraph_topic_sentence(args, base_url, system_prompt, user_prompt):
    print("TODO")


def main() -> None:
    # Set up arguments for command line
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to GGUF model")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    args = parser.parse_args()

    # File path to server
    llama_server = select_server_for_model("gemma")
    # repo_root = Path(__file__).resolve().parents[1]
    # llama_server = repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"

    # Basic server settings
    cmd = [
        str(llama_server),
        "-m", str(Path(args.model).resolve()),
        "--port", str(args.port),
        "-c", str(args.ctx),
        "--cache-type-k", args.cache_k,
        "--cache-type-v", args.cache_v,
        "--flash-attn", "on",
        "--n-gpu-layers", str(args.n_gpu_layers),
    ]

    # Start the server
    print("Starting server:\n", " ".join(cmd))
    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"

    # Get system prompt and user prompt
    prompts = get_prompts("experiments/system_prompts/multiple_decision_maker.md", "experiments/writing_examples/w1.md")
    system_prompt = prompts[0]
    user_prompt = prompts[1]

    # Make the decision based on decision_maker.md
    # Call one of the functions improve_paragraph_with_examples OR improve_paragraph_topic_sentence

    # Run basic inference
    try:
        wait_for_server(base_url)
        multiple_decision_maker(base_url, system_prompt, user_prompt)

        # payload = {
        #     "model": "local-gguf",
        #     "messages": [
        #         {"role": "system", "content": system_prompt},
        #         {"role": "user", "content": user_prompt},
        #     ],
        #     "max_tokens": args.max_tokens,
        #     "temperature": args.temp,
        #     "chat_template_kwargs": {"enable_thinking": False}
        # }

        # r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
        # r.raise_for_status()
        # data = r.json()

        # print("\n=== Raw JSON ===")
        # print(json.dumps(data, indent=2))
        # print("\n=== Assistant ===")
        # print(data["choices"][0]["message"]["content"])

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

# main
if __name__ == "__main__":
    main()

# To run a quick experiment
# With gemma:
# - Change line 54 to llama_server = select_server_for_model("gemma")
# python experiments/main.py --model "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --cache-k="f16" --cache-v="f16"

# With ternary bonsai
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3