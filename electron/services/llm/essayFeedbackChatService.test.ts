import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { describe, expect, it, vi } from 'vitest';
import type { LlmRuntimeSettings } from '../../ipc/contracts/llmManager.contracts';
import { EssayFeedbackChatService } from './essayFeedbackChatService';

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function buildRuntimeSettings(overrides: Partial<LlmRuntimeSettings> = {}): LlmRuntimeSettings {
  return {
    llm_server_path: '/tmp/llama-server',
    llm_gguf_path: '/tmp/model.gguf',
    llm_mmproj_path: null,
    llm_server_url: 'http://127.0.0.1:8080/v1/chat/completions',
    llm_host: '127.0.0.1',
    llm_port: 8080,
    llm_n_ctx: 4096,
    llm_n_threads: 4,
    llm_n_gpu_layers: 0,
    llm_n_batch: 128,
    llm_n_parallel: 1,
    llm_seed: 42,
    llm_rope_freq_base: null,
    llm_rope_freq_scale: null,
    llm_model_family: 'instruct/think',
    llm_reasoning_mode: null,
    llm_reasoning_budget: null,
    llm_chat_template_path: null,
    llm_use_jinja: true,
    llm_cache_prompt: true,
    llm_flash_attn: false,
    max_tokens: 256,
    temperature: 0,
    top_p: null,
    top_k: null,
    repeat_penalty: null,
    request_seed: null,
    use_fake_reply: false,
    fake_reply_text: null,
    llm_log_outbound_payload: false,
    bulk_llm_recycle_policy: 'never',
    ...overrides
  };
}

