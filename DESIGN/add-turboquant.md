add TurboQuant KV-cache settings end-to-end so
  the user can configure them in the LLM settings UI, persist them, and have electron-llm
  pass them to llama-server as --cache-type-k and --cache-type-v.

  What it needs to understand first

  1. Read repo architecture instructions:

  - AGENTS.md
  - electron/AGENTS.md
  - renderer/AGENTS.md

  2. Trace the LLM path deeply:

  - Renderer LLM manager UI:
      - renderer/src/features/llm-manager/LlmManager.tsx
      - renderer/src/features/llm-manager/components/LlmConfiguration.tsx
      - renderer/src/features/llm-manager/hooks/useLlmManagerController.ts
      - renderer/src/features/llm-manager/hooks/useLlmManagerMutations.ts
  - Renderer/backend contracts:
      - renderer/src/app/ports/llmManager.port.ts
      - renderer/src/app/adapters/llm-manager/electronLlmManager.adapter.ts
  - Electron IPC + persistence:
      - electron/ipc/contracts/llmManager.contracts.ts
      - electron/ipc/validationSchemas/llmManager.schemas.ts
      - electron/ipc/registerHandlers/register.llmManager.ts
      - electron/db/repositories/llmSettingsRepository.ts
      - electron/db/repositories/llmSelectionRepository.ts
      - electron/db/migrations/0009_llm_settings.sql
      - electron/db/migrations/0010_llm_selection.sql
  - Python worker / server startup:
      - electron-llm/app/settings.py
      - electron-llm/config/llm_server_config.py
      - electron-llm/nlp/llm/llm_server_process.py
      - electron/services/llm/chatService.ts

  Implementation plan

  1. Add new runtime settings fields.

  - Add llm_cache_type_k and llm_cache_type_v to the runtime settings schema and DTOs.
  - Use nullable string fields so “unset/default behavior” remains possible.
  - Recommended allowed values initially:
      - null
      - f16
      - q8_0
      - turbo3
      - turbo4
  - Keep validation centralized in Electron IPC schema.

  2. Add a DB migration.

  - Create a new migration, do not edit old migrations.
  - Add columns to llm_settings.
  - Add columns to llm_selection_defaults so model defaults can carry cache-type defaults.
  - Backfill existing rows with NULL.
  - Decide initial defaults for current Qwen catalog rows:
      - safest: NULL
      - if explicitly enabling TurboQuant by default: likely turbo3/turbo3
  - Preserve backward compatibility for existing installs.

  3. Update Electron repositories.

  - Extend electron/db/repositories/llmSettingsRepository.ts to read/write the new fields.
  - Extend electron/db/repositories/llmSelectionRepository.ts so selecting a model copies
    llm_cache_type_k and llm_cache_type_v defaults from llm_selection_defaults into live
    llm_settings.

  4. Update IPC contracts and validation.

  - Add both fields to:
      - electron/ipc/contracts/llmManager.contracts.ts
      - renderer/src/app/ports/llmManager.port.ts
  - Update electron/ipc/validationSchemas/llmManager.schemas.ts to validate the allowed
    values.

  5. Thread the settings into the Python worker config.

  - Update electron-llm/app/settings.py to extract the new fields from payload/settings.
  - Update electron-llm/config/llm_server_config.py to carry them as typed config values.
  - Validate them there too, even if Electron already validates, so the Python layer is
    defensive.

  6. Pass the flags to llama-server.

  - Update electron-llm/nlp/llm/llm_server_process.py.
  - Append:
      - --cache-type-k <value> when llm_cache_type_k is set
      - --cache-type-v <value> when llm_cache_type_v is set
  - Do not pass these flags when values are null.
  - Keep current --flash-attn logic intact.

  7. Add frontend controls in the LLM configuration screen.

  - Update renderer/src/features/llm-manager/components/LlmConfiguration.tsx
  - Add two select inputs:
      - KV Cache Type K
      - KV Cache Type V
  - Options:
      - Default
      - FP16
      - Q8_0
      - Turbo3
      - Turbo4
  - Ensure save/reset flows work through the existing settings mutation path.

  8. Update frontend settings logic if needed.

  - Check:
      - renderer/src/features/llm-manager/domain/llmSettings.logic.ts
      - renderer/src/features/llm-manager/hooks/useLlmSettingsEditor.ts
  - Make sure the new fields participate in dirty-state, form state, save, and reset
    behavior.

  9. Consider readiness and UX messaging.

  - No readiness change is strictly required.
  - Optional improvement: if TurboQuant values are set but unsupported by the binary,
    surface a clearer startup error from Python process logs.

  Testing plan

  1. Typecheck:

  - npm run typecheck

  2. Electron backend tests:

  - Add/adjust tests around:
      - settings repository read/write
      - selection repository default application
      - LLM manager IPC update/reset flows

  3. Renderer tests:

  - Add/adjust tests for:
      - configuration form rendering the two new selects
      - saving updated values
      - resetting to defaults after model selection

  4. Python-side tests:

  - Add unit tests for:
      - config parsing/validation
      - llm_server_process.py command construction including and omitting the new flags

  Acceptance criteria

  - User can see and edit KV Cache Type K and KV Cache Type V in the LLM config UI.
  - Values persist through Electron settings storage.
  - Reset-to-defaults restores model-specific defaults for those fields.
  - When set, the Python launcher passes --cache-type-k and --cache-type-v to llama-
    server.
  - When unset, no cache-type flags are passed.
  - Existing users migrate cleanly with no manual DB changes.

  Key design guidance for the new Codex instance

  - Treat Electron DB + IPC as the source of truth for runtime settings.
  - Do not put llama-server startup policy in the renderer.
  - Keep the Python worker thin: accept typed settings, build CLI args, launch server.
  - Use a new migration for all schema/default changes.
  - Preserve backward compatibility with older settings rows and missing vendor binaries.