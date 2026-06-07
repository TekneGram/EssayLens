import type { LlmNotReadyErrorDetails } from '../ipc/contracts/chat.contracts';
import { getLlmNotReadyDetails } from './llmRuntimeReadiness';
import type { ChatServiceDeps, RuntimeReadyResult } from '../services/llm/chatService.shared';

function normalizeOptionalPath(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canRecoverServerPathIssues(details: LlmNotReadyErrorDetails): boolean {
  const recoverableCodes = new Set([
    'MISSING_SERVER_PATH',
    'SERVER_FILE_NOT_FOUND',
    'SERVER_PATH_NOT_FILE',
    'SERVER_NOT_EXECUTABLE',
    'CHAT_TEMPLATE_FILE_NOT_FOUND',
    'CHAT_TEMPLATE_PATH_NOT_FILE'
  ]);
  return details.issues.length > 0 && details.issues.every((issue) => recoverableCodes.has(issue.code));
}

export class LlmRuntimeService {
  constructor(
    private readonly deps: Pick<
      ChatServiceDeps,
      'llmSettingsRepository' | 'llmSelectionRepository' | 'fileExists' | 'isFile' | 'isExecutable' | 'resolveLlmServerPath' | 'resolveLlmAssetPath'
    >
  ) {}

  private async loadRuntimeSettings() {
    return this.deps.llmSettingsRepository.getRuntimeSettings();
  }

  async getRuntimeReadyResult(): Promise<RuntimeReadyResult> {
    let settings = await this.loadRuntimeSettings();
    const activeModel = await this.deps.llmSelectionRepository.getActiveModel();
    const catalogModels = activeModel ? await this.deps.llmSelectionRepository.listCatalogModels() : [];
    const activeCatalogModel = activeModel ? catalogModels.find((model) => model.key === activeModel.key) ?? null : null;
    const expectedChatTemplatePath =
      activeCatalogModel?.chatTemplateAsset && this.deps.resolveLlmAssetPath
        ? this.deps.resolveLlmAssetPath(activeCatalogModel.chatTemplateAsset)
        : null;
    const hasTemplateMismatch = normalizeOptionalPath(settings.llm_chat_template_path) !== expectedChatTemplatePath;
    if (activeModel && hasTemplateMismatch) {
      const reset = await this.deps.llmSelectionRepository.resetSettingsToDefaults(
        this.deps.resolveLlmServerPath(),
        expectedChatTemplatePath
      );
      if (reset?.settings) {
        settings = reset.settings;
      }
    }

    let notReadyDetails = await getLlmNotReadyDetails(settings, {
      fileExists: this.deps.fileExists,
      isFile: this.deps.isFile,
      isExecutable: this.deps.isExecutable
    });

    if (notReadyDetails && canRecoverServerPathIssues(notReadyDetails)) {
      if (activeModel) {
        const reset = await this.deps.llmSelectionRepository.resetSettingsToDefaults(
          this.deps.resolveLlmServerPath(),
          expectedChatTemplatePath
        );
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
