import { randomUUID } from 'node:crypto';
import { FeedbackRepository, type FeedbackRecord } from '../../db/repositories/feedbackRepository';
import { WorkspaceRepository } from '../../db/repositories/workspaceRepository';
import { extractDocumentText, type ExtractedDocument } from '../documents/documentExtractor';
import { generateFeedbackFile } from '../feedback/feedbackFileGenerator';
import { AppException } from '../../core/appException';
import type {
  FeedbackDto,
  ExtractDocumentResponse,
  ListFeedbackResponse,
  AddFeedbackRequest,
  AddFeedbackResponse,
  EditFeedbackResponse,
  DeleteFeedbackResponse,
  ApplyFeedbackResponse,
  SendFeedbackToLlmResponse,
  GenerateFeedbackDocumentResponse
} from '../../ipc/contracts/assessment.contracts';

export interface AssessmentServiceDeps {
  repository: FeedbackRepository;
  workspaceRepository: WorkspaceRepository;
  makeFeedbackId: () => string;
  makeMessageId?: () => string;
  extractDocument: (filePath: string) => Promise<ExtractedDocument>;
  generateFeedbackFile: typeof generateFeedbackFile;
}

export class AssessmentService {
  private deps: AssessmentServiceDeps;

  constructor(deps?: Partial<AssessmentServiceDeps>) {
    this.deps = {
      repository: deps?.repository ?? new FeedbackRepository(),
      workspaceRepository: deps?.workspaceRepository ?? new WorkspaceRepository(),
      makeFeedbackId: deps?.makeFeedbackId ?? randomUUID,
      makeMessageId: deps?.makeMessageId ?? randomUUID,
      extractDocument: deps?.extractDocument ?? extractDocumentText,
      generateFeedbackFile: deps?.generateFeedbackFile ?? generateFeedbackFile
    };
  }

  private toFeedbackDto(record: FeedbackRecord): FeedbackDto {
    if (record.kind === 'block') {
      return {
        id: record.id,
        fileId: record.fileId,
        kind: 'block',
        source: record.source,
        commentText: record.commentText,
        createdAt: record.createdAt ?? new Date().toISOString(),
        updatedAt: record.updatedAt,
        applied: record.applied
      };
    }

    if (!record.startAnchor || !record.endAnchor || !record.exactQuote) {
      throw new Error(`Inline feedback ${record.id} is missing required inline fields.`);
    }

    return {
      id: record.id,
      fileId: record.fileId,
      kind: 'inline',
      source: record.source,
      commentText: record.commentText,
      createdAt: record.createdAt ?? new Date().toISOString(),
      updatedAt: record.updatedAt,
      applied: record.applied,
      exactQuote: record.exactQuote,
      prefixText: record.prefixText ?? '',
      suffixText: record.suffixText ?? '',
      startAnchor: record.startAnchor,
      endAnchor: record.endAnchor
    };
  }

