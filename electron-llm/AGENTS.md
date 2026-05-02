Use `electron-llm/*` for the Python worker side of EssayLens.

Purpose
- Own Python-side orchestration, prompt composition, runtime startup, and local LLM/NLP execution support.
- Act as the native worker boundary that Electron reaches through the backend infrastructure layer.

Boundaries
- Electron owns IPC registration, persistence, and main-process orchestration.
- `electron-llm` owns Python execution-side workflows and JSON-line communication behavior.
- Worker entrypoints should keep transport output concerns in the worker entry module and keep request orchestration in controllers/pipelines.

Typical contents
- controllers
  - route and orchestrate worker actions
- app / pipeline modules
  - implement Python-side workflows and runtime assembly
- prompts
  - prompt building, extraction helpers, caches, and composition
- NLP / LLM task modules
  - local model and task-specific execution logic

Rules
- Keep the stdout protocol stable and machine-readable.
- Keep request orchestration separate from response serialization where practical.
- Do not import Electron TypeScript code here.
- Prefer clear boundaries between controller, prompt, runtime, and task logic.
- Cache/session behavior should be explicit and tested because it affects chat semantics.

Testing
- Put Python unit tests near the modules they verify.
- Test prompt composition, cache behavior, controller routing, and worker output contracts.
