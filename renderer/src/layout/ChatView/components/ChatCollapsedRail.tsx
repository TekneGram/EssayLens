interface ChatCollapsedRailProps {
  onExpand: () => void;
}

export function ChatCollapsedRail({ onExpand }: ChatCollapsedRailProps) {
  return (
    <aside className="chat-collapsed-rail pane" data-testid="chat-collapsed-rail" aria-label="Collapsed chat panel">
      <button className="chat-toggle chat-toggle-expand" type="button" aria-label="Expand chat panel" onClick={onExpand}>
        ›
      </button>
    </aside>
  );
}
