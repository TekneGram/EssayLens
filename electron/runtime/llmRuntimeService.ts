import type { LlmNotReadyErrorDetails } from '../ipc/contracts/chat.contracts';
import { getLlmNotReadyDetails } from './llmRuntimeReadiness';
import type { ChatServiceDeps, RuntimeReadyResult } from '../services/llm/chatService.shared';

function canRecoverServerPathIssues(details: LlmNotReadyErrorDetails): boolean {
  const recoverableCodes = new Set([
    'MISSING_SERVER_PATH',
    'SERVER_FILE_NOT_FOUND',
    'SERVER_PATH_NOT_FILE',
    'SERVER_NOT_EXECUTABLE'
  ]);
  return details.issues.length > 0 && details.issues.every((issue) => recoverableCodes.has(issue.code));
}

export class LlmRuntimeService {
  constructor(private readonly deps: Pick<ChatServiceDeps, 'llmSettingsRepository' | 'llmSelectionRepository' | 'fileExists' | 'isFile' | 'isExecutable' | 'resolveLlmServerPath'>) {}

  private async loadRuntimeSettings() {
    return this.deps.llmSettingsRepository.getRuntimeSettings();
  }

  async getRuntimeReadyResult(): Promise<RuntimeReadyResult> {
    let settings = await this.loadRuntimeSettings();
    let notReadyDetails = await getLlmNotReadyDetails(settings, {
      fileExists: this.deps.fileExists,
      isFile: this.deps.isFile,
      isExecutable: this.deps.isExecutable
    });

    if (notReadyDetails && canRecoverServerPathIssues(notReadyDetails)) {
      const activeModel = await this.deps.llmSelectionRepository.getActiveModel();
      if (activeModel) {
        const reset = await this.deps.llmSelectionRepository.resetSettingsToDefaults(this.deps.resolveLlmServerPath());
        if (reset?.settings) {
          settings = reset.settings;
          notReadyDetails = await getLlmNotReadyDetails(settings, {
            fileExists: this.deps.fileExists,
            isFile: this.deps.isFile,
            isExecutable: this.deps.isExecutable
          });
        }
      }
    }

    return {
      settings,
      notReadyDetails
    };
  }
}
