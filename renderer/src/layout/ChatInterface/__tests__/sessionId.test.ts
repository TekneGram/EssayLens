import { describe, expect, it } from 'vitest';
import { createRubricFeedbackSessionId, createTimestampSessionId, resolveSessionIdForSend } from '@/layout/ChatInterface/domain';

describe('chat session id helpers', () => {
  it('creates timestamp chat session ids for new sessions', () => {
    expect(createTimestampSessionId('file-1', 1700000000000)).toBe('simple-chat:file-1:1700000000000');
  });

  it('creates rubric feedback session ids for rubric runs', () => {
    expect(createRubricFeedbackSessionId('file-1', 1700000000000)).toBe('rubric-feedback:file-1:1700000000000');
  });

  it('resolves send session id with active session fallback to file-scoped id', () => {
    expect(resolveSessionIdForSend('file-1', 'session-a')).toBe('session-a');
    expect(resolveSessionIdForSend('file-1', '   ')).toBe('simple-chat:file-1');
    expect(resolveSessionIdForSend('file-1')).toBe('simple-chat:file-1');
  });
});
