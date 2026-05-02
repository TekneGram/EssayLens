Used for backend use-case orchestration.

Purpose
- Services coordinate backend work for a feature or domain.
- They sit below IPC and above repositories, runtime helpers, and infrastructure ports/adapters.
- Services return typed response DTOs and throw structured backend errors for known failure cases.

Organization
- Group service files by domain.
- Current domains include `assessment`, `documents`, `feedback`, `llm`, and `workspace`.
- Prefer one domain folder per backend capability area.
- Keep cross-domain helpers here only when they are genuinely reusable across domains.

Service responsibilities
- Accept typed request data and `RequestContext` when needed.
- Validate runtime and business constraints beyond IPC shape validation.
- Call repositories, runtime helpers, and infrastructure ports/adapters.
- Define transaction boundaries.
- Coordinate persistence and multi-step workflows.
- Return typed response DTOs.

Boundaries
- Do not register IPC handlers here.
- Do not contain raw SQL unless there is a strong reason.
- Do not hardcode runtime paths.
- Do not let direct Electron/platform API usage spread here when it belongs in `infrastructure/*`.
- Do not turn this folder into a dumping ground for mappers or generic helpers that belong elsewhere.

Testing
- Write service tests here for orchestration logic, branching, persistence coordination, and DTO mapping.
- Mock repositories, runtime helpers, and infrastructure dependencies in unit tests.
