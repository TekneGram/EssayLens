# Rubric Based Feedback

This document describes the current `Rubric based comments` flow across the renderer, Electron backend, and Python worker.

## Overview

The feature is triggered from the assessment chat UI when the user selects `Rubric based comments` from the chat command menu and submits the command.

The current system is intentionally separate from normal freeform chat in three ways:

1. The user does not need to type a message in the chat input.
2. Every rubric feedback request starts a brand-new chat session.
3. Each rubric category is evaluated as a one-shot response, not as a cumulative multi-turn chat.

At a high level:

1. The renderer detects that the active command is rubric-based feedback.
2. The renderer validates that a file, essay text, and rubric are available.
3. The renderer creates and activates a fresh `rubric-feedback:*` session for the selected file.
4. The renderer sends a single `chat/sendMessage` request with `kind: 'rubric-feedback'`, the essay text, the rubric id, and the new session id.
5. Electron loads the rubric matrix, groups it by category, and processes each category sequentially.
6. For each category, Electron makes one one-shot `llm.evaluate.withRubric` request.
7. Electron emits synthetic `start` / `chunk` / `done` chat stream events so the existing `ChatView` can render the category responses sequentially.
8. Electron persists one assistant turn per rubric category in the new session.

## Frontend Trigger And Submission

The main renderer entry point is:

- [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts)

Core logic:

- The hook checks whether `activeCommand?.id === 'evaluate-with-rubric'`.
- Rubric feedback no longer requires `draftText.trim()` to be non-empty.
- It still requires:
  - a selected file
  - extracted essay text
  - a selected rubric
- The selected rubric is resolved from existing rubric state first, then from rubric grading context:
  - `state.rubric.selectedGradingRubricIdByFileId[fileId]`
  - `state.rubric.lockedGradingRubricId`
  - `rubric.getGradingContext({ fileId })`

When rubric feedback is requested, the renderer:

- creates a new rubric session id using:
  - [`renderer/src/layout/ChatInterface/domain/sessionId.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/domain/sessionId.ts)
- creates that session through:
  - `llmSession.create({ sessionId, fileEntityUuid })`
- sets it as the active session for the file
- calls:
  - [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts)

using:

- `kind: 'rubric-feedback'`
- `rubricId`
- `essay`
- `sessionId`

No user-authored `message` is required for this path.

## Renderer Chat Workflow

The renderer-side orchestration lives in:

- [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts)

### Submission path

`submitChatMessageWorkflow(...)` supports two request modes:

- `kind: 'chat'`
- `kind: 'rubric-feedback'`

For plain chat:

- the renderer creates a teacher message immediately
- the renderer creates one empty assistant placeholder immediately
- stream chunks append into that placeholder

For rubric feedback:

- the renderer does not create a teacher message
- the renderer does not create assistant placeholders up front
- Electron returns one reply per rubric category
- stream events include category routing data so assistant messages are created lazily as each category starts

### Stream handling

`handleChatStreamChunkWorkflow(...)` processes normal chat stream events and rubric-feedback stream events through the same listener.

Rubric-feedback uses the extra stream metadata in the chat contract:

- `messageId`
- `sessionId`
- `rubricCategory`

That metadata allows the renderer to:

- create one assistant message per rubric category
- append content into the correct message
- keep those messages inside the normal chat/session state so `ChatView` renders them as standard assistant turns

Important implementation detail:

- rubric feedback is rendered like a stream
- but the underlying LLM work is not token streaming
- Electron emits synthetic lifecycle events around each one-shot category result

## IPC And Shared Chat Contract

The shared contract lives in:

- [`electron/ipc/contracts/chat.contracts.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/contracts/chat.contracts.ts)
- [`electron/ipc/validationSchemas/chat.schemas.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/validationSchemas/chat.schemas.ts)
- [`renderer/src/app/ports/chat.port.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/ports/chat.port.ts)
- [`renderer/src/app/adapters/chat/electronChat.adapter.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/adapters/chat/electronChat.adapter.ts)

Important fields:

- `kind?: 'chat' | 'rubric-feedback'`
- `message?: string`
- `rubricId?: string`
- `rubricFeedback?.replies`
- stream event fields:
  - `messageId?`
  - `sessionId?`
  - `rubricCategory?`

The validation schema now allows rubric-feedback requests to omit `message`.

The renderer also avoids sending `message: undefined` explicitly. Optional fields are omitted unless they contain real values.

## Electron Backend Orchestration

The main backend implementation is in:

- [`electron/services/llm/chatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts)

