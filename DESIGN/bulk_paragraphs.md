# Bulk Paragraph Workflow

This document traces the current end-to-end workflow for `Paragraph feedback in bulk`. It follows the actual code path from the renderer, through Electron IPC and services, and into the `electron-llm` Python worker.

The important point is that the command is now implemented as a bulk, per-file workflow. The renderer gathers DOCX files from workspace state, Electron loops those files one by one, and the Python worker generates paragraph feedback for each file.

## 1. Renderer entry point

The visible entry point is the chat command menu in [`renderer/src/layout/ChatInterface.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface.tsx).

Relevant functions and components:

- `ChatInterface(...)` in [`renderer/src/layout/ChatInterface.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface.tsx)
- `executeChatInterfaceSubmit(...)` in [`renderer/src/layout/ChatInterface/application/chatIntent.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/application/chatIntent.service.ts)
- `CHAT_COMMAND_OPTIONS` in [`renderer/src/layout/ChatInterface/domain/commands.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/domain/commands.ts)
- `toActiveCommand(...)` in [`renderer/src/layout/ChatInterface/domain/commands.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/domain/commands.ts)

The `Paragraph feedback in bulk` option is selected from the dropdown and becomes an active command with id `paragraph-feedback-bulk`.

### Command selection and mode switching

The selection flows through the assessment tab bindings:

- `WindowPane(...)` in [`renderer/src/layout/WindowPane.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/WindowPane.tsx)
- `AssessmentTab(...)` in [`renderer/src/features/assessment-tab/AssessmentTab.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/AssessmentTab.tsx)
- `useAssessmentTabController(...)` in [`renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts)
- `setActiveCommandWithModeRule(...)` in [`renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/useAssessmentTabController.ts)
- `toChatModeAfterCommandSelection(...)` in [`renderer/src/features/assessment-tab/domain/assessmentTab.logic.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/domain/assessmentTab.logic.ts)
- `useAssessmentChatStateSync(...)` in [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatStateSync.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatStateSync.ts)

`setActiveCommandWithModeRule(...)` stores the command and forces chat mode when a command is active. That is why the input becomes chat-style after the user selects the bulk paragraph command.

### File scope used for bulk feedback

The file list shown in [`renderer/src/layout/FileControlContainer/components/FileDisplayBar.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/FileControlContainer/components/FileDisplayBar.tsx) comes from workspace state, but the bulk workflow does not read from the component itself. The actual bulk target set is computed in:

- `useAssessmentChatActions(...)` in [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts)

That hook builds `workspaceDocxFileIds` from `appState.workspace.files`, filtering to `kind === 'docx'`. So the workflow targets all DOCX files currently in the workspace.

## 2. Renderer submit path

When the user presses send, the path is:

- `ChatInterface(...)` -> `executeChatInterfaceSubmit(...)`
- `executeChatInterfaceSubmit(...)` -> assessment tab `onSubmit`
- `useAssessmentChatActions(...).handleSubmit()` in [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts)
- `submitChatMessageWorkflow(...)` in [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts)

For `paragraph-feedback-bulk`, `handleSubmit()` does the following:

- trims the draft text
- checks for `activeCommand?.id === 'paragraph-feedback-bulk'`
- verifies that at least one DOCX file exists in the workspace
- calls `chatApi.checkParagraphFeedbackCompletions({ fileIds: workspaceDocxFileIds })`
- optionally skips or redoes already completed files
- calls `submitChatMessageWorkflow({ kind: 'paragraph-feedback-bulk', bulkFileIds, redoCompletedFileIds, ... })`

The request sent from the renderer is not a plain chat message. It is a bulk LLM request with:

- `kind: 'paragraph-feedback-bulk'`
- `fileIds`
- `redoCompletedFileIds`
- `clientRequestId`
- `selectedFileId`

The submit workflow itself is in [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts). It creates client-side request ids, updates optimistic chat state, and sends the request through the chat port.

## 3. Renderer to Electron IPC

The chat port implementation is the Electron adapter exposed through the preload bridge.

Relevant files:

- [`renderer/src/app/adapters/chat/electronChat.adapter.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/adapters/chat/electronChat.adapter.ts)
- [`electron/preload.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/preload.ts)

On the Electron side, the request crosses IPC through:

- `registerChatHandlers(...)` in [`electron/ipc/registerHandlers/register.chat.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/registerHandlers/register.chat.ts)
- `SendChatMessageSchema` in [`electron/ipc/validationSchemas/chat.schemas.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/validationSchemas/chat.schemas.ts)
- `CHAT_CHANNELS.sendMessage` in [`electron/ipc/registerHandlers/register.chat.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/registerHandlers/register.chat.ts)
- `ChatService.sendMessage(...)` in [`electron/services/llm/chatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts)

`SendChatMessageSchema` accepts a `kind: 'paragraph-feedback-bulk'` payload with `fileIds` and optional `redoCompletedFileIds`. `registerChatHandlers(...)` validates the raw payload, then delegates to `ChatService.sendMessage(...)`.

## 4. Electron orchestration

`ChatService.sendMessage(...)` in [`electron/services/llm/chatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts) routes the request based on the request kind:

