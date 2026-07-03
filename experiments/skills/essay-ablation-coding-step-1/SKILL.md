---
name: essay-ablation-coding-step-1
description: Compare an ablated essay against its original version and code step-1 sentence alignment rows into a target CSV for EssayLens. Use when the user provides the CSV file to write to plus the ablated and original essay files, and wants body paragraphs 1-3 and the references section separated into `ABLATED_ESSAY`, `ORIGINAL_ESSAY`, and `SENTENCE_CHANGE` with `Correspond`, `Split`, `New`, or `Removed`.
---

# Essay Ablation Coding Step 1

Use this skill to perform only step 1 of essay-ablation coding: sentence separation and alignment between an ablated essay and its original version.

## Required Inputs

Extract these inputs from the user's request:

- `csv_path`: the CSV file to update
- `ablated_essay_path`: the degraded essay
- `original_essay_path`: the intact comparison essay

If any path is missing, ask only for the missing path.

## Scope

- Code only the three body paragraphs and the references section unless the user narrows the scope further.
- Do not code the introduction or conclusion.
- Store references rows with `BODY_PARA_NUM` set to `ref`.
- Fill only these columns during step 1:
  - `ESSAY_ID`
  - `BODY_PARA_NUM`
  - `ABLATED_ESSAY`
  - `ORIGINAL_ESSAY`
  - `SENTENCE_CHANGE`
- Leave later analysis columns unchanged if updating existing rows, or blank if appending new rows.

## Workflow

### 1. Read and segment the essays

- Read both essays in full.
- Extract `ESSAY_ID` from the essay filename, such as `002` from `essay_002_part_time_jobs.md`.
- Identify body paragraphs in order and isolate the references section separately.
- Split paragraphs into sentence-level units carefully. Treat each reference entry as a separate unit.

### 2. Align ablated and original units

For each aligned row, use exactly one `SENTENCE_CHANGE` label:

- `Correspond`: the ablated and original units are essentially the same sentence-level idea.
- `Split`: one original sentence was split into two ablated sentences. Paste the same original sentence into each split row.
- `New`: the ablated essay contains a unit with no original counterpart. Leave `ORIGINAL_ESSAY` blank.
- `Removed`: the original essay contains a unit with no ablated counterpart. Leave `ABLATED_ESSAY` blank.

Prefer preserving alignment order. When several mappings are plausible, choose the pairing that best preserves the surrounding paragraph structure.

### 3. Write valid CSV rows

- Use a real CSV writer such as Python's `csv` module, or otherwise ensure proper CSV escaping.
- Do not hand-build CSV lines with string concatenation.
- Quote any field that contains commas, quotation marks, or line breaks.
- Escape embedded double quotes according to CSV rules.
- Preserve the file's existing header and row order.

### 4. Verify before finishing

Check these points:

- Introduction and conclusion were not coded.
- Body paragraphs use `1`, `2`, and `3` in `BODY_PARA_NUM`.
- References use `ref` in `BODY_PARA_NUM`.
- Every `New` row has a blank `ORIGINAL_ESSAY`.
- Every `Removed` row has a blank `ABLATED_ESSAY`.
- Every `Split` row repeats the original sentence in each corresponding row.
- The CSV parses cleanly after the update.
