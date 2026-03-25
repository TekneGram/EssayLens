import type {
  PythonRequest,
  PythonResponse,
  PythonStreamEventEnvelope
} from '../../services/llm/llm.contracts';

export interface PythonWorkerPort {
  request(
    request: PythonRequest<unknown>,
    options?: {
      timeoutMs?: number;
      onStreamEvent?: (event: PythonStreamEventEnvelope) => void;
    }
  ): Promise<PythonResponse<unknown>>;

  shutdown(): void;
}
