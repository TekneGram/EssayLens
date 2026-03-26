import { useCallback, useMemo, useState } from 'react';
import { resolveEffectiveMode } from '@/features/rubric-for-react/application/rubricForReact.workflows';
import type { RubricInteractionMode } from '@/features/rubric-for-react/domain';

interface UseRubricModeParams {
  isGrading?: boolean;
  canEdit?: boolean;
  mode?: 'editing' | 'viewing';
  onModeChange?: (mode: 'editing' | 'viewing') => void;
}

interface UseRubricModeResult {
  effectiveEditingMode: 'editing' | 'viewing';
  effectiveMode: RubricInteractionMode;
  toggleMode: () => void;
}

export function useRubricMode({
  isGrading = false,
  canEdit = true,
  mode,
  onModeChange
}: UseRubricModeParams): UseRubricModeResult {
  const [localMode, setLocalMode] = useState<'editing' | 'viewing'>('editing');
  const effectiveEditingMode = mode ?? localMode;

  const effectiveMode = useMemo(
    () =>
      resolveEffectiveMode({
        isGrading,
        canEdit,
        effectiveEditingMode
      }),
    [canEdit, effectiveEditingMode, isGrading]
  );

  const toggleMode = useCallback(() => {
    const nextMode = effectiveEditingMode === 'editing' ? 'viewing' : 'editing';
    if (mode) {
      onModeChange?.(nextMode);
      return;
    }
    setLocalMode(nextMode);
    onModeChange?.(nextMode);
  }, [effectiveEditingMode, mode, onModeChange]);

  return { effectiveEditingMode, effectiveMode, toggleMode };
}
