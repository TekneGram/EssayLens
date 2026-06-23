import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import type {
  ChatFeedbackType,
  ChatInlineCommentPayload,
  EssayFeedbackSection,
  EssayFeedbackType,
  SendChatMessageResponse
} from '../../ipc/contracts/chat.contracts';
import { extractDocxTextFromBuffer } from '../documents/docxTextExtractor';
import {
  buildLlmEssayFeedbackConclusionFinalCommentPayload,
  buildLlmEssayFeedbackIdentifyPayload,
  buildLlmEssayFeedbackParagraphEvaluationPayload,
  buildLlmEssayFeedbackSummaryFeedbackPayload,
  buildLlmEssayFeedbackStubPayload,
  buildLlmEssayFeedbackSummarizeMainIdeaPayload,
  buildLlmEssayFeedbackThesisRestatementPayload,
  buildLlmEssayFeedbackThesisStatementPayload,
  isEssayFeedbackConclusionFinalCommentResult,
  isEssayFeedbackIdentifyResult,
  isEssayFeedbackParagraphEvaluationResult,
  isEssayFeedbackSummaryFeedbackResult,
  isEssayFeedbackSummarizeMainIdeaResult,
  isEssayFeedbackThesisRestatementResult,
  isEssayFeedbackThesisStatementResult
} from '../../mappers/chatRequestMappers';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type { LlmSessionTurn } from '../../db/repositories/llmChatSessionRepository';
import type {
  ChatServiceDeps,
  EmitChatEvent,
  EssayFeedbackRequest,
  LlmEssayFeedbackIdentifyResult,
  LlmEssayFeedbackParagraphEvaluationResult,
  LlmEssayFeedbackConclusionFinalCommentResult,
  LlmEssayFeedbackSummaryFeedbackResult,
  LlmEssayFeedbackSummarizeMainIdeaResult,
  LlmEssayFeedbackThesisRestatementResult,
  LlmEssayFeedbackThesisStatementResult
} from './chatService.shared';

interface EssayFeedbackReply {
  fileId: string;
  sessionId: string;
  messageId: string;
  reply: string;
  clientRequestId: string;
  essayFeedbackType: EssayFeedbackType;
  essayFeedbackSection?: EssayFeedbackSection;
  feedbackType?: ChatFeedbackType;
  inlineComment?: ChatInlineCommentPayload;
  paragraphFirstSentence?: string;
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

interface IdentifiedEssayContext {
  essayText: string;
  identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
  mainIdea?: string;
}

interface EssayPreflightContext {
  essayText: string;
  progressMessageId: string;
  identifyClientRequestId: string;
}

interface EssayFeedbackStageResult {
  clientRequestId: string;
  replies: EssayFeedbackReply[];
  statusMessageId: string;
  persistReplies?: boolean;
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
    const activeModel = await this.deps.llmSelectionRepository.getActiveModel();

    const preflightContext = await this.preflightEssayFile({
      fileId: request.fileId,
      filePath: sourceFile.path,
      sessionId,
      baseClientRequestId,
      emitToRenderer
    });
    if (!preflightContext) {
      return { reply: '', essayFeedback: { replies, failures } };
    }

    await this.deps.llmChatSessionRepository.createSession(sessionId, request.fileId);

    const identifiedEssayContext = await this.identifyParagraphs({
      fileId: request.fileId,
      sessionId,
      settings,
      emitToRenderer,
      essayText: preflightContext.essayText,
      identifyClientRequestId: preflightContext.identifyClientRequestId,
      progressMessageId: preflightContext.progressMessageId
    });
    if (!identifiedEssayContext) {
      return { reply: '', essayFeedback: { replies, failures } };
    }

