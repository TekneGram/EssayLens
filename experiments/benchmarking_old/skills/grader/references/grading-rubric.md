# Grading Rubric

Use this with `results/<model_id>/benchmark_results.csv`.

## Row Resolution

- `Paragraph` names the question file stem, e.g. `A1_1`.
- `Task` names the system prompt file, e.g. `A1_ts.md`.
- Use the question family from the row `Task` prefix.
- Use `questions/<family>/<Paragraph>.md` for the prompt text.
- Use `system_prompts/<Task>` for the task text.

## Judgment Fields

- `Judgement` gets the verdict: `correct`, `incorrect`, `n/a`, or `pending` when still ungraded.
- `Reason Judgement` gets the short comment on the reason, explanation, or details when applicable.
- Keep `Answer` unchanged unless the user explicitly asks to rewrite it.

## Family Rules

### A1

- Judge the topic sentence against the paragraph and task.

### A2

- Judge the answer choice.
- Add a concise comment on whether the reason is sound.

### A3

- Judge whether the topic sentence is acceptable.
- Use the matching file in `answers/<family>/<Paragraph>.md` as a guide.
- Mark `correct` when the answer aligns with the accepted options or intent.

### A4

- Judge the answer choice.
- Add a concise comment on whether the reason is sound.

### B1

- If `precise_vocabulary` is the same as `simple_vocabulary`, mark `incorrect`.
- If it is a genuine improvement, mark `correct`.

### B2

- If the simple vocabulary is already reasonable, mark `incorrect`.
- If it could clearly be improved, mark `correct`.

### B3

- If `precise_vocabulary` improves on `simple_vocabulary`, mark `correct`.
- Otherwise mark `incorrect`.

### C2

- `decision` rows:
  - judge whether the decision fits the paragraph context.
- `recommend` rows:
  - judge whether the connector fits the two sentences.

### C3

- Use rows with `Task = C3_2_coh.md` for the recommendation stage.
- Judge whether the recommended transition sentence is suitable.
- Add a concise comment on the reason field.

### C4

- Use rows with `Task = C4_2_coh.md` for the recommendation stage.
- Judge whether the recommended summary noun phrase is suitable.
- Add a concise comment on the reason field.

### D1

- Add a concise comment on the reason field.

### D2

- Judge whether `weak_support` is correct.
- Add a brief comment on the `details` field.

## Overwrite Rule

- If the user identifies rows to re-grade, overwrite existing judgments for those rows even if they already say `correct` or `incorrect`.
