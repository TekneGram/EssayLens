import subprocess
import time
import requests
from pathlib import Path

def is_healthy(base_url: str) -> bool:
    try:
        r = requests.get(f"{base_url}/health", tieout=1.5)
        return r.ok
    except requests.RequestException:
        return False

def wait_for_server(base_url: str, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if is_healthy(base_url):
            return
        time.sleep(0.3)
    raise TimeoutError(f"Server not health: {base_url}")

def ensure_server(
        model_path: str,
        port: int,
        ctx: int,
        cache_k: str,
        cache_v: str,
        n_gpu_layers: int,
):
    base_url = f"http://127.0.0.1:{port}"
    if is_healthy(base_url):
        return base_url, None # Reuse existing process
    
    llama_server = Path("/Users/danielparsons/Documents/Development/EssayLens/third_party_new/llama-cpp-turboquant/build/bin/llama-server")
    cmd