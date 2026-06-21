import { useState } from 'react';
import '../styles/essay-feedback-manager.css';
import {
  ESSAY_FEEDBACK_ROWS,
  INITIAL_ESSAY_FEEDBACK_SELECTION,
  isEssayFeedbackSelectionLocked,
  normalizeEssayFeedbackSelection,
  type EssayFeedbackProcessKey,
  type EssayFeedbackSelectionState
} from '../essayFeedbackManager.types';

interface EssayFeedbackManagerProps {
  selection?: EssayFeedbackSelectionState;
  onSelectionChange?: (selection: EssayFeedbackSelectionState) => void;
}

export default function EssayFeedbackManager({
  selection: controlledSelection,
  onSelectionChange
}: EssayFeedbackManagerProps) {
  const [localSelection, setLocalSelection] = useState<EssayFeedbackSelectionState>(
    INITIAL_ESSAY_FEEDBACK_SELECTION
  );
  const selected = controlledSelection ?? localSelection;

  const setSelection = (next: EssayFeedbackSelectionState) => {
    if (onSelectionChange) {
      onSelectionChange(next);
      return;
    }
    setLocalSelection(next);
  };

  const setCheckbox = (key: EssayFeedbackProcessKey, nextChecked: boolean) => {
    setSelection(
      normalizeEssayFeedbackSelection({
        ...selected,
        [key]: nextChecked
      })
    );
  };

  return (
    <section className="essay-feedback-manager" data-testid="essay-feedback-manager" aria-label="Essay feedback manager">
      <h4 className="essay-feedback-manager__title">Essay Feedback</h4>
      <div className="essay-feedback-manager__table-wrap">
        <table className="essay-feedback-manager__table">
          <thead>
            <tr>
              <th scope="col">LLM feedback process</th>
              <th scope="col">Explanation</th>
              <th scope="col">Select</th>
            </tr>
          </thead>
          <tbody>
            {ESSAY_FEEDBACK_ROWS.map((row) => (
              <tr key={row.key} className={row.locked ? 'essay-feedback-manager__row essay-feedback-manager__row--locked' : 'essay-feedback-manager__row'}>
                <th scope="row">{row.label}</th>
                <td>{row.explanation}</td>
                <td>
                  <label className="essay-feedback-manager__checkbox">
                    <input
                      type="checkbox"
                      checked={selected[row.key]}
                      disabled={isEssayFeedbackSelectionLocked(row.key, selected)}
                      onChange={(event) => setCheckbox(row.key, event.target.checked)}
                      aria-label={row.label}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
