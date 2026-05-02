Use `electron/core/*` for shared backend-core primitives.

Purpose
- Define shared backend error/result types and helpers.
- Define request-scoped context and other small reusable primitives.
- Give IPC, services, runtime, and infrastructure a common backend language.

Typical contents
- `AppError`, `AppException`, `AppResult`
- request context and correlation metadata
- small generic helpers reused across backend domains

Rules
- Keep this folder small, generic, and framework-light.
- Do not put feature-specific orchestration here.
- Do not put IPC registration here.
- Do not put SQL or repository logic here.
- Do not put Electron or child-process platform API code here.
- Prefer pure helpers and stable types over feature-aware abstractions.

Testing
- Write small unit tests here for errors, result helpers, and request-context behavior.
- Keep tests pure and focused on reusable primitives.
