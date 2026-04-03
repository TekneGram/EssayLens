import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RubricForReact } from '@/features/rubric-for-react';
import { PortsProvider, type AppPorts } from '@/app/ports';

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
    const ports: AppPorts = {
      workspace: {
        selectFolder: vi.fn().mockResolvedValue({ ok: true, data: { folder: null } }),
        listFiles: vi.fn().mockResolvedValue({ ok: true, data: { files: [] } })
      },
      assessment: {
        extractDocument: vi.fn(),
        listFeedback: vi.fn(),
        addFeedback: vi.fn(),
        editFeedback: vi.fn(),
        deleteFeedback: vi.fn(),
        applyFeedback: vi.fn(),
        sendFeedbackToLlm: vi.fn(),
        generateFeedbackDocument: vi.fn(),
        requestLlmAssessment: vi.fn()
      },
      chat: {
        sendMessage: vi.fn(),
        onStreamChunk: vi.fn().mockReturnValue(() => {})
      },
      rubric: {
        listRubrics: vi.fn().mockResolvedValue({ ok: true, data: { rubrics: [] } }),
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
      },
      llmManager: {
        listCatalogModels: vi.fn(),
        listDownloadedModels: vi.fn(),
        getActiveModel: vi.fn(),
        selectModel: vi.fn(),
        downloadModel: vi.fn(),
        deleteDownloadedModel: vi.fn(),
        onDownloadProgress: vi.fn().mockReturnValue(() => {}),
        getSettings: vi.fn(),
        updateSettings: vi.fn(),
        resetSettingsToDefaults: vi.fn()
      },
      llmSession: {
        create: vi.fn(),
        clear: vi.fn(),
        delete: vi.fn(),
        getTurns: vi.fn(),
        listByFile: vi.fn()
      }
    };

    render(
      <QueryClientProvider client={queryClient}>
        <PortsProvider ports={ports}>
          <RubricForReact sourceData={sourceData} mode="editing" canEdit={false} />
        </PortsProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByRole('button', { name: /switch to viewing/i })).toBeNull();
    expect(screen.queryByText('Rubric Name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Category' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add Score' })).toBeNull();
  });
});
