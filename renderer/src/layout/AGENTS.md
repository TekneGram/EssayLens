Use `renderer/src/layout/*` for screen composition and shared UI coordination.

Purpose
- Compose feature modules into windows, panels, and screen regions.
- Hold small coordination state when multiple nearby shell regions need it.

Rules
- Put backend access and business logic in features, not layout.
- Lift state to layout only when it is local to one shell area and mainly about coordination.
- Pass shell actions down as props.
- Render features inside layout; do not let layout become a service layer.
- If state starts looking domain-level or cross-cutting across distant UI regions, stop and consider whether it belongs in a provider instead.

Testing
- Write tests here only for layout composition and shared UI-state coordination.
- Prefer mocking feature components/hooks rather than re-testing feature behavior inside layout tests.
