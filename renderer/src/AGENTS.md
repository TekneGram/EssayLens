Frontend overview for `renderer/src/*`.

Renderer flow to Electron
- UI -> hook -> service/query layer -> port -> adapter -> preload `window.api` -> Electron backend

Return flow
- backend -> adapter -> port-shaped result -> service/query state -> hook -> UI

Folder responsibilities
- `src/app/*`
  - frontend infrastructure boundary for ports, adapters, shared app errors/results, request helpers, and providers
- `src/features/*`
  - feature implementation and feature-local state/services
- `src/layout/*`
  - screen composition and shared UI coordination
- `src/styles/*`
  - global styles, tokens, and reusable stylesheet layers

Rules
- Do not call `window.api` directly outside `src/app/adapters/*`.
- Do not import from `electron/*` anywhere in `renderer/src/*`.
- Keep feature business logic inside `src/features/*`, not layout files.
- Keep layout focused on composition and UI coordination, not backend access.
- Keep feature-specific styles local; use `src/styles/*` only for app-wide shared styling.
- Prefer `@/` aliases for renderer imports.

Testing
- Put frontend unit/local tests near the code they verify, typically in `__tests__`.
- Put frontend integration tests in `src/test/integration` if that layer is added.
- Put end-to-end tests in root `test/e2e`.
- Consult subfolder `AGENTS.md` files for more specific guidance.
