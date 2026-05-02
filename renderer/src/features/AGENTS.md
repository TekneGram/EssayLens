Use `renderer/src/features/*` for feature implementation.

Purpose
- Own feature-local UI, hooks, application services, domain logic, state, and styles.
- Keep business and workflow logic close to the feature that needs it.

Organization
- Put each feature in its own folder.
- Co-locate UI, hooks, state, application services, and CSS with the owning feature.
- Use subfolders such as `application`, `domain`, `hooks`, `state`, `components`, or `styles` when they clarify ownership.

Rules
- Components should not call backend adapters directly.
- Put backend or adapter calls in feature services/hooks, not in components.
- Keep top-level feature components focused on composition and UI wiring.
- Use hooks for workflow/state orchestration.
- Keep local UI state local.
- Keep feature-specific styling beside the feature.
- Do not put cross-feature shell coordination in feature folders; that belongs in layout or providers.

Testing
- Write feature tests in the feature folder, typically under `__tests__`.
- Good default coverage is feature services, hooks, and top-level component branching/interaction.
- Keep cross-feature tests out of feature folders.
