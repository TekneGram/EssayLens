import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRubricMode } from '@/features/rubric-for-react/hooks/useRubricMode';

describe('useRubricMode', () => {
  it('toggles local mode when uncontrolled', () => {
    const onModeChange = vi.fn();
    const { result } = renderHook(() => useRubricMode({ onModeChange }));

    expect(result.current.effectiveEditingMode).toBe('editing');
    expect(result.current.effectiveMode).toBe('editing');

    act(() => {
      result.current.toggleMode();
    });

    expect(result.current.effectiveEditingMode).toBe('viewing');
    expect(result.current.effectiveMode).toBe('viewing');
    expect(onModeChange).toHaveBeenCalledWith('viewing');
  });

  it('uses controlled mode and does not mutate local state', () => {
    const onModeChange = vi.fn();
    const { result, rerender } = renderHook((props: { mode: 'editing' | 'viewing' }) => useRubricMode({ ...props, onModeChange }), {
      initialProps: { mode: 'editing' }
    });

    act(() => {
      result.current.toggleMode();
    });

    expect(onModeChange).toHaveBeenCalledWith('viewing');
    expect(result.current.effectiveEditingMode).toBe('editing');

    rerender({ mode: 'viewing' });
    expect(result.current.effectiveEditingMode).toBe('viewing');
  });

  it('forces grading mode when grading is enabled', () => {
    const { result } = renderHook(() => useRubricMode({ isGrading: true, canEdit: true, mode: 'editing' }));
    expect(result.current.effectiveMode).toBe('grading');
  });
});
