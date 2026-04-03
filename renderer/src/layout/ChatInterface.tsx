import { executeChatInterfaceSubmit } from '@/layout/ChatInterface/application/chatIntent.service';
import type { ChatInterfaceBindings } from '@/layout/ChatInterface/domain';
import { ChatInput } from '@/layout/ChatInterface/components/ChatInput';
import { ChatToggle } from '@/layout/ChatInterface/components/ChatToggle';
import { CommandDisplay } from '@/layout/ChatInterface/components/CommandDisplay';
import { CommandDropdown } from '@/layout/ChatInterface/components/CommandDropdown';
import { HighlightedTextDisplay } from '@/layout/ChatInterface/components/HighlightedTextDisplay';

export type { ChatInterfaceBindings };

interface ChatInterfaceProps extends Partial<ChatInterfaceBindings> {
  onChatIntent: () => void;
}

export function ChatInterface({
  activeCommand = null,
  pendingSelection = null,
  chatMode = 'comment',
  draftText = '',
  isModeLockedToChat = false,
  isChatSendDisabled = false,
  onChatIntent,
  onDraftChange,
  onModeChange,
  onSubmit,
  onCommandSelected
}: ChatInterfaceProps) {
  const submitAriaLabel = chatMode === 'comment' ? 'Send comment' : 'Send chat message';
  const inputPlaceholder = chatMode === 'comment' ? 'Write a comment' : 'Chat with me about the essay';
  const hasActiveCommand = Boolean(activeCommand?.id);
  const isSubmitDisabled = chatMode === 'chat' && isChatSendDisabled;
  const handleSubmit = () => {
    if (isSubmitDisabled) {
      return;
    }
    void executeChatInterfaceSubmit({ chatMode, onChatIntent, onSubmit });
  };

  return (
    <section className="chat-interface pane" data-testid="chat-interface" aria-label="Chat interface">
      <div hidden data-testid="assessment-chat-interface-stub">
        {`${chatMode}:${isModeLockedToChat}:${activeCommand?.id ?? 'no-command'}`}
      </div>
      <div className="interface-area">
        <div className="top-row">
          <CommandDisplay
            activeCommand={activeCommand}
            isVisible={hasActiveCommand}
            onClearCommand={() => onCommandSelected?.(null)}
          />
          <ChatToggle chatMode={chatMode} isModeLockedToChat={isModeLockedToChat} onModeChange={onModeChange} />
        </div>
        <div className="middle-row">
          <CommandDropdown activeCommand={activeCommand} onCommandSelected={onCommandSelected} />
          <ChatInput
            draftText={draftText}
            placeholder={inputPlaceholder}
            onDraftChange={onDraftChange}
            onSubmit={handleSubmit}
          />
          <button className="chat-send" type="button" aria-label={submitAriaLabel} disabled={isSubmitDisabled} onClick={handleSubmit}>
            {chatMode === 'comment' ? (
              <svg className="chat-send-icon chat-send-icon--comment" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M4 7h8M4 11h6M4 15h4" />
                <path d="M17.5 18V7.5" />
                <path d="M14.5 10.5l3-3 3 3" />
              </svg>
            ) : (
              <svg className="chat-send-icon chat-send-icon--chat" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M12 18V6.5" />
                <path d="M9 9.5l3-3 3 3" />
              </svg>
            )}
          </button>
        </div>
        <div className="bottom-row">
          <HighlightedTextDisplay pendingSelection={pendingSelection} />
        </div>
      </div>
    </section>
  );
}
