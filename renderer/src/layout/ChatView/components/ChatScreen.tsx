import type { ChatViewMessageItem } from '../application/chatView.service';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ChatScreenProps {
  items: ChatViewMessageItem[];
  isLoading: boolean;
  error?: string;
  showLlmLoading?: boolean;
  showThinking?: boolean;
  onCreateCommentFromChatMessage?: (text: string) => void | Promise<void>;
}

export function ChatScreen({
  items,
  isLoading,
  error,
  showLlmLoading = false,
  showThinking = false,
  onCreateCommentFromChatMessage
}: ChatScreenProps) {
  if (isLoading) {
    return <p className="content-block">Loading chat messages...</p>;
  }

  if (error) {
    return <p className="content-block">{error}</p>;
  }

  if (items.length === 0) {
    return <p className="content-block">No messages in this chat yet.</p>;
  }

  const latestAssistantIndex = [...items]
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.roleClassName === 'assistant')
    .map(({ index }) => index)
    .pop();

  return (
    <>
      {showLlmLoading ? <p className="content-block">Loading LLM, please wait a moment</p> : null}
      <ul className="chat-log" data-testid="chat-screen">
        {items.map((item, index) => (
          <li key={item.id} className={`msg ${item.roleClassName}`}>
            <div className="msg-role">{item.roleLabel}</div>
            {item.roleClassName === 'assistant' ? (
              <>
                <div className="msg-body msg-markdown">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                </div>
                {onCreateCommentFromChatMessage && item.canCreateComment && item.content.trim().length > 0 ? (
                  <div className="msg-actions">
                    <button
                      type="button"
                      className="msg-action-button"
                      onClick={() => void onCreateCommentFromChatMessage(item.content)}
                    >
                      Add to comments
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="msg-body msg-body-plain">{item.content}</div>
            )}
            {showThinking && latestAssistantIndex === index ? <div>-----thinking-----</div> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
