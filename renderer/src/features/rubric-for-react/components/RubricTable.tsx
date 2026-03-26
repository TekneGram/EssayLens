import { useEffect, useState } from 'react';
import { createCellKey } from '@/features/rubric-for-react/domain';
import type { NormalizedRubric, RubricDisplayMode, RubricInteractionMode } from '@/features/rubric-for-react/domain';

interface RubricTableProps {
  state: NormalizedRubric;
  mode: RubricInteractionMode;
  selectedCellKeys?: Set<string>;
  displayMode?: RubricDisplayMode;
  onRenameCategory: (categoryId: string, name: string) => void;
  onRemoveCategory: (categoryId: string) => void;
  onSetScoreValue: (scoreId: string, value: number) => void;
  onRemoveScore: (scoreId: string) => void;
  onSetCellDescription: (categoryId: string, scoreId: string, description: string) => void;
  onSelectCell?: (categoryId: string, scoreId: string) => void;
  onDeselectCell?: (categoryId: string, scoreId: string) => void;
  classNames?: {
    tableWrap?: string;
    table?: string;
    axisField?: string;
    axisInput?: string;
    deleteButton?: string;
    cellTextarea?: string;
  };
}

export function RubricTable(props: RubricTableProps) {
  const {
    state,
    mode,
    selectedCellKeys,
    displayMode = 'full',
    onRenameCategory,
    onRemoveCategory,
    onSetScoreValue,
    onRemoveScore,
    onSetCellDescription,
    onSelectCell,
    onDeselectCell,
    classNames
  } = props;
  const isEditing = mode === 'editing';
  const isGrading = mode === 'grading';
  const isCompactScoreMode = displayMode === 'compact-score' && !isEditing;
  const [scoreDrafts, setScoreDrafts] = useState<Record<string, string>>({});
  const [tooltipState, setTooltipState] = useState<{ visible: boolean; text: string; x: number; y: number }>({
    visible: false,
    text: '',
    x: 0,
    y: 0
  });

  const hideTooltip = () => {
    setTooltipState((previous) => (previous.visible ? { ...previous, visible: false } : previous));
  };

  const showTooltipNearPointer = (text: string, clientX: number, clientY: number) => {
    if (!text) {
      hideTooltip();
      return;
    }
    const maxX = Math.max(24, window.innerWidth - 340);
    const maxY = Math.max(24, window.innerHeight - 160);
    setTooltipState({
      visible: true,
      text,
      x: Math.min(clientX + 14, maxX),
      y: Math.min(clientY + 14, maxY)
    });
  };

  useEffect(() => {
    setScoreDrafts((previous) => {
      const next: Record<string, string> = {};
      for (const scoreId of state.scoreOrder) {
        next[scoreId] = previous[scoreId] ?? String(state.scoresById[scoreId]?.value ?? '');
      }
      return next;
    });
  }, [state.scoreOrder, state.scoresById]);

  const commitScoreDraft = (scoreId: string) => {
    const score = state.scoresById[scoreId];
    if (!score) return;
    const draftValue = (scoreDrafts[scoreId] ?? String(score.value)).trim();
    if (!draftValue) {
      setScoreDrafts((previous) => ({ ...previous, [scoreId]: String(score.value) }));
      return;
    }

    const parsed = Number(draftValue);
    const isValid = Number.isFinite(parsed) && parsed > 0 && parsed < 1000;
    if (!isValid) {
      setScoreDrafts((previous) => ({ ...previous, [scoreId]: String(score.value) }));
      return;
    }

    setScoreDrafts((previous) => ({ ...previous, [scoreId]: String(parsed) }));
    if (parsed !== score.value) {
      onSetScoreValue(scoreId, parsed);
    }
  };

  const compactCategoryLabel = (name: string): string => name.slice(0, 7);

  return (
    <div className={['rubric-table-wrap', classNames?.tableWrap].filter(Boolean).join(' ')}>
      <table
        className={['rubric-table', isCompactScoreMode ? 'rubric-table--compact' : '', classNames?.table]
          .filter(Boolean)
          .join(' ')}
      >
        <colgroup>
          <col className={['rubric-table__score-col', isCompactScoreMode ? 'rubric-table__score-col--compact' : ''].join(' ')} />
          <col span={state.categoryOrder.length} />
        </colgroup>
        <thead>
          <tr>
            <th>{isCompactScoreMode ? '' : 'Score'}</th>
            {state.categoryOrder.map((categoryId) => {
              const category = state.categoriesById[categoryId];
              return (
                <th key={categoryId}>
                  <div
                    className={['rubric-axis-field', 'rubric-axis-field--category', classNames?.axisField]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className={['rubric-axis-field__delete', classNames?.deleteButton]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => onRemoveCategory(categoryId)}
                          aria-label={`Delete category ${category.name}`}
                        >
                          <span className="rubric-axis-field__delete-icon" aria-hidden="true" />
                        </button>
                        <input
                          className={[
                            'rubric-axis-field__input',
                            'rubric-axis-field__input--category',
                            classNames?.axisInput
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          value={category.name}
                          onChange={(event) => onRenameCategory(categoryId, event.target.value)}
                          aria-label={`Category ${category.name}`}
                        />
                      </>
                    ) : (
                      <div
                        className="rubric-axis-field__value rubric-axis-field__value--category"
                        aria-label={category.name}
                      >
                        {isCompactScoreMode ? compactCategoryLabel(category.name) : category.name}
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {state.scoreOrder.map((scoreId) => {
            const score = state.scoresById[scoreId];
            return (
              <tr key={scoreId}>
                <th>
                  <div
                    className={['rubric-axis-field', 'rubric-axis-field--score', classNames?.axisField]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className={['rubric-axis-field__delete', classNames?.deleteButton]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => onRemoveScore(scoreId)}
                          aria-label={`Delete score ${score.value}`}
                        >
                          <span className="rubric-axis-field__delete-icon" aria-hidden="true" />
                        </button>
                        <input
                          className={[
                            'rubric-axis-field__input',
                            'rubric-axis-field__input--score',
                            classNames?.axisInput
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          value={scoreDrafts[scoreId] ?? String(score.value)}
                          onChange={(event) =>
                            setScoreDrafts((previous) => ({
                              ...previous,
                              [scoreId]: event.target.value
                            }))
                          }
                          onBlur={() => commitScoreDraft(scoreId)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              commitScoreDraft(scoreId);
                              (event.currentTarget as HTMLInputElement).blur();
                            }
                            if (event.key === 'Escape') {
                              event.preventDefault();
                              setScoreDrafts((previous) => ({
                                ...previous,
                                [scoreId]: String(score.value)
                              }));
                              (event.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                          inputMode="numeric"
                          aria-label={`Score ${score.value}`}
                        />
                      </>
                    ) : (
                      <div className="rubric-axis-field__value rubric-axis-field__value--score">
                        {isCompactScoreMode ? '' : score.value}
                      </div>
                    )}
                  </div>
                </th>
                {state.categoryOrder.map((categoryId) => {
                  const key = createCellKey(categoryId, scoreId);
                  const cell = state.cellsByKey[key];
                  const isSelected = Boolean(selectedCellKeys?.has(key));
                  const description = cell?.description ?? '';
                  const scoreValue = state.scoresById[scoreId]?.value ?? '';
                  const categoryName = state.categoriesById[categoryId]?.name ?? 'Category';
                  const tooltipText = `${categoryName}: ${description || 'No description provided.'}`;
                  const compactAria = `Category ${categoryName}, score ${scoreValue}. ${
                    description || 'No description provided.'
                  }`;
                  return (
                    <td key={key}>
                      {isEditing ? (
                        <textarea
                          className={classNames?.cellTextarea}
                          value={cell?.description ?? ''}
                          onChange={(event) => onSetCellDescription(categoryId, scoreId, event.target.value)}
                          placeholder="Description"
                        />
                      ) : isGrading ? (
                        <button
                          type="button"
                          className={[
                            'rubric-table__grade-cell',
                            isCompactScoreMode ? 'rubric-table__grade-cell--compact' : '',
                            isSelected ? 'rubric-table__grade-cell--selected' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onClick={() => (isSelected ? onDeselectCell : onSelectCell)?.(categoryId, scoreId)}
                          onDoubleClick={() => onDeselectCell?.(categoryId, scoreId)}
                          onMouseEnter={(event) =>
                            isCompactScoreMode
                              ? showTooltipNearPointer(tooltipText, event.clientX, event.clientY)
                              : undefined
                          }
                          onMouseMove={(event) =>
                            isCompactScoreMode
                              ? showTooltipNearPointer(tooltipText, event.clientX, event.clientY)
                              : undefined
                          }
                          onMouseLeave={isCompactScoreMode ? hideTooltip : undefined}
                          onFocus={(event) => {
                            if (!isCompactScoreMode) {
                              return;
                            }
                            const rect = event.currentTarget.getBoundingClientRect();
                            showTooltipNearPointer(tooltipText, rect.left + rect.width / 2, rect.top + rect.height / 2);
                          }}
                          onBlur={isCompactScoreMode ? hideTooltip : undefined}
                          aria-pressed={isSelected}
                          aria-label={isCompactScoreMode ? compactAria : undefined}
                        >
                          {isCompactScoreMode ? String(scoreValue) : description}
                        </button>
                      ) : (
                        <div
                          className={[
                            'rubric-table__cell-text',
                            isCompactScoreMode ? 'rubric-table__cell-text--compact' : ''
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          onMouseEnter={(event) =>
                            isCompactScoreMode
                              ? showTooltipNearPointer(tooltipText, event.clientX, event.clientY)
                              : undefined
                          }
                          onMouseMove={(event) =>
                            isCompactScoreMode
                              ? showTooltipNearPointer(tooltipText, event.clientX, event.clientY)
                              : undefined
                          }
                          onMouseLeave={isCompactScoreMode ? hideTooltip : undefined}
                          tabIndex={isCompactScoreMode ? 0 : undefined}
                          onFocus={(event) => {
                            if (!isCompactScoreMode) {
                              return;
                            }
                            const rect = event.currentTarget.getBoundingClientRect();
                            showTooltipNearPointer(tooltipText, rect.left + rect.width / 2, rect.top + rect.height / 2);
                          }}
                          onBlur={isCompactScoreMode ? hideTooltip : undefined}
                          aria-label={isCompactScoreMode ? compactAria : undefined}
                        >
                          {isCompactScoreMode ? String(scoreValue) : description}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {tooltipState.visible ? (
        <div className="rubric-tooltip" style={{ left: `${tooltipState.x}px`, top: `${tooltipState.y}px` }} role="tooltip">
          {tooltipState.text}
        </div>
      ) : null}
    </div>
  );
}
