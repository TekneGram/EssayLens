import { useState } from 'react';
import '../styles/essay-feedback-manager.css';

type FeedbackKey =
  | 'identify-paragraphs'
  | 'thesis-statement-feedback'
  | 'summarize-main-idea'
  | 'paragraph-evaluation'
  | 'thesis-restatement-feedback'
  | 'summary-feedback'
  | 'conclusion-final-comment';

interface FeedbackRow {
  key: FeedbackKey;
  label: string;
  explanation: string;
  locked?: boolean;
  requiredBy?: FeedbackKey[];
  selects?: FeedbackKey[];
}

const FEEDBACK_ROWS: FeedbackRow[] = [
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

const INITIAL_STATE: Record<FeedbackKey, boolean> = {
  'identify-paragraphs': true,
  'thesis-statement-feedback': true,
  'summarize-main-idea': true,
  'paragraph-evaluation': true,
  'thesis-restatement-feedback': true,
  'summary-feedback': true,
  'conclusion-final-comment': true
};

export default function EssayFeedbackManager() {
  const [selected, setSelected] = useState<Record<FeedbackKey, boolean>>(INITIAL_STATE);

  const setCheckbox = (key: FeedbackKey, nextChecked: boolean) => {
    setSelected((previous) => {
      const next = { ...previous, [key]: nextChecked };
      const row = FEEDBACK_ROWS.find((candidate) => candidate.key === key);

      if (nextChecked && row?.selects) {
        for (const dependencyKey of row.selects) {
          next[dependencyKey] = true;
        }
      }

      return next;
    });
  };

  return (
    <section className="essay-feedback-manager" data-testid="essay-feedback-manager" aria-label="Essay feedback manager">
      <h4 className="essay-feedback-manager__title">Essay Feedback</h4>
      <div className="essay-feedback-manager__table-wrap">
        <table className="essay-feedback-manager__table">
          <thead>
            <tr>
              <th scope="col">LLM feedback process</th>
              <th scope="col">Explanation</th>
              <th scope="col">Select</th>
            </tr>
          </thead>
          <tbody>
            {FEEDBACK_ROWS.map((row) => (
              <tr key={row.key} className={row.locked ? 'essay-feedback-manager__row essay-feedback-manager__row--locked' : 'essay-feedback-manager__row'}>
                <th scope="row">{row.label}</th>
                <td>{row.explanation}</td>
                <td>
                  <label className="essay-feedback-manager__checkbox">
                    <input
                      type="checkbox"
                      checked={selected[row.key]}
                      disabled={
                        row.locked ||
                        (row.key === 'thesis-statement-feedback' && selected['thesis-restatement-feedback']) ||
                        (row.key === 'summarize-main-idea' && selected['paragraph-evaluation'])
                      }
                      onChange={(event) => setCheckbox(row.key, event.target.checked)}
                      aria-label={row.label}
                    />
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
