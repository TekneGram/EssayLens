# EssayLens Architecture

EssayLens is a desktop app with three main layers:

- `renderer/`: the React UI. `renderer/src/app` holds app-wide ports, adapters, providers, and shared types. `renderer/src/features` holds domain features. `renderer/src/layout` composes those features into the main screens.
- `electron/`: the desktop backend. `main.ts` boots Electron, creates the window, initializes runtime state, and registers IPC. `preload.ts` exposes the safe `window.api` bridge to the renderer.
- `electron-llm/`: the Python side of the app. This is not a TypeScript feature folder. It is the route to the native Python programs and supporting code used for local LLM and NLP work.

Within `electron/`, responsibilities are split as follows:

- `core/`: shared backend primitives such as errors, exceptions, and request context.
- `ipc/`: IPC contracts, validation schemas, and handler registration. This is the boundary between renderer requests and backend services.
- `services/`: application/backend logic grouped by domain (`assessment`, `documents`, `feedback`, `llm`, `workspace`).
- `db/`: SQLite setup, migrations, and repositories.
- `infrastructure/`: adapters and ports for external/process boundaries, including the Python worker boundary.
- `runtime/`: startup and environment coordination such as storage bootstrap and LLM runtime path reconciliation.
- `assets/` and `bin/`: packaged backend resources and helper binaries/scripts.

At the repo root:

- `vendor/`: staged native runtime binaries for packaging and local execution. This is where the app keeps bundled `python-worker` and `llama-server` artifacts by platform/architecture. Electron packages these into app resources and resolves runtime paths to them when needed.

The main architectural rule is:

- Renderer code should talk to backend capabilities through `renderer/src/app/ports` and adapters, not by importing from `electron/`.
- Electron owns IPC, persistence, runtime setup, and process orchestration.
- `electron-llm/` owns the Python execution side that Electron reaches through the backend infrastructure layer.
- `vendor/` owns the packaged native binary inputs that Electron ships and launches; it is not application source code.

Generated output:

- `dist-electron/`: compiled Electron backend output.
- `renderer/dist/`: compiled renderer output.
