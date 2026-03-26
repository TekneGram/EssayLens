import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RubricForReact } from '@/features/rubric-for-react';

vi.mock('../../../../../ports', () => ({
  usePorts: () => ({
    rubric: {
      listRubrics: vi.fn(),
      createRubric: vi.fn(),
      cloneRubric: vi.fn(),
      deleteRubric: vi.fn(),
      getFileScores: vi.fn(),
      saveFileScores: vi.fn(),
      clearAppliedRubric: vi.fn(),
      getGradingContext: vi.fn(),
      getMatrix: vi.fn(),
      updateMatrix: vi.fn(),
      setLastUsed: vi.fn()
    }
  })
}));

const sourceData = {
  rubricId: 'rubric-1',
  rubricName: 'Sample Rubric',
  categories: [{ id: 'cat-1', name: 'Content' }],
  scores: [{ id: 'score-1', value: 5 }],
  cells: [
    {
      categoryId: 'cat-1',
      scoreId: 'score-1',
      detailId: 'detail-1',
      scoreRowId: 'score-row-1',
      description: 'Strong content'
    }
  ]
};

describe('RubricForReact editability', () => {
  it('disables editing affordances when rubric is non-editable', () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity },
        mutations: { retry: false, gcTime: Infinity }
      }
    });

    render(
      <QueryClientProvider client={queryClient}>
        <RubricForReact sourceData={sourceData} mode="editing" canEdit={false} />
      </QueryClientProvider>
    );

    expect(screen.queryByRole('button', { name: /switch to viewing/i })).toBeNull();
    expect(screen.queryByText('Rubric Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Category' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Score' })).toBeNull();
  });
});
