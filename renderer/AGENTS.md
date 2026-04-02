Frontend overview

Renderer flow to electron:
UI -> hook -> service/query layer -> port -> adapter -> preload `window.api` -> electron backend

Return flow:
backend -> adapter -> port-shaped result -> service/query state -> hook -> UI

Folder responsibilities:
- `src/app/*`: frontend infrastructure boundary. This holds ports, adapters, shared app errors/results, request helpers such as `invokeRequest.ts`, and app-wide providers/state.
- `src/features/*`: feature implementation. This is where domain UI and feature-local state/services live, including assessment, rubric, LLM manager, text view, comments view, and score tool features.
- `src/layout/*`: app shell composition and shared screen-level coordination. This is where the main windows and composed layout regions live, including `AssessmentWindow`, `ChatView`, `ChatInterface`, and `FileControlContainer`.
- `src/styles/*`: global design tokens and shared stylesheet layers. Keep this for app-wide styling, not feature business logic.

Rules:
- Do not call `window.api` directly outside adapters in `src/app/adapters/*`.
- Do not import from `electron/*` anywhere in `renderer/src/*`.
- Use ports in `src/app/ports/*` as the renderer/backend boundary.
- Keep `src/layout/*` focused on composition and UI coordination, not backend/infrastructure logic.
- Keep feature business logic inside `src/features/*`, not in layout files.
- When a feature needs backend access, add or update a port first, then implement the adapter.
- Keep shared app state in `src/app/providers/*` only when it genuinely crosses feature/layout boundaries.
- Prefer `@/` aliases for renderer imports instead of long relative escape chains.

EssayLens-specific structure notes:
- `features/assessment-tab` is the assessment orchestration shell inside the feature layer; extracted pieces such as `comments-view`, `original-text-view`, `text-view-window`, and `score-tool` should stay in their own feature folders.
- `layout/ChatView`, `layout/ChatInterface`, and `layout/FileControlContainer` are layout-level compositions, not general-purpose domain features.
- `app/adapters/*` should stay thin and mostly translate port calls into `invokeRequest(...)` or event subscriptions.

Testing:
- Put frontend unit/local tests near the code they verify, typically in folder-level `__tests__`.
- Put frontend integration tests in `src/test/integration` if that layer is added.
- Put full app end-to-end tests in root `test/e2e`.
- Consult each subfolder `AGENTS.md` for domain-specific test expectations and quirks when present.
