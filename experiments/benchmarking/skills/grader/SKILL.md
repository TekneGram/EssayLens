---
name: grader
description: Grade EssayLens benchmark CSV rows in place by resolving each row back to its question, task, and answer files, then updating Judgement and Reason Judgement.
---

# Grader

Grade an existing benchmark CSV in place.

## Workflow

1. Open the benchmark CSV under `results/<model_id>/benchmark_results.csv`.
2. For each row, resolve:
   - `Paragraph` -> `questions/<question>/<Paragraph>.md`
   - `Task` -> `system_prompts/<Task>`
3. Use the task rubric in [references/grading-rubric.md](references/grading-rubric.md).
4. Update the row in place.

## Source Files

- Read the question file for the row.
- Read the matching system prompt file.
- Read `answers/` only when the rubric requires it, especially for `A3`.
- Do not change any columns except the judgment columns unless the user explicitly asks.

## Judgment Rules

- Keep `Answer` as the model output already stored in the CSV.
- Write the evaluation verdict to `Judgement`.
- Write the short rationale or comment to `Reason Judgement`.
- If a row already has `correct` or `incorrect`, you may overwrite it when the user asks you to re-grade that row.

## Family Handling

- `A1`: judge the topic sentence against the question and task.
- `A2`: judge the answer and add a concise comment on how sound the reason is.
- `A3`: judge the topic sentence using the matching answer file as a guide.
- `A4`: judge the answer and add a concise comment on how sound the reason is.
- `B1`: `precise_vocabulary` must improve on `simple_vocabulary`.
- `B2`: if the simple word is already reasonable, mark it incorrect.
- `B3`: `precise_vocabulary` must improve on `simple_vocabulary`.
- `C2`:
  - `decision`: judge whether the decision fits the paragraph context.
  - `recommend`: judge whether the connector suits the two sentences.
- `C3`:
  - use `C3_2_coh.md` rows for the recommendation stage
  - judge the transition sentence
  - add a concise comment on the reason
- `C4`:
  - use `C4_2_coh.md` rows for the recommendation stage
  - judge the summary noun phrase
  - add a concise comment on the reason
- `D1`: add a concise comment on the reason.
- `D2`: judge `weak_support` and add a brief comment on `details`.

## Output

- Save the updated CSV back to the same file.
- Preserve all other fields and row order.
- If a row is not being graded yet, leave its judgment fields unchanged unless the user says otherwise.
