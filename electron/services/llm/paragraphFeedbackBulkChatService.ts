import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppException } from '../../core/appException';
import type { SendChatMessageResponse } from '../../ipc/contracts/chat.contracts';
import {
  buildLlmParagraphFeedbackBulkPayload,
  requireReplyText
} from '../../mappers/chatRequestMappers';
import { extractDocxTextFromBuffer } from '../documents/docxTextExtractor';
import { LlmRuntimeService } from '../../runtime/llmRuntimeService';
import type {
  ChatServiceDeps,
  EmitChatEvent,
  ParagraphFeedbackBulkRequest
} from './chatService.shared';

interface ParagraphFeedbackBulkReply {
  fileId: string;
  sessionId: string;
  messageId: string;
  reply: string;
  clientRequestId: string;
  feedbackType?: 'topic_sentence' | 'supporting_sentences' | 'coherence';
  feedbackSection?: 'verdict' | 'reason' | 'revision_suggestion';
  progressMessageId?: string;
}

interface ParagraphFeedbackBulkFailure {
  fileId: string;
  sessionId: string;
  messageId: string;
  reason: string;
  clientRequestId: string;
  details?: unknown;
  progressMessageId?: string;
}

interface ParagraphFeedbackTypeResult {
  verdict: string;
  reason: string;
  revision_suggestion: string;
}

interface ParagraphFeedbackBundle {
  paragraph_feedback?: {
    topic_sentence?: ParagraphFeedbackTypeResult;
    supporting_sentences?: ParagraphFeedbackTypeResult;
    coherence?: ParagraphFeedbackTypeResult;
  };
}

export class ParagraphFeedbackBulkChatService {
  private readonly runtimeService: LlmRuntimeService;

  constructor(private readonly deps: ChatServiceDeps) {
    this.runtimeService = new LlmRuntimeService(deps);
  }

