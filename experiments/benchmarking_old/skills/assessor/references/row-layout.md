# Assessor Row Layout

This is the normalized CSV layout after the benchmark flow in [benchmark-flow.md](benchmark-flow.md) has been applied.

Use one CSV row per atomic output item.

## Shared Columns

- `Row ID`
- `Parent Row ID`
- `Paragraph`
- `Enhanced Knowledge`
- `LLM`
- `Model Path`
- `Task`
- `Stage`
- `Item Index`
- `Answer`
- `Reason`
- `First Sentence`
- `Second Sentence`
- `Judgement`
- `Reason Judgement`
- `Raw Response`

## Task Patterns

- `A1`, `A3`, `D1`, `D2`: one row per paragraph per knowledge setting.
- `A2`, `A4`: one row per paragraph per knowledge setting, with the verdict in `Answer` and explanation in `Reason`.
- `B1`, `B2`, `B3`: one row per returned item, all with `Judgement = pending`.
- `C1`: one row per returned signpost item.
- `C2`:
  - `decision` row: `Answer = necessary_to_add`, keep `First Sentence` and `Second Sentence`
  - `recommend` row: `Answer = signpost`, keep `First Sentence` and `Second Sentence`
  - only emit `recommend` when `necessary_to_add == yes`
- `C3`:
  - `detect` row: `Answer = has_transition_sentence`, `Reason = detected_transition_sentence`
  - `recommend` row: `Answer = recommended_transition_sentence`, `Reason = transition_sentence_placement`
  - only emit `recommend` when the detection says `No`
- `C4`:
  - `detect` row: `Answer = has_summary_noun_phrase`, `Reason = summary_noun_phrase`
  - `recommend` row: `Answer = recommended_summary_noun_phrase`, `Reason = summary_noun_phrase_placement`
  - only emit `recommend` when the detection says `No`

## Defaults

- `Judgement`: `pending`
- `Reason Judgement`: `pending`
- `LLM`: the assessor model label, not a local runtime preset
- For frontier runs, use `gpt-5.4` as `LLM` and `frontier/gpt-5.4` as the model-path placeholder if needed.
