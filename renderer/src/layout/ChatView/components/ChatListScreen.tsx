import type { LlmSessionListItemDto } from '@/app/ports/llmSession.port';

interface ChatListScreenProps {
  sessions: LlmSessionListItemDto[];
  activeSessionId?: string;
  isLoading: boolean;
  error?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
}

function toReadableDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  return date.toLocaleString();
}

export function ChatListScreen({ sessions, activeSessionId, isLoading, error, onSessionSelect, onSessionDelete }: ChatListScreenProps) {
  if (isLoading) {
    return <p className="content-block">Loading chat sessions...</p>;
  }

  if (error) {
    return <p className="content-block">{error}</p>;
  }

  if (sessions.length === 0) {
    return <p className="content-block">No chats yet for this file. Start a new chat to begin.</p>;
  }

  return (
    <ul className="chat-log" data-testid="chat-list-screen">
      {sessions.map((session, index) => (
        <li key={session.sessionId}>
          <div className={`msg chat-session-item ${session.sessionId === activeSessionId ? 'assistant' : 'system'}`}>
            <button
              type="button"
              className="chat-session-open"
              aria-label={`Open Chat ${index + 1}`}
              onClick={() => onSessionSelect(session.sessionId)}
            >
              <strong>{`Chat ${index + 1}`}</strong>
              <br />
              Last used: {toReadableDate(session.lastUsedAt)}
            </button>
            <button
              type="button"
              className="chat-session-delete"
              aria-label={`Delete Chat ${index + 1}`}
              onClick={() => onSessionDelete(session.sessionId)}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
