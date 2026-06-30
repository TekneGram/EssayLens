import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { AssessmentWindow } from '@/layout/AssessmentWindow';
import { AssessmentTab } from '@/features/assessment-tab/AssessmentTab';
import EssayFeedbackManager from '@/features/essay-feedback-manager/components/EssayFeedbackManager';
import {
  INITIAL_ESSAY_FEEDBACK_SELECTION,
  type EssayFeedbackSelectionState
} from '@/features/essay-feedback-manager/essayFeedbackManager.types';
import { ChatInterface } from '@/layout/ChatInterface';
import type { ChatInterfaceBindings } from '@/layout/ChatInterface';
import { ChatCollapsedRail, ChatView, collapseChatPanel, expandChatPanel, selectIsChatCollapsed } from '@/layout/ChatView';
import { FileControlContainer } from '@/layout/FileControlContainer';
import { LlmManager } from '@/features/llm-manager/LlmManager';
import { useLlmManagerMutations } from '@/features/llm-manager/hooks/useLlmManagerMutations';
import { useLlmSettingsQuery } from '@/features/llm-manager/hooks/useLlmSettingsQuery';
import { RubricTab } from '@/features/rubric-tab';
import { selectActiveTopTab, selectSelectedFileType, useAppDispatch, useAppState } from '@/app/providers/state';

const ESSAY_BULK_MAX_TOKENS = 2048;
const DEFAULT_MAX_TOKENS_COPY = 1024;

export default function WindowPane() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const llmSettingsQuery = useLlmSettingsQuery();
  const { updateSettings, isSavingSettings } = useLlmManagerMutations();
  const [assessmentChatBindings, setAssessmentChatBindings] = useState<ChatInterfaceBindings | null>(null);
  const [essayFeedbackSelection, setEssayFeedbackSelection] = useState<EssayFeedbackSelectionState>(
    INITIAL_ESSAY_FEEDBACK_SELECTION
  );
  const activeTopTab = selectActiveTopTab(state);
  const selectedFileType = selectSelectedFileType(state);
  const isChatCollapsed = selectIsChatCollapsed(state);
  const isEssayFeedbackMode = assessmentChatBindings?.activeCommand?.id === 'evaluate-essay-bulk';
  const wasEssayFeedbackModeRef = useRef(isEssayFeedbackMode);
  const isMountedRef = useRef(true);
  const pendingEssayBulkMaxTokensSyncRef = useRef(false);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useLayoutEffect(() => {
    const wasEssayFeedbackMode = wasEssayFeedbackModeRef.current;
    const isEnteringEssayFeedbackMode = isEssayFeedbackMode && !wasEssayFeedbackMode;
    const isLeavingEssayFeedbackMode = !isEssayFeedbackMode && wasEssayFeedbackMode;

    if (isEnteringEssayFeedbackMode) {
      if (activeTopTab !== 'essay-feedback') {
        dispatch({ type: 'ui/setTopTab', payload: 'essay-feedback' });
      }
      pendingEssayBulkMaxTokensSyncRef.current = true;
    }

    if (isLeavingEssayFeedbackMode) {
      if (activeTopTab === 'essay-feedback') {
        dispatch({ type: 'ui/setTopTab', payload: 'assessment' });
      }
      toast.info(
        `Essay feedback in bulk leaves max_tokens at ${ESSAY_BULK_MAX_TOKENS}. If you want to change it back to the default ${DEFAULT_MAX_TOKENS_COPY}, update it in Your LLM.`
      );
    }
    wasEssayFeedbackModeRef.current = isEssayFeedbackMode;
  }, [activeTopTab, dispatch, isEssayFeedbackMode]);

  useEffect(() => {
    if (!isEssayFeedbackMode || !pendingEssayBulkMaxTokensSyncRef.current) {
      return;
    }
    const settings = llmSettingsQuery.data;
    if (!settings || isSavingSettings) {
      return;
    }
    if (settings.max_tokens === ESSAY_BULK_MAX_TOKENS) {
      pendingEssayBulkMaxTokensSyncRef.current = false;
      return;
    }

    void updateSettings({ max_tokens: ESSAY_BULK_MAX_TOKENS })
      .then(() => {
        if (!isMountedRef.current) {
          return;
        }
        toast.info(
          `Essay feedback in bulk increased max_tokens to ${ESSAY_BULK_MAX_TOKENS} from ${settings.max_tokens}.`
        );
      })
      .catch((error: unknown) => {
        if (!isMountedRef.current) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not update max_tokens for essay feedback in bulk.';
        toast.error(message);
      })
      .finally(() => {
        if (isMountedRef.current) {
          pendingEssayBulkMaxTokensSyncRef.current = false;
        }
      });
  }, [isEssayFeedbackMode, isSavingSettings, llmSettingsQuery.data, updateSettings]);

  const collapseChat = () => dispatch(collapseChatPanel());
  const expandChat = () => dispatch(expandChatPanel());

  return (
    <div className="app-shell" data-testid="app-shell" data-chat-collapsed={isChatCollapsed}>
      <FileControlContainer />
      <AssessmentWindow
        activeTab={activeTopTab}
        onTabChange={(tab) => dispatch({ type: 'ui/setTopTab', payload: tab })}
        isEssayFeedbackMode={isEssayFeedbackMode}
        assessmentPanel={
          <AssessmentTab
            selectedFileType={selectedFileType}
            essayFeedbackSelection={essayFeedbackSelection}
            onChatBindingsChange={setAssessmentChatBindings}
          />
        }
        rubricPanel={<RubricTab />}
        llmPanel={<LlmManager />}
        essayFeedbackPanel={
          <EssayFeedbackManager
            selection={essayFeedbackSelection}
            onSelectionChange={setEssayFeedbackSelection}
          />
        }
      />
      {isChatCollapsed ? (
        <ChatCollapsedRail onExpand={expandChat} />
      ) : (
        <ChatView
          onCollapse={collapseChat}
          onCreateCommentFromChatMessage={assessmentChatBindings?.onCreateCommentFromChatMessage}
          onCreateInlineCommentFromChatMessage={assessmentChatBindings?.onCreateInlineCommentFromChatMessage}
        />
      )}
      <ChatInterface onChatIntent={expandChat} {...(assessmentChatBindings ?? {})} />
    </div>
  );
}
