import { describe, expect, it, vi } from 'vitest';
import { AssessmentService } from './assessmentService';
import type { FeedbackRecord } from '../../db/repositories/feedbackRepository';

function createInlineFeedback(overrides: Partial<FeedbackRecord> = {}): FeedbackRecord {
  return {
    id: 'inline-1',
    fileId: 'file-1',
    kind: 'inline',
    source: 'teacher',
    commentText: 'Inline feedback',
    exactQuote: 'student text',
    prefixText: '',
    suffixText: '',
    startAnchor: {
      part: 'word/document.xml',
      paragraphIndex: 0,
      runIndex: 0,
      charOffset: 0
    },
    endAnchor: {
      part: 'word/document.xml',
      paragraphIndex: 0,
      runIndex: 0,
      charOffset: 12
    },
    applied: false,
    createdAt: '2026-02-24T00:00:00.000Z',
    ...overrides
  };
}

describe('AssessmentService feedback document generation', () => {
  it('passes persisted applied block comments into the generated feedback document', async () => {
    const feedback: FeedbackRecord[] = [
      createInlineFeedback(),
      {
        id: 'block-applied-1',
        fileId: 'file-1',
        kind: 'block',
        source: 'llm',
        commentText: 'Applied block feedback',
        applied: true,
        createdAt: '2026-02-24T00:01:00.000Z'
      },
      {
        id: 'block-unapplied-1',
        fileId: 'file-1',
        kind: 'block',
        source: 'llm',
        commentText: 'Unapplied block feedback',
        applied: false,
        createdAt: '2026-02-24T00:02:00.000Z'
      }
    ];
    const generateFeedbackFile = vi.fn().mockResolvedValue({ outputPath: '/tmp/source.annotated.docx' });

    const service = new AssessmentService({
      repository: {
        listByFileId: vi.fn().mockResolvedValue(feedback)
      } as any,
      workspaceRepository: {
        resolveFileById: vi.fn().mockResolvedValue({
          id: 'file-1',
          path: '/tmp/source.docx',
          name: 'source.docx'
        })
      } as any,
      generateFeedbackFile,
      extractDocument: vi.fn(),
      makeFeedbackId: vi.fn()
    });

    const result = await service.generateFeedbackDocument('file-1');

    expect(result).toEqual({ fileId: 'file-1', outputPath: '/tmp/source.annotated.docx' });
    expect(generateFeedbackFile).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceFilePath: '/tmp/source.docx',
        outputPath: '/tmp/source.annotated.docx',
        comments: [
          expect.objectContaining({
            commentText: 'Inline feedback',
            exactQuote: 'student text'
          })
        ],
        blockComments: [{ commentText: 'Applied block feedback' }]
      })
    );
  });
});
