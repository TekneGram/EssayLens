import { RubricForReact } from '@/features/rubric-for-react';
import type { ScoreToolViewModel } from '../hooks/useScoreToolController';

interface ScoreToolViewProps {
  viewModel: ScoreToolViewModel;
}

export function ScoreToolView({ viewModel }: ScoreToolViewProps) {
  if (viewModel.kind === 'message') {
    return <div>{viewModel.message}</div>;
  }

  return (
    <>
      <div className="content-block score-tool-toolbar">
        {viewModel.lockedFromDb ? (
          <div className="score-tool-toolbar__row">
            <p className="score-tool-toolbar__applied">Applied rubric: {viewModel.appliedRubricName}</p>
            <button
              type="button"
              className="score-tool-button"
              onClick={viewModel.onRequestChangeRubric}
              disabled={viewModel.isChangingRubric}
            >
              {viewModel.isChangingRubric ? 'Changing...' : 'Change Rubric'}
            </button>
          </div>
        ) : (
          <label className="score-tool-select-field" htmlFor="grading-rubric-select">
            <span className="score-tool-select-field__label">Grading rubric</span>
            <select
              id="grading-rubric-select"
              className="score-tool-select"
              value={viewModel.effectiveRubricId}
              onChange={(event) => {
                viewModel.onSelectRubric(event.target.value);
              }}
            >
              {viewModel.rubrics.map((rubric) => (
                <option key={rubric.entityUuid} value={rubric.entityUuid}>
                  {rubric.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <RubricForReact
        sourceData={viewModel.draftData}
        isGrading
        displayMode="compact-score"
        initialSelectedCellKeys={viewModel.selectedCellKeys}
        onSelectedCellKeysChange={viewModel.onSelectedCellKeysChange}
      />
    </>
  );
}
