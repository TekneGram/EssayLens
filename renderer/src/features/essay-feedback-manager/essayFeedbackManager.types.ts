export type EssayFeedbackProcessKey =
  | 'identify-paragraphs'
  | 'thesis-statement-feedback'
  | 'summarize-main-idea'
  | 'paragraph-evaluation'
  | 'thesis-restatement-feedback'
  | 'summary-feedback'
  | 'conclusion-final-comment';

export type EssayFeedbackType = Exclude<EssayFeedbackProcessKey, 'identify-paragraphs'>;

export interface EssayFeedbackRow {
  key: EssayFeedbackProcessKey;
  label: string;
  explanation: string;
  locked?: boolean;
  selects?: EssayFeedbackProcessKey[];
}

export type EssayFeedbackSelectionState = Record<EssayFeedbackProcessKey, boolean>;

export const ESSAY_FEEDBACK_ROWS: EssayFeedbackRow[] = [
  {
    key: 'identify-paragraphs',
    label: 'Identify Paragraphs',
    explanation: 'Necessary for extracting introduction, body and conclusion paragraphs and performing later analyses.',
    locked: true
  },
  {
    key: 'thesis-statement-feedback',
    label: 'Thesis statement feedback',
    explanation: 'Extracts the thesis statement and evaluates'
  },
  {
    key: 'summarize-main-idea',
    label: 'Summarize main idea',
    explanation: 'Reads the essay and creates a one sentence summary of the main idea'
  },
  {
    key: 'paragraph-evaluation',
    label: 'Paragraph evaluation',
    explanation:
      "Reads the essay introduction, the essay's main idea and evaluates one body paragraph at a time to assess how well it develops the main idea of the essay. Requires the main idea summary.",
    selects: ['summarize-main-idea']
  },
  {
    key: 'thesis-restatement-feedback',
    label: 'Thesis restatement feedback',
    explanation: 'Reads the first sentence of the conclusion and evaluates how well the restatement is paraphrased from the thesis statement.',
    selects: ['thesis-statement-feedback']
  },
  {
    key: 'summary-feedback',
    label: 'Summary feedback',
    explanation: 'Reads the conclusion paragraph and evaluates how effectively it summarizes key points from the body paragraphs.'
  },
  {
    key: 'conclusion-final-comment',
    label: 'Conclusion final comment',
    explanation: 'Read the final sentence of the conclusion paragraph and judges the impact of the final sentence.'
  }
];

export const INITIAL_ESSAY_FEEDBACK_SELECTION: EssayFeedbackSelectionState = {
  'identify-paragraphs': true,
  'thesis-statement-feedback': true,
  'summarize-main-idea': true,
  'paragraph-evaluation': true,
  'thesis-restatement-feedback': true,
  'summary-feedback': true,
  'conclusion-final-comment': true
};

export function normalizeEssayFeedbackSelection(
  selection: EssayFeedbackSelectionState
): EssayFeedbackSelectionState {
  const next = {
    ...selection,
    'identify-paragraphs': true
  };

  if (next['paragraph-evaluation']) {
    next['summarize-main-idea'] = true;
  }
  if (next['thesis-restatement-feedback']) {
    next['thesis-statement-feedback'] = true;
  }

  return next;
}

export function isEssayFeedbackSelectionLocked(
  key: EssayFeedbackProcessKey,
  selection: EssayFeedbackSelectionState
): boolean {
  return (
    key === 'identify-paragraphs' ||
    (key === 'thesis-statement-feedback' && selection['thesis-restatement-feedback']) ||
    (key === 'summarize-main-idea' && selection['paragraph-evaluation'])
  );
}

export function toSelectedEssayFeedbackTypes(
  selection: EssayFeedbackSelectionState
): EssayFeedbackType[] {
  const normalized = normalizeEssayFeedbackSelection(selection);

  return ESSAY_FEEDBACK_ROWS
    .map((row) => row.key)
    .filter((key): key is EssayFeedbackType => key !== 'identify-paragraphs' && normalized[key]);
}
