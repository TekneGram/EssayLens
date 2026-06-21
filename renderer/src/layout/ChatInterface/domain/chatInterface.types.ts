import type { FeedbackAnchor } from '@/features/feedback/domain';
import type { ChatInlineCommentPayload } from '@/app/ports/chat.port';

export type ChatMode = 'comment' | 'chat';
export type CommandId = string;

export interface PendingSelection {
  exactQuote: string;
  prefixText: string;
  suffixText: string;
  startAnchor: FeedbackAnchor;
  endAnchor: FeedbackAnchor;
}

export interface ActiveCommand {
  id: CommandId;
  label: string;
  source: 'chat-dropdown';
}

export interface ChatInterfaceBindings {
  activeCommand: ActiveCommand | null;
  pendingSelection: PendingSelection | null;
  chatMode: ChatMode;
  isModeLockedToChat: boolean;
  isChatSendDisabled: boolean;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
  onModeChange: (mode: ChatMode) => void;
  onCommandSelected: (command: ActiveCommand | null) => void;
  onCreateCommentFromChatMessage?: (text: string) => void | Promise<void>;
  onCreateInlineCommentFromChatMessage?: (payload: ChatInlineCommentPayload) => void | Promise<void>;
}
