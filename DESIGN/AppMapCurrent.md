# App Map Current

This file lists the main user-facing features in EssayLens and the vertical slices that implement them.

Format:
- User: what the user does in the UI
- Frontend flow: the main renderer files involved
- Backend flow: the Electron IPC/service/repository files involved
- Effect: what changes in app state, storage, or runtime

## 1. Load Workspace Folder

User:
- Clicks the folder picker in `FileControl.tsx`.

Frontend flow:
- `useFileControl.ts`
- `useSelectFolder.ts`
- `workspace.service.ts`
- `electronWorkspace.adapter.ts`

Backend flow:
- `register.workspace.ts`
- `WorkspaceRepository.ts`
- `fileScanner.ts`

Effect:
- Electron opens the native folder picker.
- The selected folder is saved as the current workspace.
- Supported files in that folder are scanned and saved.
- The workspace file list in the renderer updates.

## 2. Select Workspace File

User:
- Clicks a file in `FileDisplayBar.tsx`.

Frontend flow:
- `useFileControl.ts`
- `workspace.reducer.ts`
- `ChatView.tsx`
- `AssessmentTab.tsx`

Backend flow:
- No immediate IPC call is required for the click itself.

Effect:
- The selected file becomes the active working file in the renderer.
- Assessment, rubric scoring, and chat features switch to that file context.
- A system chat message noting the selected file is added in the renderer.

## 3. Load The Selected Document Into The Assessment View

User:
- Selects a `.docx` or `.pdf` file and opens the Assessment tab.

Frontend flow:
- `AssessmentTab.tsx`
- `TextViewWindow.tsx`
- `useTextViewDocument.ts`
- `textViewDocument.workflows.ts`
- `electronAssessment.adapter.ts`

Backend flow:
- `register.assessment.ts`
- `AssessmentService.ts`
- `WorkspaceRepository.ts`
- `documentExtractor.ts`

Effect:
- The backend resolves the selected file path and reads the source document.
- The renderer receives document payload data for the selected file.
- For `.docx`, the renderer builds the text map needed for anchored comment selection.
- The document becomes viewable in the text window.

## 4. Capture A Text Selection For Inline Commenting

User:
- Highlights text in `TextViewWindow.tsx` and captures it for commenting.

Frontend flow:
- `TextViewWindow.tsx`
- `useTextViewSelection.ts`
- `textView.workflows.ts`
- `ChatInterface.tsx`

Backend flow:
- No immediate backend call.

Effect:
- The renderer creates a pending inline-selection payload with quote and anchors.
- That pending selection is shown in the chat/comment input area.
- The next comment submission can be saved as inline feedback tied to the document location.

## 5. Add A Comment From The Assessment Input

User:
- Types in `ChatInterface.tsx` and submits in comment mode.

Frontend flow:
- `ChatInterface.tsx`
- `useAssessmentChatController.ts`
- `useAddFeedbackMutation.ts`
- `commentsWorkflow.service.ts`
- `assessmentApi.service.ts`
- `electronAssessment.adapter.ts`

Backend flow:
- `register.assessment.ts`
- `AssessmentService.ts`
- `FeedbackRepository.ts`

Effect:
- The comment is saved as either block feedback or inline feedback.
- Inline feedback stores quote and anchor metadata; block feedback stores just the comment text.
- The saved feedback list for the selected file updates in the renderer.

## 6. View Comments For The Selected File

User:
- Opens the comments area in `CommentsView.tsx`.

Frontend flow:
- `useAssessmentCommentsController.ts`
- `useFeedbackListQuery.ts`
- `assessmentApi.service.ts`
- `CommentsView.tsx`

Backend flow:
- `register.assessment.ts`
- `AssessmentService.ts`
- `FeedbackRepository.ts`

Effect:
- The backend loads saved feedback records for the selected file.
- The renderer displays comment cards, grouped into the comments UI for that file.

## 7. Edit, Delete, Apply, Or Send A Comment To The LLM

User:
- Uses the controls in `CommentTools.tsx` on an existing comment.

Frontend flow:
- `useCommentToolsController.ts`
- `useAssessmentCommentsController.ts`
- `commentsWorkflow.service.ts`
- `assessmentApi.service.ts`
- `electronAssessment.adapter.ts`

Backend flow:
- `register.assessment.ts`
- `AssessmentService.ts`
- `FeedbackRepository.ts`

Effect:
- Edit updates the saved comment text.
- Delete removes the feedback record.
- Apply toggles whether the feedback is marked applied.
- Send to LLM creates a new LLM-sourced feedback entry based on the original feedback.

## 8. Generate An Annotated Feedback Document

User:
- Triggers feedback document generation from the comments area.

