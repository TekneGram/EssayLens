import type { ActiveCommand } from './chatInterface.types';

export interface ChatCommandOption {
  id: ActiveCommand['id'];
  label: string;
}

export const CHAT_COMMAND_OPTIONS: ChatCommandOption[] = [
  { id: 'evaluate-essay-bulk', label: 'Essay feedback in bulk' },
  { id: 'evaluate-with-rubric', label: 'Rubric based comments' },
  { id: 'paragraph-feedback-bulk', label: 'Paragraph feedback in bulk' }
];

export function toActiveCommand(option: ChatCommandOption): ActiveCommand {
  return {
    id: option.id,
    label: option.label,
    source: 'chat-dropdown'
  };
}
