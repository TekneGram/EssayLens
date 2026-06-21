import type { ReactNode } from 'react';
import type { AssessmentTopTab } from '@/app/providers/state';
import { usePorts } from '@/app/ports';
import { useActiveLlmModelQuery } from '@/features/llm-manager/hooks/useActiveLlmModelQuery';

interface AssessmentWindowProps {
  activeTab: AssessmentTopTab;
  onTabChange: (tab: AssessmentTopTab) => void;
  isEssayFeedbackMode: boolean;
  assessmentPanel: ReactNode;
  rubricPanel: ReactNode;
  llmPanel: ReactNode;
  essayFeedbackPanel: ReactNode;
}

export function AssessmentWindow({
  activeTab,
  onTabChange,
  isEssayFeedbackMode,
  assessmentPanel,
  rubricPanel,
  llmPanel,
  essayFeedbackPanel
}: AssessmentWindowProps) {
  const { llmManager } = usePorts();
  const hasLlmManagerApi = llmManager.isAvailable();
  const { data: activeModel } = useActiveLlmModelQuery(hasLlmManagerApi);
  const llmStatusText = activeModel?.displayName ?? 'No LLM installed.';

  return (
    <section className="assessment-window pane main" data-testid="assessment-window" aria-label="Assessment window">
      <div className="main-head">
        <div className="assessment-window-header">
          <div role="tablist" aria-label="Assessment window tabs" className="assessment-window-tabs tabs">
            <button
              id="assessment-tab"
              role="tab"
              type="button"
              aria-selected={activeTab === 'assessment'}
              aria-controls="assessment-panel"
              className={activeTab === 'assessment' ? 'tab active is-active' : 'tab'}
              onClick={() => onTabChange('assessment')}
            >
              Assessment
            </button>
            <button
              id="rubric-tab"
              role="tab"
              type="button"
              aria-selected={activeTab === 'rubric'}
              aria-controls="rubric-panel"
              className={activeTab === 'rubric' ? 'tab active is-active' : 'tab'}
              onClick={() => onTabChange('rubric')}
            >
              Rubric
            </button>
            <button
              id="llm-tab"
              role="tab"
              type="button"
              aria-selected={activeTab === 'llm'}
              aria-controls="llm-panel"
              className={activeTab === 'llm' ? 'tab active is-active' : 'tab'}
              onClick={() => onTabChange('llm')}
            >
              Your LLM
            </button>
            {isEssayFeedbackMode ? (
              <button
                id="essay-feedback-tab"
                role="tab"
                type="button"
                aria-selected={activeTab === 'essay-feedback'}
                aria-controls="essay-feedback-panel"
                className={activeTab === 'essay-feedback' ? 'tab active is-active' : 'tab'}
                onClick={() => onTabChange('essay-feedback')}
              >
                Essay Feedback
              </button>
            ) : null}
          </div>

          <h3 className="assessment-window-title">AssessmentWindow</h3>

          <p className="assessment-llm-status" data-testid="assessment-llm-status">
            Currently using: {llmStatusText}
          </p>
        </div>
      </div>

      <div
        id="assessment-panel"
        className="workspace-panel"
        role="tabpanel"
        aria-labelledby="assessment-tab"
        data-testid="assessment-panel"
        hidden={activeTab !== 'assessment'}
      >
        {assessmentPanel}
      </div>

      <div
        id="rubric-panel"
        className="workspace-panel"
        role="tabpanel"
        aria-labelledby="rubric-tab"
        data-testid="rubric-panel"
        hidden={activeTab !== 'rubric'}
      >
        {rubricPanel}
      </div>

      <div
        id="llm-panel"
        className="workspace-panel"
        role="tabpanel"
        aria-labelledby="llm-tab"
        data-testid="llm-panel"
        hidden={activeTab !== 'llm'}
      >
        {llmPanel}
      </div>
      {isEssayFeedbackMode ? (
        <div
          id="essay-feedback-panel"
          className="workspace-panel"
          role="tabpanel"
          aria-labelledby="essay-feedback-tab"
          data-testid="essay-feedback-panel"
          hidden={activeTab !== 'essay-feedback'}
        >
          {essayFeedbackPanel}
        </div>
      ) : null}
    </section>
  );
}
