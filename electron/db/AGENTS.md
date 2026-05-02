Use `electron/db/*` for persistence setup, migrations, and database access.

Purpose
- Own SQLite setup and migration flow.
- Keep repositories as the database-facing layer for backend services.

Files
- `migrations/*`
  - ordered SQL schema/data migrations
- `repositories/*`
  - table-oriented SQL access helpers
- database bootstrap files
  - startup DB initialization only

Rules
- Repositories should stay dumb.
- Repositories may read and write rows, but should not orchestrate workflows.
- Do not put IPC registration here.
- Do not put Electron platform code here.
- Do not put runtime path policy here.
- Do not let repositories become service-like.
- Services own transaction boundaries, workflow branching, UUID strategy, and multi-repository coordination unless a narrow repository helper clearly belongs here.

Testing
- Write repository tests here for SQL behavior and row mapping.
- Keep orchestration tests in `electron/services/*`, not here.