Frontend flow:
- `useAssessmentCommentsController.ts`
- `feedbackDocument.service.ts`
- `assessmentApi.service.ts`
- `electronAssessment.adapter.ts`

Backend flow:
- `register.assessment.ts`
- `AssessmentService.ts`
- `WorkspaceRepository.ts`
- `FeedbackRepository.ts`
- `feedbackFileGenerator.ts`

Effect:
- The backend loads the source `.docx` and the inline feedback for the selected file.
- A new annotated `.docx` is generated with Word comments inserted.
- The output path is returned to the renderer.

## 9. Browse Chat Sessions For The Selected File

User:
- Opens the chat panel in `ChatView.tsx` for the selected file.

Frontend flow:
- `ChatView.tsx`
- `useChatViewController.ts`
- `chatViewWorkflow.service.ts`
- `electronLlmSession.adapter.ts`

Backend flow:
- `register.llmSession.ts`
- `LlmChatSessionRepository.ts`

Effect:
- The backend loads the saved LLM chat sessions associated with the selected file.
- The renderer shows the session list for that file.

## 10. Create, Select, And Delete Chat Sessions

User:
- Clicks New Chat, opens an existing session, or deletes a session in `ChatView.tsx`.

Frontend flow:
- `useChatViewController.ts`
- `chatViewWorkflow.service.ts`
- `electronLlmSession.adapter.ts`

Backend flow:
- `register.llmSession.ts`
- `LlmChatSessionRepository.ts`
- `LlmOrchestrator.ts`

Effect:
- Creating a chat stores a new session tied to the selected file.
- Selecting a session loads its saved turns.
- Deleting a session removes its persisted session record and clears related Python-side cache.

## 11. Send A Chat Message To The LLM

User:
- Switches `ChatInterface.tsx` to chat mode and submits a message.

Frontend flow:
- `ChatInterface.tsx`
- `chatIntent.service.ts`
- `electronChat.adapter.ts`
- `ChatView.tsx`

Backend flow:
- `register.chat.ts`
- `ChatService.ts`
- `LlmSettingsRepository.ts`
- `LlmSelectionRepository.ts`
- `LlmChatSessionRepository.ts`
- `ChatRepository.ts`
- `LlmOrchestrator.ts`

Effect:
- The backend validates runtime readiness and resolves the active model settings.
- The message is sent through the Python LLM runtime.
- Streamed chunks are sent back to the renderer during generation.
- The final teacher/assistant turn pair is persisted for the session.
- A chat history record is also saved for the file.

## 12. View Available LLM Models

User:
- Opens the Your LLM tab in `LlmManager.tsx`.

Frontend flow:
- `LlmManager.tsx`
- `useLlmManagerController.ts`
- `llmManager.service.ts`
- `electronLlmManager.adapter.ts`

Backend flow:
- `register.llmManager.ts`
- `LlmSelectionRepository.ts`
- `LlmSettingsRepository.ts`

Effect:
- The renderer loads the catalog, downloaded models, active model, and current runtime settings.
- The backend may also clean up downloaded-model records whose files no longer exist.

## 13. Download Or Delete An LLM Model

User:
- Uses `LlmDownload.tsx` to download or remove a model.

Frontend flow:
- `LlmManager.tsx`
- `useLlmManagerMutations.ts`
- `llmManager.service.ts`
- `electronLlmManager.adapter.ts`

Backend flow:
- `register.llmManager.ts`
- `llmModelDownloader.ts`
- `LlmSelectionRepository.ts`

Effect:
- Download fetches the model file and saves its metadata as a downloaded model.
- Download progress events stream back to the renderer.
- Delete removes the downloaded model record and can also remove files from disk.
- If the deleted model was active, runtime model paths are cleared.

## 14. Select The Active LLM Model

User:
- Chooses a downloaded model in `LlmSelector.tsx`.

Frontend flow:
- `LlmManager.tsx`
- `useLlmManagerMutations.ts`
- `llmManager.service.ts`
- `electronLlmManager.adapter.ts`

Backend flow:
- `register.llmManager.ts`
- `LlmSelectionRepository.ts`
- `LlmSettingsRepository.ts`
- `runtimePaths.ts`

Effect:
- The selected model becomes the active model.
- Runtime settings are updated to point at that model’s GGUF path.
- Runtime settings are also updated with the resolved `llama-server` executable path.

## 15. Edit Or Reset LLM Runtime Settings

User:
- Changes values in `LlmConfiguration.tsx` or clicks reset to defaults.

Frontend flow:
- `LlmManager.tsx`
- `useLlmSettingsEditor.ts`
- `useLlmManagerMutations.ts`
- `llmManager.service.ts`
- `electronLlmManager.adapter.ts`

