export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function clipContext(text: string, target: string, offsetDirection: 'prefix' | 'suffix'): string {
  const normalizedText = normalizeWhitespace(text);
  const normalizedTarget = normalizeWhitespace(target);
  if (!normalizedTarget) {
    return '';
  }
  const start = normalizedText.indexOf(normalizedTarget);
  if (start < 0) {
    return '';
  }
  const boundary = 40;
  if (offsetDirection === 'prefix') {
    return normalizedText.slice(Math.max(0, start - boundary), start);
  }
  return normalizedText.slice(start + normalizedTarget.length, start + normalizedTarget.length + boundary);
}

export function clampZoomPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildPendingQuotePreview(exactQuote: string | null | undefined, maxLength = 180): string | null {
  if (!exactQuote) {
    return null;
  }
  return exactQuote.length > maxLength ? `${exactQuote.slice(0, maxLength)}...` : exactQuote;
}