async function createMinimalDocx(filePath: string): Promise<void> {
  const zip = new JSZip();
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="${W_NS}">
  <w:body>
    <w:p><w:r><w:t>Introduction paragraph.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Body paragraph one. More detail here.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Conclusion paragraph. Final sentence here.</w:t></w:r></w:p>
  </w:body>
</w:document>`
  );
  const buffer = await zip.generateAsync({ type: 'nodebuffer' });
  await fs.writeFile(filePath, buffer);
}

async function createEssayFeedbackService() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-essay-feedback-'));
  const sourcePath = path.join(tempDir, 'essay.docx');
  await createMinimalDocx(sourcePath);

  const createSession = vi.fn().mockResolvedValue({
    sessionId: 'essay-feedback:file-1:1',
    fileEntityUuid: 'file-1'
  });
  const appendTurns = vi.fn().mockResolvedValue(undefined);
  const addMessage = vi.fn().mockResolvedValue(undefined);
  let storedAnalysis: {
    introductionParagraph: string;
    bodyParagraphs: Array<{ body_paragraph: string }>;
    conclusionParagraph: string;
    thesisStatement?: string | null;
    mainIdea?: string | null;
  } | null = null;
  const upsertIdentifiedParagraphs = vi.fn().mockImplementation(async (_sessionId, _fileId, paragraphs) => {
    storedAnalysis = {
      ...paragraphs
    };
  });
  const saveThesisStatement = vi.fn().mockImplementation(async (_sessionId, _fileId, thesisStatement) => {
    storedAnalysis = {
      introductionParagraph: storedAnalysis?.introductionParagraph ?? '',
      bodyParagraphs: storedAnalysis?.bodyParagraphs ?? [],
      conclusionParagraph: storedAnalysis?.conclusionParagraph ?? '',
      thesisStatement,
      mainIdea: storedAnalysis?.mainIdea ?? null
    };
  });
  const saveMainIdea = vi.fn().mockImplementation(async (_sessionId, _fileId, mainIdea) => {
    storedAnalysis = {
      introductionParagraph: storedAnalysis?.introductionParagraph ?? '',
      bodyParagraphs: storedAnalysis?.bodyParagraphs ?? [],
      conclusionParagraph: storedAnalysis?.conclusionParagraph ?? '',
      thesisStatement: storedAnalysis?.thesisStatement ?? null,
      mainIdea
    };
  });
  const addCompletion = vi.fn().mockResolvedValue(undefined);
  const getIdentifyResult = () => ({
    introduction_paragraph: 'Introduction paragraph.',
    body_paragraphs: {
      items: [{ body_paragraph: 'Body paragraph one. More detail here.' }]
    },
    conclusion_paragraph: 'Conclusion paragraph. Final sentence here.'
  });
  const requestActionStream = vi.fn().mockImplementation(async (action, payload, onStreamEvent) => {
    if (action === 'llm.essay.feedback.identifyParagraphs') {
      onStreamEvent({
        requestId: 'llm-identify-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: 'essay-client-1:identify',
          channel: 'meta',
          text: 'Identifying introduction, body paragraphs, and conclusion...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-identify-1',
        ok: true,
        data: getIdentifyResult(),
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    if (action === 'llm.essay.feedback.summarizeMainIdea') {
      onStreamEvent({
        requestId: 'llm-main-idea-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: 'essay-client-1:essay:1:summarize-main-idea',
          channel: 'meta',
          text: "Summarizing the essay's main idea...",
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-main-idea-1',
        ok: true,
        data: {
          main_idea: 'Reading helps students grow by expanding knowledge and imagination.'
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    if (action === 'llm.essay.feedback.paragraphEvaluation') {
      onStreamEvent({
        requestId: 'llm-paragraph-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: 'essay-client-1:essay:2:paragraph-evaluation:paragraph:1',
          channel: 'meta',
          text: 'Evaluating how the body paragraph supports the main idea...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-paragraph-1',
        ok: true,
        data: {
          verdict: 'contributes to the main idea well',
          comments: "The paragraph stays focused and develops the essay's central point with relevant support."
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    if (action === 'llm.essay.feedback.thesisRestatement') {
      onStreamEvent({
        requestId: 'llm-thesis-restatement-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: payload.clientRequestId,
          channel: 'meta',
          text: 'Evaluating how well the conclusion restates the thesis...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-thesis-restatement-1',
        ok: true,
        data: {
          verdict: 'strong paraphrase',
          comments: 'The conclusion restates the thesis clearly without copying it exactly.'
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    if (action === 'llm.essay.feedback.summaryFeedback') {
      onStreamEvent({
        requestId: 'llm-summary-feedback-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: payload.clientRequestId,
          channel: 'meta',
          text: 'Evaluating how effectively the conclusion summarizes the essay...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-summary-feedback-1',
        ok: true,
        data: {
          verdict: 'summarizes key points effectively',
          comments: "The conclusion revisits the essay's main points in a concise way."
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    if (action === 'llm.essay.feedback.conclusionFinalComment') {
      onStreamEvent({
        requestId: 'llm-conclusion-final-status-1',
        type: 'stream_chunk',
        data: {
          clientRequestId: payload.clientRequestId,
          channel: 'meta',
          text: 'Evaluating the final sentence of the conclusion...',
          done: false,
          seq: 1
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      });

      return {
        requestId: 'llm-conclusion-final-1',
        ok: true,
        data: {
          verdict: 'gives a confident suggestion',
          comments: 'The final sentence ends with a clear and confident takeaway.'
        },
        timestamp: '2026-06-21T00:00:00.000Z'
      };
    }

    onStreamEvent({
      requestId: 'llm-thesis-status-1',
      type: 'stream_chunk',
      data: {
        clientRequestId: 'essay-client-1:essay:1:thesis-statement-feedback',
        channel: 'meta',
        text: 'Extracting and evaluating the thesis statement...',
        done: false,
        seq: 1
      },
      timestamp: '2026-06-21T00:00:00.000Z'
    });

    return {
      requestId: 'llm-thesis-1',
      ok: true,
      data: {
        thesis_statement: 'Students should read more books.',
        verdict: 'Clear thesis, but it would be stronger with one concrete reason.',
        improvements: 'Add a specific reason students benefit from reading more books.'
      },
      timestamp: '2026-06-21T00:00:00.000Z'
    };
  });

  const service = new EssayFeedbackChatService({
    llmOrchestrator: {
      requestActionStream
    } as any,
    llmSettingsRepository: {
      getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
    } as any,
    llmSelectionRepository: {
      listCatalogModels: vi.fn().mockResolvedValue([]),
      getActiveModel: vi.fn().mockResolvedValue({ key: 'essay-model', displayName: 'Essay Model' }),
      resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
    } as any,
    llmFeedbackCompletionRepository: {
      addCompletion
    } as any,
    essayFeedbackAnalysisRepository: {
      upsertIdentifiedParagraphs,
      saveThesisStatement,
      saveMainIdea,
      getIdentifiedParagraphs: vi.fn().mockImplementation(async () => storedAnalysis)
    } as any,
    rubricRepository: {} as any,
    workspaceRepository: {
      resolveFileById: vi.fn().mockResolvedValue({
        id: 'file-1',
        path: sourcePath,
        name: 'essay.docx',
        kind: 'docx'
      })
    } as any,
    llmChatSessionRepository: {
      createSession,
      appendTurns
    } as any,
    repository: {
      addMessage
    } as any,
    fileExists: vi.fn().mockResolvedValue(true),
    isFile: vi.fn().mockResolvedValue(true),
    isExecutable: vi.fn().mockResolvedValue(true),
    resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
  });

  return {
    service,
    createSession,
    appendTurns,
    addMessage,
    requestActionStream,
    upsertIdentifiedParagraphs,
    saveThesisStatement,
    saveMainIdea,
    addCompletion
  };
}

describe('EssayFeedbackChatService', () => {
  it('identifies essay sections before returning selected feedback stubs', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const {
      service,
      createSession,
      appendTurns,
      addMessage,
      requestActionStream,
      upsertIdentifiedParagraphs,
      addCompletion
    } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['summary-feedback', 'conclusion-final-comment']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(3);
    expect(result.essayFeedback?.replies).toHaveLength(4);
    expect(result.essayFeedback?.replies.map((reply) => reply.essayFeedbackType)).toEqual([
      'summary-feedback',
      'summary-feedback',
      'conclusion-final-comment',
      'conclusion-final-comment'
    ]);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession.mock.invocationCallOrder[0]).toBeLessThan(upsertIdentifiedParagraphs.mock.invocationCallOrder[0]);
    expect(upsertIdentifiedParagraphs).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      {
        introductionParagraph: 'Introduction paragraph.',
        bodyParagraphs: [{ body_paragraph: 'Body paragraph one. More detail here.' }],
        conclusionParagraph: 'Conclusion paragraph. Final sentence here.'
      }
    );
    expect(addCompletion).toHaveBeenCalledWith({
      fileId: 'file-1',
      workflowKey: 'essay_feedback',
      modelKey: 'essay-model',
      modelDisplayName: 'Essay Model',
      sessionId: expect.stringContaining('essay-feedback:file-1:')
    });
    expect(appendTurns).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content: '### Summary Feedback\nVerdict: summarizes key points effectively',
          metadata: {
            feedbackType: 'summary-feedback',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: 'summarizes key points effectively'
            }
          }
        },
        {
          role: 'assistant',
          content: "### Summary Feedback\nComments: The conclusion revisits the essay's main points in a concise way.",
          metadata: {
            feedbackType: 'summary-feedback',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: "The conclusion revisits the essay's main points in a concise way."
            }
          }
        }
      ],
      'file-1'
    );
    expect(appendTurns).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content: '### Conclusion Final Comment\nVerdict: gives a confident suggestion',
          metadata: {
            feedbackType: 'conclusion-final-comment',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: 'gives a confident suggestion'
            }
          }
        },
        {
          role: 'assistant',
          content: '### Conclusion Final Comment\nComments: The final sentence ends with a clear and confident takeaway.',
          metadata: {
            feedbackType: 'conclusion-final-comment',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: 'The final sentence ends with a clear and confident takeaway.'
            }
          }
        }
      ],
      'file-1'
    );
    expect(addMessage).toHaveBeenCalledTimes(4);
    expect(
      emittedEvents.map((event) => ({
        type: event.type,
        stage: event.essayFeedbackStage,
        feedbackType: event.essayFeedbackType,
        channel: event.channel
      }))
    ).toEqual([
      { type: 'start', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'status', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'done', stage: 'identify-paragraphs', feedbackType: undefined, channel: 'meta' },
      { type: 'start', stage: undefined, feedbackType: 'summary-feedback', channel: 'meta' },
      { type: 'status', stage: undefined, feedbackType: 'summary-feedback', channel: 'meta' },
      { type: 'chunk', stage: undefined, feedbackType: 'summary-feedback', channel: 'content' },
      { type: 'chunk', stage: undefined, feedbackType: 'summary-feedback', channel: 'content' },
      { type: 'done', stage: undefined, feedbackType: 'summary-feedback', channel: 'meta' },
      { type: 'start', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'meta' },
      { type: 'status', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'meta' },
      { type: 'chunk', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'content' },
      { type: 'chunk', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'content' },
      { type: 'done', stage: undefined, feedbackType: 'conclusion-final-comment', channel: 'meta' }
    ]);
  });

  it('emits verdict and improvements bubbles for thesis statement feedback with inline comment payloads', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, requestActionStream, saveThesisStatement, addCompletion } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['thesis-statement-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(2);
    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(result.essayFeedback?.replies?.map((reply) => reply.essayFeedbackSection)).toEqual([
      'verdict',
      'improvements'
    ]);
    expect(result.essayFeedback?.replies?.map((reply) => reply.inlineComment)).toEqual([
      {
        searchText: 'Students should read more books.',
        commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
      },
      {
        searchText: 'Students should read more books.',
        commentText: 'Add a specific reason students benefit from reading more books.'
      }
    ]);
    expect(saveThesisStatement).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      'Students should read more books.'
    );
    expect(addCompletion).toHaveBeenCalledWith({
      fileId: 'file-1',
      workflowKey: 'essay_feedback',
      modelKey: 'essay-model',
      modelDisplayName: 'Essay Model',
      sessionId: expect.stringContaining('essay-feedback:file-1:')
    });
    expect(appendTurns).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content:
            '### Thesis Statement Feedback\nVerdict: Clear thesis, but it would be stronger with one concrete reason.',
          metadata: {
            feedbackType: 'thesis-statement-feedback',
            inlineComment: {
              searchText: 'Students should read more books.',
              commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
            }
          }
        },
        {
          role: 'assistant',
          content:
            '### Thesis Statement Feedback\nImprovements: Add a specific reason students benefit from reading more books.',
          metadata: {
            feedbackType: 'thesis-statement-feedback',
            inlineComment: {
              searchText: 'Students should read more books.',
              commentText: 'Add a specific reason students benefit from reading more books.'
            }
          }
        }
      ],
      'file-1'
    );
    expect(
      emittedEvents
        .filter((event) => event.type === 'chunk')
        .map((event) => ({
          section: event.essayFeedbackSection,
          inlineComment: event.inlineComment
        }))
    ).toEqual([
      {
        section: 'verdict',
        inlineComment: {
          searchText: 'Students should read more books.',
          commentText: 'Clear thesis, but it would be stronger with one concrete reason.'
        }
      },
      {
        section: 'improvements',
        inlineComment: {
          searchText: 'Students should read more books.',
          commentText: 'Add a specific reason students benefit from reading more books.'
        }
      }
    ]);
    expect(
      emittedEvents
        .filter((event) => event.type === 'done')
        .map((event) => event.clientRequestId)
    ).toEqual([
      'essay-client-1:identify',
      'essay-client-1:essay:1:thesis-statement-feedback'
    ]);
  });

  it('runs summarize-main-idea without persisting a chat bubble and still records completion', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, addMessage, requestActionStream, saveMainIdea, addCompletion } =
      await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['summarize-main-idea']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(2);
    expect(saveMainIdea).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      'file-1',
      'Reading helps students grow by expanding knowledge and imagination.'
    );
    expect(result.essayFeedback?.replies).toEqual([]);
    expect(appendTurns).not.toHaveBeenCalled();
    expect(addMessage).not.toHaveBeenCalled();
    expect(addCompletion).toHaveBeenCalledWith({
      fileId: 'file-1',
      workflowKey: 'essay_feedback',
      modelKey: 'essay-model',
      modelDisplayName: 'Essay Model',
      sessionId: expect.stringContaining('essay-feedback:file-1:')
    });
    expect(
      emittedEvents.map((event) => ({
        type: event.type,
        feedbackType: event.essayFeedbackType,
        channel: event.channel
      }))
    ).toEqual([
      { type: 'start', feedbackType: undefined, channel: 'meta' },
      { type: 'status', feedbackType: undefined, channel: 'meta' },
      { type: 'done', feedbackType: undefined, channel: 'meta' },
      { type: 'start', feedbackType: 'summarize-main-idea', channel: 'meta' },
      { type: 'status', feedbackType: 'summarize-main-idea', channel: 'meta' },
      { type: 'done', feedbackType: 'summarize-main-idea', channel: 'meta' }
    ]);
    expect(
      emittedEvents
        .filter((event) => event.type === 'done')
        .map((event) => event.clientRequestId)
    ).toEqual(['essay-client-1:identify', 'essay-client-1:essay:1:summarize-main-idea']);
  });

  it('emits verdict and comments bubbles for paragraph evaluation with inline comments on the first sentence', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, requestActionStream, saveMainIdea } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['summarize-main-idea', 'paragraph-evaluation']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream).toHaveBeenCalledTimes(3);
    expect(saveMainIdea).toHaveBeenCalled();
    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(result.essayFeedback?.replies?.map((reply) => reply.essayFeedbackSection)).toEqual([
      'verdict',
      'comments'
    ]);
    expect(result.essayFeedback?.replies?.map((reply) => reply.paragraphFirstSentence)).toEqual([
      'Body paragraph one.',
      'Body paragraph one.'
    ]);
    expect(result.essayFeedback?.replies?.map((reply) => reply.inlineComment)).toEqual([
      {
        searchText: 'Body paragraph one.',
        commentText: 'contributes to the main idea well'
      },
      {
        searchText: 'Body paragraph one.',
        commentText: "The paragraph stays focused and develops the essay's central point with relevant support."
      }
    ]);
    expect(appendTurns).toHaveBeenCalledWith(
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content: '### Paragraph Evaluation 1\nVerdict: contributes to the main idea well',
          metadata: {
            feedbackType: 'paragraph-evaluation',
            inlineComment: {
              searchText: 'Body paragraph one.',
              commentText: 'contributes to the main idea well'
            }
          }
        },
        {
          role: 'assistant',
          content:
            "### Paragraph Evaluation 1\nComments: The paragraph stays focused and develops the essay's central point with relevant support.",
          metadata: {
            feedbackType: 'paragraph-evaluation',
            inlineComment: {
              searchText: 'Body paragraph one.',
              commentText:
                "The paragraph stays focused and develops the essay's central point with relevant support."
            }
          }
        }
      ],
      'file-1'
    );
    expect(
      emittedEvents
        .filter((event) => event.type === 'chunk')
        .map((event) => ({
          section: event.essayFeedbackSection,
          paragraphFirstSentence: event.paragraphFirstSentence,
          inlineComment: event.inlineComment
        }))
    ).toEqual([
      {
        section: 'verdict',
        paragraphFirstSentence: 'Body paragraph one.',
        inlineComment: {
          searchText: 'Body paragraph one.',
          commentText: 'contributes to the main idea well'
        }
      },
      {
        section: 'comments',
        paragraphFirstSentence: 'Body paragraph one.',
        inlineComment: {
          searchText: 'Body paragraph one.',
          commentText:
            "The paragraph stays focused and develops the essay's central point with relevant support."
        }
      }
    ]);
    expect(
      emittedEvents
        .filter((event) => event.type === 'done')
        .map((event) => event.clientRequestId)
    ).toEqual([
      'essay-client-1:identify',
      'essay-client-1:essay:1:summarize-main-idea',
      'essay-client-1:essay:2:paragraph-evaluation'
    ]);
  });

  it('emits inline-comment bubbles for thesis restatement feedback anchored to the full conclusion paragraph', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, requestActionStream } = await createEssayFeedbackService();

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-1',
        selectedFeedbackTypes: ['thesis-statement-feedback', 'thesis-restatement-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(requestActionStream.mock.calls.map((call) => call[0])).toEqual([
      'llm.essay.feedback.identifyParagraphs',
      'llm.essay.feedback.thesisStatement',
      'llm.essay.feedback.thesisRestatement'
    ]);
    expect(result.essayFeedback?.replies).toHaveLength(4);
    expect(result.essayFeedback?.replies?.slice(2).map((reply) => reply.essayFeedbackSection)).toEqual([
      'verdict',
      'comments'
    ]);
    expect(result.essayFeedback?.replies?.slice(2).map((reply) => reply.inlineComment)).toEqual([
      {
        searchText: 'Conclusion paragraph. Final sentence here.',
        commentText: 'strong paraphrase'
      },
      {
        searchText: 'Conclusion paragraph. Final sentence here.',
        commentText: 'The conclusion restates the thesis clearly without copying it exactly.'
      }
    ]);
    expect(appendTurns).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('essay-feedback:file-1:'),
      [
        {
          role: 'assistant',
          content: '### Thesis Restatement Feedback\nVerdict: strong paraphrase',
          metadata: {
            feedbackType: 'thesis-restatement-feedback',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: 'strong paraphrase'
            }
          }
        },
        {
          role: 'assistant',
          content:
            '### Thesis Restatement Feedback\nComments: The conclusion restates the thesis clearly without copying it exactly.',
          metadata: {
            feedbackType: 'thesis-restatement-feedback',
            inlineComment: {
              searchText: 'Conclusion paragraph. Final sentence here.',
              commentText: 'The conclusion restates the thesis clearly without copying it exactly.'
            }
          }
        }
      ],
      'file-1'
    );
    expect(
      emittedEvents
        .filter((event) => event.type === 'done')
        .map((event) => event.clientRequestId)
    ).toEqual([
      'essay-client-1:identify',
      'essay-client-1:essay:1:thesis-statement-feedback',
      'essay-client-1:essay:2:thesis-restatement-feedback'
    ]);
  });

  it('does not create a session for unsupported non-docx files', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'essaylens-essay-feedback-pdf-'));
    const sourcePath = path.join(tempDir, 'essay.pdf');
    await fs.writeFile(sourcePath, Buffer.from('fake'));

    const createSession = vi.fn().mockResolvedValue({
      sessionId: 'essay-feedback:file-1:1',
      fileEntityUuid: 'file-1'
    });
    const upsertIdentifiedParagraphs = vi.fn();
    const service = new EssayFeedbackChatService({
      llmOrchestrator: { requestActionStream: vi.fn() } as any,
      llmSettingsRepository: {
        getRuntimeSettings: vi.fn().mockResolvedValue(buildRuntimeSettings())
      } as any,
      llmSelectionRepository: {
        listCatalogModels: vi.fn().mockResolvedValue([]),
        getActiveModel: vi.fn().mockResolvedValue({ key: 'essay-model', displayName: 'Essay Model' }),
        resetSettingsToDefaults: vi.fn().mockResolvedValue(null)
      } as any,
      llmFeedbackCompletionRepository: {
        addCompletion: vi.fn()
      } as any,
      essayFeedbackAnalysisRepository: {
        upsertIdentifiedParagraphs,
        saveThesisStatement: vi.fn(),
        saveMainIdea: vi.fn(),
        getIdentifiedParagraphs: vi.fn().mockResolvedValue(null)
      } as any,
      rubricRepository: {} as any,
      workspaceRepository: {
        resolveFileById: vi.fn().mockResolvedValue({
          id: 'file-1',
          path: sourcePath,
          name: 'essay.pdf',
          kind: 'pdf'
        })
      } as any,
      llmChatSessionRepository: {
        createSession,
        appendTurns: vi.fn()
      } as any,
      repository: {
        addMessage: vi.fn()
      } as any,
      fileExists: vi.fn().mockResolvedValue(true),
      isFile: vi.fn().mockResolvedValue(true),
      isExecutable: vi.fn().mockResolvedValue(true),
      resolveLlmServerPath: vi.fn().mockReturnValue('/tmp/llama-server')
    });

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-unsupported',
        selectedFeedbackTypes: ['summary-feedback']
      },
      () => {}
    );

    expect(createSession).not.toHaveBeenCalled();
    expect(upsertIdentifiedParagraphs).not.toHaveBeenCalled();
    expect(result.essayFeedback?.replies).toEqual([]);
  });

  it('does not throw when completion tracking fails after replies are persisted', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, addCompletion } = await createEssayFeedbackService();
    addCompletion.mockRejectedValueOnce(new Error('CHECK constraint failed'));

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-completion-failure',
        selectedFeedbackTypes: ['summary-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(result.essayFeedback?.replies).toHaveLength(2);
    expect(result.essayFeedback?.failures).toEqual([]);
    expect(
      emittedEvents.some(
        (event) =>
          event.type === 'error' &&
          event.error &&
          (event.error as { code?: string }).code === 'ESSAY_FEEDBACK_COMPLETION_PERSIST_FAILED'
      )
    ).toBe(true);
  });

  it('returns a per-file failure instead of throwing when reply persistence fails', async () => {
    const emittedEvents: Array<Record<string, unknown>> = [];
    const { service, appendTurns, addCompletion } = await createEssayFeedbackService();
    appendTurns.mockRejectedValueOnce(new Error('disk full'));

    const result = await service.sendMessage(
      {
        kind: 'essay-feedback',
        fileId: 'file-1',
        clientRequestId: 'essay-client-persist-failure',
        selectedFeedbackTypes: ['summary-feedback']
      },
      (event) => emittedEvents.push(event as unknown as Record<string, unknown>)
    );

    expect(result.essayFeedback?.replies).toHaveLength(0);
    expect(result.essayFeedback?.failures).toHaveLength(1);
    expect(result.essayFeedback?.failures?.[0]?.reason).toBe(
      'disk full'
    );
    expect(addCompletion).not.toHaveBeenCalled();
    expect(
      emittedEvents.some(
        (event) =>
          event.type === 'error' &&
          event.error &&
          (event.error as { code?: string }).code === 'ESSAY_FEEDBACK_STAGE_FAILED'
      )
    ).toBe(true);
  });
});
