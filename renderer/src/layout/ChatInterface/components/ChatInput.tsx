interface ChatInputProps {
  draftText?: string;
  placeholder?: string;
  onDraftChange?: (text: string) => void;
  onSubmit?: () => void;
}

export function ChatInput({
  draftText = '',
  placeholder = 'Write a comment',
  onDraftChange,
  onSubmit
}: ChatInputProps) {
  return (
    <>
      <label htmlFor="chat-input" className="visually-hidden">
        Message
      </label>
      <textarea
        id="chat-input"
        className="chat-input"
        rows={2}
        placeholder={placeholder}
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
