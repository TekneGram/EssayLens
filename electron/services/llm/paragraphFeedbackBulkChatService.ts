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
}

interface ParagraphFeedbackBulkFailure {
  fileId: string;
  reason: string;
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
      const responseMessageId = randomUUID();
      const sessionId = `paragraph-feedback:${fileId}:${Date.now()}:${index + 1}`;
      const perFileClientRequestId = `${baseClientRequestId}:paragraph:${index + 1}`;

      emitToRenderer({
        requestId: `${perFileClientRequestId}:start`,
        clientRequestId: perFileClientRequestId,
        fileId,
        sessionId,
        messageId: responseMessageId,
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
          messageId: responseMessageId,
          reason: 'Could not find this file in the workspace.'
        });
        failures.push({ fileId, reason: 'missing-file' });
        continue;
      }

      if (path.extname(sourceFile.path).toLowerCase() !== '.docx') {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:unsupported-file`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: responseMessageId,
          reason: 'Only DOCX files are supported for paragraph feedback in bulk.'
        });
        failures.push({ fileId, reason: 'unsupported-filetype' });
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
          messageId: responseMessageId,
          reason: 'Could not read DOCX text for this file.',
          details: error
        });
        failures.push({ fileId, reason: 'extract-failed' });
        continue;
      }

      if (!essayText) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:empty-text`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: responseMessageId,
          reason: 'No text was extracted from this DOCX file.'
        });
        failures.push({ fileId, reason: 'empty-text' });
        continue;
      }

      const llmPayload = buildLlmParagraphFeedbackBulkPayload({
        essay: essayText,
        settings
      });

      const llmResult = await this.deps.llmOrchestrator.requestAction<typeof llmPayload, SendChatMessageResponse>(
        'llm.paragraph.feedback.bulk',
        llmPayload
      );

      if (!llmResult.ok) {
        this.emitBulkError({
          emitToRenderer,
          requestId: llmResult.requestId,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: responseMessageId,
          reason: llmResult.error.message,
          details: llmResult.error.details
        });
        failures.push({ fileId, reason: 'llm-failed' });
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
          messageId: responseMessageId,
          reason: 'Python worker returned an invalid paragraph feedback response.',
          details: error
        });
        failures.push({ fileId, reason: 'invalid-response' });
        continue;
      }

      emitToRenderer({
        requestId: `${perFileClientRequestId}:chunk`,
        clientRequestId: perFileClientRequestId,
        fileId,
        sessionId,
        messageId: responseMessageId,
        workflow: 'paragraph-feedback-bulk',
        type: 'chunk',
        seq: 2,
        channel: 'content',
        text: reply,
        done: false
      });

      try {
        await this.deps.llmChatSessionRepository.createSession(sessionId, fileId);
        await this.deps.llmChatSessionRepository.appendTurns(
          sessionId,
          [
            {
              role: 'assistant',
              content: reply
            }
          ],
          fileId
        );
        await this.deps.repository.addMessage({
          id: responseMessageId,
          role: 'assistant',
          content: reply,
          relatedFileId: fileId,
          createdAt: new Date().toISOString()
        });
      } catch (error) {
        this.emitBulkError({
          emitToRenderer,
          requestId: `${perFileClientRequestId}:persist-failed`,
          clientRequestId: perFileClientRequestId,
          fileId,
          sessionId,
          messageId: responseMessageId,
          reason: 'Paragraph feedback was generated but could not be persisted.',
          details: error
        });
        failures.push({ fileId, reason: 'persist-failed' });
        continue;
      }

      emitToRenderer({
        requestId: `${perFileClientRequestId}:done`,
        clientRequestId: perFileClientRequestId,
        fileId,
        sessionId,
        messageId: responseMessageId,
        workflow: 'paragraph-feedback-bulk',
        type: 'done',
        seq: 3,
        channel: 'meta',
        text: '',
        done: true
      });

      replies.push({
        fileId,
        sessionId,
        messageId: responseMessageId,
        reply,
        clientRequestId: perFileClientRequestId
      });
    }

    return {
      reply: replies[replies.length - 1]?.reply ?? '',
      paragraphFeedbackBulk: {
        replies,
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
}
