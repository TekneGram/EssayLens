import type {
  EssayFeedbackType,
  EssayFeedbackStage,
  ChatStreamChunkEvent,
  SendChatMessageRequest,
  SendChatMessageResponse
} from '../../ipc/contracts/chat.contracts';
import type { GetRubricMatrixResponse } from '../../ipc/contracts/rubric.contracts';
import { ChatRepository } from '../../db/repositories/chatRepository';
import { EssayFeedbackAnalysisRepository } from '../../db/repositories/essayFeedbackAnalysisRepository';
import { LlmChatSessionRepository, type LlmSessionTurn } from '../../db/repositories/llmChatSessionRepository';
import { LlmSelectionRepository } from '../../db/repositories/llmSelectionRepository';
import { LlmSettingsRepository, type LlmRuntimeSettings } from '../../db/repositories/llmSettingsRepository';
import { LlmFeedbackCompletionRepository } from '../../db/repositories/llmFeedbackCompletionRepository';
import { RubricRepository } from '../../db/repositories/rubricRepository';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { LlmOrchestrator } from './llmOrchestrator';
import type { LlmNotReadyErrorDetails } from '../../ipc/contracts/chat.contracts';

export interface ChatServiceDeps {
  repository: ChatRepository;
  essayFeedbackAnalysisRepository: EssayFeedbackAnalysisRepository;
  llmOrchestrator: LlmOrchestrator;
  llmSettingsRepository: LlmSettingsRepository;
  llmChatSessionRepository: LlmChatSessionRepository;
  llmSelectionRepository: LlmSelectionRepository;
  llmFeedbackCompletionRepository: LlmFeedbackCompletionRepository;
  rubricRepository: RubricRepository;
  workspaceRepository: WorkspaceRepository;
  fileExists: (targetPath: string) => Promise<boolean>;
  isFile: (targetPath: string) => Promise<boolean>;
  isExecutable: (targetPath: string) => Promise<boolean>;
  resolveLlmServerPath: () => string;
  resolveLlmAssetPath?: (assetRelativePath: string) => string;
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

export interface LlmEssayFeedbackStubPayload {
  fileId: string;
  selectedFeedbackTypes: EssayFeedbackType[];
}

export interface LlmEssayFeedbackIdentifyPayload {
  settings: LlmRuntimeSettings;
  essay: string;
  clientRequestId?: string;
}

export interface LlmEssayFeedbackIdentifyResult {
  introduction_paragraph: string;
  body_paragraphs: {
    items: Array<{
      body_paragraph: string;
    }>;
  };
  conclusion_paragraph: string;
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
  redoCompletedFileIds?: string[];
};

export type EssayFeedbackRequest = SendChatMessageRequest & {
  kind: 'essay-feedback';
  fileId: string;
  selectedFeedbackTypes: EssayFeedbackType[];
};

export type ChatSendResult = Promise<SendChatMessageResponse>;

export type RubricMatrix = GetRubricMatrixResponse;
