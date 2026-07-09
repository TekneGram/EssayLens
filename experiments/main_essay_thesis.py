from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path
from types import SimpleNamespace

from essay_analysis_thesis import identify_paragraphs, determine_thesis_statement, thesis_statement_characteristics, thesis_statement_advice, thesis_statement_comment, thesis_statement_heap_praise

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
    parser.add_argument("--top_k", type=int, default=None)
    parser.add_argument("--top_p", type=float, default=None)
    parser.add_argument("--min_p", type=float, default=None)
    args = parser.parse_args()

    # File path to server
    llama_server = select_server_for_model(args.model)
    jinja = select_jinja(args.model)
    cmd_extra = []
    if args.model=="gemma":
        # Set thinking to 0 for gemma
        cmd_extra = ["--reasoning", "off", "--reasoning-budget", "0", "--jinja", "--chat-template-file", str(jinja)]
    
    # Will set the sampling_params to None if they are not defined
    # Downstream, the essay_analysis_ ... .py functions define the payload and only add these sampling
    # parameters if these values are not None.
    # If they are None, the server's default values are used.
    sampling_params = SimpleNamespace(
        top_k=args.top_k,
        top_p=args.top_p,
        min_p=args.min_p
    )

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
        writing_path = "experiments/essay_examples/w1_strong.md"
        
        identified_paragraphs = identify_paragraphs(writing_path, "experiments/tasks_thesis/essay_knowledge.md", "experiments/tasks_thesis/identify_paragraphs.md", base_url, args.max_tokens, args.temp, sampling_params)
        print(json.dumps(identified_paragraphs, indent=2))
        essay_paragraphs = identified_paragraphs["choices"][0]["message"]["content"]
        essay_paragraphs = json.loads(essay_paragraphs)
        
        # Introduction
        introduction = essay_paragraphs["introduction_paragraph"]

        # Body paragraphs
        body_paragraphs = essay_paragraphs["body_paragraphs"]["items"]

        # Conclusion paragraph
        conclusion = essay_paragraphs["conclusion_paragraph"]

        # Essay main idea
        full_essay = introduction
        for bp in body_paragraphs:
            full_essay = full_essay + "\n" +  bp["body_paragraph"]
        
        full_essay = full_essay + "\n" + conclusion

        thesis_statement_initial = determine_thesis_statement(full_essay, "experiments/tasks_thesis/essay_knowledge_determine_thesis.md", introduction, "experiments/tasks_thesis/essay_determine_thesis.md", base_url, args.max_tokens, args.temp, sampling_params)
        print(json.dumps(thesis_statement_initial, indent=2))
        thesis_statement_initial_result = thesis_statement_initial["choices"][0]["message"]["content"]
        thesis_statement_initial_result = json.loads(thesis_statement_initial_result)
        ts = thesis_statement_initial_result["thesis_statement"]

        ts_characteristics = thesis_statement_characteristics(full_essay, "experiments/tasks_thesis/essay_knowledge_determine_thesis.md", thesis_statement_initial_result["thesis_statement"], "experiments/tasks_thesis/essay_characterize_thesis.md", base_url, args.max_tokens, args.temp, sampling_params)
        print(json.dumps(ts_characteristics, indent=2))

        ts_characteristics = ts_characteristics["choices"][0]["message"]["content"]
        ts_characteristics = json.loads(ts_characteristics)

        no_characteristics_count = 0
        missing_features = []
        if ts_characteristics["main_idea"] == "no":
            no_characteristics_count = no_characteristics_count + 1
            missing_features.append("have a main idea")
        if ts_characteristics["clear_goal"] == "no":
            no_characteristics_count = no_characteristics_count + 1
            missing_features.append("have a clear goal")
        if ts_characteristics["preview_topics"] == "no":
            no_characteristics_count = no_characteristics_count + 1
            missing_features.append("preview topics")
        if ts_characteristics["writer_opinion"] == "no":
            no_characteristics_count = no_characteristics_count + 1
            missing_features.append("have the writer's opinion")

        print("Characteristics count is: " + str(no_characteristics_count))

        # When there are at least 3 missing characteristics from the identified thesis statement, then we should offer advice on improvement
        if no_characteristics_count >= 3:
            ts_advice = thesis_statement_advice(full_essay, "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md", ts, str(no_characteristics_count), "experiments/tasks_thesis/essay_thesis_statement_advice.md", base_url, args.max_tokens, args.temp, sampling_params)
            print(json.dumps(ts_advice, indent=2))

        # When there are 2 features the thesis statement is reasonable, and we can add a comment.
        if no_characteristics_count == 2:
            # Concatenate summary of missing features for LLM
            what_is_missing = "The writer's thesis statement appears to not "
            if len(missing_features) == 1:
                what_is_missing = what_is_missing + missing_features[0]
            else:
                what_is_missing = what_is_missing + ", ".join(missing_features[:-1]) + " or " + missing_features[-1]
            
            ts_comment = thesis_statement_comment(full_essay, "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md", ts, what_is_missing, "experiments/tasks_thesis/essay_thesis_statement_comment.md", base_url, args.max_tokens, args.temp, sampling_params)
            print(json.dumps(ts_comment, indent=2))

        # When there are no missing features or just 1 missing feature, then the thesis statement is excellent, and we can praise it.
        if no_characteristics_count == 1 or no_characteristics_count == 0:
            ts_praise = thesis_statement_heap_praise(full_essay, "experiments/tasks_thesis/essay_knowledge_thesis_characteristics.md", ts, "experiments/tasks_thesis/essay_thesis_statement_heap_praise.md", base_url, args.max_tokens, args.temp, sampling_params)
            print(json.dumps(ts_praise, indent=2))

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
# python experiments/main_essay_thesis.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --max-tokens 2048

# With Gemma 4
# python experiments/main_essay_thesis.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --temp 1.0 --top_p 0.95 --top_k 64 --cache-k turbo3 --cache-v turbo3 --max-tokens 2048
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/main_essay_thesis.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3
