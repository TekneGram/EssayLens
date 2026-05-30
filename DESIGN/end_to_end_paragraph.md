# End To End: `Paragraph feedback in bulk`

This note describes the current end-to-end behavior when a user selects `Paragraph feedback in bulk` from the `ChatInterface`, how data flows through the app today, and what still needs to be built for bulk commenting to become a real workflow. It was written after reviewing the repo architecture rules in the root `AGENTS.md` and the relevant renderer, Electron, service, infrastructure, runtime, and `electron-llm` `AGENTS.md` files.

## Current User Flow

The visible entry point is the assessment chat input in [`renderer/src/layout/ChatInterface.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface.tsx). The command menu is rendered by [`renderer/src/layout/ChatInterface/components/CommandDropdown.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/components/CommandDropdown.tsx), using options from [`renderer/src/layout/ChatInterface/domain/commands.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/domain/commands.ts). `Paragraph feedback in bulk` maps to an `ActiveCommand` with id `paragraph-feedback-bulk`, label `Paragraph feedback in bulk`, and source `chat-dropdown`.

When the user selects it, the dropdown calls `onCommandSelected(toActiveCommand(option))`. That callback is supplied by the assessment tab binding chain:

- [`renderer/src/layout/WindowPane.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/WindowPane.tsx) owns `assessmentChatBindings` and passes them into `ChatInterface`.
- [`renderer/src/features/assessment-tab/AssessmentTab.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/AssessmentTab.tsx) passes `onChatBindingsChange` into the assessment controller.
- [`renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts) creates `setActiveCommandWithModeRule`.
- [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatStateSync.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatStateSync.ts) publishes that function as `onCommandSelected`.

`setActiveCommandWithModeRule` stores the selected command in assessment-tab local reducer state and calls `toChatModeAfterCommandSelection(...)`. That helper in [`renderer/src/features/assessment-tab/domain/assessmentTab.logic.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/domain/assessmentTab.logic.ts) forces the chat input into `chat` mode whenever any command is active. The UI then shows the selected command through `CommandDisplay`, changes the input placeholder to chat mode, and changes the send button label to `Send chat message`.

At this point, no backend request has happened. Selecting `Paragraph feedback in bulk` only mutates local renderer state.

## Submit Behavior Today

Submit is wired from `ChatInterface` through `executeChatInterfaceSubmit(...)` in [`renderer/src/layout/ChatInterface/application/chatIntent.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/application/chatIntent.service.ts). In chat mode, it first expands/opens the chat area via `onChatIntent`, then calls the assessment tab's `onSubmit` binding.

The real submit branch is [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts). This hook recognizes only one special command:

```ts
const isRubricFeedbackCommand = activeCommand?.id === 'evaluate-with-rubric';
```

There is no equivalent branch for `activeCommand?.id === 'paragraph-feedback-bulk'`.

As a result:

- If `Paragraph feedback in bulk` is selected and the input is empty, submit returns early because the request is not rubric feedback and has no message.
- If `Paragraph feedback in bulk` is selected and the user types text, the command id is ignored and the message is sent as ordinary chat.

The command id is not included in the renderer chat request payload. [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts) builds a `SendChatMessageRequest` with fields such as `kind`, `fileId`, `sessionId`, `clientRequestId`, `message`, `essay`, `rubricId`, and `contextText`; it does not include `activeCommand` or `paragraph-feedback-bulk`.

## Current Frontend To Backend Data Flow

When the user has selected `Paragraph feedback in bulk` but also types a message, the data flow is the normal chat flow:

1. `ChatInterface` calls `executeChatInterfaceSubmit`.
2. `useAssessmentChatActions.handleSubmit` treats it as ordinary chat because the active command is not `evaluate-with-rubric`.
3. The hook prepares the selected essay text, subject to the current 2,000-word truncation rule.
4. It calls `submitChatMessageWorkflow(...)`.
5. `submitChatMessageWorkflow(...)` creates an optimistic teacher chat message and an empty assistant placeholder in renderer app state.
6. It calls the chat port: `chatApi.sendMessage(request)`.
7. The port is implemented by [`renderer/src/app/adapters/chat/electronChat.adapter.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/adapters/chat/electronChat.adapter.ts), which invokes the preload bridge channel `chat/sendMessage` through `invokeRequest(...)`.
8. [`electron/preload.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/preload.ts) exposes the safe `window.api.invoke(...)` bridge and the `chat/streamChunk` event subscription.

