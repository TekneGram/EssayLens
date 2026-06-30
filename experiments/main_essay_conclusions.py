from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path

from essay_analysis_conclusions import identify_paragraphs, analyze_conclusions, provide_conclusion_feedback

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

def get_prompts(system_prompt_knowledge_path: str, system_prompt_task_path: str, user_prompt_path: str) -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[1]
    system_prompt_task_path = repo_root / system_prompt_task_path
    system_prompt_knowledge_path = repo_root / system_prompt_knowledge_path
    user_prompt_path = repo_root / user_prompt_path

    system_prompt_knowledge = system_prompt_knowledge_path.read_text(encoding="utf-8")
    system_prompt_task = system_prompt_task_path.read_text(encoding="utf-8")
    system_prompt = system_prompt_knowledge + "\n" + system_prompt_task
    user_content = user_prompt_path.read_text(encoding="utf-8")

    return (system_prompt, user_content)

def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"
    
def select_jinja(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model =="gemma":
        return repo_root / "assets" / "models" / "gemma_4_chat_template.jinja"


def main() -> None:
    # Set up arguments for command line
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True, help="Path to GGUF model")
    parser.add_argument("--model", required=True, help="Name of model: bonsai, gemma", choices=["bonsai", "gemma"])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    args = parser.parse_args()

    # File path to server
    llama_server = select_server_for_model(args.model)
    jinja = select_jinja(args.model)
    cmd_extra = []
    if args.model=="gemma":
        # Set thinking to 0 for gemma
        cmd_extra = ["--reasoning", "off", "--reasoning-budget", "0", "--jinja", "--chat-template-file", str(jinja)]

    # Basic server settings
    cmd = [
        str(llama_server),
        "-m", str(Path(args.model_path).resolve()),
        "--port", str(args.port),
        "-c", str(args.ctx),
        "--cache-type-k", args.cache_k,
        "--cache-type-v", args.cache_v,
        "--flash-attn", "on",
        "--n-gpu-layers", str(args.n_gpu_layers),
    ]

    # Extra model-dependent flags
    cmd.extend(cmd_extra)
    print(cmd)


    # Start the server
    print("Starting server:\n", " ".join(cmd))
    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"

    try:
        wait_for_server(base_url)
        writing_path = "experiments/essay_examples/w1_weak.md"
        
        identified_paragraphs = identify_paragraphs(writing_path, "experiments/tasks_conclusions/essay_knowledge.md", "experiments/tasks_conclusions/identify_paragraphs_references.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(identified_paragraphs, indent=2))
        essay_paragraphs = identified_paragraphs["choices"][0]["message"]["content"]
        essay_paragraphs = json.loads(essay_paragraphs)
        
        # Introduction
        introduction = essay_paragraphs["introduction_paragraph"]

        # Body paragraphs
        body_paragraphs = essay_paragraphs["body_paragraphs"]["items"]

        # Conclusion paragraph
        conclusion = essay_paragraphs["conclusion_paragraph"]

        # References section
        references = essay_paragraphs["references_section"]
        has_references = essay_paragraphs["contains_references"]

        # Essay main idea
        full_essay = introduction
        for bp in body_paragraphs:
            full_essay = full_essay + "\n\n" +  bp["body_paragraph"]
        
        full_essay = full_essay + "\n\n" + conclusion
        full_essay_with_refs = full_essay + "\n\n" + references
        
        evaluation = analyze_conclusions(full_essay, conclusion, "experiments/tasks_conclusions/conclusions_knowledge.md", "experiments/tasks_conclusions/analyze_conclusion.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(evaluation))
        evaluation_content = evaluation["choices"][0]["message"]["content"]
        #evaluation_content = json.loads(evaluation_content)

        feedback = provide_conclusion_feedback(full_essay, conclusion, evaluation_content, "experiments/tasks_conclusions/conclusions_knowledge.md", "experiments/tasks_conclusions/conclusions_feedback.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(feedback))


        


    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()


# To run a quick experiment
# With Ternary Bonsai:
# python experiments/main_essay_conclusions.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --max-tokens 2048

# With Gemma 4
# python experiments/main_essay_conclusions.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --max-tokens 2048
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/main_essay_conclusions.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3
