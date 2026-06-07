# EssayLens

EssayLens is a desktop app for grading essays offline with LLM support for maximum student privacy.

The app has three main parts:

- `renderer/`: the React desktop UI
- `electron/`: the Electron backend, IPC layer, persistence, and runtime setup
- `electron-llm/`: the Python worker and local LLM/NLP code

## Python Worker Setup

Packaged builds expect a vendored Python worker binary under `vendor/python-worker/<platform>-<arch>/`.

For Apple Silicon macOS, the expected path is:

`vendor/python-worker/darwin-arm64/essaylens-llm-worker`

Create the worker bundle from the repo root with these commands:

```bash
python3 -m venv .venv-llm
source .venv-llm/bin/activate
python -m pip install -r electron-llm/requirements.txt pyinstaller
pyinstaller --onedir --name essaylens-llm-worker electron-llm/main.py
mkdir -p vendor/python-worker/darwin-arm64
rsync -a dist/essaylens-llm-worker/ vendor/python-worker/darwin-arm64/
chmod +x vendor/python-worker/darwin-arm64/essaylens-llm-worker
```

After those steps, `vendor/python-worker/darwin-arm64/` should contain:

- `essaylens-llm-worker`
- `_internal/`

Electron Builder copies `vendor/python-worker/**` into the packaged app resources, and the app launches the bundled worker from there.

## Llama Server Setup

Packaged builds and local dev mode expect a vendored `llama-server` bundle under `vendor/llama-server/<platform>-<arch>/`.

For Apple Silicon macOS, the expected path is:

`vendor/llama-server/darwin-arm64/llama-server`

Right now, EssayLens uses the TurboQuant fork of llama.cpp for the bundled server build. Clone the Gemma 4-capable checkout into `third_party_new/` from the repo root:

```bash
mkdir -p third_party_new
git clone https://github.com/TheTom/llama-cpp-turboquant.git third_party_new/llama-cpp-turboquant
```

Then build and vendor the macOS bundle with:

```bash
scripts/build_llama_server.sh --backend metal --clean
```

What the script does:

- configures and builds `llama-server` from the TurboQuant checkout
- installs it into a staging directory under `third_party_new/llama-cpp-turboquant/`
- rewrites macOS library paths so the binary is relocatable
- signs the staged binaries ad hoc so they can run locally after Mach-O fixups
- copies the final shippable `llama-server` bundle into `vendor/llama-server/darwin-arm64/`

After those steps, `vendor/llama-server/darwin-arm64/` should contain `llama-server` and the required `.dylib` files it loads at runtime.

This workflow is documented for macOS Apple Silicon only right now. The build script already has placeholders for Linux, Windows, and CUDA-oriented builds, but those paths still need validation and may change.

## Notes

- Run the commands above from the repository root.
- `.venv-llm/` is a build environment for packaging the Python worker.
- The `vendor/python-worker` directory is packaged with the app. It is not source code.
- The `vendor/llama-server` directory is packaged with the app. It is not source code.
