import { useLayoutEffect, useRef, useState } from 'react';
import { AssessmentWindow } from '@/layout/AssessmentWindow';
import { AssessmentTab } from '@/features/assessment-tab/AssessmentTab';
import EssayFeedbackManager from '@/features/essay-feedback-manager/components/EssayFeedbackManager';
import { ChatInterface } from '@/layout/ChatInterface';
import type { ChatInterfaceBindings } from '@/layout/ChatInterface';
import { ChatCollapsedRail, ChatView, collapseChatPanel, expandChatPanel, selectIsChatCollapsed } from '@/layout/ChatView';
import { FileControlContainer } from '@/layout/FileControlContainer';
import { LlmManager } from '@/features/llm-manager/LlmManager';
import { RubricTab } from '@/features/rubric-tab';
import { selectActiveTopTab, selectSelectedFileType, useAppDispatch, useAppState } from '@/app/providers/state';

export default function WindowPane() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [assessmentChatBindings, setAssessmentChatBindings] = useState<ChatInterfaceBindings | null>(null);
  const activeTopTab = selectActiveTopTab(state);
  const selectedFileType = selectSelectedFileType(state);
  const isChatCollapsed = selectIsChatCollapsed(state);
  const isEssayFeedbackMode = assessmentChatBindings?.activeCommand?.id === 'evaluate-essay-bulk';
  const wasEssayFeedbackModeRef = useRef(isEssayFeedbackMode);

  useLayoutEffect(() => {
    const wasEssayFeedbackMode = wasEssayFeedbackModeRef.current;
    const isEnteringEssayFeedbackMode = isEssayFeedbackMode && !wasEssayFeedbackMode;
    const isLeavingEssayFeedbackMode = !isEssayFeedbackMode && wasEssayFeedbackMode;

    if (isEnteringEssayFeedbackMode && activeTopTab !== 'essay-feedback') {
      dispatch({ type: 'ui/setTopTab', payload: 'essay-feedback' });
    }

    if (isLeavingEssayFeedbackMode && activeTopTab === 'essay-feedback') {
      dispatch({ type: 'ui/setTopTab', payload: 'assessment' });
    }
    wasEssayFeedbackModeRef.current = isEssayFeedbackMode;
  }, [activeTopTab, dispatch, isEssayFeedbackMode]);

  const collapseChat = () => dispatch(collapseChatPanel());
  const expandChat = () => dispatch(expandChatPanel());

  return (
    <div className="app-shell" data-testid="app-shell" data-chat-collapsed={isChatCollapsed}>
      <FileControlContainer />
      <AssessmentWindow
        activeTab={activeTopTab}
        onTabChange={(tab) => dispatch({ type: 'ui/setTopTab', payload: tab })}
        isEssayFeedbackMode={isEssayFeedbackMode}
        assessmentPanel={<AssessmentTab selectedFileType={selectedFileType} onChatBindingsChange={setAssessmentChatBindings} />}
        rubricPanel={<RubricTab />}
        llmPanel={<LlmManager />}
        essayFeedbackPanel={<EssayFeedbackManager />}
      />
      {isChatCollapsed ? (
        <ChatCollapsedRail onExpand={expandChat} />
      ) : (
        <ChatView
          onCollapse={collapseChat}
          onCreateCommentFromChatMessage={assessmentChatBindings?.onCreateCommentFromChatMessage}
          onCreateInlineCommentFromVocabulary={assessmentChatBindings?.onCreateInlineCommentFromVocabulary}
        />
      )}
      <ChatInterface onChatIntent={expandChat} {...(assessmentChatBindings ?? {})} />
    </div>
  );
}
