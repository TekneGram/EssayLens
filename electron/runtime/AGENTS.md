Use `electron/runtime/*` for runtime configuration, environment-aware paths, storage policy, and runtime readiness helpers.

Purpose
- Centralize dev vs packaged path logic.
- Centralize writable vs bundled read-only path decisions.
- Keep runtime readiness and repair logic out of feature services.

Typical contents
- path resolution helpers
- storage/bootstrap setup
- LLM runtime readiness and recovery helpers
- low-level filesystem/runtime probes used by readiness checks

Rules
- Services should ask runtime helpers for paths and readiness state instead of constructing them manually.
- Do not put feature orchestration here.
- Do not put SQL or repository logic here.
- Do not put IPC registration here.
- Do not call Electron UI APIs here.
- Treat this folder as the source of truth for runtime/filesystem policy.

Use this layer when
- a service needs an environment-aware filesystem path
- startup must ensure runtime storage exists
- the app must distinguish writable generated state from bundled read-only resources
- runtime configuration needs readiness validation or safe repair

Testing
- Write tests here for path resolution, bootstrap behavior, and readiness/recovery logic.
- Mock filesystem and environment state when needed.
