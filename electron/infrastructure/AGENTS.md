Use `electron/infrastructure/*` for Electron, native-process, and external capability boundaries used by backend services.

Purpose
- Keep direct platform and process access from spreading through services.
- Define small ports and thin adapters for external boundaries.

Files
- `ports/*`
  - small interfaces for capabilities such as Python worker access
- `adapters/*`
  - concrete implementations using Electron APIs, child processes, or other platform libraries

Rules
- Services should depend on ports when the capability belongs at this boundary.
- Keep ports small and capability-focused.
- Keep adapters thin and implementation-focused.
- Do not put business orchestration here.
- Do not put DB logic here.
- Do not put IPC registration here.
- Do not put runtime path policy here.
- If a capability is not reused and would stay tiny, avoid creating unnecessary abstraction.

Testing
- Test adapters here when wrapper behavior is non-trivial.
- Mock platform APIs and child-process behavior in this layer's tests.
- Do not retest service orchestration here.
