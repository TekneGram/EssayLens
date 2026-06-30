import type { PythonWorkerPort } from '../../infrastructure/ports/pythonWorker.port';
import type {
  LlmAction,
  PythonRequest,
  PythonResponse,
  PythonSuccess,
  PythonStreamEventEnvelope
} from './llm.contracts';

const SUPPORTED_ACTIONS = new Set<LlmAction>([
  'llm.assessEssay',
  'llm.chat',
  'llm.chatStream',
  'llm.generateFeedbackSummary',
  'llm.evaluate.simple',
  'llm.evaluate.withRubric',
  'llm.essay.feedback.identifyParagraphs',
  'llm.essay.feedback.thesisStatement',
  'llm.essay.feedback.summarizeMainIdea',
  'llm.essay.feedback.paragraphEvaluation',
  'llm.essay.feedback.thesisRestatement',
  'llm.essay.feedback.summaryFeedback',
  'llm.essay.feedback.conclusionFinalComment',
  'llm.paragraph.feedback.bulk',
  'llm.session.create',
  'llm.session.clear',
  'llm.simpleChat.clearSessionCache',
  'llm.server.start',
  'llm.server.stop',
  'llm.server.status'
]);

export interface LlmFailure {
  requestId: string;
  ok: false;
  error: {
    code: 'PY_TIMEOUT' | 'PY_PROCESS_DOWN' | 'PY_INVALID_RESPONSE' | 'PY_ACTION_FAILED';
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type LlmResponse<TData = unknown> = PythonSuccess<TData> | LlmFailure;

interface LlmOrchestratorDeps {
  workerClient: PythonWorkerPort;
  requestIdFactory: () => string;
  now: () => string;
  defaultTimeoutMs: number;
  actionTimeoutMs: Partial<Record<LlmAction, number>>;
}

function createRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createFailure(
  requestId: string,
  code: LlmFailure['error']['code'],
  message: string,
  details?: unknown
): LlmFailure {
  return {
    requestId,
    ok: false,
    error: {
      code,
      message,
      details
    },
    timestamp: new Date().toISOString()
  };
}

export class LlmOrchestrator {
  private readonly deps: LlmOrchestratorDeps;

  constructor(deps: Partial<LlmOrchestratorDeps> & { workerClient: PythonWorkerPort }) {
    this.deps = {
      requestIdFactory: createRequestId,
      now: () => new Date().toISOString(),
      defaultTimeoutMs: 180_000,
      actionTimeoutMs: {
        'llm.essay.feedback.identifyParagraphs': 600_000,
        'llm.essay.feedback.thesisStatement': 600_000,
        'llm.essay.feedback.summarizeMainIdea': 600_000,
        'llm.essay.feedback.paragraphEvaluation': 600_000,
        'llm.essay.feedback.thesisRestatement': 600_000,
        'llm.essay.feedback.summaryFeedback': 600_000,
        'llm.essay.feedback.conclusionFinalComment': 600_000,
        'llm.paragraph.feedback.bulk': 600_000
      },
      ...deps
    };
  }

  async requestAction<TPayload, TResponse>(action: LlmAction, payload: TPayload): Promise<LlmResponse<TResponse>> {
    const request: PythonRequest<TPayload> = {
      requestId: this.deps.requestIdFactory(),
      action,
      payload,
      timestamp: this.deps.now()
    };
    return this.request<TPayload, TResponse>(request, undefined);
  }

  async requestActionStream<TPayload, TResponse>(
    action: LlmAction,
    payload: TPayload,
    onStreamEvent: (event: PythonStreamEventEnvelope) => void
  ): Promise<LlmResponse<TResponse>> {
    const request: PythonRequest<TPayload> = {
      requestId: this.deps.requestIdFactory(),
      action,
      payload,
      timestamp: this.deps.now()
    };
    return this.request<TPayload, TResponse>(request, onStreamEvent);
  }

  async request<TPayload, TResponse>(
    request: PythonRequest<TPayload>,
    onStreamEvent?: (event: PythonStreamEventEnvelope) => void
  ): Promise<LlmResponse<TResponse>> {
    if (!SUPPORTED_ACTIONS.has(request.action)) {
      return createFailure(
        request.requestId,
        'PY_ACTION_FAILED',
        `Unsupported Python action: ${request.action}.`
      );
    }

    try {
      const timeoutMs = this.deps.actionTimeoutMs[request.action] ?? this.deps.defaultTimeoutMs;
      const response = await this.deps.workerClient.request(request as PythonRequest<unknown>, {
        timeoutMs,
        onStreamEvent
      });

      if (response.requestId !== request.requestId) {
        return createFailure(
          request.requestId,
          'PY_INVALID_RESPONSE',
          'Python worker response requestId did not match the request.',
          { expected: request.requestId, received: response.requestId }
        );
      }

      if (response.ok) {
        return response as LlmResponse<TResponse>;
      }

      return createFailure(
        request.requestId,
        'PY_ACTION_FAILED',
        (response as any).error?.message || 'Python worker reported action failure.',
        (response as any).error
      );
    } catch (error: any) {
      if (error && error.name === 'PythonBridgeError') {
        let code: LlmFailure['error']['code'] = 'PY_PROCESS_DOWN';
        switch (error.code) {
          case 'PY_TIMEOUT':
            code = 'PY_TIMEOUT';
            break;
          case 'PY_PROCESS_DOWN':
            code = 'PY_PROCESS_DOWN';
            break;
          case 'PY_INVALID_RESPONSE':
            code = 'PY_INVALID_RESPONSE';
            break;
        }
        return createFailure(request.requestId, code, error.message, error.details);
      }
      return createFailure(
        request.requestId,
        'PY_PROCESS_DOWN',
        'Python worker request failed unexpectedly.',
        error
      );
    }
  }

  shutdown(): void {
    this.deps.workerClient.shutdown();
  }
}
