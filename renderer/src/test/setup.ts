import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type ApiNamespace = Record<string, (...args: any[]) => any>;
type AppWindowApi = {
  invoke?: (channel: string, payload?: unknown) => Promise<unknown>;
  workspace?: ApiNamespace;
  assessment?: ApiNamespace;
  rubric?: ApiNamespace;
  chat?: ApiNamespace;
  llmManager?: ApiNamespace;
  llmSession?: ApiNamespace;
  llmContext?: ApiNamespace;
};

beforeEach(() => {
  if (typeof window === 'undefined') {
    return;
  }

  const appWindow = window as Window & { api?: AppWindowApi };
  appWindow.api ??= {};

  const existingWorkspace = appWindow.api.workspace ?? {};
  const existingAssessment = appWindow.api.assessment ?? {};
  const existingRubric = appWindow.api.rubric ?? {};
  const existingChat = appWindow.api.chat ?? {};
  const existingLlmManager = appWindow.api.llmManager ?? {};
  const existingLlmSession = appWindow.api.llmSession ?? {};
  const existingLlmContext = appWindow.api.llmContext ?? {};

  appWindow.api.workspace = {
    selectFolder: vi.fn().mockResolvedValue({ ok: true, data: { folder: null } }),
    listFiles: vi.fn().mockResolvedValue({ ok: true, data: { files: [] } }),
    getCurrentFolder: vi.fn().mockResolvedValue({ ok: true, data: { folder: null } }),
    ...existingWorkspace
  };

  appWindow.api.assessment = {
    extractDocument: vi.fn().mockResolvedValue({ ok: true, data: { fileId: 'unused', text: '', markdown: '' } }),
    listFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: [] } }),
    addFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: null } }),
    editFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: null } }),
    deleteFeedback: vi.fn().mockResolvedValue({ ok: true, data: { deleted: true } }),
    applyFeedback: vi.fn().mockResolvedValue({ ok: true, data: { feedback: null } }),
    sendFeedbackToLlm: vi.fn().mockResolvedValue({ ok: true, data: { feedback: null } }),
    generateFeedbackDocument: vi.fn().mockResolvedValue({ ok: true, data: { outputPath: '/tmp/out.docx' } }),
    requestLlmAssessment: vi.fn().mockResolvedValue({ ok: true, data: { createdFeedbackCount: 0, createdFeedbackIds: [] } }),
    ...existingAssessment
  };

  appWindow.api.rubric = {
    listRubrics: vi.fn().mockResolvedValue({ ok: true, data: { rubrics: [] } }),
    getGradingContext: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileId: 'file-1',
        lockedRubricId: null,
        selectedRubricIdForFile: null
      }
    }),
    getFileScores: vi.fn().mockResolvedValue({ ok: true, data: { instance: null, scores: [] } }),
    clearAppliedRubric: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        fileId: 'file-1',
        filepathId: 'file-1',
        clearedRubricId: null
      }
    }),
    saveFileScores: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        instance: {
          uuid: 'instance-1',
          fileEntityUuid: 'file-1',
          rubricEntityUuid: 'rubric-1',
          createdAt: new Date().toISOString()
        },
        scores: []
      }
    }),
    setLastUsed: vi.fn().mockResolvedValue({ ok: true, data: { rubricId: 'rubric-1' } }),
    getMatrix: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        rubric: {
          entityUuid: 'rubric-1',
          name: 'Standard rubric',
          type: 'detailed',
          isActive: true,
          isArchived: false
        },
        details: [],
        scores: []
      }
    }),
    updateMatrix: vi.fn().mockResolvedValue({ ok: true, data: { success: true } }),
    createRubric: vi.fn().mockResolvedValue({ ok: true, data: { rubricId: 'rubric-1' } }),
    cloneRubric: vi.fn().mockResolvedValue({ ok: true, data: { rubricId: 'rubric-1' } }),
    deleteRubric: vi.fn().mockResolvedValue({ ok: true, data: { rubricId: 'rubric-1' } }),
    ...existingRubric
  };

  appWindow.api.chat = {
    checkParagraphFeedbackCompletions: vi.fn().mockResolvedValue({ ok: true, data: { activeModel: null, completions: [] } }),
    sendMessage: vi.fn().mockResolvedValue({ ok: true, data: { reply: '' } }),
    onStreamChunk: vi.fn().mockReturnValue(() => {}),
    ...existingChat
  };

  appWindow.api.llmManager = {
    listCatalogModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    listDownloadedModels: vi.fn().mockResolvedValue({ ok: true, data: { models: [] } }),
    getActiveModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    selectModel: vi.fn().mockResolvedValue({ ok: true, data: { model: null } }),
    getSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        settings: {
          llm_model_family: 'instruct/think',
          llm_reasoning_mode: null,
          llm_reasoning_budget: null,
          llm_chat_template_path: null,
          llm_n_ctx: 4096,
          llm_n_predict: 1024,
          llm_top_k: 40,
          llm_top_p: 0.95,
          temperature: 0.2,
          llm_log_outbound_payload: false
        }
      }
    }),
    updateSettings: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        settings: {
          llm_model_family: 'instruct/think',
          llm_reasoning_mode: null,
          llm_reasoning_budget: null,
          llm_chat_template_path: null,
          llm_n_ctx: 4096,
          llm_n_predict: 1024,
          llm_top_k: 40,
          llm_top_p: 0.95,
          temperature: 0.2,
          llm_log_outbound_payload: false
        }
      }
    }),
    resetSettingsToDefaults: vi.fn().mockResolvedValue({
      ok: true,
      data: {
        settings: {
          llm_model_family: 'instruct/think',
          llm_reasoning_mode: null,
          llm_reasoning_budget: null,
          llm_chat_template_path: null,
          llm_n_ctx: 4096,
          llm_n_predict: 1024,
          llm_top_k: 40,
          llm_top_p: 0.95,
          temperature: 0.2,
          llm_log_outbound_payload: false
        }
      }
    }),
    downloadModel: vi.fn().mockResolvedValue({ ok: true, data: { model: { key: 'qwen3_4b_q8', status: 'downloaded' } } }),
    deleteDownloadedModel: vi.fn().mockResolvedValue({ ok: true, data: { key: 'qwen3_4b_q8', deleted: true } }),
    onDownloadProgress: vi.fn().mockReturnValue(() => {}),
    ...existingLlmManager
  };

  appWindow.api.llmSession = {
    create: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', fileEntityUuid: 'file-1' } }),
    clear: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', cleared: true } }),
    delete: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', deleted: true } }),
    getTurns: vi.fn().mockResolvedValue({ ok: true, data: { sessionId: 'session-a', fileEntityUuid: 'file-1', turns: [] } }),
    listByFile: vi.fn().mockResolvedValue({ ok: true, data: { fileEntityUuid: 'file-1', sessions: [] } }),
    ...existingLlmSession
  };

  appWindow.api.llmContext = {
    getContext: vi.fn().mockResolvedValue({
      ok: true,
      data: { context: { behavior: '', knowledge: '', personality: '', updatedAt: '2026-03-03T00:00:00.000Z' } }
    }),
    updateContext: vi.fn().mockResolvedValue({
      ok: true,
      data: { context: { behavior: '', knowledge: '', personality: '', updatedAt: '2026-03-03T00:00:00.000Z' } }
    }),
    ...existingLlmContext
  };

  appWindow.api.invoke = vi.fn(async (channel: string, payload?: unknown) => {
    const [namespace, method] = channel.split('/');
    const target = appWindow.api?.[namespace as keyof AppWindowApi] as ApiNamespace | undefined;
    const handler = method ? target?.[method] : undefined;

    if (typeof handler !== 'function') {
      return undefined;
    }

    if (payload === undefined) {
      return await handler();
    }

    return await handler(payload);
  });
});

afterEach(() => {
  cleanup();
});

if (typeof window !== 'undefined') {
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
  }

  if (typeof window.ResizeObserver === 'undefined') {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: ResizeObserverMock
    });
  }

  if (typeof window.HTMLElement !== 'undefined' && typeof window.HTMLElement.prototype.scrollIntoView !== 'function') {
    Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
      writable: true,
      value: vi.fn()
    });
  }
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: ResizeObserverMock
  });
}
