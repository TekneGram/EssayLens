import type { ActiveCommand } from '../domain';

interface CommandDisplayProps {
  activeCommand?: ActiveCommand | null;
  isVisible?: boolean;
  onClearCommand?: () => void;
}

export function CommandDisplay({ activeCommand = null, isVisible = true, onClearCommand }: CommandDisplayProps) {
  const className = isVisible ? 'chat-command-display' : 'chat-command-display is-hidden';

  return (
    <div className={className} data-testid="command-display" aria-hidden={!isVisible}>
      {isVisible ? (
        <>
          <span className="chat-command-label" title={activeCommand?.label}>
            {activeCommand?.label ?? ''}
          </span>
          <button className="chat-command-clear" type="button" aria-label="Clear active command" onClick={onClearCommand}>
            ×
          </button>
        </>
      ) : null}
    </div>
  );
}