This follows the renderer architecture rule: UI and hooks go through app ports and adapters, not direct Electron imports.

## Current Backend Flow

The Electron IPC handler for chat lives in [`electron/ipc/registerHandlers/register.chat.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/registerHandlers/register.chat.ts). It validates the raw payload with [`electron/ipc/validationSchemas/chat.schemas.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/validationSchemas/chat.schemas.ts), creates an `emitToRenderer` function that sends `chat/streamChunk` events back to the renderer, and delegates to [`electron/services/llm/chatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts).

The shared chat contract currently allows only:

```ts
kind?: 'chat' | 'rubric-feedback';
```

That type is mirrored in [`renderer/src/app/ports/chat.port.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/ports/chat.port.ts) and [`electron/ipc/contracts/chat.contracts.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/contracts/chat.contracts.ts). There is no `paragraph-feedback-bulk` request kind.

`ChatService.sendMessage(...)` dispatches between:

- [`electron/services/llm/simpleChatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/simpleChatService.ts) for ordinary chat.
- [`electron/services/llm/rubricFeedbackChatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/rubricFeedbackChatService.ts) for `kind: 'rubric-feedback'`.

Because the renderer sends `kind: 'chat'` for the typed-message case, the backend uses `SimpleChatService`. That service checks LLM runtime readiness, resolves the chat session, loads recent turns, builds an LLM chat payload, and calls `llmOrchestrator.requestActionStream('llm.chatStream', ...)`.

The Python boundary is [`electron/services/llm/llmOrchestrator.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/llmOrchestrator.ts), backed by [`electron/infrastructure/adapters/pythonWorkerAdapter.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/infrastructure/adapters/pythonWorkerAdapter.ts). The adapter spawns or reuses the Python worker, writes JSON-line requests to stdin, reads JSON-line responses and stream events from stdout, and maps failures into structured Python bridge errors.

## Current Python Worker Flow

The Python worker entrypoint is [`electron-llm/main.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/main.py). It parses JSON-line requests, routes them through [`electron-llm/controllers/handle_request.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/controllers/handle_request.py), and emits JSON-line responses.

The controller knows about an `llm.paragraph.feedback.bulk` action name:

```py
"llm.paragraph.feedback.bulk": (PARAGRAPH_FEEDBACK_BULK_PIPELINE_KEY, "evaluate")
```

But the route is not implemented. If Electron ever sends `llm.paragraph.feedback.bulk` today, the worker raises:

```py
WorkerActionError(f"Action not implemented yet: {pipeline_key}")
```

Normal chat instead uses `llm.chatStream`, which is implemented by [`electron-llm/app/pipeline_simple.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_simple.py). That stream path returns assistant text chunks and a final `{ "reply": ... }` response.

## Return Flow To The Frontend

For the current typed-message fallback, return data reaches the UI in two ways:

1. While generation is running, Python stream events flow through `PythonWorkerClient` to `LlmOrchestrator`, then through `mapPythonStreamEventToChatChunkEvent(...)`, then through the IPC sender on `chat/streamChunk`, then through `electronChat.adapter.onStreamChunk(...)`.
2. When the request finishes, `chat/sendMessage` resolves with `AppResult<SendChatMessageResponse>`.

The renderer subscribes to stream chunks in `useAssessmentChatActions`. Stream events are handled by `handleChatStreamChunkWorkflow(...)`, which appends content to the optimistic assistant message and updates send-phase/status state. The final resolved response also replaces the assistant message content for ordinary chat. `ChatView` then renders the updated app-state messages.

Backend persistence for ordinary chat happens in `SimpleChatService`: it appends teacher and assistant turns to the LLM session repository when a session exists, and also writes both messages into `ChatRepository`.

No feedback comments are created from this path. It produces chat messages, not `FeedbackItem` rows.

## Why This Is Not Bulk Commenting Yet

