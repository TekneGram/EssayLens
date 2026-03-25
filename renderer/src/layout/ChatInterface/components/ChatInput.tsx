interface ChatInputProps {
  draftText?: string;
  onDraftChange?: (text: string) => void;
  onSubmit?: () => void;
}

export function ChatInput({ draftText = '', onDraftChange, onSubmit }: ChatInputProps) {
  return (
    <>
      <label htmlFor="chat-input" className="visually-hidden">
        Message
      </label>
      <textarea
        id="chat-input"
        className="chat-input"
        rows={2}
        placeholder="Chat with me or write a comment."
        value={draftText}
        onChange={(event) => onDraftChange?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onSubmit?.();
          }
        }}
      />
    </>
  );
}
