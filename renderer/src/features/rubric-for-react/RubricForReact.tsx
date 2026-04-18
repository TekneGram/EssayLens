import { RubricTable } from '@/features/rubric-for-react/components/RubricTable';
import { RubricToolbar } from '@/features/rubric-for-react/components/RubricToolbar';
import type { RubricForReactProps } from '@/features/rubric-for-react/domain';
import { useRubricForReactController } from '@/features/rubric-for-react/hooks/useRubricForReactController';
import '../../styles/rubric.css';

export function RubricForReact({
  rubricId = null,
  sourceData,
  isGrading = false,
  canEdit = true,
  displayMode = 'full',
  className,
  classes,
  mode,
  onModeChange,
  onSelectedCellKeysChange,
  initialSelectedCellKeys,
  onSetRubricName,
  onAddCategory,
  onAddScore,
  onRenameCategory,
  onRemoveCategory,
  onSetScoreValue,
  onRemoveScore,
  onSetCellDescription,
  onChange
}: RubricForReactProps) {
  const {
    isLoading,
    isError,
    errorMessage,
    state,
    effectiveEditingMode,
    effectiveMode,
    selectedCellKeys,
    toggleMode,
    handleSetRubricName,
    handleAddCategory,
    handleAddScore,
    handleRenameCategory,
    handleSetScoreValue,
    handleRemoveCategory,
    handleRemoveScore,
    handleSetCellDescription,
    selectCell,
    deselectCell
  } = useRubricForReactController({
    rubricId,
    sourceData,
    isGrading,
    canEdit,
    mode,
    onModeChange,
    onSelectedCellKeysChange,
    initialSelectedCellKeys,
    onSetRubricName,
    onAddCategory,
    onAddScore,
    onRenameCategory,
    onRemoveCategory,
    onSetScoreValue,
    onRemoveScore,
    onSetCellDescription,
    onChange
  });
  const visualMode = effectiveEditingMode === 'editing' ? 'editing' : 'viewing';
  const rootClassName = ['rubric', className, classes?.root].filter(Boolean).join(' ');

  if (isLoading) {
    return (
      <section className={rootClassName} data-rubric-mode={visualMode}>
        Loading rubric...
      </section>
    );
  }

  if (isError) {
    return (
      <section className={rootClassName} data-rubric-mode={visualMode}>
        Unable to load rubric.
        {errorMessage ? ` ${errorMessage}` : ''}
      </section>
    );
  }

  return (
    <section className={rootClassName} data-rubric-mode={visualMode}>
      <div className="rubric-modebar">
        <div className="rubric-modebar__heading">
          <h2 className="rubric-modebar__title">
            {state.rubricName}
            {isGrading && <span className="rubric-modebar__tag">can grade</span>}
          </h2>
          <span className="rubric-modebar__badge">{visualMode === 'editing' ? 'Editing' : 'Viewing'}</span>
        </div>
        {!isGrading && canEdit && (
          <button type="button" className="rubric-modebar__toggle" onClick={toggleMode}>
            {effectiveEditingMode === 'editing' ? 'Switch to Viewing' : 'Switch to Editing'}
          </button>
        )}
      </div>
      {effectiveMode === 'editing' && (
        <RubricToolbar
          className={classes?.toolbar}
          rubricName={state.rubricName}
          onRubricNameChange={handleSetRubricName}
          onAddCategory={handleAddCategory}
          onAddScore={handleAddScore}
        />
      )}
      <RubricTable
        state={state}
        mode={effectiveMode}
        selectedCellKeys={selectedCellKeys}
        displayMode={displayMode}
        classNames={{
          tableWrap: classes?.tableWrap,
          table: classes?.table,
          axisField: classes?.axisField,
          axisInput: classes?.axisInput,
          deleteButton: classes?.deleteButton,
          cellTextarea: classes?.cellTextarea
        }}
        onRenameCategory={handleRenameCategory}
        onRemoveCategory={handleRemoveCategory}
        onSetScoreValue={handleSetScoreValue}
        onRemoveScore={handleRemoveScore}
        onSetCellDescription={handleSetCellDescription}
        onSelectCell={selectCell}
        onDeselectCell={deselectCell}
      />
    </section>
  );
}
