import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { PythonWorkerClient, resolveDefaultPythonWorkerDeps } from './pythonWorkerAdapter';

class MockChildProcess extends EventEmitter {
  stdout = new PassThrough();
  stderr = new PassThrough();
  stdin = new PassThrough();
  killed = false;
  exitCode: number | null = null;

  kill(): boolean {
    this.killed = true;
    return true;
  }
}

describe('PythonWorkerClient', () => {
  it('prefers repo-local .venv-llm python in dev mode', () => {
    const cwd = '/tmp/essaylens';
    const repoPython = path.join(cwd, '.venv-llm', 'bin', 'python');

    const deps = resolveDefaultPythonWorkerDeps({
      cwd,
      packaged: false,
      existsSync: (targetPath) => targetPath === repoPython
    });

    expect(deps.workerCommand).toBe(repoPython);
    expect(deps.workerArgs).toEqual(['-u', path.join(cwd, 'electron-llm', 'main.py')]);
  });

  it('prefers explicit PYTHON_EXECUTABLE over repo-local .venv-llm', () => {
    const cwd = '/tmp/essaylens';
    const explicitPython = '/custom/python';
    const explicitWorker = '/custom/worker.py';

    const deps = resolveDefaultPythonWorkerDeps({
      cwd,
      packaged: false,
      pythonExecutable: explicitPython,
      workerScriptPath: explicitWorker,
      existsSync: () => true
    });

    expect(deps.workerCommand).toBe(explicitPython);
    expect(deps.workerArgs).toEqual(['-u', explicitWorker]);
  });

  it('falls back to ambient python3 when no repo-local .venv-llm exists', () => {
    const cwd = '/tmp/essaylens';

    const deps = resolveDefaultPythonWorkerDeps({
      cwd,
      packaged: false,
      existsSync: () => false
    });

    expect(deps.workerCommand).toBe('python3');
    expect(deps.workerArgs).toEqual(['-u', path.join(cwd, 'electron-llm', 'main.py')]);
  });

  it('includes stderr output when the worker exits before responding', async () => {
    const worker = new MockChildProcess();
    const client = new PythonWorkerClient({
      spawn: () => worker as any,
      workerCommand: 'python3',
      workerArgs: ['-u', 'electron-llm/main.py'],
      defaultTimeoutMs: 1_000
    });

    const requestPromise = client.request({
      requestId: 'req-1',
      action: 'llm.chatStream',
      payload: { message: 'hello' },
      timestamp: new Date().toISOString()
    });

    worker.stderr.write('Traceback (most recent call last):\n');
    worker.stderr.write("ModuleNotFoundError: No module named 'requests'\n");
    worker.exitCode = 1;
    worker.emit('exit', 1, null);

    await expect(requestPromise).rejects.toMatchObject({
      name: 'PythonBridgeError',
      code: 'PY_PROCESS_DOWN',
      message: expect.stringContaining("ModuleNotFoundError: No module named 'requests'"),
      details: {
        code: 1,
        signal: null,
        stderr: expect.stringContaining("ModuleNotFoundError: No module named 'requests'")
      }
    });
  });
});
