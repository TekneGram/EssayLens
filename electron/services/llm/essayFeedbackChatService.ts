import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { extractDocxTextFromBuffer } from '../documents/docxTextExtractor';
import type { EssayFeedbackType, SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import {
  buildLlmEssayFeedbackIdentifyPayload,
  buildLlmEssayFeedbackStubPayload,
  isEssayFeedbackIdentifyResult
} from '../../mappers/chatRequestMappers';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type {
  ChatServiceDeps,
  EmitChatEvent,
  EssayFeedbackRequest,
  LlmEssayFeedbackIdentifyResult
} from './chatService.shared';

interface EssayFeedbackReply {
  fileId: string;
  sessionId: string;
  messageId: string;
  reply: string;
  clientRequestId: string;
  essayFeedbackType: EssayFeedbackType;
}

interface EssayFeedbackFailure {
  fileId: string;
  sessionId: string;
  messageId: string;
  reason: string;
  clientRequestId: string;
  details?: unknown;
  essayFeedbackType?: EssayFeedbackType;
}

const ESSAY_FEEDBACK_TYPE_LABELS: Record<EssayFeedbackType, string> = {
  'thesis-statement-feedback': 'Thesis statement feedback',
  'summarize-main-idea': 'Summarize main idea',
  'paragraph-evaluation': 'Paragraph evaluation',
  'thesis-restatement-feedback': 'Thesis restatement feedback',
  'summary-feedback': 'Summary feedback',
  'conclusion-final-comment': 'Conclusion final comment'
};

export class EssayFeedbackChatService {
  private readonly runtimeService: LlmRuntimeService;

  constructor(private readonly deps: ChatServiceDeps) {
    this.runtimeService = new LlmRuntimeService(deps);
  }

  async sendMessage(
    request: EssayFeedbackRequest,
    emitToRenderer: EmitChatEvent
  ): Promise<SendChatMessageResponse> {
    const { settings, notReadyDetails } = await this.runtimeService.getRuntimeReadyResult();
    if (notReadyDetails) {
      throw new AppException({
        code: 'LLM_NOT_READY',
        userMessage: 'LLM runtime is not ready. Select a downloaded model and ensure llama-server is configured.',
        details: notReadyDetails
      });
    }

    const normalizedSelection = buildLlmEssayFeedbackStubPayload({
      fileId: request.fileId,
      selectedFeedbackTypes: request.selectedFeedbackTypes
    });

    if (normalizedSelection.selectedFeedbackTypes.length === 0) {
      throw new AppException({
        code: 'CHAT_INVALID_REQUEST',
        userMessage: 'Essay feedback requires at least one selected feedback type.'
      });
    }

    const sourceFile = await this.deps.workspaceRepository.resolveFileById(request.fileId);
    if (!sourceFile) {
      throw new AppException({
        code: 'CHAT_INVALID_REQUEST',
        userMessage: 'Could not find this file in the workspace.'
      });
    }

    const sessionId = request.sessionId?.trim() || `essay-feedback:${request.fileId}:${Date.now()}`;
    const baseClientRequestId = request.clientRequestId ?? randomUUID();
    const replies: EssayFeedbackReply[] = [];
    const failures: EssayFeedbackFailure[] = [];

    await this.deps.llmChatSessionRepository.createSession(sessionId, request.fileId);

    const identifiedParagraphs = await this.identifyParagraphs({
      fileId: request.fileId,
      filePath: sourceFile.path,
      sessionId,
      baseClientRequestId,
      settings,
      emitToRenderer
    });

    if (!identifiedParagraphs) {
      return {
        reply: '',
        essayFeedback: {
          replies,
          failures
        }
      };
    }

    for (let index = 0; index < normalizedSelection.selectedFeedbackTypes.length; index += 1) {
      const essayFeedbackType = normalizedSelection.selectedFeedbackTypes[index];
      const messageId = randomUUID();
      const clientRequestId = `${baseClientRequestId}:essay:${index + 1}:${essayFeedbackType}`;

      emitToRenderer({
        requestId: `${clientRequestId}:start`,
        clientRequestId,
        fileId: request.fileId,
        sessionId,
        messageId,
        workflow: 'essay-feedback',
        essayFeedbackType,
        type: 'start',
        seq: 1,
        channel: 'meta',
        text: '',
        done: false
      });

      try {
        const reply = this.runEssayFeedbackStub({
          essayFeedbackType,
          fileName: sourceFile.name,
          format: path.extname(sourceFile.path).toLowerCase().slice(1) || 'other',
          identifiedParagraphs
        });

        replies.push({
          fileId: request.fileId,
          sessionId,
          messageId,
          reply,
          clientRequestId,
          essayFeedbackType
        });

        emitToRenderer({
          requestId: `${clientRequestId}:chunk`,
          clientRequestId,
          fileId: request.fileId,
          sessionId,
          messageId,
          workflow: 'essay-feedback',
          essayFeedbackType,
          type: 'chunk',
          seq: 2,
          channel: 'content',
          text: reply,
          done: false
        });

        emitToRenderer({
          requestId: `${clientRequestId}:done`,
          clientRequestId,
          fileId: request.fileId,
          sessionId,
          messageId,
          workflow: 'essay-feedback',
          essayFeedbackType,
          type: 'done',
          seq: 3,
          channel: 'meta',
          text: '',
          done: true
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Essay feedback stub failed.';
        failures.push({
          fileId: request.fileId,
          sessionId,
          messageId,
          reason,
          clientRequestId,
          details: error,
          essayFeedbackType
        });

        emitToRenderer({
          requestId: `${clientRequestId}:error`,
          clientRequestId,
          fileId: request.fileId,
          sessionId,
          messageId,
          workflow: 'essay-feedback',
          essayFeedbackType,
          type: 'error',
          seq: 2,
          channel: 'meta',
          text: '',
          done: true,
          error: {
            code: 'ESSAY_FEEDBACK_STUB_FAILED',
            message: reason,
            details: error
          }
        });
      }
    }

    try {
      await this.deps.llmChatSessionRepository.appendTurns(
        sessionId,
        replies.map((reply) => ({
          role: 'assistant' as const,
          content: reply.reply
        })),
        request.fileId
      );
      for (const reply of replies) {
        await this.deps.repository.addMessage({
          id: reply.messageId,
          role: 'assistant',
          content: reply.reply,
          relatedFileId: request.fileId,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      throw new AppException({
        code: 'CHAT_SEND_PERSIST_FAILED',
        userMessage: 'Essay feedback responses were generated but could not be persisted.',
        details: error
      });
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      essayFeedback: {
        replies,
        failures
      }
    };
  }

  private async identifyParagraphs(args: {
    fileId: string;
    filePath: string;
    sessionId: string;
    baseClientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
  }): Promise<LlmEssayFeedbackIdentifyResult | null> {
    const identifyClientRequestId = `${args.baseClientRequestId}:identify`;
    const progressMessageId = randomUUID();

    args.emitToRenderer({
      requestId: `${identifyClientRequestId}:start`,
      clientRequestId: identifyClientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: progressMessageId,
      workflow: 'essay-feedback',
      essayFeedbackStage: 'identify-paragraphs',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    if (path.extname(args.filePath).toLowerCase() !== '.docx') {
      args.emitToRenderer({
        requestId: `${identifyClientRequestId}:unsupported`,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'error',
        seq: 2,
        channel: 'meta',
        text: '',
        done: true,
        error: {
          code: 'ESSAY_FEEDBACK_UNSUPPORTED_FILE',
          message: 'Only DOCX files are supported for essay feedback right now.'
        }
      });
      return null;
    }

    let essayText = '';
    try {
      const buffer = await fs.readFile(args.filePath);
      essayText = (await extractDocxTextFromBuffer(buffer)).trim();
    } catch (error) {
      args.emitToRenderer({
        requestId: `${identifyClientRequestId}:extract-failed`,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'error',
        seq: 2,
        channel: 'meta',
        text: '',
        done: true,
        error: {
          code: 'ESSAY_FEEDBACK_EXTRACT_FAILED',
          message: 'Could not read DOCX text for this file.',
          details: error
        }
      });
      return null;
    }

    if (!essayText) {
      args.emitToRenderer({
        requestId: `${identifyClientRequestId}:empty-text`,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'error',
        seq: 2,
        channel: 'meta',
        text: '',
        done: true,
        error: {
          code: 'ESSAY_FEEDBACK_EMPTY_TEXT',
          message: 'No text was extracted from this DOCX file.'
        }
      });
      return null;
    }

    const llmPayload = buildLlmEssayFeedbackIdentifyPayload({
      essay: essayText,
      settings: args.settings,
      clientRequestId: identifyClientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof llmPayload,
      LlmEssayFeedbackIdentifyResult
    >('llm.essay.feedback.identifyParagraphs', llmPayload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      args.emitToRenderer({
        requestId: llmResult.requestId,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'error',
        seq: 999,
        channel: 'meta',
        text: '',
        done: true,
        error: llmResult.error
      });
      return null;
    }

    if (!isEssayFeedbackIdentifyResult(llmResult.data)) {
      args.emitToRenderer({
        requestId: llmResult.requestId,
        clientRequestId: identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: progressMessageId,
        workflow: 'essay-feedback',
        essayFeedbackStage: 'identify-paragraphs',
        type: 'error',
        seq: 999,
        channel: 'meta',
        text: '',
        done: true,
        error: {
          code: 'PY_INVALID_RESPONSE',
          message: 'Python worker returned an invalid identify-paragraphs response.',
          details: llmResult.data
        }
      });
      return null;
    }

    await this.deps.essayFeedbackAnalysisRepository.upsertIdentifiedParagraphs(
      args.sessionId,
      args.fileId,
      {
        introductionParagraph: llmResult.data.introduction_paragraph,
        bodyParagraphs: llmResult.data.body_paragraphs.items,
        conclusionParagraph: llmResult.data.conclusion_paragraph
      }
    );

    args.emitToRenderer({
      requestId: `${identifyClientRequestId}:done`,
      clientRequestId: identifyClientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: progressMessageId,
      workflow: 'essay-feedback',
      essayFeedbackStage: 'identify-paragraphs',
      type: 'done',
      seq: 1000,
      channel: 'meta',
      text: '',
      done: true
    });

    return llmResult.data;
  }

  private runEssayFeedbackStub(args: {
    essayFeedbackType: EssayFeedbackType;
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    switch (args.essayFeedbackType) {
      case 'thesis-statement-feedback':
        return this.stubThesisStatementFeedback(args);
      case 'summarize-main-idea':
        return this.stubSummarizeMainIdea(args);
      case 'paragraph-evaluation':
        return this.stubParagraphEvaluation(args);
      case 'thesis-restatement-feedback':
        return this.stubThesisRestatementFeedback(args);
      case 'summary-feedback':
        return this.stubSummaryFeedback(args);
      case 'conclusion-final-comment':
        return this.stubConclusionFinalComment(args);
      default:
        return `Stub essay feedback response for ${args.fileName}.`;
    }
  }

  private stubThesisStatementFeedback(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['thesis-statement-feedback']} is queued for ${args.fileName} (${args.format}) using the identified introduction paragraph.`;
  }

  private stubSummarizeMainIdea(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['summarize-main-idea']} is queued for ${args.fileName} (${args.format}) using the identified essay structure.`;
  }

  private stubParagraphEvaluation(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['paragraph-evaluation']} is queued for ${args.fileName} (${args.format}) across ${args.identifiedParagraphs.body_paragraphs.items.length} body paragraphs.`;
  }

  private stubThesisRestatementFeedback(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['thesis-restatement-feedback']} is queued for ${args.fileName} (${args.format}) using the identified conclusion paragraph.`;
  }

  private stubSummaryFeedback(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['summary-feedback']} is queued for ${args.fileName} (${args.format}) using the identified conclusion paragraph.`;
  }

  private stubConclusionFinalComment(args: {
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  }): string {
    return `Stub: ${ESSAY_FEEDBACK_TYPE_LABELS['conclusion-final-comment']} is queued for ${args.fileName} (${args.format}) using the identified conclusion paragraph.`;
  }
}
