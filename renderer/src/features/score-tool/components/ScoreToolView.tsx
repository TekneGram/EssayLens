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
      <div className="content-block">
        {viewModel.lockedFromDb ? (
          <>
            <div>Applied rubric: {viewModel.appliedRubricName}</div>
            <button type="button" onClick={viewModel.onRequestChangeRubric} disabled={viewModel.isChangingRubric}>
              {viewModel.isChangingRubric ? 'Changing...' : 'Change Rubric'}
            </button>
          </>
        ) : (
          <>
            <label htmlFor="grading-rubric-select">Grading rubric</label>{' '}
            <select
              id="grading-rubric-select"
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
          </>
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
