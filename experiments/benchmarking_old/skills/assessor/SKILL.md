---
name: assessor
description: Run the EssayLens benchmark sweep as Codex/GPT-5.4, answering each question from `questions/` and `system_prompts/` only, with fresh per-question sub-agents and CSV output in `results/frontier/benchmark_results.csv`.
---

# Assessor

Run the full benchmark sweep as the assessor model itself.

## Benchmark Flow

- Use [references/benchmark-flow.md](references/benchmark-flow.md) as the routing map for question families, prompt files, helper behavior, and output shapes.
- Use [references/row-layout.md](references/row-layout.md) for the normalized CSV rows produced downstream of the model output.

## Workflow

1. Run the full sweep from one invocation.
   - A single `assessor` invocation should process all questions.
   - Do not ask the user to invoke the skill once per question.

2. Isolate each question.
   - Spawn a fresh sub-agent for every question.
   - Each sub-agent may only read the current question file and its matching system prompt files.
   - Do not carry chat history, scratch state, or prior answers into the next question.

3. Never read gold answers.
   - Do not inspect `answers/`.
   - Generate model-style responses only from `questions/` and `system_prompts/`.

4. Write frontier output.
   - Append rows to `results/frontier/benchmark_results.csv`.
   - Keep the benchmark row shape used elsewhere in this repo.
   - Leave `Judgement` and `Reason Judgement` as `pending`.
   - For frontier runs, label the model as `gpt-5.4` and use `frontier/gpt-5.4` as the model-path placeholder if a path field is required.

## Question Handling

- Process each benchmark question family in the same style as `main.py`.
- Every family uses the same knowledge / no-knowledge split that `main.py` uses, except where `main.py` branches into a second stage.
- Preserve multi-row behavior:
  - `B1`, `B2`, `B3`, and `C1` can yield multiple rows.
  - `C2` uses `decision` and optional `recommend`.
  - `C3` and `C4` use `detect` and optional `recommend`.
- Match the helper-level output shape for each family:
  - topic sentence tasks use either free text or `{verdict, reason}`
  - vocabulary tasks use `items[]`
  - coherence tasks use the exact detect/recommend JSON keys
  - supporting claim tasks use `{has_support, details}` or `{weak_support, details}`
- Keep `first_sentence` and `second_sentence` on `C2` rows.
- Keep `Reason` filled only when the task naturally has a reason or details field.

## Output Convention

- Use `results/frontier/benchmark_results.csv` as the single destination.
- Append only; do not overwrite prior frontier runs.
- Keep `LLM` labeled as `gpt-5.4` for frontier runs, not a local runtime preset.
- See [references/benchmark-flow.md](references/benchmark-flow.md) for the exact family-to-shape mapping.
- See [references/row-layout.md](references/row-layout.md) for the compact downstream row schema.
- See [references/run-checklist.md](references/run-checklist.md) for the execution checklist.

## Execution Notes

- Prefer `spawn_agent` for per-question isolation when needed.
- If a helper process is used, it must be fresh per question and must not reuse context from earlier questions.
- Treat the task as assessment, not evaluation against gold answers.