- `isRubricFeedbackRequest(...)` -> `RubricFeedbackChatService`
- `isParagraphFeedbackBulkRequest(...)` -> `ParagraphFeedbackBulkChatService`
- otherwise -> `SimpleChatService`

For bulk paragraph feedback, the actual orchestrator is:

- `ParagraphFeedbackBulkChatService.sendMessage(...)` in [`electron/services/llm/paragraphFeedbackBulkChatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/paragraphFeedbackBulkChatService.ts)

### Bulk service flow

`ParagraphFeedbackBulkChatService.sendMessage(...)` performs the full per-file loop:

1. Calls `LlmRuntimeService.getRuntimeReadyResult(...)` to verify the LLM runtime is available.
2. Normalizes and deduplicates `request.fileIds`.
3. Loads the active LLM model from `llmSelectionRepository`.
4. Checks previously completed files with `llmFeedbackCompletionRepository.listCompletedForFiles(...)`.
5. For each file:
   - emits a `start` stream event
   - skips the file if it is already complete and not listed in `redoCompletedFileIds`
   - resolves the workspace file with `workspaceRepository.resolveFileById(...)`
   - rejects non-DOCX files
   - reads the file from disk with `fs.readFile(...)`
   - extracts DOCX text with `extractDocxTextFromBuffer(...)` from [`electron/services/documents/docxTextExtractor.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/documents/docxTextExtractor.ts)
   - builds the worker payload with `buildLlmParagraphFeedbackBulkPayload(...)` in [`electron/mappers/chatRequestMappers.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/mappers/chatRequestMappers.ts)
   - calls `llmOrchestrator.requestActionStream('llm.paragraph.feedback.bulk', ...)`
   - parses the returned `reply` text with `requireReplyText(...)`
   - parses the JSON bundle with `tryParseParagraphFeedbackBundle(...)`
   - converts it into assistant messages with `buildFeedbackReplies(...)`
   - persists the messages in `llmChatSessionRepository` and `ChatRepository`
   - records completion in `llmFeedbackCompletionRepository.addCompletion(...)`
   - emits `chunk` and `done` stream events for the renderer
   - optionally recycles the runtime with `recycleBulkRuntimeAfterFile(...)`

The helper methods that matter most are:

- `emitBulkError(...)`
- `tryParseParagraphFeedbackBundle(...)`
- `buildFeedbackReplies(...)`
- `formatParagraphSectionReply(...)`
- `formatVocabularyReply(...)`
- `recycleBulkRuntimeAfterFile(...)`

### What gets shown in ChatView

The completed bulk replies are turned into assistant chat bubbles and shown in:

- `ChatView(...)` in [`renderer/src/layout/ChatView.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatView.tsx)
- `ChatScreen(...)` in [`renderer/src/layout/ChatView/components/ChatScreen.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatView/components/ChatScreen.tsx)
- `toChatViewMessageItems(...)` in [`renderer/src/layout/ChatView/application/chatView.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatView/application/chatView.service.ts)

