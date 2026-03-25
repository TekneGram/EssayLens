import type { ChatMode } from '../domain';

interface ExecuteChatInterfaceSubmitOptions {
  chatMode: ChatMode;
  onChatIntent: () => void;
  onSubmit?: () => void | Promise<void>;
}

export function executeChatInterfaceSubmit(options: ExecuteChatInterfaceSubmitOptions) {
  if (options.chatMode === 'chat') {
    options.onChatIntent();
  }
  return options.onSubmit?.();
}
