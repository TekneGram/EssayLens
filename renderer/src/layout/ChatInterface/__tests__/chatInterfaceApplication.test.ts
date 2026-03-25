import { describe, expect, it, vi } from 'vitest';
import { executeChatInterfaceSubmit } from '@/layout/ChatInterface/application/chatIntent.service';
import { CHAT_COMMAND_OPTIONS, toActiveCommand } from '@/layout/ChatInterface/domain';

describe('chat-interface application/domain seams', () => {
  it('triggers chat intent only in chat mode', () => {
    const onChatIntent = vi.fn();
    const onSubmit = vi.fn();

    executeChatInterfaceSubmit({ chatMode: 'comment', onChatIntent, onSubmit });
    expect(onChatIntent).not.toHaveBeenCalled();
    expect(onSubmit).toHaveBeenCalledTimes(1);

    executeChatInterfaceSubmit({ chatMode: 'chat', onChatIntent, onSubmit });
    expect(onChatIntent).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('maps command option into active command', () => {
    const option = CHAT_COMMAND_OPTIONS[0];
    if (!option) {
      throw new Error('Expected at least one command option');
    }

    expect(toActiveCommand(option)).toEqual({
      id: option.id,
      label: option.label,
      source: 'chat-dropdown'
    });
  });
});
