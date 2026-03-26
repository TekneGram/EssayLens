import { useEffect, useMemo } from 'react';
import type { AssessmentTabChatBindings } from '../../types';
import type { AssessmentTabLocalState } from '../../state';

interface UseAssessmentChatStateSyncParams {
  localState: AssessmentTabLocalState;
  isModeLockedToChat: boolean;
  isChatSendDisabled: boolean;
  setDraftText: (text: string) => void;
  handleSubmit: () => Promise<void>;
  handleModeChange: (mode: AssessmentTabChatBindings['chatMode']) => void;
  setActiveCommandWithModeRule: (command: AssessmentTabChatBindings['activeCommand']) => void;
  onChatBindingsChange?: (bindings: AssessmentTabChatBindings) => void;
}

export function useAssessmentChatStateSync({
  localState,
  isModeLockedToChat,
  isChatSendDisabled,
  setDraftText,
  handleSubmit,
  handleModeChange,
  setActiveCommandWithModeRule,
  onChatBindingsChange
}: UseAssessmentChatStateSyncParams): void {
  const { activeCommand, pendingSelection, chatMode, draftText } = localState;

  const chatBindings = useMemo<AssessmentTabChatBindings>(
    () => ({
      activeCommand,
      pendingSelection,
      chatMode,
      isModeLockedToChat,
      isChatSendDisabled,
      draftText,
      onDraftChange: setDraftText,
      onSubmit: handleSubmit,
      onModeChange: handleModeChange,
      onCommandSelected: setActiveCommandWithModeRule
    }),
    [
      activeCommand,
      pendingSelection,
      chatMode,
      isModeLockedToChat,
      isChatSendDisabled,
      draftText,
      setDraftText,
      handleSubmit,
      handleModeChange,
      setActiveCommandWithModeRule
    ]
  );

  useEffect(() => {
    if (!onChatBindingsChange) {
      return;
    }
    onChatBindingsChange(chatBindings);
  }, [chatBindings, onChatBindingsChange]);
}
