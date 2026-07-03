---
name: essay-ablation-coding-step-2
description: Fill the remaining step-2 coding columns in an EssayLens ablation-coding CSV by comparing an ablated essay against its original version. Use when the user provides the target CSV plus the ablated and original essay files, and wants `COHERENCE_TOPIC_SENTENCE_ERROR_ADDED`, `COHERENCE_LINGUISTIC_ERROR_ADDED`, `COHERENCE_PRONOUN_ERROR_ADDED`, `CITATION_ERROR_ADDED`, `GRAMMAR_ERROR_ADDED`, and `WORDS_SIMPLIFIED` completed for existing step-1 rows.
---

# Essay Ablation Coding Step 2

Use this skill after step 1 rows already exist in the target CSV. This skill fills the remaining judgment columns for the existing sentence-alignment rows.

## Required Inputs

Extract these inputs from the user's request:

- `csv_path`: the CSV file to update
- `ablated_essay_path`: the degraded essay
- `original_essay_path`: the intact comparison essay

If any path is missing, ask only for the missing path.

## Required Knowledge Sources

Read these repository files before making judgments:

- `tasks_body_paras/topic_sentence_coherence_knowledge.md`
- `tasks_body_paras/linguistic_coherence_knowledge.md`
- `tasks_body_paras/pronoun_coherence_knowledge.md`

Use those files as the source of truth for the three coherence-related columns.

## Scope

- Work from the existing step-1 rows in the CSV.
- Fill only these columns:
  - `COHERENCE_TOPIC_SENTENCE_ERROR_ADDED`
  - `COHERENCE_LINGUISTIC_ERROR_ADDED`
  - `COHERENCE_PRONOUN_ERROR_ADDED`
  - `CITATION_ERROR_ADDED`
  - `GRAMMAR_ERROR_ADDED`
  - `WORDS_SIMPLIFIED`
- Do not rewrite the sentence-alignment columns unless the user explicitly asks for corrections.
- Respect `BODY_PARA_NUM` values `1`, `2`, `3`, and `ref`.

## Judgment Rules

### 1. Topic sentence coherence

Use `tasks_body_paras/topic_sentence_coherence_knowledge.md`.

- Read each ablated paragraph as a paragraph, not just as isolated sentences.
- Usually the first sentence is the topic sentence.
- Mark `COHERENCE_TOPIC_SENTENCE_ERROR_ADDED` as `1` when a supporting sentence is off topic for that paragraph.
- Mark it as `0` otherwise.
- `New` sentences are strong candidates for `1` when they introduce unrelated content.
- For `Removed` rows and `ref` rows, use `0` unless the user gives a different convention.

### 2. Linguistic coherence

Use `tasks_body_paras/linguistic_coherence_knowledge.md`.

- Compare `ABLATED_ESSAY` against `ORIGINAL_ESSAY`.
- Mark `COHERENCE_LINGUISTIC_ERROR_ADDED` as `1` when the ablated sentence introduces a coherence problem such as a broken contrast, addition, elaboration, cause-effect, or reason link, including dropped or damaged linking language.
- Mark it as `0` otherwise.
- For `New` rows, judge whether the inserted sentence creates a coherence problem in its paragraph.
- For `Removed` rows and `ref` rows, use `0`.

### 3. Pronoun coherence

Use `tasks_body_paras/pronoun_coherence_knowledge.md`.

- Compare `ABLATED_ESSAY` against `ORIGINAL_ESSAY`.
- Mark `COHERENCE_PRONOUN_ERROR_ADDED` as `1` when the ablated sentence introduces unclear, inconsistent, or mismatched pronoun use, including first-person or second-person intrusions that create an academic-style coherence problem.
- Mark it as `0` otherwise.
- For `New` rows, judge the ablated sentence directly.
- For `Removed` rows and `ref` rows, use `0`.

### 4. Citation error

- Compare ablated and original sentences.
- Mark `CITATION_ERROR_ADDED` as `1` when a citation present in the original is removed or damaged in the ablated version.
- Mark it as `0` otherwise.
- For `BODY_PARA_NUM=ref`, mark `1` when the original reference entry is missing from the ablated references and `0` otherwise.

### 5. Grammar error

- Mark `GRAMMAR_ERROR_ADDED` as `1` when the ablated sentence contains a grammatical error not present in the original.
- Mark it as `0` otherwise.
- For `Removed` rows and `ref` rows, use `0`.

### 6. Words simplified

- Compare ablated and original wording.
- Mark `WORDS_SIMPLIFIED` as `1` when the ablated sentence uses noticeably simpler wording than the original.
- Mark it as `0` otherwise.
- For `Removed` rows and `ref` rows, use `0`.

## Writing Rules

- Use a real CSV writer such as Python's `csv` module, or otherwise ensure proper CSV escaping.
- Do not hand-build CSV lines with string concatenation.
- Quote any field that contains commas, quotation marks, or line breaks.
- Escape embedded double quotes according to CSV rules.
- Preserve the file's existing header and row order.

## Verify Before Finishing

Check these points:

- The three knowledge files were read before judging coherence columns.
- Only the six step-2 columns were filled.
- `ref` rows were handled with the reference-specific citation rule.
- `New` and `Removed` rows were handled consistently with the rules above.
- The CSV parses cleanly after the update.
