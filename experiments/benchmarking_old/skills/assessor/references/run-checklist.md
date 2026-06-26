# Assessor Run Checklist

Use this before and during a full frontier sweep.

## Before You Start

- Confirm the target is `assessor`, not a local LLM runner.
- Confirm the output destination is `results/frontier/benchmark_results.csv`.
- Confirm you will read only `questions/` and `system_prompts/`.
- Confirm you will not inspect `answers/`.
- Confirm the family-specific output shape in [benchmark-flow.md](benchmark-flow.md) before starting the first question.

## For Each Question

- Load only the current question file.
- Load only the matching system prompt file.
- Start from a fresh sub-agent or fresh worker context.
- Do not reuse prior chat history or scratch state.
- Match the family’s exact JSON shape before downstream row normalization.
- Produce the benchmark-style row shape for the current task.

## Write Rules

- Append rows only; do not overwrite prior frontier runs.
- Keep `Judgement` as `pending` on the first pass.
- Keep `Reason Judgement` as `pending` on the first pass.
- Preserve multi-row behavior for `B1`, `B2`, `B3`, `C1`, `C2`, `C3`, and `C4`.

## After the Sweep

- Verify the CSV exists in `results/frontier/benchmark_results.csv`.
- Spot-check a few rows for stage, item, and answer mapping.
- Confirm no gold answers were read during the run.
