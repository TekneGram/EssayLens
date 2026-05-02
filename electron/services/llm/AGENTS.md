Use `electron/services/llm/*` for LLM-specific backend orchestration in the Electron main process.

Purpose
- Orchestrate chat, rubric-feedback chat, and related LLM-backed backend use cases.
- Coordinate repositories, runtime readiness helpers, mappers, and the Python worker orchestrator.

Current structure
- `chatService.ts`
  - thin dispatch/facade entrypoint
- `simpleChatService.ts`
  - plain chat orchestration and persistence coordination
- `rubricFeedbackChatService.ts`
  - rubric-feedback orchestration and persistence coordination
- `rubricResolutionService.ts`
  - rubric lookup and rubric-matrix loading
- `policy/*`
  - small LLM-specific orchestration policy such as session-id rules
- `llmOrchestrator.ts`
  - request/response transport orchestration to the Python worker boundary

Rules
- Keep this folder focused on orchestration, not transport registration.
- Runtime readiness and recovery belong in `electron/runtime/*`.
- Pure payload/result/event transformations belong in `electron/mappers/*`.
- Direct process/platform capability access belongs behind infrastructure ports/adapters.
- Persistence coordination may stay here, but raw SQL should not.
- Keep plain chat and rubric-feedback chat as separate orchestration flows.

Testing
- Write tests here for orchestration, worker-response handling, persistence coordination, and LLM-specific branching.
- Mock repositories, runtime helpers, and the Python worker orchestrator.
