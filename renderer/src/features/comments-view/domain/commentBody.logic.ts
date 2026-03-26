export function truncateText(text: string, length: number): string {
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, Math.max(0, length - 1)).trimEnd()}…`;
}
