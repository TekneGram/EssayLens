import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '@/App';
import { AppProviders } from '@/app/providers/AppProviders';
import { createAppQueryClient } from '@/app/providers/queryClient';

function setWindowApi(getActiveModel = vi.fn().mockResolvedValue({ ok: true, data: { model: null } })) {
  Object.defineProperty(window, 'api', {
    value: {
      workspace: {},
      assessment: {},
      rubric: {},
      chat: {},
      llmManager: {
        listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
        listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
        getActiveModel,
        selectModel: vi.fn(),
        getSettings: vi.fn().mockResolvedValue({ ok: true, data: { settings: {} } }),
        updateSettings: vi.fn(),
        resetSettingsToDefaults: vi.fn()
      }
    },
    configurable: true
  });
}

describe('AssessmentWindow tabs', () => {
  it('defaults to assessment tab selected', () => {
    setWindowApi();
    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    const assessmentTab = screen.getByRole('tab', { name: 'Assessment' });
    const rubricTab = screen.getByRole('tab', { name: 'Rubric' });
    const llmTab = screen.getByRole('tab', { name: 'Your LLM' });
    const assessmentPanel = screen.getByTestId('assessment-panel');
    const rubricPanel = screen.getByTestId('rubric-panel');
    const llmPanel = screen.getByTestId('llm-panel');
    const llmStatus = screen.getByTestId('assessment-llm-status');

    expect(assessmentTab.getAttribute('aria-selected')).toBe('true');
    expect(rubricTab.getAttribute('aria-selected')).toBe('false');
    expect(llmTab.getAttribute('aria-selected')).toBe('false');
    expect(assessmentTab.className).toContain('active');
    expect(rubricTab.className).toBe('tab');
    expect(llmTab.className).toBe('tab');
    expect(llmStatus.textContent).toBe('No LLM installed.');
    expect(assessmentPanel.hasAttribute('hidden')).toBe(false);
    expect(rubricPanel.hasAttribute('hidden')).toBe(true);
    expect(llmPanel.hasAttribute('hidden')).toBe(true);
  });

  it('switches panels and aria-selected on tab click', () => {
    setWindowApi();
    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    const assessmentTab = screen.getByRole('tab', { name: 'Assessment' });
    const rubricTab = screen.getByRole('tab', { name: 'Rubric' });
    const llmTab = screen.getByRole('tab', { name: 'Your LLM' });

    fireEvent.click(llmTab);

    const assessmentPanel = screen.getByTestId('assessment-panel');
    const rubricPanel = screen.getByTestId('rubric-panel');
    const llmPanel = screen.getByTestId('llm-panel');

    expect(assessmentTab.getAttribute('aria-selected')).toBe('false');
    expect(rubricTab.getAttribute('aria-selected')).toBe('false');
    expect(llmTab.getAttribute('aria-selected')).toBe('true');
    expect(llmTab.className).toContain('active');
    expect(assessmentTab.className).toBe('tab');
    expect(rubricTab.className).toBe('tab');
    expect(assessmentPanel.hasAttribute('hidden')).toBe(true);
    expect(rubricPanel.hasAttribute('hidden')).toBe(true);
    expect(llmPanel.hasAttribute('hidden')).toBe(false);
  });

  it('shows selected model name in banner when an active model exists', async () => {
    setWindowApi(
      vi.fn().mockResolvedValue({
        ok: true,
        data: {
          model: {
            key: 'qwen3_8b_q8',
            displayName: 'Qwen3 8B Q8_0',
            localGgufPath: '/models/Qwen3-8B-Q8_0.gguf',
            localMmprojPath: null,
            downloadedAt: '2026-02-22T12:00:00.000Z',
            isActive: true
          }
        }
      })
    );

    const queryClient = createAppQueryClient();
    render(
      <AppProviders queryClient={queryClient}>
        <App />
      </AppProviders>
    );

    await waitFor(() => {
      expect(screen.getByTestId('assessment-llm-status').textContent).toBe('Qwen3 8B Q8_0');
    });
  });
});
