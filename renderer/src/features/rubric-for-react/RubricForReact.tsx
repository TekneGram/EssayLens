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

  if (isLoading) {
    return <section className={['rubric', className, classes?.root].filter(Boolean).join(' ')}>Loading rubric...</section>;
  }

  if (isError) {
    return (
      <section className={['rubric', className, classes?.root].filter(Boolean).join(' ')}>
        Unable to load rubric.
        {errorMessage ? ` ${errorMessage}` : ''}
      </section>
    );
  }

  return (
    <section className={['rubric', className, classes?.root].filter(Boolean).join(' ')}>
      <div className="rubric-modebar">
        <h2 className="rubric-modebar__title">
          {state.rubricName}
          {isGrading && <span className="rubric-modebar__tag">can grade</span>}
        </h2>
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