  async sendMessage(
    request: ParagraphFeedbackBulkRequest,
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

    const fileIds = [...new Set(request.fileIds.map((fileId) => fileId.trim()).filter((fileId) => fileId.length > 0))];
    if (fileIds.length === 0) {
      throw new AppException({
        code: 'CHAT_INVALID_REQUEST',
        userMessage: 'Paragraph feedback in bulk requires at least one file id.'
      });
    }

    const baseClientRequestId = request.clientRequestId ?? randomUUID();
    const replies: ParagraphFeedbackBulkReply[] = [];
    const failures: ParagraphFeedbackBulkFailure[] = [];

    for (let index = 0; index < fileIds.length; index += 1) {
      const fileId = fileIds[index];
      const progressMessageId = randomUUID();
      const sessionId = `paragraph-feedback:${fileId}:${Date.now()}:${index + 1}`;
      const perFileClientRequestId = `${baseClientRequestId}:paragraph:${index + 1}`;

      emitToRenderer({
        requestId: `${perFileClientRequestId}:start`,
        clientRequestId: perFileClientRequestId,
        fileId,
        sessionId,
        messageId: progressMessageId,
        workflow: 'paragraph-feedback-bulk',
        type: 'start',
        seq: 1,
        channel: 'meta',
        text: '',
        done: false
      });

      const sourceFile = await this.deps.workspaceRepository.resolveFileById(fileId);
      if (!sourceFile) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:missing-file`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'Could not find this file in the workspace.'
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'Could not find this file in the workspace.', clientRequestId: perFileClientRequestId, progressMessageId }));
        continue;
      }

      if (path.extname(sourceFile.path).toLowerCase() !== '.docx') {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:unsupported-file`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'Only DOCX files are supported for paragraph feedback in bulk.'
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'Only DOCX files are supported for paragraph feedback in bulk.', clientRequestId: perFileClientRequestId, progressMessageId }));
        continue;
      }

      let essayText = '';
      try {
        const buffer = await fs.readFile(sourceFile.path);
        essayText = (await extractDocxTextFromBuffer(buffer)).trim();
      } catch (error) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:extract-failed`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'Could not read DOCX text for this file.',
          details: error
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'Could not read DOCX text for this file.', clientRequestId: perFileClientRequestId, details: error, progressMessageId }));
        continue;
      }

      if (!essayText) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:empty-text`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'No text was extracted from this DOCX file.'
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'No text was extracted from this DOCX file.', clientRequestId: perFileClientRequestId, progressMessageId }));
        continue;
      }

      const llmPayload = buildLlmParagraphFeedbackBulkPayload({
        essay: essayText,
        settings,
        clientRequestId: perFileClientRequestId
      });

      const llmResult = await this.deps.llmOrchestrator.requestActionStream<typeof llmPayload, SendChatMessageResponse>(
        'llm.paragraph.feedback.bulk',
        llmPayload,
        (streamEvent) => {
          if (streamEvent.type !== 'stream_chunk' || streamEvent.data.channel !== 'meta') return;
          emitToRenderer({
            requestId: streamEvent.requestId,
            clientRequestId: perFileClientRequestId,
            fileId,
            sessionId,
            messageId: progressMessageId,
            workflow: 'paragraph-feedback-bulk',
            type: 'status',
            seq: streamEvent.data.seq + 1,
            channel: 'meta',
            text: streamEvent.data.text,
            done: false
          });
        }
      );

      if (!llmResult.ok) {
        this.emitBulkError({
          emitToRenderer,
          requestId: llmResult.requestId,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: llmResult.error.message,
          details: llmResult.error.details
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: llmResult.error.message, clientRequestId: perFileClientRequestId, details: llmResult.error.details, progressMessageId }));
        continue;
      }

      let reply = '';
      try {
        reply = requireReplyText(
          llmResult.data,
          'Python worker returned paragraph-feedback-bulk success without a valid reply.'
        );
      } catch (error) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:invalid-response`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'Python worker returned an invalid paragraph feedback response.',
          details: error
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'Python worker returned an invalid paragraph feedback response.', clientRequestId: perFileClientRequestId, details: error, progressMessageId }));
        continue;
      }

      const structuredReply = this.tryParseParagraphFeedbackBundle(reply);
      const feedbackReplies = this.buildFeedbackReplies({
        fileId,
        sessionId,
        baseClientRequestId: perFileClientRequestId,
        fallbackMessageId: randomUUID(),
        progressMessageId,
        structuredReply,
        fallbackReply: reply
      });

      try {
        await this.deps.llmChatSessionRepository.createSession(sessionId, fileId);
        await this.deps.llmChatSessionRepository.appendTurns(
          sessionId,
          feedbackReplies.map((item) => ({ role: 'assistant' as const, content: item.reply })),
          fileId
        );
        for (const item of feedbackReplies) {
          await this.deps.repository.addMessage({
            id: item.messageId,
            role: 'assistant',
            content: item.reply,
            relatedFileId: fileId,
            createdAt: new Date().toISOString()
          });
        }
      } catch (error) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:persist-failed`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: progressMessageId,
          reason: 'Paragraph feedback was generated but could not be persisted.',
          details: error
        });
        failures.push(this.buildFailure({ fileId, sessionId, messageId: progressMessageId, reason: 'Paragraph feedback was generated but could not be persisted.', clientRequestId: perFileClientRequestId, details: error, progressMessageId }));
        continue;
      }

      for (let replyIndex = 0; replyIndex < feedbackReplies.length; replyIndex += 1) {
        const item = feedbackReplies[replyIndex];
        emitToRenderer({
          requestId: `${item.clientRequestId}:chunk`,
          clientRequestId: item.clientRequestId,
          fileId,
          sessionId,
          messageId: item.messageId,
          workflow: 'paragraph-feedback-bulk',
          feedbackType: item.feedbackType,
          feedbackSection: item.feedbackSection,
          type: 'chunk',
          seq: 2,
          channel: 'content',
          text: item.reply,
          done: false
        });
        emitToRenderer({
          requestId: `${item.clientRequestId}:done`,
          clientRequestId: item.clientRequestId,
          fileId,
          sessionId,
          messageId: item.messageId,
          workflow: 'paragraph-feedback-bulk',
          feedbackType: item.feedbackType,
          feedbackSection: item.feedbackSection,
          type: 'done',
          seq: 3,
          channel: 'meta',
          text: '',
          done: true
        });
      }
      emitToRenderer({
        requestId: `${perFileClientRequestId}:progress-done`,
        clientRequestId: perFileClientRequestId,
        fileId,
        sessionId,
        messageId: progressMessageId,
        workflow: 'paragraph-feedback-bulk',
        type: 'done',
        seq: 999,
        channel: 'meta',
        text: '',
        done: true
      });

      replies.push(...feedbackReplies);
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      paragraphFeedbackBulk: {
        replies,
        failures,
        failedFileIds: failures.map((item) => item.fileId)
      }
    };
  }

  private emitBulkError(args: {
    emitToRenderer: EmitChatEvent;
    requestId: string;
    clientRequestId: string;
    fileId: string;
    sessionId: string;
    messageId: string;
    reason: string;
    details?: unknown;
  }): void {
    args.emitToRenderer({
      requestId: args.requestId,
      clientRequestId: args.clientRequestId,
      fileId: args.fileId,
      sessionId: args.sessionId,
      messageId: args.messageId,
      workflow: 'paragraph-feedback-bulk',
      type: 'error',
      seq: 2,
      channel: 'meta',
      text: '',
      done: true,
      error: {
        code: 'PARAGRAPH_FEEDBACK_BULK_FILE_FAILED',
        message: args.reason,
        details: args.details
      }
    });
  }

  private tryParseParagraphFeedbackBundle(text: string): ParagraphFeedbackBundle | null {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (typeof parsed !== 'object' || parsed === null) return null;
      return parsed as ParagraphFeedbackBundle;
    } catch {
      return null;
    }
  }

  private formatParagraphSectionReply(label: string, sectionLabel: string, text: string): string {
    return `### ${label}
${sectionLabel}: ${text}`;
  }

  private buildFeedbackReplies(args: {
    fileId: string;
    sessionId: string;
    baseClientRequestId: string;
    fallbackMessageId: string;
    progressMessageId: string;
    structuredReply: ParagraphFeedbackBundle | null;
    fallbackReply: string;
  }): ParagraphFeedbackBulkReply[] {
    const { fileId, sessionId, baseClientRequestId, fallbackMessageId, progressMessageId, structuredReply, fallbackReply } = args;
    const paragraphFeedback = structuredReply?.paragraph_feedback;

    const entries: Array<{
      key: 'topic_sentence' | 'supporting_sentences' | 'coherence';
      label: string;
      value: ParagraphFeedbackTypeResult | undefined;
    }> = [
      { key: 'topic_sentence', label: 'Topic Sentence', value: paragraphFeedback?.topic_sentence },
      { key: 'supporting_sentences', label: 'Supporting Sentences', value: paragraphFeedback?.supporting_sentences },
      { key: 'coherence', label: 'Coherence', value: paragraphFeedback?.coherence }
    ];

    const typedReplies = entries
      .filter(
        (entry): entry is typeof entry & { value: ParagraphFeedbackTypeResult } =>
          !!entry.value &&
          typeof entry.value.verdict === 'string' &&
          typeof entry.value.reason === 'string' &&
          typeof entry.value.revision_suggestion === 'string'
      )
      .flatMap((entry, index) => {
        const sections: Array<{
          key: 'verdict' | 'reason' | 'revision_suggestion';
          label: string;
          text: string;
        }> = [
          { key: 'verdict', label: 'Verdict', text: entry.value.verdict },
          { key: 'reason', label: 'Reason', text: entry.value.reason },
          { key: 'revision_suggestion', label: 'Revision suggestion', text: entry.value.revision_suggestion }
        ];

        return sections.map((section) => ({
          fileId,
          sessionId,
          messageId: randomUUID(),
          reply: this.formatParagraphSectionReply(entry.label, section.label, section.text),
          clientRequestId: `${baseClientRequestId}:${entry.key}:${section.key}:${index + 1}`,
          feedbackType: entry.key,
          feedbackSection: section.key,
          progressMessageId
        }));
      });

    if (typedReplies.length > 0) {
      return typedReplies;
    }

    return [
      {
        fileId,
        sessionId,
        messageId: fallbackMessageId,
        reply: fallbackReply,
        clientRequestId: `${baseClientRequestId}:fallback`,
        progressMessageId
      }
    ];
  }

  private buildFailure(args: ParagraphFeedbackBulkFailure): ParagraphFeedbackBulkFailure {
    return args;
  }
}