The current `Paragraph feedback in bulk` command is a UI affordance, not an implemented bulk-comment workflow. It does not:

- send a bulk-specific request to Electron
- loop through workspace files
- extract or refresh text for each file
- call a bulk LLM prompt or pipeline
- parse generated comments into structured feedback
- create `FeedbackItem` rows
- attach inline anchors to document text
- update per-file progress in the UI
- handle partial failure or cancellation

The repo does have pieces that a future workflow can reuse:

- Document extraction: `assessment/extractDocument` through `AssessmentService.extractDocument(...)`.
- Feedback persistence: `assessment/addFeedback` through `AssessmentService.addFeedback(...)`.
- Feedback listing and UI refresh through the comments-view hooks.
- LLM runtime readiness, settings, and Python-worker orchestration through the existing LLM services.
- A reserved but unimplemented Python action name, `llm.paragraph.feedback.bulk`.

## Development Needed

Bulk comment needs a first-class contract instead of piggybacking on ordinary chat. The renderer, IPC contract, Electron service layer, and Python worker should agree on a bulk request/response shape. That shape should probably not live as a freeform chat message, because the output needs to become persisted feedback comments, not just assistant chat text.

Recommended backend shape:

- Add a bulk-comment request contract in the Electron IPC boundary. It can either be a new assessment capability such as `assessment/requestBulkComments` or a new LLM chat kind such as `kind: 'bulk-feedback'`. The assessment route is cleaner if the primary result is saved feedback.
- Include target file scope: current file, selected files, all workspace files, or another explicit set.
- Include settings from the proposed Bulk Comment tab: comment types, style, maximum length, maximum comments per file, inline/block preference, and whether comments should be automatically marked applied.
- Return a job-like result if the operation can run across many documents, with progress events for file started, file completed, comment created, error, and done.

Recommended Electron service work:

- Create a service orchestration path that loads the relevant workspace files, extracts text, calls the LLM, validates/parses results, and persists feedback.
- Reuse `AssessmentService.addFeedback(...)` or a repository-level transaction for comment persistence.
- Define transaction and partial-failure behavior: one file failing should not necessarily discard comments for every other file.
- Add cancellation support before this runs across many files.
- Add tests around request validation, per-file orchestration, LLM failures, and persistence.

Recommended Python worker work:

- Implement `llm.paragraph.feedback.bulk` in `electron-llm`.
- Define a prompt/output contract that returns structured comment candidates, not prose-only chat.
- Decide whether the worker returns only block comments, exact-quote comments, or anchored spans. If inline comments are required, it must return enough evidence for Electron to map each comment to text anchors safely.
- Add validation so malformed model output fails clearly instead of creating bad feedback.

Recommended renderer work:

- Add the planned Bulk Comment tab and store its settings in an appropriate feature state or provider if shared across the assessment UI.
- Make `paragraph-feedback-bulk` a real submit branch in `useAssessmentChatActions` or move the command handling into a dedicated bulk-comment feature hook.
- Disable or explain the command until required settings and target files are available.
- Show progress by file and comments created. Do not only render a single chat answer.
- After each file completes, invalidate/refetch feedback so `CommentsView` updates.

Recommended feedback/anchor work:

- If the first implementation creates block comments, the data path is straightforward: persist `kind: 'block'`, `source: 'llm'`, and `commentText`.
- If it creates inline comments, the workflow needs reliable anchors. Current manual inline feedback gets anchors from user selection. Bulk LLM output will need an anchoring algorithm that maps exact quotes back to DOCX/PDF text positions and handles duplicates, missing quotes, and edited/extracted text mismatches.

## Practical Next Step

The smallest useful implementation is current-file block-comment generation:

1. Treat `paragraph-feedback-bulk` as a dedicated command in `useAssessmentChatActions`.
2. Require a selected file and extracted essay text.
3. Send a new backend request with essay text and bulk settings.
4. Have Electron call a new Python `llm.paragraph.feedback.bulk` implementation that returns structured block comments.
5. Persist each returned comment with `source: 'llm'` and `kind: 'block'`.
6. Refetch comments for the current file so `CommentsView` displays them.

After that works, expand the scope to multiple files, richer settings, progress events, cancellation, and inline anchoring.
