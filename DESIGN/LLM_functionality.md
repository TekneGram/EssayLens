# LLM Functionality

## Implemented LLM-backed use cases

### 1. Ask questions about the currently selected essay in chat

The user can switch the bottom input into `chat` mode and send a prompt tied to the selected file. The frontend includes the selected file ID, optional highlighted quote context, and the essay text on first send for that session. Responses stream back into the UI.

Relevant code:
- [renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/chat/useAssessmentChatActions.ts#L107)
- [renderer/src/features/assessment-tab/application/chatWorkflow.service.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts#L33)
- [electron/services/llm/chatService.ts](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts#L92)

### 2. Continue multi-turn chat sessions for a file

This is the same chat feature, but with persisted session memory. The chat service resolves a session ID, loads recent turns, sends them with the new request, and persists the teacher/assistant turn pair afterward. From the user’s point of view, that means they can open a file, start a chat, and continue that conversation later.

Relevant code:
- [electron/services/llm/chatService.ts](/Users/danielparsons/Documents/Development/EssayLens/electron/services/llm/chatService.ts#L134)
- [renderer/src/layout/ChatView.tsx](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatView.tsx#L11)

### 3. Manage which local LLM is installed and active

This is not text generation, but it is a real frontend LLM workflow the user can perform: open `Your LLM`, download a model, select the active model, and tune or reset runtime settings. This is the prerequisite for chat to work.

Relevant code:
- [renderer/src/layout/AssessmentWindow.tsx](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/AssessmentWindow.tsx#L21)
- [renderer/src/features/llm-manager/LlmManager.tsx](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/llm-manager/LlmManager.tsx#L7)

## LLM-labeled UX that is not actually using the model yet

### 4. “Send to LLM” on an existing comment is currently a stub

The frontend lets the user choose commands like `Evaluate Thesis` or `Check Hedging` and click `Send to LLM` from a comment tool. But the backend does not call the LLM there. It just creates a new feedback item whose text is `LLM follow-up...` plus the original comment.

Relevant code:
- [renderer/src/features/comments-view/components/CommentTools.tsx](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/comments-view/components/CommentTools.tsx#L51)
- [renderer/src/features/assessment-tab/hooks/comments/useAssessmentCommentsActions.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/hooks/comments/useAssessmentCommentsActions.ts#L126)
- [electron/services/assessment/assessmentService.ts](/Users/danielparsons/Documents/Development/EssayLens/electron/services/assessment/assessmentService.ts#L204)

### 5. Chat command dropdown options are UI-only right now

The user can pick `Overview Comments`, `Rubric based comments`, or `Comment in bulk`, and that does affect UI state by forcing chat mode. But those commands are not sent through the actual chat request payload. These are affordances for a future feature, not real LLM behaviors today.

Relevant code:
- [renderer/src/layout/ChatInterface/domain/commands.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/layout/ChatInterface/domain/commands.ts#L8)
- [renderer/src/features/assessment-tab/application/chatWorkflow.service.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/features/assessment-tab/application/chatWorkflow.service.ts#L82)

### 6. “Request LLM assessment” exists in the port but is not implemented

There is an assessment API shape for whole-document LLM assessment, but the Electron handler explicitly throws `not implemented`. So there is no current frontend feature the user can successfully use for full auto-assessment.

Relevant code:
- [renderer/src/app/ports/assessment.port.ts](/Users/danielparsons/Documents/Development/EssayLens/renderer/src/app/ports/assessment.port.ts#L111)
- [electron/ipc/registerHandlers/register.assessment.ts](/Users/danielparsons/Documents/Development/EssayLens/electron/ipc/registerHandlers/register.assessment.ts#L66)
