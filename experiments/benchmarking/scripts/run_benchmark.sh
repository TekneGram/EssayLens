#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <bonsai_8B|gemma4_12B_nothink|gemma4_E4B_nothink>" >&2
  exit 1
fi

PRESET="$1"

case "$PRESET" in
  bonsai_8B)
    MODEL_PATH="/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf"
    MODEL="bonsai"
    MODEL_ID="bonsai_8B"
    CACHE_K="f16"
    CACHE_V="f16"
    ;;
  gemma4_12B_nothink)
    MODEL_PATH="/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-12b-it-Q4_K_M.gguf"
    MODEL="gemma"
    MODEL_ID="gemma4_12B_nothink"
    CACHE_K="turbo3"
    CACHE_V="turbo3"
    ;;
  gemma4_E4B_nothink)
    MODEL_PATH="/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf"
    MODEL="gemma"
    MODEL_ID="gemma4_E4B_nothink"
    CACHE_K="turbo3"
    CACHE_V="turbo3"
    ;;
  *)
    echo "Unknown preset: $PRESET" >&2
    exit 1
    ;;
esac

max_tokens_for_question() {
  case "$1" in
    A1|A2|A3|A4)
      echo 128
      ;;
    B1)
      echo 256
      ;;
    B2|B3|C1|C2|C3|C4|D1|D2)
      echo 512
      ;;
    *)
      echo 512
      ;;
  esac
}

QUESTIONS=(A1 A2 A3 A4 B1 B2 B3 C1 C2 C3 C4 D1 D2)

for QUESTION in "${QUESTIONS[@]}"; do
  MAX_TOKENS="$(max_tokens_for_question "$QUESTION")"
  echo "Running ${MODEL_ID} ${QUESTION} with ${MAX_TOKENS} tokens"
  python3 "${SCRIPT_DIR}/../main.py" \
    --model_path "$MODEL_PATH" \
    --model-id "$MODEL_ID" \
    --model "$MODEL" \
    --cache-k "$CACHE_K" \
    --cache-v "$CACHE_V" \
    --question "$QUESTION" \
    --max-tokens "$MAX_TOKENS"
done
