import type { GetRubricMatrixResponse } from '../ipc/contracts/rubric.contracts';
import type { RubricFeedbackCategorySection } from '../services/llm/chatService.shared';

export function slugifyCategory(category: string): string {
  const slug = category
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'category';
}

export function normalizeRubricSections(matrix: GetRubricMatrixResponse): RubricFeedbackCategorySection[] {
  const scoreByDetailId = new Map<string, number>();
  for (const score of matrix.scores) {
    scoreByDetailId.set(score.detailsUuid, score.scoreValues);
  }

  const sections = new Map<string, RubricFeedbackCategorySection>();
  for (const detail of matrix.details) {
    const scoreValue = scoreByDetailId.get(detail.uuid);
    if (scoreValue === undefined) {
      continue;
    }

    const existing = sections.get(detail.category);
    if (existing) {
      existing.entries.push({
        scoreValue,
        description: detail.description
      });
      continue;
    }

    sections.set(detail.category, {
      category: detail.category,
      entries: [
        {
          scoreValue,
          description: detail.description
        }
      ]
    });
  }

  return [...sections.values()].map((section) => ({
    ...section,
    entries: [...section.entries].sort((left, right) => right.scoreValue - left.scoreValue || left.description.localeCompare(right.description))
  }));
}
