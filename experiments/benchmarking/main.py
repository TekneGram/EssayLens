from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path

from topic_sentences_benchmarks import identify_topic_sentence



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


def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    print(repo_root)
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"
    
def select_jinja(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
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
        repo_root = Path(__file__).resolve().parents[1]
        writing_dir = repo_root / "benchmarking/questions/A1"

        # Topic sentence benchmarking: iterate files in the directory
        for writing_file in sorted(writing_dir.iterdir()):
            if not writing_file.is_file():
                continue
            
            identify_topic_sentences_with_knowledge = identify_topic_sentence(
                "benchmarking/system_prompts/paragraph_knowledge.md",
                writing_file,
                "benchmarking/system_prompts/A1_ts.md",
                base_url,
                args.max_tokens,
                args.temp,
            )

            print(f"--- {writing_file.name} ---")
            print(json.dumps(identify_topic_sentences_with_knowledge, indent=2))

            identify_topic_sentences_without_knowledge = identify_topic_sentence(
                "benchmarking/system_prompts/paragraph_no_knowledge.md",
                writing_file,
                "benchmarking/system_prompts/A1_ts.md",
                base_url,
                args.max_tokens,
                args.temp,
            )

            print(f"--- {writing_file.name} ---")
            print(json.dumps(identify_topic_sentences_without_knowledge, indent=2))

            # TO DO
            # Write the results to a CSV file as follows
            # Paragraph --- Enhanced Knowledge --- LLM --- Task --- Answer --- Judgement

        # # Formatting
        # formatting = determine_paragraph_breaks("experiments/system_prompts_v2/paragraph_knowledge.md", writing_path, "experiments/system_prompts_v2/formatting_line_break.md", base_url, args.max_tokens, args.temp)
        # print(json.dumps(formatting, indent=2))

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
# With Ternary Bonsai:
# - Change line 54 to llama_server = select_server_for_model("gemma")
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16"

# With Gemma 4
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-12b-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/benchmarking/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3