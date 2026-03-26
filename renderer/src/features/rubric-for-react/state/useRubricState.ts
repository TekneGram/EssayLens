import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { createCellKey, createEntityId, normalizeRubric } from '@/features/rubric-for-react/domain';
import type { CategoryId, NormalizedRubric, RubricSourceData, ScoreId } from '@/features/rubric-for-react/domain';

type RubricAction =
  | { type: 'HYDRATE'; payload: RubricSourceData | NormalizedRubric }
  | { type: 'SET_RUBRIC_NAME'; payload: string }
  | { type: 'ADD_CATEGORY'; payload: { name: string } }
  | { type: 'REMOVE_CATEGORY'; payload: { categoryId: CategoryId } }
  | { type: 'RENAME_CATEGORY'; payload: { categoryId: CategoryId; name: string } }
  | { type: 'ADD_SCORE'; payload: { value: number } }
  | { type: 'REMOVE_SCORE'; payload: { scoreId: ScoreId } }
  | { type: 'SET_SCORE_VALUE'; payload: { scoreId: ScoreId; value: number } }
  | {
      type: 'SET_CELL_DESCRIPTION';
      payload: { categoryId: CategoryId; scoreId: ScoreId; description: string };
    };

function reducer(state: NormalizedRubric, action: RubricAction): NormalizedRubric {
  switch (action.type) {
    case 'HYDRATE': {
      return normalizeRubric(action.payload);
    }
    case 'SET_RUBRIC_NAME': {
      return { ...state, rubricName: action.payload };
    }
    case 'ADD_CATEGORY': {
      const categoryId = createEntityId('category');
      const categoriesById = {
        ...state.categoriesById,
        [categoryId]: { id: categoryId, name: action.payload.name }
      };
      const categoryOrder = [...state.categoryOrder, categoryId];
      const cellsByKey = { ...state.cellsByKey };

      for (const scoreId of state.scoreOrder) {
        const key = createCellKey(categoryId, scoreId);
        cellsByKey[key] = { key, categoryId, scoreId, description: '' };
      }

      return { ...state, categoriesById, categoryOrder, cellsByKey };
    }
    case 'REMOVE_CATEGORY': {
      if (!state.categoriesById[action.payload.categoryId]) return state;
      const categoriesById = { ...state.categoriesById };
      delete categoriesById[action.payload.categoryId];
      const categoryOrder = state.categoryOrder.filter((id) => id !== action.payload.categoryId);
      const cellsByKey = { ...state.cellsByKey };

      for (const scoreId of state.scoreOrder) {
        delete cellsByKey[createCellKey(action.payload.categoryId, scoreId)];
      }

      return { ...state, categoriesById, categoryOrder, cellsByKey };
    }
    case 'RENAME_CATEGORY': {
      const category = state.categoriesById[action.payload.categoryId];
      if (!category) return state;
      const categoriesById = {
        ...state.categoriesById,
        [category.id]: { ...category, name: action.payload.name }
      };
      return { ...state, categoriesById };
    }
    case 'ADD_SCORE': {
      const scoreId = createEntityId('score');
      const scoresById = {
        ...state.scoresById,
        [scoreId]: { id: scoreId, value: action.payload.value }
      };
      const scoreOrder = [...state.scoreOrder, scoreId].sort((a, b) => scoresById[b].value - scoresById[a].value);
      const cellsByKey = { ...state.cellsByKey };

      for (const categoryId of state.categoryOrder) {
        const key = createCellKey(categoryId, scoreId);
        cellsByKey[key] = { key, categoryId, scoreId, description: '' };
      }

      return { ...state, scoresById, scoreOrder, cellsByKey };
    }
    case 'REMOVE_SCORE': {
      if (!state.scoresById[action.payload.scoreId]) return state;
      const scoresById = { ...state.scoresById };
      delete scoresById[action.payload.scoreId];
      const scoreOrder = state.scoreOrder.filter((id) => id !== action.payload.scoreId);
      const cellsByKey = { ...state.cellsByKey };

      for (const categoryId of state.categoryOrder) {
        delete cellsByKey[createCellKey(categoryId, action.payload.scoreId)];
      }

      return { ...state, scoresById, scoreOrder, cellsByKey };
    }
    case 'SET_SCORE_VALUE': {
      const score = state.scoresById[action.payload.scoreId];
      if (!score) return state;
      const scoresById = {
        ...state.scoresById,
        [score.id]: { ...score, value: action.payload.value }
      };
      const scoreOrder = [...state.scoreOrder].sort((a, b) => scoresById[b].value - scoresById[a].value);
      return { ...state, scoresById, scoreOrder };
    }
    case 'SET_CELL_DESCRIPTION': {
      const key = createCellKey(action.payload.categoryId, action.payload.scoreId);
      const existing = state.cellsByKey[key];
      const nextCell = {
        ...(existing ?? {}),
        key,
        categoryId: action.payload.categoryId,
        scoreId: action.payload.scoreId,
        description: action.payload.description
      };
      if (existing && existing.description === nextCell.description) return state;
      return {
        ...state,
        cellsByKey: {
          ...state.cellsByKey,
          [key]: nextCell
        }
      };
    }
    default:
      return state;
  }
}

