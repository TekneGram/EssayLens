import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from 'node:child_process';
import fs from 'node:fs';
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

interface DefaultDepsResolverOptions {
  cwd?: string;
  existsSync?: (targetPath: string) => boolean;
  platform?: NodeJS.Platform;
  arch?: string;
  resourcesPath?: string;
  pythonExecutable?: string;
  workerScriptPath?: string;
  packaged?: boolean;
}

function isPackagedApp(): boolean {
  try {
    const electron = require('electron') as typeof import('electron');
    return Boolean(electron.app?.isPackaged);
  } catch {
    return false;
  }
}

function getRepoLocalPythonExecutable(cwd: string, platform: NodeJS.Platform, existsSync: (targetPath: string) => boolean) {
  const candidate =
    platform === 'win32'
      ? path.resolve(cwd, '.venv-llm', 'Scripts', 'python.exe')
      : path.resolve(cwd, '.venv-llm', 'bin', 'python');
  return existsSync(candidate) ? candidate : null;
}

export function resolveDefaultPythonWorkerDeps(options: DefaultDepsResolverOptions = {}): PythonWorkerClientDeps {
  const cwd = options.cwd ?? process.cwd();
  const existsSync = options.existsSync ?? fs.existsSync;
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const resourcesPath = options.resourcesPath ?? process.resourcesPath;
  const packaged = options.packaged ?? isPackagedApp();
  const pythonExecutable = options.pythonExecutable ?? process.env.PYTHON_EXECUTABLE;
  const workerScriptPath = options.workerScriptPath ?? process.env.PYTHON_WORKER_PATH;

  if (pythonExecutable && workerScriptPath) {
    return {
      spawn,
      workerCommand: pythonExecutable,
      workerArgs: ['-u', workerScriptPath],
      defaultTimeoutMs: 180_000
    };
  }

  if (packaged) {
    const workerRoot = path.resolve(resourcesPath, 'python-worker', `${platform}-${arch}`);
    const executable = platform === 'win32' ? 'essaylens-llm-worker.exe' : 'essaylens-llm-worker';
    return {
      spawn,
      workerCommand: path.join(workerRoot, executable),
      workerArgs: [],
      defaultTimeoutMs: 180_000
    };
  }

  const repoLocalPython = pythonExecutable
    ? null
    : getRepoLocalPythonExecutable(cwd, platform, existsSync);

  return {
    spawn,
    workerCommand: pythonExecutable ?? repoLocalPython ?? 'python3',
    workerArgs: ['-u', workerScriptPath ?? path.resolve(cwd, 'electron-llm', 'main.py')],
    defaultTimeoutMs: 180_000
  };
}

function getDefaultDeps(): PythonWorkerClientDeps {
  return resolveDefaultPythonWorkerDeps();
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
    value.type === 'stream_status' ||
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
  private stderrBuffer = '';
  private readonly maxStderrBufferChars = 8_000;

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
      this.stderrBuffer = '';

      worker.stdout.setEncoding('utf8');
      worker.stderr.setEncoding('utf8');
      worker.stdout.on('data', (chunk: string) => {
        this.handleStdoutChunk(chunk);
      });
      worker.stderr.on('data', (chunk: string) => {
        this.handleStderrChunk(chunk);
      });
      worker.on('error', (error) => {
        this.rejectAllPending(
          new PythonBridgeError(
            'PY_PROCESS_DOWN',
            this.formatProcessDownMessage('Python worker failed to start or crashed.'),
            this.buildProcessDownDetails(error)
          )
        );
      });
      worker.on('exit', (code, signal) => {
        this.worker = null;
        this.rejectAllPending(
          new PythonBridgeError(
            'PY_PROCESS_DOWN',
            this.formatProcessDownMessage(
              `Python worker exited before responding (code=${String(code)}, signal=${String(signal)}).`
            ),
            this.buildProcessDownDetails({ code, signal })
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
        if (envelope.type === 'stream_start' || envelope.type === 'stream_status' || envelope.type === 'stream_chunk') {
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

  private handleStderrChunk(chunk: string): void {
    this.stderrBuffer += chunk;
    if (this.stderrBuffer.length > this.maxStderrBufferChars) {
      this.stderrBuffer = this.stderrBuffer.slice(-this.maxStderrBufferChars);
    }
  }

  private formatProcessDownMessage(baseMessage: string): string {
    const stderrTail = this.getStderrTail();
    if (!stderrTail) {
      return baseMessage;
    }
    return `${baseMessage} stderr: ${stderrTail}`;
  }

  private buildProcessDownDetails(details: unknown): unknown {
    const stderrTail = this.getStderrTail();
    if (!stderrTail) {
      return details;
    }

    if (isPlainObject(details)) {
      return {
        ...details,
        stderr: stderrTail
      };
    }

    return {
      cause: details,
      stderr: stderrTail
    };
  }

  private getStderrTail(): string | null {
    const trimmed = this.stderrBuffer.trim();
    if (!trimmed) {
      return null;
    }

    const lines = trimmed
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    if (lines.length === 0) {
      return null;
    }

    return lines.slice(-8).join(' | ');
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