  async extractDocument(fileId: string): Promise<ExtractDocumentResponse> {
    try {
      const sourceFile = await this.deps.workspaceRepository.resolveFileById(fileId);
      if (!sourceFile) {
        throw new AppException({
          code: 'ASSESSMENT_EXTRACT_DOCUMENT_NOT_FOUND',
          userMessage: 'Could not find the selected file.'
        });
      }
      const extracted = await this.deps.extractDocument(sourceFile.path);
      return {
        fileId,
        text: extracted.text,
        extractedAt: extracted.extractedAt,
        format: extracted.format,
        fileName: sourceFile.name,
        dataBase64: extracted.dataBase64
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_EXTRACT_DOCUMENT_FAILED',
        userMessage: 'Could not extract document.',
        details: error
      });
    }
  }

  async listFeedback(fileId: string): Promise<ListFeedbackResponse> {
    try {
      const records = await this.deps.repository.listByFileId(fileId);
      const feedback = records.map((record) => this.toFeedbackDto(record));
      return { feedback };
    } catch (error) {
      throw new AppException({
        code: 'ASSESSMENT_LIST_FEEDBACK_FAILED',
        userMessage: 'Could not load feedback for this file.',
        details: error
      });
    }
  }

  async addFeedback(request: AddFeedbackRequest): Promise<AddFeedbackResponse> {
    try {
      const created = await this.deps.repository.add({
        id: this.deps.makeFeedbackId(),
        fileId: request.fileId,
        kind: request.kind,
        source: request.source,
        commentText: request.commentText,
        exactQuote: request.kind === 'inline' ? request.exactQuote : undefined,
        prefixText: request.kind === 'inline' ? request.prefixText : undefined,
        suffixText: request.kind === 'inline' ? request.suffixText : undefined,
        startAnchor: request.kind === 'inline' ? request.startAnchor : undefined,
        endAnchor: request.kind === 'inline' ? request.endAnchor : undefined
      });
      return { feedback: this.toFeedbackDto(created) };
    } catch (error) {
      throw new AppException({
        code: 'ASSESSMENT_ADD_FEEDBACK_FAILED',
        userMessage: 'Could not persist feedback.',
        details: error
      });
    }
  }

  async editFeedback(feedbackId: string, commentText: string): Promise<EditFeedbackResponse> {
    try {
      const edited = await this.deps.repository.editCommentText(feedbackId, commentText);
      if (!edited) {
        throw new AppException({
          code: 'ASSESSMENT_EDIT_FEEDBACK_NOT_FOUND',
          userMessage: 'Feedback item not found.'
        });
      }
      return { feedback: this.toFeedbackDto(edited) };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_EDIT_FEEDBACK_FAILED',
        userMessage: 'Could not edit feedback.',
        details: error
      });
    }
  }

  async deleteFeedback(feedbackId: string): Promise<DeleteFeedbackResponse> {
    try {
      const deleted = await this.deps.repository.deleteById(feedbackId);
      if (!deleted) {
        throw new AppException({
          code: 'ASSESSMENT_DELETE_FEEDBACK_NOT_FOUND',
          userMessage: 'Feedback item not found.'
        });
      }
      return { deletedFeedbackId: feedbackId };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_DELETE_FEEDBACK_FAILED',
        userMessage: 'Could not delete feedback.',
        details: error
      });
    }
  }

  async applyFeedback(feedbackId: string, applied: boolean): Promise<ApplyFeedbackResponse> {
    try {
      const updated = await this.deps.repository.setApplied(feedbackId, applied);
      if (!updated) {
        throw new AppException({
          code: 'ASSESSMENT_APPLY_FEEDBACK_NOT_FOUND',
          userMessage: 'Feedback item not found.'
        });
      }
      return { feedback: this.toFeedbackDto(updated) };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_APPLY_FEEDBACK_FAILED',
        userMessage: 'Could not apply feedback.',
        details: error
      });
    }
  }

  async sendFeedbackToLlm(feedbackId: string, command?: string): Promise<SendFeedbackToLlmResponse> {
    try {
      const source = await this.deps.repository.getById(feedbackId);
      if (!source) {
        throw new AppException({
          code: 'ASSESSMENT_SEND_FEEDBACK_TO_LLM_NOT_FOUND',
          userMessage: 'Feedback item not found.'
        });
      }

      const commandLabel = command ? ` [${command}]` : '';
      const generatedCommentText = `LLM follow-up${commandLabel}: ${source.commentText}`;
      await this.deps.repository.add({
        id: this.deps.makeFeedbackId(),
        fileId: source.fileId,
        kind: source.kind,
        source: 'llm',
        commentText: generatedCommentText,
        exactQuote: source.kind === 'inline' ? source.exactQuote : undefined,
        prefixText: source.kind === 'inline' ? source.prefixText : undefined,
        suffixText: source.kind === 'inline' ? source.suffixText : undefined,
        startAnchor: source.kind === 'inline' ? source.startAnchor : undefined,
        endAnchor: source.kind === 'inline' ? source.endAnchor : undefined
      });

      return {
        status: 'sent',
        messageId: this.deps.makeMessageId?.() ?? this.deps.makeFeedbackId()
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_SEND_FEEDBACK_TO_LLM_FAILED',
        userMessage: 'Could not send feedback to LLM.',
        details: error
      });
    }
  }

  async generateFeedbackDocument(fileId: string): Promise<GenerateFeedbackDocumentResponse> {
    try {
      const feedback = await this.deps.repository.listByFileId(fileId);
      const sourceFile = await this.deps.workspaceRepository.resolveFileById(fileId);
      if (!sourceFile) {
        throw new AppException({
          code: 'ASSESSMENT_GENERATE_FEEDBACK_DOCUMENT_NOT_FOUND',
          userMessage: 'Could not find the selected file.'
        });
      }
      const inlineFeedback = feedback.filter((item) => item.kind === 'inline');
      const appliedBlockFeedback = feedback.filter((item) => item.kind === 'block' && item.applied === true);
      const outputPath = sourceFile.path.replace(/\.docx$/i, '.annotated.docx');
      const result = await this.deps.generateFeedbackFile({
        sourceFilePath: sourceFile.path,
        outputPath,
        comments: inlineFeedback.map((item) => ({
          commentText: item.commentText,
          exactQuote: item.exactQuote ?? '',
          startAnchor: item.startAnchor ?? {
            part: 'word/document.xml',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 0
          },
          endAnchor: item.endAnchor ?? {
            part: 'word/document.xml',
            paragraphIndex: 0,
            runIndex: 0,
            charOffset: 0
          }
        })),
        blockComments: appliedBlockFeedback.map((item) => ({
          commentText: item.commentText
        }))
      });

      return {
        fileId,
        outputPath: result.outputPath
      };
    } catch (error) {
      if (error instanceof AppException) throw error;
      throw new AppException({
        code: 'ASSESSMENT_GENERATE_FEEDBACK_DOCUMENT_FAILED',
        userMessage: 'Could not generate feedback document.',
        details: error
      });
    }
  }
}
