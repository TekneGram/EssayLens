import { describe, expect, it } from 'vitest';
import {
  computeCanEditSelectedRubric,
  isSelectedRubricStillValid,
  resolvePreferredRubricSelection
} from '@/features/rubric-tab/domain';

describe('rubric-tab domain rules', () => {
  it('checks whether selected rubric still exists', () => {
    const rubrics = [{ entityUuid: 'r1', isActive: false }];

    expect(isSelectedRubricStillValid(rubrics, 'r1')).toBe(true);
    expect(isSelectedRubricStillValid(rubrics, 'missing')).toBe(false);
    expect(isSelectedRubricStillValid(rubrics, null)).toBe(false);
  });

  it('resolves preferred rubric selection using current, then last used, then first', () => {
    const rubrics = [
      { entityUuid: 'r1', isActive: false },
      { entityUuid: 'r2', isActive: false }
    ];

    expect(resolvePreferredRubricSelection({ rubrics, selectedRubricId: 'r2', lastUsedRubricId: 'r1' })).toBe('r2');
    expect(resolvePreferredRubricSelection({ rubrics, selectedRubricId: 'missing', lastUsedRubricId: 'r1' })).toBe('r1');
    expect(resolvePreferredRubricSelection({ rubrics, selectedRubricId: 'missing', lastUsedRubricId: 'missing' })).toBe('r1');
    expect(resolvePreferredRubricSelection({ rubrics: [], selectedRubricId: 'r1', lastUsedRubricId: 'r1' })).toBe(null);
  });

  it('allows edits only for non-active rubrics', () => {
    expect(computeCanEditSelectedRubric(undefined)).toBe(true);
    expect(computeCanEditSelectedRubric({ entityUuid: 'r1', isActive: false })).toBe(true);
    expect(computeCanEditSelectedRubric({ entityUuid: 'r2', isActive: true })).toBe(false);
  });
});
