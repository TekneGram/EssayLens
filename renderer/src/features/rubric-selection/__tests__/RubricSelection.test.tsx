import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RubricSelection } from '@/features/rubric-selection/RubricSelection';

describe('RubricSelection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders rubric list and routes select/create/clone actions', () => {
    const onSelect = vi.fn();
    const onCreate = vi.fn();
    const onClone = vi.fn();
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <RubricSelection
        rubrics={[
          { entityUuid: 'r1', name: 'Rubric 1', isActive: false },
          { entityUuid: 'r2', name: 'Rubric 2', isActive: false }
        ]}
        selectedRubricId="r1"
        canDeleteSelectedRubric={true}
        isPending={false}
        isError={false}
        onSelect={onSelect}
        onCreate={onCreate}
        onClone={onClone}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Rubric 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'New Rubric' }));
    fireEvent.click(screen.getByRole('button', { name: 'Clone' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onSelect).toHaveBeenCalledWith('r2');
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onClone).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not delete when confirmation is cancelled', () => {
    const onDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <RubricSelection
        rubrics={[{ entityUuid: 'r1', name: 'Rubric 1', isActive: false }]}
        selectedRubricId="r1"
        canDeleteSelectedRubric={true}
        isPending={false}
        isError={false}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        onClone={vi.fn()}
        onDelete={onDelete}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
  });
});
