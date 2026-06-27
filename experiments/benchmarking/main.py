from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path
import re

import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
EXPERIMENTS_DIR = CURRENT_DIR.parent
REPO_ROOT = CURRENT_DIR.parent.parent

sys.path.insert(0, str(CURRENT_DIR))
sys.path.insert(0, str(EXPERIMENTS_DIR))

from run_benchmarks import run_identify_essay_benchmark

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
    parser.add_argument("--max_tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    parser.add_argument("--csv_file_append", required=True, help="Add a csv file identifier for the benchmark, usually the name of the language model being used")
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
        # Look through essays and run benchmarks on each essay
        folder = Path("experiments/generated_essays")

        for md_file in folder.rglob("*.md"):
            filename = md_file.name

            match = re.search(r"essay_(\d+)_", filename)

            if match:
                essay_id = match.group(1)
            else:
                raise ValueError(f"Could not extract essay ID from filename: {filename}")
            try:
                essay = md_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                essay = md_file.read_text(encoding="utf-8", errors="replace")
            
            full_essay, full_essay_with_references, has_references = run_identify_essay_benchmark(essay, essay_id, base_url, args.max_tokens, args.temp, args.csv_file_append)
            print(full_essay)
            print(full_essay_with_references)
            print(has_references)

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
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --max_tokens 2048 --csv_file_append="gemma_e4b"

# With Gemma 4
# python experiments/benchmarking/main.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --max_tokens 2048 --csv_file_append="bonsai-8b"
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/benchmarking/main.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3