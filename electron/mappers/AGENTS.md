Use `electron/mappers/*` for typed transformations between backend layers.

Purpose
- Keep payload shaping, event translation, normalization, and result extraction out of orchestration services.
- Give services small pure helpers for translating between request, worker, renderer, and repository-adjacent shapes.

Typical contents
- request validation helpers that shape typed service inputs
- request-to-worker payload builders
- worker-result extractors
- Python-stream-event to renderer-event mappers
- rubric/data normalization helpers

Rules
- Prefer pure, stateless functions.
- Keep this layer free of orchestration, persistence, and transport registration.
- Do not put DB access here.
- Do not put runtime path or readiness policy here.
- Do not let this become a second service layer.
- If a helper is feature/domain specific, keep it small and name it by transformation purpose.

Testing
- Write focused unit tests here for mapping, normalization, and validation behavior.
- Test edge cases and shape conversions precisely.
