import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import path from 'node:path';
import type {
  PythonRequest,
  PythonResponse,
  PythonStreamEventEnvelope,
  PythonWorkerEnvelope
} from '../../services/llm/llm.contracts';

export type PythonBridgeErrorCode = 'PY_TIMEOUT' | 'PY_PROCESS_DOWN' | 'PY_INVALID_RESPONSE';

export class PythonBridgeError extends Error {
  readonly code: PythonBridgeErrorCode;
  readonly details?: unknown;

  constructor(code: PythonBridgeErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'PythonBridgeError';
    this.code = code;
    this.details = details;
  }
}

type SpawnLike = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio
) => ChildProcessWithoutNullStreams;

interface PendingRequest {
  requestId: string;
  action: string;
  resolve: (value: PythonResponse<unknown>) => void;
  reject: (error: PythonBridgeError) => void;
  timeoutId: NodeJS.Timeout;
  timeoutMs: number;
  onStreamEvent?: (event: PythonStreamEventEnvelope) => void;
}

export interface PythonWorkerClientDeps {
  spawn: SpawnLike;
  workerCommand: string;
  workerArgs: string[];
  defaultTimeoutMs: number;
}

function isPackagedApp(): boolean {
  try {
    const electron = require('electron') as typeof import('electron');
    return Boolean(electron.app?.isPackaged);
  } catch {
    return false;
  }
}

function getDefaultWorkerScriptPath(resourcesPath: string): string {
  if (isPackagedApp()) {
    return path.resolve(resourcesPath, 'electron-llm', 'main.py');
  }
  return path.resolve(process.cwd(), 'electron-llm', 'main.py');
}

function getBundledWorkerExecutablePath(resourcesPath: string): string {
  const workerRoot = path.resolve(resourcesPath, 'python-worker', `${process.platform}-${process.arch}`);
  const executable = process.platform === 'win32' ? 'essaylens-llm-worker.exe' : 'essaylens-llm-worker';
  return path.join(workerRoot, executable);
}

