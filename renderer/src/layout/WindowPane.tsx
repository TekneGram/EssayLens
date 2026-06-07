import { useState } from 'react';
import { AssessmentWindow } from '@/layout/AssessmentWindow';
import { AssessmentTab } from '@/features/assessment-tab/AssessmentTab';
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

  const collapseChat = () => dispatch(collapseChatPanel());
  const expandChat = () => dispatch(expandChatPanel());

  return (
    <div className="app-shell" data-testid="app-shell" data-chat-collapsed={isChatCollapsed}>
      <FileControlContainer />
      <AssessmentWindow
        activeTab={activeTopTab}
        onTabChange={(tab) => dispatch({ type: 'ui/setTopTab', payload: tab })}
        assessmentPanel={<AssessmentTab selectedFileType={selectedFileType} onChatBindingsChange={setAssessmentChatBindings} />}
        rubricPanel={<RubricTab />}
        llmPanel={<LlmManager />}
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
