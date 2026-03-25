interface ChatControlProps {
  isBackDisabled: boolean;
  isNewChatDisabled: boolean;
  onBack: () => void;
  onNewChat: () => void;
}

export function ChatControl({ isBackDisabled, isNewChatDisabled, onBack, onNewChat }: ChatControlProps) {
  return (
    <div className="chat-control" data-testid="chat-control">
      <button type="button" className="chat-toggle" aria-label="Back to chat list" disabled={isBackDisabled} onClick={onBack}>
        ←
      </button>
      <button type="button" className="chat-toggle" aria-label="Start new chat" disabled={isNewChatDisabled} onClick={onNewChat}>
        +
      </button>
    </div>
  );
}
