# Benchmark Mapping

Use this file as the source of truth for the benchmark workflow.

## Scope

This skill is for the benchmark comparison workflow where:

- the first essay is the ablated essay being scored
- the second essay is the perfect comparison essay
- Codex fills expected-response CSVs in `benchmarking/llm_expected_responses/`

The perfect essay is not the artifact being evaluated. Use it to detect what was removed, inserted, degraded, or made inconsistent in the ablated essay.

## Essay ID And Paragraph Scope

- Derive `ESSAY_ID` from the ablated filename, e.g. `essay_001_wearable_devices.md` -> `001`.
- For sentence-level coherence and grammar tasks, evaluate only the three body paragraphs.
- Use `PARA_NUM` `1`, `2`, `3` in body-paragraph order.
- Ignore the introduction and conclusion for these sentence-level CSVs.

## Function And Task Mapping

### 1. Topic Sentence / Unity

- Function: `essay_analysis_coherence.py` -> `analyze_topic_sentence_coherence`
- Knowledge file: `tasks_body_paras/topic_sentence_coherence_knowledge.md`
- Task file: `tasks_body_paras/body_coherence_with_topic.md`
- Output CSV: `benchmarking/llm_expected_responses/coherence_topic_sentence_unity.csv`
- CSV columns:
  - `ESSAY_ID`
  - `PARA_NUM`
  - `SENTENCE`
  - `BEHAVIOR`
  - `COMMENT`
- Required row pattern: one row per sentence in each body paragraph
- Allowed `BEHAVIOR` values:
  - `topic sentence`
  - `elaborates an earlier sentence`
  - `introduces a new idea`
- Guidance:
  - Mark the body paragraph's main sentence as `topic sentence`, usually the first sentence.
  - Mark inserted or off-topic ablated sentences as `introduces a new idea` when they do not stay close to the topic sentence.
  - Keep comments very concise.

### 2. Linguistic Coherence

- Function: `essay_analysis_coherence.py` -> `analyze_linguistic_coherence`
- Knowledge file: `tasks_body_paras/linguistic_coherence_knowledge.md`
- Task file: `tasks_body_paras/identify_linguistic_coherence_improvements.md`
- Output CSV: `benchmarking/llm_expected_responses/coherence_linguistic.csv`
- CSV columns:
  - `ESSAY_ID`
  - `PARA_NUM`
  - `SENTENCE`
  - `COHERENCE`
  - `COMMENT`
- Required row pattern: one row per sentence in each body paragraph
- Allowed `COHERENCE` values:
  - `satisfactory`
  - `add a contrast`
  - `add an addition connector`
  - `show cause and effect`
  - `show reason`
  - `use elaboration words`
- Guidance:
  - Use the perfect essay to notice dropped transitions like `for example`, `furthermore`, or `for this reason`.
  - Keep comments concrete, usually naming the missing connector type and giving a brief example.

### 3. Pronoun Coherence

- Function: `essay_analysis_coherence.py` -> `analyze_pronouns`
- Knowledge file: `tasks_body_paras/pronoun_coherence_knowledge.md`
- Task file: `tasks_body_paras/improve_pronouns.md`
- Output CSV: `benchmarking/llm_expected_responses/coherence_pronouns.csv`
- CSV columns:
  - `ESSAY_ID`
  - `PARA_NUM`
  - `SENTENCE`
  - `PRONOUN_ISSUE`
  - `RECOMMENDATION`
- Required row pattern: one row per sentence in each body paragraph
- Guidance:
  - Compare sentences across the paragraph to detect inconsistent or unclear pronouns.
  - Common ablations include shifts to first person (`I`, `me`) or unclear forms like `its` / `it` / `they`.
  - Include all body-paragraph sentences, not only flagged ones.
  - For sentences without a problem, use a neutral no-issue entry consistent with the benchmark style, such as `None` and `No change needed.`

### 4. Citation Has No Reference

- Function: `essay_analysis_citations.py` -> `check_citation_no_reference`
- Knowledge file: `tasks_citations/citations_references_knowledge.md`
- Task file: `tasks_citations/check_citation_no_ref.md`
- Output CSV: `benchmarking/llm_expected_responses/citations_no_references.csv`
- CSV columns:
  - `ESSAY_ID`
  - `CITATION`
  - `MISSING_REFERENCE`
- Required row pattern: write rows only for actual mismatches
- Required message:
  - `Reference missing for this citation`
- Guidance:
  - Put the full ablated sentence containing the citation into `CITATION`.
  - Use the perfect essay to spot references that were removed from the ablated references section.

### 5. Reference Has No Citation

- Function: `essay_analysis_citations.py` -> `check_references_no_citation`
- Knowledge file: `tasks_citations/citations_references_knowledge.md`
- Task file: `tasks_citations/check_ref_no_citation.md`
- Output CSV: `benchmarking/llm_expected_responses/reference_has_no_citations.csv`
- CSV columns:
  - `ESSAY_ID`
  - `REFERENCE`
  - `MISSING_CITATION`
- Required row pattern: write rows only for actual mismatches
- Required message:
  - `This reference has no in-text citation; either remove the reference or add the relevant in-text citation.`
- Guidance:
  - Put the full reference entry into `REFERENCE`.
  - Use the perfect essay to detect dropped in-text citations that leave a reference orphaned.

### 6. Grammar Repair

- Function: `essay_analysis_grammar.py` -> `repair_grammar`
- Knowledge file: `tasks_grammar/grammar_knowledge.md`
- Task file: `tasks_grammar/improve_language.md`
- Output CSV: `benchmarking/llm_expected_responses/grammar_repair.csv`
- CSV columns:
  - `ESSAY_ID`
  - `PARA_NUM`
  - `SENTENCE`
  - `CORRECTION`
  - `COMMENTS`
- Required row pattern: one row per sentence in each body paragraph
- Guidance:
  - Evaluate awkward, unnatural, or grammatically degraded ablated sentences.
  - Use the perfect essay to reconstruct the intended natural sentence when helpful.
  - If the sentence is acceptable, use:
    - `CORRECTION`: `none`
    - `COMMENTS`: `none`

## Comparison Heuristics

Use the perfect essay to detect ablations such as:

- inserted off-topic sentences
- removed or weakened connectors
- pronoun inconsistency or unclear reference
- missing in-text citations
- missing references
- broken grammar or awkward rephrasing

Do not copy the perfect essay blindly into the CSV. The ablated essay remains the scored artifact.

## Editing Rule

Update the target CSV files directly in `benchmarking/llm_expected_responses/`.

When the user asks for one essay pair:

1. read the six target CSV files
2. append or add rows for that `ESSAY_ID`
3. preserve existing rows for other essays
4. verify the written rows after editing
