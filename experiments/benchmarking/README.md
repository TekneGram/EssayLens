# Benchmarking Runs

Use the launcher script to run a full benchmark suite for one model preset and append all results into a single CSV for that preset.

## Presets

- `bonsai_8B` -> `/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf`
- `gemma4_12B_nothink` -> `/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-12b-it-Q4_K_M.gguf`
- `gemma4_E4B_nothink` -> `/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf`

## Run

```bash
./scripts/run_benchmark.sh bonsai_8B
./scripts/run_benchmark.sh gemma4_12B_nothink
./scripts/run_benchmark.sh gemma4_E4B_nothink
```

## Output

Each preset writes to:

- `results/bonsai_8B/benchmark_results.csv`
- `results/gemma4_12B_nothink/benchmark_results.csv`
- `results/gemma4_E4B_nothink/benchmark_results.csv`

Each CSV includes a `Reason Judgement` column next to `Judgement`. On the first pass, both columns are written as `pending` for manual review.

For the vocabulary tasks:

- `B1`
- `B2`
- `B3`

`Judgement` is intentionally left as `pending` on initial write.

`C2` is written as two logical stages in the CSV:

- `decision` records `necessary_to_add`, `first_sentence`, and `second_sentence`
- `recommend` records `signpost`, plus `first_sentence` and `second_sentence`, only when `necessary_to_add` is `yes`

## Direct Invocation

If you run `main.py` directly, pass `--model-id` so the row output goes to the correct CSV folder.

Example:

```bash
python3 main.py \
  --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" \
  --model-id "gemma4_E4B_nothink" \
  --model "gemma" \
  --cache-k turbo3 \
  --cache-v turbo3 \
  --question A1 \
  --max-tokens 128
```
