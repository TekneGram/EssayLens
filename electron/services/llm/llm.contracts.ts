export type LlmAction =
  | 'llm.assessEssay'
  | 'llm.chat'
  | 'llm.chatStream'
  | 'llm.generateFeedbackSummary'
  | 'llm.evaluate.simple'
  | 'llm.evaluate.withRubric'
  | 'llm.evaluate.bulk'
  | 'llm.session.create'
  | 'llm.session.clear'
  | 'llm.simpleChat.clearSessionCache'
  | 'llm.server.start'
  | 'llm.server.stop'
  | 'llm.server.status';

export interface PythonRequest<TPayload = unknown> {
  requestId: string;
  action: LlmAction;
  payload: TPayload;
  timestamp: string;
}

export interface PythonSuccess<TData = unknown> {
  requestId: string;
  ok: true;
  data: TData;
  timestamp: string;
}

export interface PythonFailure {
  requestId: string;
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: string;
}

export type PythonResponse<TData = unknown> = PythonSuccess<TData> | PythonFailure;

export type PythonStreamEventType = 'stream_start' | 'stream_chunk' | 'stream_done' | 'stream_error';

export interface PythonStreamEventData {
  clientRequestId?: string;
  channel: 'content' | 'reasoning' | 'meta';
  text: string;
  done: boolean;
  seq: number;
  finishReason?: string | null;
  model?: string | null;
  usage?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PythonStreamEventEnvelope {
  requestId: string;
  type: PythonStreamEventType;
  data: PythonStreamEventData;
  timestamp: string;
}

export type PythonWorkerEnvelope<TData = unknown> = PythonResponse<TData> | PythonStreamEventEnvelope;