    for (let index = 0; index < normalizedSelection.selectedFeedbackTypes.length; index += 1) {
      const essayFeedbackType = normalizedSelection.selectedFeedbackTypes[index];
      const clientRequestId = `${baseClientRequestId}:essay:${index + 1}:${essayFeedbackType}`;

      try {
        const stageResult = await this.runEssayFeedbackStage({
          fileId: request.fileId,
          sessionId,
          clientRequestId,
          settings,
          emitToRenderer,
          essayFeedbackType,
          identifiedEssayContext,
          sourceFileName: sourceFile.name,
          sourceFormat: path.extname(sourceFile.path).toLowerCase().slice(1) || 'other'
        });

        if (stageResult.persistReplies !== false) {
          await this.persistStageReplies({
            fileId: request.fileId,
            sessionId,
            replies: stageResult.replies
          });
        }
        this.emitPersistedStageReplies({
          fileId: request.fileId,
          sessionId,
          essayFeedbackType,
          stageResult,
          emitToRenderer
        });
        replies.push(...stageResult.replies);
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Essay feedback stage failed.';
        const messageId = randomUUID();
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
          seq: 999,
          channel: 'meta',
          text: '',
          done: true,
          error: {
            code: 'ESSAY_FEEDBACK_STAGE_FAILED',
            message: reason,
            details: error
          }
        });
        break;
      }
    }

    if (activeModel && failures.length === 0) {
      try {
        await this.deps.llmFeedbackCompletionRepository.addCompletion({
          fileId: request.fileId,
          workflowKey: 'essay_feedback',
          modelKey: activeModel.key,
          modelDisplayName: activeModel.displayName,
          sessionId
        });
      } catch (error) {
        emitToRenderer({
          requestId: `${baseClientRequestId}:completion:error`,
          clientRequestId: `${baseClientRequestId}:completion`,
          fileId: request.fileId,
          sessionId,
          messageId: randomUUID(),
          workflow: 'essay-feedback',
          type: 'error',
          seq: 1002,
          channel: 'meta',
          text: '',
          done: true,
          error: {
            code: 'ESSAY_FEEDBACK_COMPLETION_PERSIST_FAILED',
            message: 'Essay feedback was generated, but completion tracking could not be saved.',
            details: error
          }
        });
      }
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      essayFeedback: { replies, failures }
    };
  }

  private async runEssayFeedbackStage(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    essayFeedbackType: EssayFeedbackType;
    identifiedEssayContext: IdentifiedEssayContext;
    sourceFileName: string;
    sourceFormat: string;
  }): Promise<EssayFeedbackStageResult> {
    switch (args.essayFeedbackType) {
      case 'thesis-statement-feedback':
        return this.runThesisStatementFeedback(args);
      case 'summarize-main-idea':
        return this.runSummarizeMainIdea(args);
      case 'paragraph-evaluation':
        return this.runParagraphEvaluation(args);
      case 'thesis-restatement-feedback':
        return this.runThesisRestatementFeedback(args);
      case 'summary-feedback':
        return this.runSummaryFeedback(args);
      case 'conclusion-final-comment':
        return this.runConclusionFinalComment(args);
      default:
        return this.runEssayFeedbackStub({
          fileId: args.fileId,
          sessionId: args.sessionId,
          clientRequestId: args.clientRequestId,
          essayFeedbackType: args.essayFeedbackType,
          fileName: args.sourceFileName,
          format: args.sourceFormat,
          identifiedParagraphs: args.identifiedEssayContext.identifiedParagraphs,
          emitToRenderer: args.emitToRenderer
        });
    }
  }

  private async preflightEssayFile(args: {
    fileId: string;
    filePath: string;
    sessionId: string;
    baseClientRequestId: string;
    emitToRenderer: EmitChatEvent;
  }): Promise<EssayPreflightContext | null> {
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

    return {
      essayText,
      identifyClientRequestId,
      progressMessageId
    };
  }

  private async identifyParagraphs(args: {
    fileId: string;
    sessionId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    essayText: string;
    identifyClientRequestId: string;
    progressMessageId: string;
  }): Promise<IdentifiedEssayContext | null> {
    const llmPayload = buildLlmEssayFeedbackIdentifyPayload({
      essay: args.essayText,
      settings: args.settings,
      clientRequestId: args.identifyClientRequestId
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
        clientRequestId: args.identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: args.progressMessageId,
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
        clientRequestId: args.identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: args.progressMessageId,
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
        clientRequestId: args.identifyClientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: args.progressMessageId,
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

    await this.deps.essayFeedbackAnalysisRepository.upsertIdentifiedParagraphs(args.sessionId, args.fileId, {
      introductionParagraph: llmResult.data.introduction_paragraph,
      bodyParagraphs: llmResult.data.body_paragraphs.items,
      conclusionParagraph: llmResult.data.conclusion_paragraph
    });

    args.emitToRenderer({
      requestId: `${args.identifyClientRequestId}:done`,
      clientRequestId: args.identifyClientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: args.progressMessageId,
      workflow: 'essay-feedback',
      essayFeedbackStage: 'identify-paragraphs',
      type: 'done',
      seq: 1000,
      channel: 'meta',
      text: '',
      done: true
    });

    return {
      essayText: args.essayText,
      identifiedParagraphs: llmResult.data
    };
  }

  private async runThesisStatementFeedback(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'thesis-statement-feedback',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const payload = buildLlmEssayFeedbackThesisStatementPayload({
      essay: args.identifiedEssayContext.essayText,
      introduction: args.identifiedEssayContext.identifiedParagraphs.introduction_paragraph,
      settings: args.settings,
      clientRequestId: args.clientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof payload,
      LlmEssayFeedbackThesisStatementResult
    >('llm.essay.feedback.thesisStatement', payload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: args.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: 'thesis-statement-feedback',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      throw new Error(llmResult.error.message);
    }
    if (!isEssayFeedbackThesisStatementResult(llmResult.data)) {
      throw new Error('Python worker returned an invalid thesis-statement response.');
    }

    await this.deps.essayFeedbackAnalysisRepository.saveThesisStatement(
      args.sessionId,
      args.fileId,
      llmResult.data.thesis_statement
    );

    const replies = [
      this.buildEssayFeedbackReply({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: `${args.clientRequestId}:verdict`,
        essayFeedbackType: 'thesis-statement-feedback',
        essayFeedbackSection: 'verdict',
        feedbackType: 'thesis-statement-feedback',
        reply: this.formatEssayFeedbackSectionReply('Thesis Statement Feedback', 'Verdict', llmResult.data.verdict),
        inlineComment: this.buildInlineCommentPayload(llmResult.data.thesis_statement, llmResult.data.verdict)
      }),
      this.buildEssayFeedbackReply({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: `${args.clientRequestId}:comments`,
        essayFeedbackType: 'thesis-statement-feedback',
        essayFeedbackSection: 'comments',
        feedbackType: 'thesis-statement-feedback',
        reply: this.formatEssayFeedbackSectionReply(
          'Thesis Statement Feedback',
          'Comments',
          llmResult.data.comments
        ),
        inlineComment: this.buildInlineCommentPayload(
          llmResult.data.thesis_statement,
          llmResult.data.comments
        )
      })
    ];

    return {
      clientRequestId: args.clientRequestId,
      replies,
      statusMessageId
    };
  }

  private async runSummarizeMainIdea(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    essayFeedbackType: EssayFeedbackType;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'summarize-main-idea',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const payload = buildLlmEssayFeedbackSummarizeMainIdeaPayload({
      essay: args.identifiedEssayContext.essayText,
      settings: args.settings,
      clientRequestId: args.clientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof payload,
      LlmEssayFeedbackSummarizeMainIdeaResult
    >('llm.essay.feedback.summarizeMainIdea', payload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: args.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: 'summarize-main-idea',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      throw new Error(llmResult.error.message);
    }
    if (!isEssayFeedbackSummarizeMainIdeaResult(llmResult.data)) {
      throw new Error('Python worker returned an invalid summarize-main-idea response.');
    }

    args.identifiedEssayContext.mainIdea = llmResult.data.main_idea;
    await this.deps.essayFeedbackAnalysisRepository.saveMainIdea(
      args.sessionId,
      args.fileId,
      llmResult.data.main_idea
    );

    return {
      clientRequestId: args.clientRequestId,
      replies: [],
      statusMessageId,
      persistReplies: false
    };
  }

  private async runParagraphEvaluation(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    essayFeedbackType: EssayFeedbackType;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'paragraph-evaluation',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const mainIdea = args.identifiedEssayContext.mainIdea?.trim();
    if (!mainIdea) {
      throw new Error('Paragraph evaluation requires a summarized main idea.');
    }

    const replies: EssayFeedbackReply[] = [];
    const introduction = args.identifiedEssayContext.identifiedParagraphs.introduction_paragraph;
    const bodyParagraphs = args.identifiedEssayContext.identifiedParagraphs.body_paragraphs.items;

    for (let index = 0; index < bodyParagraphs.length; index += 1) {
      const bodyParagraph = bodyParagraphs[index]?.body_paragraph?.trim();
      if (!bodyParagraph) {
        continue;
      }
      const paragraphClientRequestId = `${args.clientRequestId}:paragraph:${index + 1}`;
      const payload = buildLlmEssayFeedbackParagraphEvaluationPayload({
        introduction,
        bodyParagraph,
        mainIdea,
        settings: args.settings,
        clientRequestId: paragraphClientRequestId
      });

      const llmResult = await this.deps.llmOrchestrator.requestActionStream<
        typeof payload,
        LlmEssayFeedbackParagraphEvaluationResult
      >('llm.essay.feedback.paragraphEvaluation', payload, (streamEvent) => {
        if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
          return;
        }
        args.emitToRenderer({
          requestId: streamEvent.requestId,
          clientRequestId: args.clientRequestId,
          fileId: args.fileId,
          sessionId: args.sessionId,
          messageId: statusMessageId,
          workflow: 'essay-feedback',
          essayFeedbackType: 'paragraph-evaluation',
          type: 'status',
          seq: 10 + index * 10 + streamEvent.data.seq,
          channel: 'meta',
          text: `Paragraph ${index + 1}: ${streamEvent.data.text}`,
          done: false
        });
      });

      if (!llmResult.ok) {
        throw new Error(llmResult.error.message);
      }
      if (!isEssayFeedbackParagraphEvaluationResult(llmResult.data)) {
        throw new Error('Python worker returned an invalid paragraph-evaluation response.');
      }

      const paragraphFirstSentence = this.extractFirstSentence(bodyParagraph);
      replies.push(
        this.buildEssayFeedbackReply({
          fileId: args.fileId,
          sessionId: args.sessionId,
          clientRequestId: `${paragraphClientRequestId}:verdict`,
          essayFeedbackType: 'paragraph-evaluation',
          essayFeedbackSection: 'verdict',
          feedbackType: 'paragraph-evaluation',
          reply: this.formatEssayFeedbackSectionReply(
            `Paragraph Evaluation ${index + 1}`,
            'Verdict',
            llmResult.data.verdict
          ),
          inlineComment: this.buildInlineCommentPayload(paragraphFirstSentence, llmResult.data.verdict),
          paragraphFirstSentence
        }),
        this.buildEssayFeedbackReply({
          fileId: args.fileId,
          sessionId: args.sessionId,
          clientRequestId: `${paragraphClientRequestId}:comments`,
          essayFeedbackType: 'paragraph-evaluation',
          essayFeedbackSection: 'comments',
          feedbackType: 'paragraph-evaluation',
          reply: this.formatEssayFeedbackSectionReply(
            `Paragraph Evaluation ${index + 1}`,
            'Comments',
            llmResult.data.comments
          ),
          inlineComment: this.buildInlineCommentPayload(paragraphFirstSentence, llmResult.data.comments),
          paragraphFirstSentence
        })
      );
    }

    return {
      clientRequestId: args.clientRequestId,
      replies,
      statusMessageId
    };
  }

  private async runThesisRestatementFeedback(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'thesis-restatement-feedback',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const thesisStatement = await this.requireThesisStatement(args.sessionId, args.fileId, args.identifiedEssayContext);
    const conclusionParagraph = args.identifiedEssayContext.identifiedParagraphs.conclusion_paragraph.trim();
    const conclusionFirstSentence = this.extractFirstSentence(conclusionParagraph);
    if (!conclusionFirstSentence) {
      throw new Error('Thesis restatement feedback requires a conclusion first sentence.');
    }

    const payload = buildLlmEssayFeedbackThesisRestatementPayload({
      thesisStatement,
      conclusionFirstSentence,
      settings: args.settings,
      clientRequestId: args.clientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof payload,
      LlmEssayFeedbackThesisRestatementResult
    >('llm.essay.feedback.thesisRestatement', payload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: args.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: 'thesis-restatement-feedback',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      throw new Error(llmResult.error.message);
    }
    if (!isEssayFeedbackThesisRestatementResult(llmResult.data)) {
      throw new Error('Python worker returned an invalid thesis-restatement-feedback response.');
    }

    return {
      clientRequestId: args.clientRequestId,
      replies: this.buildConclusionFeedbackReplies({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: args.clientRequestId,
        essayFeedbackType: 'thesis-restatement-feedback',
        title: 'Thesis Restatement Feedback',
        verdict: llmResult.data.verdict,
        comments: llmResult.data.comments,
        conclusionParagraph
      }),
      statusMessageId
    };
  }

  private async runSummaryFeedback(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'summary-feedback',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const payload = buildLlmEssayFeedbackSummaryFeedbackPayload({
      essay: args.identifiedEssayContext.essayText,
      settings: args.settings,
      clientRequestId: args.clientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof payload,
      LlmEssayFeedbackSummaryFeedbackResult
    >('llm.essay.feedback.summaryFeedback', payload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: args.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: 'summary-feedback',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      throw new Error(llmResult.error.message);
    }
    if (!isEssayFeedbackSummaryFeedbackResult(llmResult.data)) {
      throw new Error('Python worker returned an invalid summary-feedback response.');
    }

    const conclusionParagraph = args.identifiedEssayContext.identifiedParagraphs.conclusion_paragraph.trim();
    return {
      clientRequestId: args.clientRequestId,
      replies: this.buildConclusionFeedbackReplies({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: args.clientRequestId,
        essayFeedbackType: 'summary-feedback',
        title: 'Summary Feedback',
        verdict: llmResult.data.verdict,
        comments: llmResult.data.comments,
        conclusionParagraph
      }),
      statusMessageId
    };
  }

  private async runConclusionFinalComment(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    settings: LlmRuntimeSettings;
    emitToRenderer: EmitChatEvent;
    identifiedEssayContext: IdentifiedEssayContext;
  }): Promise<EssayFeedbackStageResult> {
    const statusMessageId = randomUUID();
    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: 'conclusion-final-comment',
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    const conclusionParagraph = args.identifiedEssayContext.identifiedParagraphs.conclusion_paragraph.trim();
    const finalSentence = this.extractLastSentence(conclusionParagraph);
    if (!finalSentence) {
      throw new Error('Conclusion final comment requires a final sentence.');
    }

    const payload = buildLlmEssayFeedbackConclusionFinalCommentPayload({
      essay: args.identifiedEssayContext.essayText,
      finalSentence,
      settings: args.settings,
      clientRequestId: args.clientRequestId
    });

    const llmResult = await this.deps.llmOrchestrator.requestActionStream<
      typeof payload,
      LlmEssayFeedbackConclusionFinalCommentResult
    >('llm.essay.feedback.conclusionFinalComment', payload, (streamEvent) => {
      if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') {
        return;
      }
      args.emitToRenderer({
        requestId: streamEvent.requestId,
        clientRequestId: args.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: 'conclusion-final-comment',
        type: 'status',
        seq: streamEvent.data.seq + 1,
        channel: 'meta',
        text: streamEvent.data.text,
        done: false
      });
    });

    if (!llmResult.ok) {
      throw new Error(llmResult.error.message);
    }
    if (!isEssayFeedbackConclusionFinalCommentResult(llmResult.data)) {
      throw new Error('Python worker returned an invalid conclusion-final-comment response.');
    }

    return {
      clientRequestId: args.clientRequestId,
      replies: this.buildConclusionFeedbackReplies({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: args.clientRequestId,
        essayFeedbackType: 'conclusion-final-comment',
        title: 'Conclusion Final Comment',
        verdict: llmResult.data.verdict,
        comments: llmResult.data.comments,
        conclusionParagraph
      }),
      statusMessageId
    };
  }

  private runEssayFeedbackStub(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    essayFeedbackType: EssayFeedbackType;
    fileName: string;
    format: string;
    identifiedParagraphs: LlmEssayFeedbackIdentifyResult;
    emitToRenderer: EmitChatEvent;
  }): EssayFeedbackStageResult {
    const statusMessageId = randomUUID();
    const reply = (() => {
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
    })();

    const builtReply = this.buildEssayFeedbackReply({
      fileId: args.fileId,
      sessionId: args.sessionId,
      clientRequestId: args.clientRequestId,
      essayFeedbackType: args.essayFeedbackType,
      reply
    });

    args.emitToRenderer({
      requestId: `${args.clientRequestId}:start`,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: args.essayFeedbackType,
      type: 'start',
      seq: 1,
      channel: 'meta',
      text: '',
      done: false
    });

    return {
      clientRequestId: args.clientRequestId,
      replies: [builtReply],
      statusMessageId
    };
  }

  private async persistStageReplies(args: {
    fileId: string;
    sessionId: string;
    replies: EssayFeedbackReply[];
  }): Promise<void> {
    if (args.replies.length === 0) {
      return;
    }
    const turns: LlmSessionTurn[] = args.replies.map((reply) => ({
      role: 'assistant',
      content: reply.reply,
      metadata: this.buildSessionTurnMetadata(reply)
    }));
    await this.deps.llmChatSessionRepository.appendTurns(args.sessionId, turns, args.fileId);

    for (const reply of args.replies) {
      await this.deps.repository.addMessage({
        id: reply.messageId,
        role: 'assistant',
        content: reply.reply,
        relatedFileId: args.fileId,
        createdAt: new Date().toISOString()
      });
    }
  }

  private emitPersistedStageReplies(args: {
    fileId: string;
    sessionId: string;
    essayFeedbackType: EssayFeedbackType;
    stageResult: EssayFeedbackStageResult;
    emitToRenderer: EmitChatEvent;
  }): void {
    if (args.stageResult.replies.length === 0) {
      args.emitToRenderer({
        requestId: `${args.fileId}:${args.essayFeedbackType}:done`,
        clientRequestId: args.stageResult.clientRequestId,
        fileId: args.fileId,
        sessionId: args.sessionId,
        messageId: args.stageResult.statusMessageId,
        workflow: 'essay-feedback',
        essayFeedbackType: args.essayFeedbackType,
        type: 'done',
        seq: 1000,
        channel: 'meta',
        text: '',
        done: true
      });
      return;
    }
    args.stageResult.replies.forEach((reply, index) => {
      args.emitToRenderer({
        requestId: `${reply.clientRequestId}:chunk`,
        clientRequestId: reply.clientRequestId,
        fileId: reply.fileId,
        sessionId: reply.sessionId,
        messageId: reply.messageId,
        workflow: 'essay-feedback',
        essayFeedbackType: reply.essayFeedbackType,
        essayFeedbackSection: reply.essayFeedbackSection,
        feedbackType: reply.feedbackType,
        inlineComment: reply.inlineComment,
        paragraphFirstSentence: reply.paragraphFirstSentence,
        type: 'chunk',
        seq: index + 10,
        channel: 'content',
        text: reply.reply,
        done: false
      });
    });

    args.emitToRenderer({
      requestId: `${args.stageResult.clientRequestId}:done`,
      clientRequestId: args.stageResult.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: args.stageResult.statusMessageId,
      workflow: 'essay-feedback',
      essayFeedbackType: args.essayFeedbackType,
      type: 'done',
      seq: 1000,
      channel: 'meta',
      text: '',
      done: true
    });
  }

  private buildEssayFeedbackReply(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    essayFeedbackType: EssayFeedbackType;
    reply: string;
    essayFeedbackSection?: EssayFeedbackSection;
    feedbackType?: ChatFeedbackType;
    inlineComment?: ChatInlineCommentPayload;
    paragraphFirstSentence?: string;
  }): EssayFeedbackReply {
    return {
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: randomUUID(),
      reply: args.reply,
      clientRequestId: args.clientRequestId,
      essayFeedbackType: args.essayFeedbackType,
      essayFeedbackSection: args.essayFeedbackSection,
      feedbackType: args.feedbackType,
      inlineComment: args.inlineComment,
      paragraphFirstSentence: args.paragraphFirstSentence
    };
  }

  private buildInlineCommentPayload(searchText: string, commentText: string): ChatInlineCommentPayload {
    return {
      searchText: searchText.trim(),
      commentText: commentText.trim()
    };
  }

  private buildSessionTurnMetadata(reply: EssayFeedbackReply): LlmSessionTurn['metadata'] {
    if (!reply.inlineComment || !reply.feedbackType) {
      return undefined;
    }
    if (reply.feedbackType === 'thesis-statement-feedback') {
      return {
        feedbackType: 'thesis-statement-feedback',
        inlineComment: reply.inlineComment
      };
    }
    if (reply.feedbackType === 'paragraph-evaluation') {
      return {
        feedbackType: 'paragraph-evaluation',
        inlineComment: reply.inlineComment
      };
    }
    if (
      reply.feedbackType === 'thesis-restatement-feedback' ||
      reply.feedbackType === 'summary-feedback' ||
      reply.feedbackType === 'conclusion-final-comment'
    ) {
      return {
        feedbackType: reply.feedbackType,
        inlineComment: reply.inlineComment
      };
    }
    return undefined;
  }

  private extractFirstSentence(text: string): string {
    const normalized = text.trim();
    if (!normalized) {
      return '';
    }
    const match = normalized.match(/^.*?[.!?](?:\s|$)/);
    return (match?.[0] ?? normalized).trim();
  }

  private extractLastSentence(text: string): string {
    const normalized = text.trim();
    if (!normalized) {
      return '';
    }
    const sentenceMatches = normalized.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
    return (sentenceMatches?.[sentenceMatches.length - 1] ?? normalized).trim();
  }

  private buildConclusionFeedbackReplies(args: {
    fileId: string;
    sessionId: string;
    clientRequestId: string;
    essayFeedbackType:
      | 'thesis-restatement-feedback'
      | 'summary-feedback'
      | 'conclusion-final-comment';
    title: string;
    verdict: string;
    comments: string;
    conclusionParagraph: string;
  }): EssayFeedbackReply[] {
    return [
      this.buildEssayFeedbackReply({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: `${args.clientRequestId}:verdict`,
        essayFeedbackType: args.essayFeedbackType,
        essayFeedbackSection: 'verdict',
        feedbackType: args.essayFeedbackType,
        reply: this.formatEssayFeedbackSectionReply(args.title, 'Verdict', args.verdict),
        inlineComment: this.buildInlineCommentPayload(args.conclusionParagraph, args.verdict)
      }),
      this.buildEssayFeedbackReply({
        fileId: args.fileId,
        sessionId: args.sessionId,
        clientRequestId: `${args.clientRequestId}:comments`,
        essayFeedbackType: args.essayFeedbackType,
        essayFeedbackSection: 'comments',
        feedbackType: args.essayFeedbackType,
        reply: this.formatEssayFeedbackSectionReply(args.title, 'Comments', args.comments),
        inlineComment: this.buildInlineCommentPayload(args.conclusionParagraph, args.comments)
      })
    ];
  }

  private async requireThesisStatement(
    sessionId: string,
    fileId: string,
    _identifiedEssayContext: IdentifiedEssayContext
  ): Promise<string> {
    const saved = await this.deps.essayFeedbackAnalysisRepository.getIdentifiedParagraphs(sessionId, fileId);
    const thesisStatement = saved?.thesisStatement?.trim();
    if (thesisStatement) {
      return thesisStatement;
    }
    throw new Error('Thesis restatement feedback requires a saved thesis statement.');
  }

  private formatEssayFeedbackSectionReply(title: string, section: string, text: string): string {
    return `### ${title}\n${section}: ${text}`;
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
