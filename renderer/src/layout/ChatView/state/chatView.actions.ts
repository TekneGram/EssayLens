type SetChatCollapsedAction = { type: 'ui/setChatCollapsed'; payload: boolean };

export function setChatCollapsed(payload: boolean): SetChatCollapsedAction {
  return { type: 'ui/setChatCollapsed', payload };
}

export function collapseChatPanel(): SetChatCollapsedAction {
  return setChatCollapsed(true);
}

export function expandChatPanel(): SetChatCollapsedAction {
  return setChatCollapsed(false);
}

export type ChatViewAction = SetChatCollapsedAction;
