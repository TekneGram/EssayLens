Use `electron/ipc/*` for the transport boundary between the renderer and Electron main.

Purpose
- Receive renderer requests.
- Validate raw IPC payloads.
- Normalize request-scoped success/failure into `AppResult<T>`.
- Define shared request/response/event DTOs.

Files
- `contracts/*`
  - request, response, and event shapes shared across the boundary
- `validationSchemas/*`
  - Zod schemas for raw incoming payloads
- `registerHandlers/*`
  - channel registration grouped by domain
- `validate.ts`
  - payload validation helper
- `safeHandle.ts`
  - request-scoped error normalization and result wrapping

Rules
- Keep handlers thin: validate input, delegate to a service, return the result.
- Keep `registerHandlers.ts` thin and compositional.
- Validate raw payloads here, not deep inside renderer code.
- Use `contracts/*` as the shared source of truth for IPC DTOs.
- Do not put business orchestration here.
- Do not put raw SQL here.
- Do not put Electron/platform capability logic here.

Pattern
- renderer adapter calls IPC
- IPC validates
- IPC delegates to a service
- `safeHandle` returns `AppResult<T>`

Testing
- Write tests here for validation, boundary failures, and request/result normalization.
- Mock services in IPC tests.
- Do not duplicate service orchestration tests here.
