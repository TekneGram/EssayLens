import type {
  ChatStreamChunkEvent,
  SendChatMessageRequest,
  SendChatMessageResponse
} from '../../ipc/contracts/chat.contracts';
import type { GetRubricMatrixResponse } from '../../ipc/contracts/rubric.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { LlmChatSessionRepository, type LlmSessionTurn } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository, type LlmRuntimeSettings } from '../../db/repositories/llmSettingsRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import type { LlmNotReadyErrorDetails } from '../../ipc/contracts/chat.contracts';

export interface ChatServiceDeps {
  repository: ChatRepository;
  llmOrchestrator: LlmOrchestrator;
  llmSettingsRepository: LlmSettingsRepository;
  llmChatSessionRepository: LlmChatSessionRepository;
  llmSelectionRepository: LlmSelectionRepository;
  rubricRepository: RubricRepository;
  workspaceRepository: WorkspaceRepository;
  fileExists: (targetPath: string) => Promise<boolean>;
  isFile: (targetPath: string) => Promise<boolean>;
  isExecutable: (targetPath: string) => Promise<boolean>;
  resolveLlmServerPath: () => string;
}

export interface LlmChatPayload extends SendChatMessageRequest {
  sessionTurns?: LlmSessionTurn[];
  settings: LlmRuntimeSettings;
  systemPrompt?: string;
}

export interface RubricFeedbackCategorySection {
  category: string;
  entries: Array<{
    scoreValue: number;
    description: string;
  }>;
}

export interface LlmRubricEvaluationPayload {
  settings: LlmRuntimeSettings;
  essay: string;
  rubricCategory: string;
  rubricEntries: RubricFeedbackCategorySection['entries'];
}

export interface LlmParagraphFeedbackBulkPayload {
  settings: LlmRuntimeSettings;
  essay: string;
  clientRequestId?: string;
}

export interface RuntimeReadyResult {
  settings: LlmRuntimeSettings;
  notReadyDetails: LlmNotReadyErrorDetails | null;
}

export type EmitChatEvent = (payload: ChatStreamChunkEvent) => void;

export type RubricFeedbackRequest = SendChatMessageRequest & {
  kind: 'rubric-feedback';
  fileId: string;
  essay: string;
  rubricId?: string;
};

export type ParagraphFeedbackBulkRequest = SendChatMessageRequest & {
  kind: 'paragraph-feedback-bulk';
  fileIds: string[];
};

export type ChatSendResult = Promise<SendChatMessageResponse>;

export type RubricMatrix = GetRubricMatrixResponse;