`ChatScreen(...)` shows:

- `Add to comments` when the assistant message can be turned into a block comment
- `Add inline comment` when the assistant message has `feedbackType === 'vocabulary'`

Those buttons are wired to:

- `onCreateCommentFromChatMessage(...)`
- `onCreateInlineCommentFromVocabulary(...)`

Both handlers live in [`renderer/src/features/assessment-tab/hooks/comments/useAssessmentCommentsActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/comments/useAssessmentCommentsActions.ts).

### Comment creation from the chat bubbles

The comment actions are separate from the bulk LLM generation, but they are part of the user-visible workflow after the assistant replies appear.

- `onCreateCommentFromChatMessage(...)` creates a block feedback item through `addFeedback({ kind: 'block', source: 'llm', commentText: text })`
- `onCreateInlineCommentFromVocabulary(...)` resolves the text span with `resolveInlineSelectionFromText(...)` and builds a draft with `buildVocabularyFeedbackDraft(...)`

Those handlers then switch the UI back to the assessment comments tab and select the newly created comment.

## 5. Electron to Python worker

The Electron orchestrator sends the worker action:

- `llmOrchestrator.requestActionStream(...)` in [`electron/services/llm/llmOrchestrator.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/llmOrchestrator.ts)
- `PythonWorkerClient.request(...)` in [`electron/infrastructure/adapters/pythonWorkerAdapter.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/infrastructure/adapters/pythonWorkerAdapter.ts)

`LlmOrchestrator` supports `llm.paragraph.feedback.bulk` and gives it a longer timeout than ordinary chat.

The Python worker request is handled by:

- `main()` in [`electron-llm/main.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/main.py)
- `HandleRequest.__call__(...)` in [`electron-llm/controllers/handle_request.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/controllers/handle_request.py)

`HandleRequest.__call__(...)` routes `llm.paragraph.feedback.bulk` to:

- `run_paragraph_feedback_bulk(...)` in [`electron-llm/app/pipeline_paragraph_feedback_bulk.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_paragraph_feedback_bulk.py)

## 6. Python runtime setup

`run_paragraph_feedback_bulk(...)` is the Python-side entry for this workflow. It:

- validates `payload["essay"]`
- calls `build_runtime(...)` in [`electron-llm/app/pipeline_builders.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_builders.py)
- gets dependencies from `build_container(...)` in [`electron-llm/app/container.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/container.py)
- selects `llm_service = llm_task_service.llm_service.with_mode("no_think").with_timeout(600.0)`
- runs `run_paragraph_feedback_bundle(...)` in [`electron-llm/nlp/llm/tasks/paragraph_feedback.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/nlp/llm/tasks/paragraph_feedback.py)
- serializes the returned bundle as JSON

The runtime assembly is shared with other Python LLM tasks, but this flow uses the no-think, long-timeout path.

## 7. Python paragraph feedback task

The core feedback generation logic lives in:

- `run_paragraph_feedback_bundle(...)` in [`electron-llm/nlp/llm/tasks/paragraph_feedback.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/nlp/llm/tasks/paragraph_feedback.py)

That task:

- loads the system prompt from `paragraph_knowledge.md`
- builds the paragraph prefix context with `_build_prefix_context(...)`
- collects unexpected reasoning text with `_ReasoningLeakCollector`
- runs topic sentence feedback through `_run_topic_sentence_feedback(...)`
- runs coherence feedback through `_run_coherence_feedback(...)`
- runs vocabulary feedback through `_run_vocabulary_feedback(...)`

The prompt fragments used by this task are stored in:

