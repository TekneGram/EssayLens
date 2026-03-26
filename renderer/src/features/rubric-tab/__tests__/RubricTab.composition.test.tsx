import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { RubricTab } from '@/features/rubric-tab/RubricTab';

const {
  mockUseRubricTabController,
  mockRubricSelection,
  mockRubricForReactPanel,
  mockRubricTabStateProvider
} = vi.hoisted(() => ({
  mockUseRubricTabController: vi.fn(),
  mockRubricSelection: vi.fn(),
  mockRubricForReactPanel: vi.fn(),
  mockRubricTabStateProvider: vi.fn()
}));

vi.mock('../hooks', () => ({
  useRubricTabController: mockUseRubricTabController
}));

vi.mock('../components', () => ({
  RubricSelection: (props: {
    onSelect: (rubricId: string) => void;
    onCreate: () => void | Promise<void>;
    onClone: () => void | Promise<void>;
    onDelete: () => void | Promise<void>;
  }) => {
    mockRubricSelection(props);
    return (
      <div data-testid="rubric-selection-mock">
        <button type="button" onClick={() => props.onSelect('r1')}>
          select
        </button>
        <button type="button" onClick={() => void props.onCreate()}>
          create
        </button>
        <button type="button" onClick={() => void props.onClone()}>
          clone
        </button>
        <button type="button" onClick={() => void props.onDelete()}>
          delete
        </button>
      </div>
    );
  },
  RubricForReactPanel: (props: { onModeChange: (mode: 'editing' | 'viewing') => void | Promise<void> }) => {
    mockRubricForReactPanel(props);
    return (
      <div data-testid="rubric-for-react-panel-mock">
        <button type="button" onClick={() => void props.onModeChange('editing')}>
          mode
        </button>
      </div>
    );
  }
}));

vi.mock('../state', () => ({
  RubricTabStateProvider: ({ children }: { children: ReactNode }) => {
    mockRubricTabStateProvider();
    return <div data-testid="rubric-tab-provider">{children}</div>;
  }
}));

describe('RubricTab composition contract', () => {
  it('wires controller output to selection + panel components and delegates actions', () => {
    const controller = {
      rubricList: [{ entityUuid: 'r1', name: 'Rubric 1', isActive: false, isArchived: false }],
      selectedRubricId: 'r1',
      selectedRubric: { entityUuid: 'r1', name: 'Rubric 1', isActive: false, isArchived: false },
      interactionMode: 'viewing' as const,
      canEditSelectedRubric: true,
      listQuery: { isPending: false, isError: false },
      selectRubric: vi.fn(),
      createRubric: vi.fn().mockResolvedValue(undefined),
      cloneRubric: vi.fn().mockResolvedValue(undefined),
      deleteRubric: vi.fn().mockResolvedValue(undefined),
      setInteractionMode: vi.fn().mockResolvedValue(undefined)
    };
    mockUseRubricTabController.mockReturnValue(controller);

    render(<RubricTab />);

    expect(screen.getByTestId('rubric-tab-provider')).toBeTruthy();
    expect(mockRubricSelection).toHaveBeenCalledWith(
      expect.objectContaining({
        rubrics: controller.rubricList,
        selectedRubricId: 'r1',
        canDeleteSelectedRubric: true,
        isPending: false,
        isError: false
      })
    );
    expect(mockRubricForReactPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedRubricId: 'r1',
        interactionMode: 'viewing',
        canEditSelectedRubric: true
      })
    );

    fireEvent.click(screen.getByRole('button', { name: 'select' }));
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    fireEvent.click(screen.getByRole('button', { name: 'clone' }));
    fireEvent.click(screen.getByRole('button', { name: 'delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'mode' }));

    expect(controller.selectRubric).toHaveBeenCalledWith('r1');
    expect(controller.createRubric).toHaveBeenCalledTimes(1);
    expect(controller.cloneRubric).toHaveBeenCalledTimes(1);
    expect(controller.deleteRubric).toHaveBeenCalledTimes(1);
    expect(controller.setInteractionMode).toHaveBeenCalledWith('editing');
  });
});