### Request branching

`ChatService.sendMessage(...)` branches immediately:

- plain chat requests go to `sendPlainChatMessage(...)`
- rubric-feedback requests go to `sendRubricFeedbackMessage(...)`

The helper `isRubricFeedbackRequest(...)` is the discriminator.

### Resolving the rubric

`sendRubricFeedbackMessage(...)` calls `resolveRubricIdForFeedback(...)`.

That logic:

- uses `request.rubricId` if the renderer supplied it
- otherwise loads rubric grading context from `RubricRepository`
- falls back to:
  - `selectedRubricIdForFile`
  - then `lockedRubricId`

The relevant repository is:

- [`electron/db/repositories/rubricRepository.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/db/repositories/rubricRepository.ts)

### Loading and grouping the rubric

Electron loads the rubric matrix through:

- `RubricRepository.getRubricMatrix(...)`

Then `normalizeRubricSections(...)` groups the matrix into a structure like:

- category
- entries[]
  - score value
  - rubric description

Each category is processed sequentially.

### Category execution

This is the main architectural change from the older design.

For each category:

- Electron creates a category-specific `clientRequestId`
- Electron creates a persistent `assistantMessageId`
- Electron emits a synthetic `start` stream event to the renderer
- Electron makes one one-shot:
  - `llm.evaluate.withRubric`
- Electron emits one synthetic `chunk` event containing the full category response
- Electron emits one synthetic `done` event

Rubric feedback no longer goes through:

- `llm.chatStream`
- `systemPrompt` injection into the chat path
- cumulative `sessionTurns`

Each category is evaluated independently.

### Persistence

Electron persists:

- one assistant turn per rubric category response

Persistence is written into:

1. chat history through:
   - [`electron/db/repositories/chatRepository.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/db/repositories/chatRepository.ts)
2. LLM session history through:
   - [`electron/db/repositories/llmChatSessionRepository.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/db/repositories/llmChatSessionRepository.ts)

Rubric feedback does not append a teacher turn derived from chat input.

Because the renderer creates a fresh rubric session before submission, the persisted assistant turns belong only to that rubric feedback run and do not accumulate onto an existing freeform chat session.

## Python Worker Changes

The Python worker flow is in:

- [`electron-llm/main.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/main.py)
- [`electron-llm/app/pipeline_simple.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_simple.py)

The worker now implements:

- `llm.evaluate.withRubric`

Current behavior:

- Electron sends:
  - `essay`
  - `rubricCategory`
  - `rubricEntries`
  - runtime `settings`
- the worker builds a rubric-specific one-shot evaluation prompt
- the worker makes one non-streaming LLM call
- the worker returns one final `reply`

This is separate from normal essay chat behavior.

Normal chat still uses:

- `run_chat(...)`
- `run_chat_stream(...)`

Rubric feedback now uses:

- `run_evaluate_with_rubric(...)`

## Why This Uses Synthetic Stream Events

The feature no longer uses `llm.chatStream` for rubric feedback.

Instead, it uses:

- one-shot `llm.evaluate.withRubric` calls for correctness and session isolation
- synthetic chat stream events for UI reuse

Reason:

- rubric category evaluation should be independent, not cumulative
- rubric feedback should always start a new session
- `ChatView` already knows how to render incremental assistant messages keyed by session and message id

So the backend keeps the UI contract that `ChatView` expects, while changing the execution model underneath.

## Tests And Verification

Main verification files:

- [`electron/services/llm/chatService.test.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.test.ts)
- [`electron-llm/app/pipeline_simple_test.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_simple_test.py)
- [`renderer/src/layout/ChatInterface/__tests__/ChatInterfaceWorkflow.test.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/__tests__/ChatInterfaceWorkflow.test.tsx)
- [`renderer/src/layout/ChatInterface/__tests__/sessionId.test.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/__tests__/sessionId.test.ts)

Checks performed during implementation:

- Electron rubric feedback service test passed
- renderer typecheck passed
- targeted renderer tests passed
- Python files passed `py_compile`

The Python pytest file exists and is useful, but whether it can be executed depends on local Python test dependencies being installed.