- [`electron-llm/prompts/paragraph_feedback/topic_sentence_1.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/topic_sentence_1.md)
- [`electron-llm/prompts/paragraph_feedback/topic_sentence_2.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/topic_sentence_2.md)
- [`electron-llm/prompts/paragraph_feedback/topic_sentence_3.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/topic_sentence_3.md)
- [`electron-llm/prompts/paragraph_feedback/coherence_1.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/coherence_1.md)
- [`electron-llm/prompts/paragraph_feedback/coherence_2.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/coherence_2.md)
- [`electron-llm/prompts/paragraph_feedback/coherence_3.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/coherence_3.md)
- [`electron-llm/prompts/paragraph_feedback/vocabulary_simple.md`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/prompts/paragraph_feedback/vocabulary_simple.md)

### The three feedback types currently produced

The current Python workflow produces:

- `topic_sentence` feedback
- `coherence` feedback
- `vocabulary` feedback

The code does not currently generate a separate `supporting_sentence` feedback category. The prompt language talks about supporting sentences, but the implemented output bundle is the three-item set above.

### JSON schema and retry handling

The task uses `_run_json_schema_chat(...)` to force structured output for the sub-steps that need JSON. That helper retries on malformed output and sanitizes schema fields through:

- `_sanitize_schema_object(...)`
- `_sanitize_vocabulary_items(...)`
- `_sanitize_field_value(...)`

If the model leaks reasoning text, `_ReasoningLeakCollector` captures it and `run_paragraph_feedback_bundle(...)` adds a diagnostic warning to the bundle.

## 8. Final return path

The Python worker returns a JSON response to Electron through `success(...)` in [`electron-llm/controllers/responses.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/controllers/responses.py).

Electron receives that response in `ParagraphFeedbackBulkChatService.sendMessage(...)`, converts it into chat messages, persists the results, and emits the final `done` events. The renderer then:

- updates the chat view through `handleChatStreamChunkWorkflow(...)` in [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts)
- renders the assistant messages in `ChatView`
- exposes `Add to comments` or `Add inline comment` buttons when the message qualifies

## 9. Compact summary

In order, the main call chain is:

1. `ChatInterface(...)` in [`renderer/src/layout/ChatInterface.tsx`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface.tsx)
2. `executeChatInterfaceSubmit(...)` in [`renderer/src/layout/ChatInterface/application/chatIntent.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/application/chatIntent.service.ts)
3. `useAssessmentChatActions(...).handleSubmit()` in [`renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts)
4. `submitChatMessageWorkflow(...)` in [`renderer/src/features/assessment-tab/application/chatWorkflow.service.ts`](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts)
5. `registerChatHandlers(...)` in [`electron/ipc/registerHandlers/register.chat.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/registerHandlers/register.chat.ts)
6. `ChatService.sendMessage(...)` in [`electron/services/llm/chatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts)
7. `ParagraphFeedbackBulkChatService.sendMessage(...)` in [`electron/services/llm/paragraphFeedbackBulkChatService.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/paragraphFeedbackBulkChatService.ts)
8. `LlmOrchestrator.requestActionStream(...)` in [`electron/services/llm/llmOrchestrator.ts`](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/llmOrchestrator.ts)
9. `main()` in [`electron-llm/main.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/main.py)
10. `HandleRequest.__call__(...)` in [`electron-llm/controllers/handle_request.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/controllers/handle_request.py)
11. `run_paragraph_feedback_bulk(...)` in [`electron-llm/app/pipeline_paragraph_feedback_bulk.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/app/pipeline_paragraph_feedback_bulk.py)
12. `run_paragraph_feedback_bundle(...)` in [`electron-llm/nlp/llm/tasks/paragraph_feedback.py`](/Users/danielparsons/Documents/Development/EssayLens/electron-llm/nlp/llm/tasks/paragraph_feedback.py)

That is the current end-to-end workflow for `Paragraph feedback in bulk`.