function getDefaultDeps(): PythonWorkerClientDeps {
  const resourcesPath = process.resourcesPath;
  const packaged = isPackagedApp();
  const pythonExecutable = process.env.PYTHON_EXECUTABLE;
  const workerScriptPath = process.env.PYTHON_WORKER_PATH ?? getDefaultWorkerScriptPath(resourcesPath);

  if (pythonExecutable) {
    return {
      spawn,
      workerCommand: pythonExecutable,
      workerArgs: ['-u', workerScriptPath],
      defaultTimeoutMs: 180_000
    };
  }

  if (packaged) {
    return {
      spawn,
      workerCommand: getBundledWorkerExecutablePath(resourcesPath),
      workerArgs: [],
      defaultTimeoutMs: 180_000
    };
  }

  return {
    spawn,
    workerCommand: 'python3',
    workerArgs: ['-u', workerScriptPath],
    defaultTimeoutMs: 180_000
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidPythonResponse(value: unknown): value is PythonResponse<unknown> {
  if (!isPlainObject(value) || typeof value.requestId !== 'string' || typeof value.ok !== 'boolean') {
    return false;
  }

  if (value.ok) {
    return 'data' in value;
  }

  if (!('error' in value) || !isPlainObject(value.error)) {
    return false;
  }

  return typeof value.error.message === 'string';
}

function isValidPythonStreamEvent(value: unknown): value is PythonStreamEventEnvelope {
  if (!isPlainObject(value)) {
    return false;
  }

  if (typeof value.requestId !== 'string' || typeof value.type !== 'string' || !isPlainObject(value.data)) {
    return false;
  }

  const validType =
    value.type === 'stream_start' ||
    value.type === 'stream_chunk' ||
    value.type === 'stream_done' ||
    value.type === 'stream_error';
  if (!validType) {
    return false;
  }

  return (
    typeof value.data.channel === 'string' &&
    typeof value.data.text === 'string' &&
    typeof value.data.done === 'boolean' &&
    typeof value.data.seq === 'number'
  );
}

export class PythonWorkerClient {
  private readonly deps: PythonWorkerClientDeps;
  private worker: ChildProcessWithoutNullStreams | null = null;
  private readonly pendingRequests = new Map<string, PendingRequest>();
  private stdoutBuffer = '';

  constructor(deps: Partial<PythonWorkerClientDeps> = {}) {
    this.deps = {
      ...getDefaultDeps(),
      ...deps
    };
  }

  async request(
    request: PythonRequest<unknown>,
    options?: { timeoutMs?: number; onStreamEvent?: (event: PythonStreamEventEnvelope) => void }
  ): Promise<PythonResponse<unknown>> {
    const worker = this.ensureWorker();
    const timeoutMs = options?.timeoutMs ?? this.deps.defaultTimeoutMs;

    return new Promise<PythonResponse<unknown>>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.rejectPending(
          request.requestId,
          new PythonBridgeError(
            'PY_TIMEOUT',
            `Python worker timed out after ${timeoutMs}ms for action ${request.action}.`
          )
        );
      }, timeoutMs);

      this.pendingRequests.set(request.requestId, {
        requestId: request.requestId,
        action: request.action,
        resolve,
        reject,
        timeoutId,
        timeoutMs,
        onStreamEvent: options?.onStreamEvent
      });

      worker.stdin.write(`${JSON.stringify(request)}\n`, (error) => {
        if (!error) {
          return;
        }
        this.rejectPending(
          request.requestId,
          new PythonBridgeError(
            'PY_PROCESS_DOWN',
            'Failed to write request to Python worker stdin.',
            error
          )
        );
      });
    });
  }

  shutdown(): void {
    if (this.worker && !this.worker.killed) {
      this.worker.kill();
    }
    this.worker = null;
    this.stdoutBuffer = '';
    this.rejectAllPending(
      new PythonBridgeError(
        'PY_PROCESS_DOWN',
        'Python worker was shut down before completing all pending requests.'
      )
    );
  }

  private ensureWorker(): ChildProcessWithoutNullStreams {
    if (this.worker && this.worker.exitCode === null && !this.worker.killed) {
      return this.worker;
    }

    try {
      const worker = this.deps.spawn(
        this.deps.workerCommand,
        this.deps.workerArgs,
        {
          stdio: 'pipe'
        }
      );
      this.worker = worker;
      this.stdoutBuffer = '';

      worker.stdout.setEncoding('utf8');
      worker.stdout.on('data', (chunk: string) => {
        this.handleStdoutChunk(chunk);
      });
      worker.on('error', (error) => {
        this.rejectAllPending(
          new PythonBridgeError('PY_PROCESS_DOWN', 'Python worker failed to start or crashed.', error)
        );
      });
      worker.on('exit', (code, signal) => {
        this.worker = null;
        this.rejectAllPending(
          new PythonBridgeError(
            'PY_PROCESS_DOWN',
            `Python worker exited before responding (code=${String(code)}, signal=${String(signal)}).`
          )
        );
      });

      return worker;
    } catch (error) {
      throw new PythonBridgeError('PY_PROCESS_DOWN', 'Failed to spawn Python worker process.', error);
    }
  }

  private handleStdoutChunk(chunk: string): void {
    this.stdoutBuffer += chunk;

    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf('\n');
      if (newlineIndex === -1) {
        break;
      }

      const rawLine = this.stdoutBuffer.slice(0, newlineIndex).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);

      if (!rawLine) {
        continue;
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(rawLine);
      } catch (error) {
        this.rejectAllPending(
          new PythonBridgeError('PY_INVALID_RESPONSE', 'Python worker returned malformed JSON.', {
            line: rawLine,
            cause: error
          })
        );
        continue;
      }

      const envelope = parsed as PythonWorkerEnvelope<unknown>;
      if (isValidPythonStreamEvent(envelope)) {
        const pending = this.pendingRequests.get(envelope.requestId);
        if (!pending) {
          continue;
        }
        if (envelope.type === 'stream_start' || envelope.type === 'stream_chunk') {
          this.refreshPendingTimeout(pending);
        }
        pending.onStreamEvent?.(envelope);
        continue;
      }

      if (!isValidPythonResponse(envelope)) {
        this.rejectAllPending(
          new PythonBridgeError('PY_INVALID_RESPONSE', 'Python worker returned an invalid response envelope.', {
            response: envelope
          })
        );
        continue;
      }

      const pending = this.pendingRequests.get(envelope.requestId);
      if (!pending) {
        continue;
      }

      clearTimeout(pending.timeoutId);
      this.pendingRequests.delete(envelope.requestId);
      pending.resolve(envelope);
    }
  }

  private rejectPending(requestId: string, error: PythonBridgeError): void {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return;
    }
    clearTimeout(pending.timeoutId);
    this.pendingRequests.delete(requestId);
    pending.reject(error);
  }

  private refreshPendingTimeout(pending: PendingRequest): void {
    clearTimeout(pending.timeoutId);
    pending.timeoutId = setTimeout(() => {
      this.rejectPending(
        pending.requestId,
        new PythonBridgeError(
          'PY_TIMEOUT',
          `Python worker timed out after ${pending.timeoutMs}ms for action ${pending.action}.`
        )
      );
    }, pending.timeoutMs);
  }

  private rejectAllPending(error: PythonBridgeError): void {
    const entries = [...this.pendingRequests.values()];
    this.pendingRequests.clear();
    for (const pending of entries) {
      clearTimeout(pending.timeoutId);
      pending.reject(error);
    }
  }
}
