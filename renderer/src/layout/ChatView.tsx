import type { ChatInlineCommentPayload } from '@/app/ports/chat.port';
import { ChatControl } from '@/layout/ChatView/components/ChatControl';
import { ChatListScreen } from '@/layout/ChatView/components/ChatListScreen';
import { ChatScreen } from '@/layout/ChatView/components/ChatScreen';
import { useChatViewController } from '@/layout/ChatView/hooks/useChatViewController';

export { ChatCollapsedRail } from '@/layout/ChatView/components/ChatCollapsedRail';
export { collapseChatPanel, expandChatPanel, selectIsChatCollapsed } from '@/layout/ChatView/state';

interface ChatViewProps {
  onCollapse: () => void;
  onCreateCommentFromChatMessage?: (text: string) => void | Promise<void>;
  onCreateInlineCommentFromChatMessage?: (payload: ChatInlineCommentPayload) => void | Promise<void>;
}

export function ChatView({
  onCollapse,
  onCreateCommentFromChatMessage,
  onCreateInlineCommentFromChatMessage
}: ChatViewProps) {
  const {
    fileEntityUuid,
    activeScreen,
    sessions,
    activeSessionId,
    sessionsStatus,
    sessionsError,
    sessionItems,
    isSessionTurnsLoading,
    sessionTurnsError,
    showLlmLoading,
    showThinking,
    onBack,
    onSessionSelect,
    onNewChat,
    onSessionDelete
  } = useChatViewController();

  return (
    <section className="chat-view pane chat" data-testid="chat-view" aria-label="Chat view">
      <div className="chat-head">
        <ChatControl
          isBackDisabled={activeScreen === 'list' || !fileEntityUuid}
          isNewChatDisabled={!fileEntityUuid}
          onBack={onBack}
          onNewChat={() => void onNewChat()}
        />
        <button className="chat-toggle chat-toggle-collapse" type="button" aria-label="Collapse chat panel" onClick={onCollapse}>
          ‹
        </button>
      </div>
      <div className="chat-main" data-testid="chat-main">
        {!fileEntityUuid ? <p className="content-block">Select a file to load chat sessions.</p> : null}
        {fileEntityUuid && activeScreen === 'list' ? (
          <ChatListScreen
            sessions={sessions}
            activeSessionId={activeSessionId}
            isLoading={sessionsStatus === 'loading'}
            error={sessionsError}
            onSessionSelect={onSessionSelect}
            onSessionDelete={onSessionDelete}
          />
        ) : null}
        {fileEntityUuid && activeScreen === 'chat' ? (
          <ChatScreen
            items={sessionItems}
            isLoading={isSessionTurnsLoading && sessionItems.length === 0}
            error={sessionTurnsError}
            showLlmLoading={showLlmLoading}
            showThinking={showThinking}
            onCreateCommentFromChatMessage={onCreateCommentFromChatMessage}
            onCreateInlineCommentFromChatMessage={onCreateInlineCommentFromChatMessage}
          />
        ) : null}
      </div>
    </section>
  );
}