export interface RubricStateApi {
  state: NormalizedRubric;
  setRubricName: (value: string) => void;
  addCategory: (name: string) => void;
  renameCategory: (categoryId: CategoryId, name: string) => void;
  removeCategory: (categoryId: CategoryId) => void;
  addScore: (value: number) => void;
  setScoreValue: (scoreId: ScoreId, value: number) => void;
  removeScore: (scoreId: ScoreId) => void;
  setCellDescription: (categoryId: CategoryId, scoreId: ScoreId, description: string) => void;
}

export function useRubricState(sourceData?: RubricSourceData | NormalizedRubric): RubricStateApi {
  const [state, dispatch] = useReducer(reducer, sourceData, normalizeRubric);

  useEffect(() => {
    if (!sourceData) return;
    dispatch({ type: 'HYDRATE', payload: sourceData });
  }, [sourceData]);

  const setRubricName = useCallback((value: string) => {
    dispatch({ type: 'SET_RUBRIC_NAME', payload: value });
  }, []);

  const addCategory = useCallback((name: string) => {
    dispatch({ type: 'ADD_CATEGORY', payload: { name } });
  }, []);

  const renameCategory = useCallback((categoryId: CategoryId, name: string) => {
    dispatch({ type: 'RENAME_CATEGORY', payload: { categoryId, name } });
  }, []);

  const removeCategory = useCallback((categoryId: CategoryId) => {
    dispatch({ type: 'REMOVE_CATEGORY', payload: { categoryId } });
  }, []);

  const addScore = useCallback((value: number) => {
    dispatch({ type: 'ADD_SCORE', payload: { value } });
  }, []);

  const setScoreValue = useCallback((scoreId: ScoreId, value: number) => {
    dispatch({ type: 'SET_SCORE_VALUE', payload: { scoreId, value } });
  }, []);

  const removeScore = useCallback((scoreId: ScoreId) => {
    dispatch({ type: 'REMOVE_SCORE', payload: { scoreId } });
  }, []);

  const setCellDescription = useCallback((categoryId: CategoryId, scoreId: ScoreId, description: string) => {
    dispatch({
      type: 'SET_CELL_DESCRIPTION',
      payload: { categoryId, scoreId, description }
    });
  }, []);

  return useMemo(
    () => ({
      state,
      setRubricName,
      addCategory,
      renameCategory,
      removeCategory,
      addScore,
      setScoreValue,
      removeScore,
      setCellDescription
    }),
    [
      addCategory,
      addScore,
      removeCategory,
      removeScore,
      renameCategory,
      setCellDescription,
      setRubricName,
      setScoreValue,
      state
    ]
  );
}
