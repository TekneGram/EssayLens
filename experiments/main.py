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

def main() -> None:
    # Set up arguments for command line
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True, help="Path to GGUF model")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f16", "q8_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f16", "q8_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=128)
    parser.add_argument("--temp", type=float, default=0.7)
    args = parser.parse_args()

    # File path to server
    repo_root = Path(__file__).resolve().parents[1]
    llama_server = repo_root / "third_party" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"

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

    try:
        wait_for_server(base_url)

        payload = {
            "model": "local-gguf",
            "messages": [
                {"role": "system", "content": "You are concise"},
                {"role": "user", "content": "Explain turboquant in 3 bullet points."},
            ],
            "max_tokens": args.max_tokens,
            "temperature": args.temp
        }

        r = requests.post(f"{base_url}/v1/chat/completions", json=payload, timeout=120)
        r.riase_for_status()
        data = r.json()

        print("\n=== Raw JSON ===")
        print(json.dumps(data, indent=2))
        print("\n=== Assistant ===")
        print(data["choices"][0]["message"]["content"])

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()