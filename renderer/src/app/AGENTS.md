Use `renderer/src/app/*` as the frontend infrastructure boundary.

Purpose
- Keep renderer transport and platform concerns out of features.
- Define typed ports and thin adapters for backend and platform access.
- Centralize app-wide error/result handling and shared providers.

Typical contents
- `ports/*`
  - domain-oriented renderer-facing interfaces
- `adapters/*`
  - concrete implementations that talk to preload `window.api`
- `providers/*`
  - genuinely cross-cutting app state only
- shared app error/result types and request helpers

Rules
- Feature code should depend on ports/adapters from here, not raw `window.api`.
- Keep adapters thin.
- Centralize request/result mapping instead of interpreting backend errors ad hoc in features.
- Use ports to model domain operations, not transport details.
- Keep providers for truly cross-feature or cross-layout state only.
- Do not put feature-specific UI logic here.

Testing
- Test adapter mapping, error/result translation, and non-trivial provider behavior here.
- Mock `window.api` rather than hitting real IPC in unit tests.
