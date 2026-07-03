---
name: essay-ablation-comparison
description: Compare an ablated essay against its perfect version and fill EssayLens benchmark expected-response CSV rows for coherence, pronouns, linguistic coherence, citation/reference mismatches, and grammar repair. Use when the user provides two essay files where the first is ablated and the second is the intact comparison version, and asks Codex to populate benchmarking/llm_expected_responses CSV data from the repo's own analysis tasks.
---

# Essay Ablation Comparison

Read [references/benchmark-mapping.md](references/benchmark-mapping.md) before making judgments. Treat it as the required source of truth for function names, task files, response shapes, and CSV targets.

## Required Inputs

Extract these inputs from the user's request:

- `ablated_essay_path`: the first essay, containing the degraded or altered text
- `perfect_essay_path`: the second essay, containing the intact comparison text

If either path is missing, ask only for the missing path.

## Workflow

### 1. Read the repo-defined rubric

- Open the analysis functions and task files listed in `references/benchmark-mapping.md`.
- Use the repository's task wording and enum values, not improvised labels.
- When the function task and the perfect essay both help, let the task define the judgment and let the perfect essay clarify what was ablated.

### 2. Compare the two essays

- Read both essays in full.
- Extract `ESSAY_ID` from the ablated filename, using the numeric portion such as `001` from `essay_001_wearable_devices.md`.
- Identify the three body paragraphs only. Ignore the introduction and conclusion for the sentence-level coherence and grammar CSVs.
- Compare the ablated body paragraphs against the perfect version sentence by sentence.

### 3. Populate sentence-level benchmark rows

For these files, write one row for every sentence in each of the three body paragraphs:

- `benchmarking/llm_expected_responses/coherence_topic_sentence_unity.csv`
- `benchmarking/llm_expected_responses/coherence_linguistic.csv`
- `benchmarking/llm_expected_responses/coherence_pronouns.csv`
- `benchmarking/llm_expected_responses/grammar_repair.csv`

Use `PARA_NUM` values `1`, `2`, and `3` for the body paragraphs in order.

### 4. Populate citation/reference mismatch rows

For these files, write rows only for actual mismatches:

- `benchmarking/llm_expected_responses/citations_no_references.csv`
- `benchmarking/llm_expected_responses/reference_has_no_citations.csv`

Use the ablated essay as the artifact being evaluated. Use the perfect essay to help detect missing references, dropped citations, or inserted mismatches.

### 5. Keep outputs aligned with the repo schemas

- Use the exact column meanings and message text described in `references/benchmark-mapping.md`.
- Preserve the ablated sentence text in the `SENTENCE` or `CITATION` field unless the target file expects a reference entry instead.
- For grammar repair, keep `correction` and `comments` as `none` when the sentence is acceptable.
- For pronouns, include all body-paragraph sentences, including sentences with no issue, using a neutral issue/recommendation such as `None` and `No change needed.` if that matches the surrounding benchmark style.

### 6. Verify before finishing

Check these points before delivering:

- Only the three body paragraphs were used for the sentence-level CSVs.
- `ESSAY_ID` matches the essay filename.
- Every sentence-level CSV has one row per body-paragraph sentence.
- Citation/reference CSVs contain only mismatch rows.
- Enum-style labels match the repository task definitions exactly.
- Any inserted off-topic sentence, dropped connector, pronoun inconsistency, citation mismatch, or grammar degradation is grounded in the ablated text and, where useful, confirmed by the perfect essay.

