import type { LlmRuntimeSettings } from '../ipc/contracts/llmManager.contracts';
import type { LlmNotReadyErrorDetails, LlmReadinessIssue } from '../ipc/contracts/chat.contracts';

interface RuntimeReadinessDeps {
  fileExists: (targetPath: string) => Promise<boolean>;
  isFile: (targetPath: string) => Promise<boolean>;
  isExecutable: (targetPath: string) => Promise<boolean>;
}

function normalizePath(value: string | null): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === '__unset_llm_server__') {
    return null;
  }
  return trimmed;
}

export async function getLlmNotReadyDetails(
  settings: LlmRuntimeSettings,
  deps: RuntimeReadinessDeps
): Promise<LlmNotReadyErrorDetails | null> {
  if (settings.use_fake_reply) {
    return null;
  }

  const issues: LlmReadinessIssue[] = [];
  const ggufPath = normalizePath(settings.llm_gguf_path);
  const serverPath = normalizePath(settings.llm_server_path);
  const chatTemplatePath = normalizePath(settings.llm_chat_template_path);

  if (!ggufPath) {
    issues.push({
      code: 'MISSING_GGUF_PATH',
      message: 'No active GGUF model path is configured in LLM settings.'
    });
  } else if (!(await deps.fileExists(ggufPath))) {
    issues.push({
      code: 'GGUF_FILE_NOT_FOUND',
      message: 'The configured GGUF model file does not exist on disk.',
      path: ggufPath
    });
  }

  if (!serverPath) {
    issues.push({
      code: 'MISSING_SERVER_PATH',
      message: 'No llama-server binary path is configured in LLM settings.'
    });
  } else if (!(await deps.fileExists(serverPath))) {
    issues.push({
      code: 'SERVER_FILE_NOT_FOUND',
      message: 'The configured llama-server binary does not exist on disk.',
      path: serverPath
    });
  } else if (!(await deps.isFile(serverPath))) {
    issues.push({
      code: 'SERVER_PATH_NOT_FILE',
      message: 'The configured llama-server path is not a file.',
      path: serverPath
    });
  } else if (!(await deps.isExecutable(serverPath))) {
    issues.push({
      code: 'SERVER_NOT_EXECUTABLE',
      message: 'The configured llama-server path is not executable.',
      path: serverPath
    });
  }

  if (chatTemplatePath) {
    if (!(await deps.fileExists(chatTemplatePath))) {
      issues.push({
        code: 'CHAT_TEMPLATE_FILE_NOT_FOUND',
        message: 'The configured chat template file does not exist on disk.',
        path: chatTemplatePath
      });
    } else if (!(await deps.isFile(chatTemplatePath))) {
      issues.push({
        code: 'CHAT_TEMPLATE_PATH_NOT_FILE',
        message: 'The configured chat template path is not a file.',
        path: chatTemplatePath
      });
    }
  }

  if (issues.length === 0) {
    return null;
  }

  return {
    issues,
    fakeMode: settings.use_fake_reply
  };
}