Backend flow:
- `register.llmManager.ts`
- `LlmSettingsRepository.ts`
- `LlmSelectionRepository.ts`

Effect:
- Manual edits update the persisted runtime settings.
- Reset restores runtime settings from the currently active model defaults.

## 16. Browse And Select Rubrics

User:
- Uses `RubricSelection.tsx` to browse and choose a rubric.

Frontend flow:
- `RubricTab.tsx`
- `useRubricTabController.ts`
- `useRubricListQuery.ts`
- `useRubricMutations.ts`
- `electronRubric.adapter.ts`

Backend flow:
- `register.rubric.ts`
- `RubricRepository.ts`

Effect:
- The renderer loads available rubrics and the last-used rubric.
- Selecting a rubric updates the current rubric context.
- The selected rubric is saved as the last-used rubric for the profile.

## 17. Create, Clone, And Delete Rubrics

User:
- Clicks New Rubric, Clone, or Delete in `RubricSelection.tsx`.

Frontend flow:
- `RubricTab.tsx`
- `rubricTab.workflows.ts`
- `useRubricMutations.ts`
- `electronRubric.adapter.ts`

Backend flow:
- `register.rubric.ts`
- `RubricRepository.ts`

Effect:
- Create adds a new rubric with starter categories and scores.
- Clone duplicates an existing rubric into a new editable rubric.
- Delete removes a rubric if it is not active or already in use for grading history.

## 18. Edit A Rubric Matrix

User:
- Edits rubric name, categories, score columns, or cell descriptions in `RubricForReact.tsx`.

Frontend flow:
- `RubricForReact.tsx`
- `useRubricForReactController.ts`
- `useRubricForReactMutations.ts`
- `electronRubric.adapter.ts`

Backend flow:
- `register.rubric.ts`
- `RubricRepository.ts`

Effect:
- The selected rubric matrix is loaded from SQLite.
- Edit operations are persisted back to the rubric tables.
- Archived or locked rubrics are prevented from being edited.

## 19. Score A File Against A Rubric

User:
- Uses `ScoreTool.tsx` to choose rubric cells for the selected file.

Frontend flow:
- `ScoreTool.tsx`
- `useScoreToolController.ts`
- `useScoreToolData.ts`
- `useScoreToolMutations.ts`
- `electronRubric.adapter.ts`

Backend flow:
- `register.rubric.ts`
- `RubricRepository.ts`

Effect:
- The backend loads the file’s grading context, active rubric association, and saved scores.
- Score selections are saved for the selected file and rubric.
- The file becomes associated with the applied rubric for grading history.

## 20. Change Or Clear The Applied Rubric For A File

User:
- Changes rubric selection while scoring, or clears the applied rubric through the score tool flow.

Frontend flow:
- `ScoreTool.tsx`
- `useScoreToolActions.ts`
- `useScoreToolMutations.ts`
- `confirmRubricChange.ts`
- `electronRubric.adapter.ts`

Backend flow:
- `register.rubric.ts`
- `RubricRepository.ts`

Effect:
- Clearing removes the saved file-to-rubric association and the saved scores for that pairing.
- Re-selecting a rubric establishes a new grading context for the file.

## 21. Collapse And Expand The Chat Panel

User:
- Collapses or expands the chat panel from `ChatView.tsx` or `ChatCollapsedRail.tsx`.

Frontend flow:
- `WindowPane.tsx`
- `ChatView.tsx`
- `ChatCollapsedRail.tsx`

Backend flow:
- No backend flow.

Effect:
- This is a renderer-only layout feature.
- It changes panel visibility but does not change persisted backend state.

## Not Yet Wired

- `llmServer/start`, `llmServer/stop`, and `llmServer/status` are implemented in `register.llmServer.ts`, but there is no main UI flow in the renderer that exposes these controls directly.
- `requestLlmAssessment` exists in `assessment.port.ts`, `electronAssessment.adapter.ts`, and `register.assessment.ts`, but there is no completed frontend feature flow for it in the app UI.

## Partially Implemented

- `requestLlmAssessment` is registered, but `register.assessment.ts` currently returns `NOT_IMPLEMENTED`.
- `sendFeedbackToLlm` is exposed as a feature, but `AssessmentService.ts` currently creates a synthetic `LLM follow-up...` feedback record instead of calling the LLM runtime.
- `documentExtractor.ts` currently reads `.docx` and `.pdf` files and returns base64 payloads, but does not extract actual text content yet.
- `textViewDocument.workflows.ts` currently supports `.docx` loading for the structured text view; `.pdf` files are recognized by the backend but are not yet supported by that document view flow.
