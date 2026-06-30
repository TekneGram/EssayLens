# Assessor Benchmark Flow

This is the source-of-truth map from benchmark family to question files, prompt files, helper behavior, and output shape.

## Topic Sentences

- `A1`
  - Questions: `questions/A1/*.md`
  - Prompts: `system_prompts/A1_ts.md` plus `system_prompts/paragraph_knowledge.md` or `system_prompts/paragraph_no_knowledge.md`
  - Helper: `identify_topic_sentence`
  - Output: free-text topic sentence
- `A2`
  - Questions: `questions/A2/*.md`
  - Prompts: `system_prompts/A2_ts.md` plus `system_prompts/paragraph_knowledge.md` or `system_prompts/paragraph_no_knowledge.md`
  - Helper: `select_best_topic_sentence`
  - Output: JSON with `verdict` and `reason`
- `A3`
  - Questions: `questions/A3/*.md`
  - Prompts: `system_prompts/A3_ts.md` plus `system_prompts/paragraph_knowledge.md` or `system_prompts/paragraph_no_knowledge.md`
  - Helper: `write_topic_sentence`
  - Output: free-text topic sentence
- `A4`
  - Questions: `questions/A4/*.md`
  - Prompts: `system_prompts/A4_ts.md` plus `system_prompts/paragraph_knowledge.md` or `system_prompts/paragraph_no_knowledge.md`
  - Helper: `judge_topic_sentence`
  - Output: JSON with `verdict` and `reason`

## Vocabulary

- `B1`
  - Questions: `questions/B1/*.md`
  - Prompts: `system_prompts/B1_v.md` plus `system_prompts/vocabulary_knowledge.md` or `system_prompts/vocabulary_no_knowledge.md`
  - Helper: `enhance_specified_word`
  - Output: `items[]` with `simple_vocabulary`, `text_context`, `precise_vocabulary`
- `B2`
  - Questions: `questions/B2/*.md`
  - Prompts: `system_prompts/B2_v.md` plus `system_prompts/vocabulary_knowledge.md` or `system_prompts/vocabulary_no_knowledge.md`
  - Helper: `identify_words_to_improve`
  - Output: `items[]` with `simple_vocabulary`, `sentence_context`
- `B3`
  - Questions: `questions/B3/*.md`
  - Prompts: `system_prompts/B3_v.md` plus `system_prompts/vocabulary_knowledge.md` or `system_prompts/vocabulary_no_knowledge.md`
  - Helper: `suggest_multiple_word_improvements`
  - Output: `items[]` with `simple_vocabulary`, `sentence_context`, `precise_vocabulary`

## Coherence

- `C1`
  - Questions: `questions/C1/*.md`
  - Prompts: `system_prompts/C1_coh.md` plus `system_prompts/coherence_knowledge.md` or `system_prompts/coherence_no_knowledge.md`
  - Helper: `identify_signposts`
  - Output: `items[]` with `signpost`
- `C2`
  - Questions: `questions/C2/*.md`
  - Prompts: `system_prompts/C2_coh.md` plus `system_prompts/coherence_knowledge.md` or `system_prompts/coherence_no_knowledge.md`
  - Helper: `recommend_signposts`
  - Output: `items[]` with `necessary_to_add`, `first_sentence`, `second_sentence`, `signpost`
  - Downstream CSV stages:
    - `decision`: write `necessary_to_add`
    - `recommend`: write `signpost` only when `necessary_to_add == yes`
- `C3`
  - Questions: `questions/C3/*.md`
  - Prompts: `system_prompts/C3_1_coh.md` and `system_prompts/C3_2_coh.md` plus `system_prompts/coherence_knowledge.md` or `system_prompts/coherence_no_knowledge.md`
  - Helpers: `detect_transition`, then `recommend_transition` when needed
  - Output stage 1: JSON with `has_transition_sentence`, `detected_transition_sentence`
  - Output stage 2: JSON with `recommended_transition_sentence`, `transition_sentence_placement`
- `C4`
  - Questions: `questions/C4/*.md`
  - Prompts: `system_prompts/C4_1_coh.md` and `system_prompts/C4_2_coh.md` plus `system_prompts/coherence_knowledge.md` or `system_prompts/coherence_no_knowledge.md`
  - Helpers: `detect_summary_noun`, then `recommend_summary_noun` when needed
  - Output stage 1: JSON with `has_summary_noun_phrase`, `summary_noun_phrase`
  - Output stage 2: JSON with `recommended_summary_noun_phrase`, `summary_noun_phrase_placement`

## Supporting Claims

- `D1`
  - Questions: `questions/D1/*.md`
  - Prompts: `system_prompts/D1_ss.md` plus `system_prompts/supporting_claims_knowledge.md` or `system_prompts/supporting_claims_no_knowledge.md`
  - Helper: `supporting_claims`
  - Output: JSON with `has_support`, `details`
- `D2`
  - Questions: `questions/D2/*.md`
  - Prompts: `system_prompts/D2_ss.md` plus `system_prompts/paragraph_knowledge.md` or `system_prompts/paragraph_no_knowledge.md`
  - Helper: `weak_support`
  - Output: JSON with `weak_support`, `details`

## Execution Rule

- Every family runs across both knowledge conditions unless the family already defines a second stage instead.
- Use `questions/` and `system_prompts/` only.
- Do not read `answers/`.
