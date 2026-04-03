import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInterface } from '@/layout/ChatInterface';

describe('ChatInterface toggle lock rules', () => {
  it('opens command menu from + trigger and selects a command', () => {
    const onCommandSelected = vi.fn();
    render(<ChatInterface onChatIntent={vi.fn()} onCommandSelected={onCommandSelected} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    expect(screen.getByRole('menu').classList.contains('chat-command-menu')).toBe(true);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Overview Comments' }));

    expect(onCommandSelected).toHaveBeenCalledWith({
      id: 'evaluate-simple',
      label: 'Overview Comments',
      source: 'chat-dropdown'
    });
  });

  it('clears command immediately from × trigger when active command is present', () => {
    const onCommandSelected = vi.fn();
    render(
      <ChatInterface
        onChatIntent={vi.fn()}
        onCommandSelected={onCommandSelected}
        activeCommand={{ id: 'evaluate-thesis', label: 'Evaluate Thesis', source: 'chat-dropdown' }}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Clear selected command' }));

    expect(onCommandSelected).toHaveBeenCalledWith(null);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes command menu on Escape', () => {
    render(<ChatInterface onChatIntent={vi.fn()} onCommandSelected={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Open command menu' }));
    expect(screen.getByRole('menu')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('keeps the command row space while hiding command content when no command is active', () => {
    const { container } = render(<ChatInterface onChatIntent={vi.fn()} />);
    const topRow = container.querySelector('.top-row');
    const commandDisplay = screen.getByTestId('command-display');

    expect(topRow).toBeTruthy();
    expect(commandDisplay.classList.contains('is-hidden')).toBe(true);
    expect(commandDisplay.getAttribute('aria-hidden')).toBe('true');
    expect(commandDisplay.textContent).toBe('');
  });

  it('does not render highlighted text display when no text is selected', () => {
    render(<ChatInterface onChatIntent={vi.fn()} />);
    expect(screen.queryByTestId('highlighted-text-stub')).toBeNull();
  });

  it('shows command content when an active command is provided', () => {
    const onCommandSelected = vi.fn();
    render(
      <ChatInterface
        onChatIntent={vi.fn()}
        onCommandSelected={onCommandSelected}
        activeCommand={{ id: 'evaluate-thesis', label: 'Evaluate Thesis', source: 'chat-dropdown' }}
      />
    );
    const commandDisplay = screen.getByTestId('command-display');

    expect(commandDisplay.classList.contains('is-hidden')).toBe(false);
    expect(commandDisplay.getAttribute('aria-hidden')).toBe('false');
    expect(commandDisplay.textContent).toContain('Evaluate Thesis');
    expect(commandDisplay.textContent).not.toContain('Command:');
    fireEvent.click(screen.getByRole('button', { name: 'Clear active command' }));
    expect(onCommandSelected).toHaveBeenCalledWith(null);
  });

  it('renders interface rows in the expected order', () => {
    const { container } = render(<ChatInterface onChatIntent={vi.fn()} />);

    const interfaceArea = container.querySelector('.interface-area');
    const topRow = container.querySelector('.top-row');
    const middleRow = container.querySelector('.middle-row');
    const bottomRow = container.querySelector('.bottom-row');

    expect(interfaceArea).toBeTruthy();
    expect(topRow).toBeTruthy();
    expect(middleRow).toBeTruthy();
    expect(bottomRow).toBeTruthy();
    expect(interfaceArea?.firstElementChild).toBe(topRow);
    expect(topRow?.nextElementSibling).toBe(middleRow);
    expect(middleRow?.nextElementSibling).toBe(bottomRow);
    expect(middleRow?.querySelector('.chat-send-icon')).toBeTruthy();
  });

  it('keeps chat input inside middle row alignment container', () => {
    const { container } = render(<ChatInterface onChatIntent={vi.fn()} />);
    const middleRow = container.querySelector('.middle-row');
    const chatInput = container.querySelector('.middle-row .chat-input');
    const sendButton = container.querySelector('.middle-row .chat-send');

    expect(middleRow).toBeTruthy();
    expect(chatInput).toBeTruthy();
    expect(sendButton).toBeTruthy();
    expect(middleRow?.contains(chatInput)).toBe(true);
    expect(middleRow?.contains(sendButton)).toBe(true);
  });

  it('updates the chat input placeholder to match the selected mode', () => {
    const { rerender } = render(<ChatInterface onChatIntent={vi.fn()} chatMode="comment" />);

    expect(screen.getByLabelText('Message').getAttribute('placeholder')).toBe('Write a comment');

    rerender(<ChatInterface onChatIntent={vi.fn()} chatMode="chat" />);

    expect(screen.getByLabelText('Message').getAttribute('placeholder')).toBe('Chat with me about the essay');
  });

  it('renders chat toggle in top row and highlighted text in bottom row', () => {
    const { container } = render(
      <ChatInterface
        onChatIntent={vi.fn()}
        pendingSelection={{
          exactQuote: 'Selected phrase',
          prefixText: 'prefix',
          suffixText: 'suffix',
          startAnchor: {
            part: 'renderer://original-text-view',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 0
          },
          endAnchor: {
            part: 'renderer://original-text-view',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 14
          }
        }}
      />
    );

    const topRow = container.querySelector('.top-row');
    const bottomRow = container.querySelector('.bottom-row');
    const highlighted = screen.getByTestId('highlighted-text-stub');

    expect(bottomRow?.contains(highlighted)).toBe(true);
    expect(topRow?.contains(highlighted)).toBe(false);
    expect(topRow?.querySelector('.chat-toggle-group')).toBeTruthy();
    expect(bottomRow?.querySelector('.chat-toggle-group')).toBeNull();
  });

  it('renders chat mode send icon as an upward vertical arrow only', () => {
    const { container } = render(<ChatInterface onChatIntent={vi.fn()} chatMode="chat" />);
    const chatIcon = container.querySelector('svg.chat-send-icon--chat');
    const iconPaths = Array.from(chatIcon?.querySelectorAll('path') ?? []).map((path) => path.getAttribute('d'));

    expect(chatIcon).toBeTruthy();
    expect(iconPaths).toEqual(['M12 18V6.5', 'M9 9.5l3-3 3 3']);
    expect(iconPaths).not.toContain('M4.5 6.5h8.5a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3H8l-3 2.5v-2.5H4.5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z');
  });

  it('disables switching to comment mode while lock is active', () => {
    const onModeChange = vi.fn();

    render(
      <ChatInterface
        chatMode="chat"
        isModeLockedToChat
        onModeChange={onModeChange}
        onChatIntent={vi.fn()}
      />
    );

    const commentButton = screen.getByRole('button', { name: 'Switch to comment mode' });
    const chatButton = screen.getByRole('button', { name: 'Switch to chat mode' });

    expect(commentButton.classList.contains('chat-mode-toggle')).toBe(true);
    expect(chatButton.classList.contains('chat-mode-toggle')).toBe(true);
    expect(commentButton.getAttribute('disabled')).not.toBeNull();
    fireEvent.click(commentButton);
    expect(onModeChange).not.toHaveBeenCalledWith('comment');

    fireEvent.click(chatButton);
    expect(onModeChange).toHaveBeenCalledWith('chat');
  });

  it('allows mode switches when lock is inactive', () => {
    const onModeChange = vi.fn();

    render(
      <ChatInterface
        chatMode="chat"
        isModeLockedToChat={false}
        onModeChange={onModeChange}
        onChatIntent={vi.fn()}
      />
    );

    const commentButton = screen.getByRole('button', { name: 'Switch to comment mode' });
    expect(commentButton.getAttribute('disabled')).toBeNull();

    fireEvent.click(commentButton);
    fireEvent.click(screen.getByRole('button', { name: 'Switch to chat mode' }));

    expect(onModeChange).toHaveBeenCalledWith('comment');
    expect(onModeChange).toHaveBeenCalledWith('chat');
  });
});
