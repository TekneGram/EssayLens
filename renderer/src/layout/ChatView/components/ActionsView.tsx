import type { ChatViewMessageItem } from '../application/chatView.service';

interface ActionsViewProps {
  items: ChatViewMessageItem[];
  showLlmLoading?: boolean;
}

export function ActionsView({ items, showLlmLoading = false }: ActionsViewProps) {
  if (showLlmLoading) {
    return <p className="content-block">Loading LLM, please wait a moment</p>;
  }

  if (items.length === 0) {
    return <p className="content-block">System actions will appear here.</p>;
  }

  return (
    <ul className="chat-log" data-testid="actions-view">
      {items.map((item) => (
        <li key={item.id} className={`msg ${item.roleClassName}`}>
          {item.text}
        </li>
      ))}
    </ul>
  );
}
