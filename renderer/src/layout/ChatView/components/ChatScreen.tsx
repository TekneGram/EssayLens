import type { ChatViewMessageItem } from '../application/chatView.service';

interface ChatScreenProps {
  items: ChatViewMessageItem[];
  isLoading: boolean;
  error?: string;
  showLlmLoading?: boolean;
  showThinking?: boolean;
}

export function ChatScreen({ items, isLoading, error, showLlmLoading = false, showThinking = false }: ChatScreenProps) {
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
            {item.text}
            {showThinking && latestAssistantIndex === index ? <div>-----thinking-----</div> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
