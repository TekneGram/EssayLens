import { useEffect, useRef, useState } from 'react';
import { CHAT_COMMAND_OPTIONS, toActiveCommand } from '../domain';
import type { ActiveCommand } from '../domain';

interface CommandDropdownProps {
  activeCommand?: ActiveCommand | null;
  onCommandSelected?: (command: ActiveCommand | null) => void;
}

export function CommandDropdown({ activeCommand = null, onCommandSelected }: CommandDropdownProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const hasActiveCommand = Boolean(activeCommand?.id);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const handleTriggerClick = () => {
    if (!onCommandSelected) {
      return;
    }
    if (hasActiveCommand) {
      onCommandSelected(null);
      setIsMenuOpen(false);
      return;
    }
    setIsMenuOpen((open) => !open);
  };

  return (
    <div className="chat-command-picker" ref={rootRef}>
      <button
        className="chat-command-trigger"
        type="button"
        aria-label={hasActiveCommand ? 'Clear selected command' : 'Open command menu'}
        aria-haspopup={hasActiveCommand ? undefined : 'menu'}
        aria-expanded={hasActiveCommand ? undefined : isMenuOpen}
        onClick={handleTriggerClick}
      >
        {hasActiveCommand ? '×' : '+'}
      </button>
      {!hasActiveCommand && isMenuOpen ? (
        <div className="chat-command-menu" role="menu" aria-label="Command options">
          {CHAT_COMMAND_OPTIONS.map((option) => (
            <button
              key={option.id}
              className="chat-command-item"
              type="button"
              role="menuitem"
              onClick={() => {
                onCommandSelected?.(toActiveCommand(option));
                setIsMenuOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
