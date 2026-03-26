Renderer to Electron request flow
 - frontend adapter -> preload.ts -> ipc/registerHandlers/* -> ipc/validate.ts + ipc/validationSchemas/* ->
   services/*

System and native capability flow
 - services/* -> infrastructure/ports/* -> infrastructure/adapters/* -> Electron APIs / native runtimes

Database capability flow
 - services/* -> db/appDatabase.ts / db/sqlite.ts -> db/repositories/*

Local LLM runtime flow
 - services/llm/* -> infrastructure/ports/pythonWorker.port.ts ->
   infrastructure/adapters/pythonWorkerAdapter.ts -> native Python worker / llama-server runtime

Shared type layer
 - ipc/contracts/* defines the request, response, and event shapes used across the renderer/backend boundary

Here are the rules for writing code in the electron folder:

`assets/`
 - Store bundled read-only resources needed by the app at runtime.
 - Good examples: seed data, SQL seeds, static templates.
 - Do not write generated runtime data here.
 - Do not put feature logic here.
 - In packaged builds, treat assets as read-only.
 - Access asset paths through `runtime/runtimePaths.ts`, not by hardcoding paths in services.

`bin/`
 - Store bundled helper binaries or placeholders for shipped executables.
 - Do not treat this folder as writable application storage.
 - Services should not hardcode paths into `bin/`; they should ask runtime helpers.

`core/`
 - Store shared backend-core types and primitives.
 - Good examples: `AppError`, `AppException`, `AppResult`, request context.
 - Keep this folder framework-light and reusable across services.
 - Do not put feature-specific orchestration here.
 - Do not put IPC registration, SQL, or Electron UI/platform code here.

`db/`
 - Own persistence setup and database access.
 - `initializeDatabase.ts` is for startup DB initialization only.
 - `runMigrations.ts` applies ordered SQL migrations.
 - `sqlite.ts` contains generic DB helpers only.
 - `repositories/*` contains table-oriented SQL operations only.
 - Repositories must stay dumb: no orchestration, no runtime path policy, no Electron API access.
 - Services own transaction boundaries and combine repository calls.

`infrastructure/`
 - Own Electron/platform/native capability boundaries used by services.
 - `ports/*` defines interfaces for external capabilities such as the Python worker boundary.
 - `adapters/*` implements those interfaces with Electron APIs, child-process calls, or platform libraries.
 - Use this folder when direct platform or process access would otherwise spread through services.
 - Keep adapters thin and capability-focused.
 - Do not put business logic, IPC registration, or DB logic here.

`ipc/`
 - Own the transport boundary between renderer and Electron main.
 - `contracts/*` defines request/response/event DTOs.
 - `validationSchemas/*` defines Zod schemas for incoming raw payloads.
 - `validate.ts` performs boundary validation.
 - `safeHandle.ts` normalizes request-scoped success/failure into `AppResult<T>`.
 - `registerHandlers/*` groups channel registration by concern.
 - `registerHandlers.ts` should remain a thin composition entrypoint.
 - Keep handlers thin: validate, delegate to service, return result.

`runtime/`
 - Own environment-aware path and storage policy.
 - Resolve dev vs packaged locations here.
 - Centralize writable vs bundled read-only path decisions here.
 - `bootstrapStorage.ts` prepares runtime directories and first-run copies.
 - `llmServerPathReconciler.ts` and `llmRuntimeReadiness.ts` keep local LLM runtime configuration sane.
 - Do not hardcode filesystem policy elsewhere.
 - Services should ask runtime helpers for paths instead of constructing them manually.

`services/`
 - Own backend use-case orchestration.
 - Domain folders currently include `assessment`, `documents`, `feedback`, `llm`, and `workspace`.
 - Accept typed request data and `RequestContext` when needed.
 - Validate runtime/business constraints beyond IPC shape validation.
 - Call repositories, runtime helpers, and infrastructure ports/adapters.
 - Define transaction boundaries.
 - Return typed response DTOs.
 - Do not register IPC handlers here.
 - Do not contain raw SQL unless there is a strong reason.
 - Do not become a dumping ground for direct platform API calls if those capabilities belong in `infrastructure/`.

`main.ts`
 - Startup/bootstrap only.
 - Initialize backend runtime concerns such as storage, database startup, handler registration, and window creation.
 - Do not put request-time feature orchestration or business logic here.

`preload.ts`
 - Renderer bridge only.
 - Expose the minimal safe `window.api` surface needed by renderer adapters.
 - Keep this file thin and transport-focused.
 - Do not place backend business logic here.

A compact summary for the whole backend is:
 - `ipc/` = transport boundary
 - `services/` = orchestration
 - `db/` = persistence
 - `runtime/` = path/storage/runtime policy
 - `infrastructure/` = Electron/platform/native capability boundary
 - `core/` = shared backend primitives
 - `assets/` and `bin/` = bundled resources and executables

Explore each subfolder's `AGENTS.md` file before writing in any subfolder if one exists.

If you need to write code that seems to break any of this architecture, stop and discuss a new architecture recommendation before implementing code.

Testing:
 - Put backend unit/local tests near the code they verify, typically in folder-level `__tests__`.
 - Put Electron/backend integration tests in `electron/test/integration` if that test layer is added.
 - Put full app end-to-end tests in root `test/e2e`.
 - Follow any more specific guidance in subfolder `AGENTS.md` files when present.
