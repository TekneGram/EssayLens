from __future__ import annotations

import argparse
import csv
import json
import math
import string
import subprocess
import time
from collections import Counter
from pathlib import Path

import requests

from essay_analysis_vocabulary import identify_paragraphs, enhance_vocabulary


WORD_COUNTS_FILE = "experiments/word_freq_data/word_counts.csv"

MIN_ENRICHMENT_FREQUENCY = 3

MODERATE_LL_THRESHOLD = 6.63
STRONG_LL_THRESHOLD = 10.83
VERY_STRONG_LL_THRESHOLD = 15.13


COMMON_FUNCTION_WORDS = {
    "the", "a", "an",
    "and", "or", "but", "if", "because", "so",
    "of", "in", "on", "at", "to", "for", "from", "with", "by", "about",
    "as", "than", "into", "over", "after", "before", "between", "through",
    "is", "am", "are", "was", "were", "be", "been", "being",
    "do", "does", "did",
    "have", "has", "had",
    "will", "would", "can", "could", "shall", "should", "may", "might", "must",
    "i", "me", "my", "mine",
    "you", "your", "yours",
    "he", "him", "his",
    "she", "her", "hers",
    "it", "its",
    "we", "us", "our", "ours",
    "they", "them", "their", "theirs",
    "this", "that", "these", "those",
    "there", "here",
    "who", "whom", "whose", "which", "what",
    "when", "where", "why", "how",
    "not", "no", "nor",
}


def wait_for_server(base_url: str, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    health_url = f"{base_url}/health"

    while time.time() < deadline:
        try:
            response = requests.get(health_url, timeout=2)
            if response.ok:
                return
        except requests.RequestException:
            pass

        time.sleep(0.5)

    raise TimeoutError(
        f"Server did not become healthy in {timeout_s}s: {health_url}"
    )


def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]

    if model == "gemma":
        return (
            repo_root
            / "third_party_new"
            / "llama-cpp-turboquant"
            / "build"
            / "bin"
            / "llama-server"
        )

    if model == "bonsai":
        return (
            repo_root
            / "third_party_prismml"
            / "llama-cpp"
            / "build"
            / "bin"
            / "llama-server"
        )

    raise ValueError(f"Unknown model: {model}")


def select_jinja(model: str) -> Path | None:
    repo_root = Path(__file__).resolve().parents[1]

    if model == "gemma":
        return repo_root / "assets" / "models" / "gemma_4_chat_template.jinja"

    return None


def clean_word(word: str) -> str:
    return "".join(
        char for char in word.lower().strip()
        if char not in string.punctuation
    )


def get_clean_words(text: str) -> list[str]:
    words = [clean_word(word) for word in text.split()]
    return [word for word in words if word]


def load_word_counts(filepath: str) -> Counter:
    """
    Load word counts from a CSV file.

    Expected columns:
        word,count

    Also accepts count columns named:
        frequency, freq

    The same file is used for:
    1. building frequency bands;
    2. serving as the comparison corpus for log-likelihood.
    """

    counts = Counter()

    with open(filepath, "r", newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)

        if reader.fieldnames is None:
            raise ValueError("Word count CSV has no header row.")

        lower_fieldnames = [
            field.lower().strip()
            for field in reader.fieldnames
        ]

        word_column = None
        count_column = None

        for candidate in ["word", "token", "lemma"]:
            if candidate in lower_fieldnames:
                word_column = reader.fieldnames[lower_fieldnames.index(candidate)]
                break

        for candidate in ["count", "frequency", "freq"]:
            if candidate in lower_fieldnames:
                count_column = reader.fieldnames[lower_fieldnames.index(candidate)]
                break

        if word_column is None:
            raise ValueError(
                "Could not find a word column. Expected: word, token, or lemma."
            )

        if count_column is None:
            raise ValueError(
                "Could not find a count column. Expected: count, frequency, or freq."
            )

        for row in reader:
            word = row[word_column].lower().strip()

            if not word:
                continue

            try:
                count = int(float(row[count_column]))
            except ValueError:
                continue

            if count > 0:
                counts[word] += count

    return counts


def remove_function_words(word_counts: Counter, function_words: set[str]) -> Counter:
    return Counter({
        word: count
        for word, count in word_counts.items()
        if word not in function_words
    })


def create_frequency_bands(reference_lexical_counts: Counter) -> dict[str, set[str]]:
    """
    Create lexical bands from the comparison corpus.

    The most frequent non-function words are used to create:
    - top_1000
    - range_1001_2000
    - range_2001_3500
    """

    ranked_words = [
        word
        for word, count in reference_lexical_counts.most_common()
    ]

    return {
        "top_1000": set(ranked_words[:1000]),
        "range_1001_2000": set(ranked_words[1000:2000]),
        "range_2001_3500": set(ranked_words[2000:3500]),
    }


def count_student_lexical_words(
    essay_words: list[str],
    function_words: set[str]
) -> Counter:
    return Counter(
        word
        for word in essay_words
        if word not in function_words
    )


def assign_words_to_bands(
    student_lexical_counts: Counter,
    frequency_bands: dict[str, set[str]]
) -> dict[str, dict]:
    """
    Count student lexical words in each frequency band.
    """

    lexical_total_tokens = sum(student_lexical_counts.values())
    lexical_total_types = len(student_lexical_counts)

    band_results = {}
    assigned_words = set()

    for band_name, band_words in frequency_bands.items():
        words_in_band = {
            word: freq
            for word, freq in student_lexical_counts.items()
            if word in band_words
        }

        assigned_words.update(words_in_band.keys())

        token_count = sum(words_in_band.values())
        type_count = len(words_in_band)

        band_results[band_name] = {
            "token_count": token_count,
            "token_percentage_lexical_words": (
                token_count / lexical_total_tokens * 100
                if lexical_total_tokens > 0
                else 0
            ),
            "type_count": type_count,
            "type_percentage_lexical_words": (
                type_count / lexical_total_types * 100
                if lexical_total_types > 0
                else 0
            ),
            "words": dict(
                sorted(
                    words_in_band.items(),
                    key=lambda item: item[1],
                    reverse=True
                )
            ),
        }

    outside_words = {
        word: freq
        for word, freq in student_lexical_counts.items()
        if word not in assigned_words
    }

    outside_token_count = sum(outside_words.values())
    outside_type_count = len(outside_words)

    band_results["lexical_outside_3500"] = {
        "token_count": outside_token_count,
        "token_percentage_lexical_words": (
            outside_token_count / lexical_total_tokens * 100
            if lexical_total_tokens > 0
            else 0
        ),
        "type_count": outside_type_count,
        "type_percentage_lexical_words": (
            outside_type_count / lexical_total_types * 100
            if lexical_total_types > 0
            else 0
        ),
        "words": dict(
            sorted(
                outside_words.items(),
                key=lambda item: item[1],
                reverse=True
            )
        ),
    }

    return band_results


def log_likelihood_g2(
    student_freq: int,
    student_total: int,
    reference_freq: int,
    reference_total: int
) -> float:
    """
    Calculate the log-likelihood G² value for one word.

    The raw G² value is always non-negative.
    Direction is added later using relative frequency comparison.
    """

    a = student_freq
    b = student_total - student_freq
    c = reference_freq
    d = reference_total - reference_freq

    if student_total <= 0 or reference_total <= 0:
        return 0.0

    total = a + b + c + d

    row1 = a + b
    row2 = c + d
    col1 = a + c
    col2 = b + d

    expected_a = row1 * col1 / total
    expected_b = row1 * col2 / total
    expected_c = row2 * col1 / total
    expected_d = row2 * col2 / total

    def term(observed: float, expected: float) -> float:
        if observed == 0 or expected == 0:
            return 0.0

        return observed * math.log(observed / expected)

    return 2 * (
        term(a, expected_a)
        + term(b, expected_b)
        + term(c, expected_c)
        + term(d, expected_d)
    )


def signed_log_likelihood(
    student_freq: int,
    student_total: int,
    reference_freq: int,
    reference_total: int
) -> float:
    """
    Positive signed LL means overused in the student essay.

    Negative signed LL means underused in the student essay.
    """

    g2 = log_likelihood_g2(
        student_freq=student_freq,
        student_total=student_total,
        reference_freq=reference_freq,
        reference_total=reference_total
    )

    student_relative_frequency = (
        student_freq / student_total
        if student_total > 0
        else 0
    )

    reference_relative_frequency = (
        reference_freq / reference_total
        if reference_total > 0
        else 0
    )

    if student_relative_frequency > reference_relative_frequency:
        return g2

    if student_relative_frequency < reference_relative_frequency:
        return -g2

    return 0.0


def classify_overuse_strength(signed_ll: float) -> str | None:
    """
    Classify positive signed LL values.

    Returns None if the word is not in the enrichment range.
    """

    if signed_ll >= VERY_STRONG_LL_THRESHOLD:
        return "very_strong"

    if signed_ll >= STRONG_LL_THRESHOLD:
        return "strong"

    if signed_ll >= MODERATE_LL_THRESHOLD:
        return "moderate"

    return None


def calculate_word_ll_scores(
    student_lexical_counts: Counter,
    reference_lexical_counts: Counter,
    frequency_bands: dict[str, set[str]]
) -> list[dict]:
    """
    Calculate signed LL scores for all lexical words in the student essay.
    """

    student_total = sum(student_lexical_counts.values())
    reference_total = sum(reference_lexical_counts.values())

    word_rows = []

    for word, student_freq in student_lexical_counts.items():
        reference_freq = reference_lexical_counts.get(word, 0)

        signed_ll = signed_log_likelihood(
            student_freq=student_freq,
            student_total=student_total,
            reference_freq=reference_freq,
            reference_total=reference_total
        )

        student_relative_frequency = (
            student_freq / student_total * 100
            if student_total > 0
            else 0
        )

        reference_relative_frequency = (
            reference_freq / reference_total * 100
            if reference_total > 0
            else 0
        )

        band = get_word_band(word, frequency_bands)

        word_rows.append({
            "word": word,
            "band": band,
            "student_frequency": student_freq,
            "student_relative_frequency_pct": student_relative_frequency,
            "reference_frequency": reference_freq,
            "reference_relative_frequency_pct": reference_relative_frequency,
            "signed_log_likelihood": signed_ll,
        })

    return sorted(
        word_rows,
        key=lambda row: row["signed_log_likelihood"],
        reverse=True
    )


def get_word_band(word: str, frequency_bands: dict[str, set[str]]) -> str:
    if word in frequency_bands["top_1000"]:
        return "top_1000"

    if word in frequency_bands["range_1001_2000"]:
        return "range_1001_2000"

    if word in frequency_bands["range_2001_3500"]:
        return "range_2001_3500"

    return "lexical_outside_3500"


def identify_words_for_enrichment(
    word_ll_rows: list[dict],
    min_frequency: int = MIN_ENRICHMENT_FREQUENCY
) -> list[dict]:
    """
    Select words for enrichment.

    Criteria:
    1. word is in top-1000 lexical band;
    2. word appears at least min_frequency times;
    3. signed LL is positive and reaches at least moderate overuse.
    """

    candidates = []

    for row in word_ll_rows:
        if row["band"] != "top_1000":
            continue

        if row["student_frequency"] < min_frequency:
            continue

        strength = classify_overuse_strength(row["signed_log_likelihood"])

        if strength is None:
            continue

        candidate = dict(row)
        candidate["overuse_strength"] = strength
        candidates.append(candidate)

    return sorted(
        candidates,
        key=lambda row: (
            row["signed_log_likelihood"],
            row["student_frequency"]
        ),
        reverse=True
    )


def run_vocabulary_analysis(
    essay_text: str,
    word_counts_file: str = WORD_COUNTS_FILE
) -> dict:
    essay_words = get_clean_words(essay_text)

    student_all_counts = Counter(essay_words)
    student_function_counts = Counter({
        word: freq
        for word, freq in student_all_counts.items()
        if word in COMMON_FUNCTION_WORDS
    })

    student_lexical_counts = count_student_lexical_words(
        essay_words,
        COMMON_FUNCTION_WORDS
    )

    reference_all_counts = load_word_counts(word_counts_file)
    reference_lexical_counts = remove_function_words(
        reference_all_counts,
        COMMON_FUNCTION_WORDS
    )

    frequency_bands = create_frequency_bands(reference_lexical_counts)

    band_results = assign_words_to_bands(
        student_lexical_counts,
        frequency_bands
    )

    word_ll_rows = calculate_word_ll_scores(
        student_lexical_counts=student_lexical_counts,
        reference_lexical_counts=reference_lexical_counts,
        frequency_bands=frequency_bands
    )

    enrichment_candidates = identify_words_for_enrichment(word_ll_rows)

    lexical_total_tokens = sum(student_lexical_counts.values())
    lexical_total_types = len(student_lexical_counts)

    return {
        "summary": {
            "total_tokens_all_words": len(essay_words),
            "total_types_all_words": len(student_all_counts),
            "function_word_tokens_removed": sum(student_function_counts.values()),
            "function_word_types_removed": len(student_function_counts),
            "lexical_tokens": lexical_total_tokens,
            "lexical_types": lexical_total_types,
        },
        "band_results": band_results,
        "word_log_likelihood_scores": word_ll_rows,
        "enrichment_candidates": enrichment_candidates,
    }


def print_vocabulary_analysis(analysis: dict) -> None:
    print("Vocabulary summary")
    print("------------------")

    summary = analysis["summary"]

    print(f"Total tokens, all words: {summary['total_tokens_all_words']}")
    print(f"Total types, all words: {summary['total_types_all_words']}")
    print(f"Function-word tokens removed: {summary['function_word_tokens_removed']}")
    print(f"Function-word types removed: {summary['function_word_types_removed']}")
    print(f"Lexical tokens: {summary['lexical_tokens']}")
    print(f"Lexical types: {summary['lexical_types']}")
    print()

    print("Lexical frequency bands")
    print("-----------------------")

    for band_name, band_data in analysis["band_results"].items():
        print(band_name)
        print(f"  Tokens: {band_data['token_count']}")
        print(
            "  Token % of lexical words: "
            f"{band_data['token_percentage_lexical_words']:.2f}%"
        )
        print(f"  Types: {band_data['type_count']}")
        print(
            "  Type % of lexical words: "
            f"{band_data['type_percentage_lexical_words']:.2f}%"
        )

        print("  Most frequent words:")
        for word, freq in list(band_data["words"].items())[:20]:
            print(f"    {word}: {freq}")

        print()

    print("Words for vocabulary enrichment")
    print("-------------------------------")
    print(
        "Criteria: top-1000 lexical word, "
        f"frequency >= {MIN_ENRICHMENT_FREQUENCY}, "
        f"signed LL >= {MODERATE_LL_THRESHOLD}"
    )
    print()

    candidates = analysis["enrichment_candidates"]

    if not candidates:
        print("No words met the enrichment criteria.")
        print()
    else:
        for item in candidates:
            print(f"Word: {item['word']}")
            print(f"  Strength: {item['overuse_strength']}")
            print(f"  Student frequency: {item['student_frequency']}")
            print(
                "  Student relative frequency: "
                f"{item['student_relative_frequency_pct']:.3f}%"
            )
            print(f"  Reference frequency: {item['reference_frequency']}")
            print(
                "  Reference relative frequency: "
                f"{item['reference_relative_frequency_pct']:.3f}%"
            )
            print(
                "  Signed log likelihood: "
                f"{item['signed_log_likelihood']:.2f}"
            )
            print()

    print("All lexical word LL scores")
    print("--------------------------")

    for item in analysis["word_log_likelihood_scores"]:
        print(
            f"{item['word']}\t"
            f"{item['band']}\t"
            f"student_freq={item['student_frequency']}\t"
            f"student_pct={item['student_relative_frequency_pct']:.3f}\t"
            f"ref_freq={item['reference_frequency']}\t"
            f"ref_pct={item['reference_relative_frequency_pct']:.3f}\t"
            f"signed_LL={item['signed_log_likelihood']:.2f}"
        )


def main() -> None:
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--model_path",
        required=True,
        help="Path to GGUF model"
    )

    parser.add_argument(
        "--model",
        required=True,
        help="Name of model: bonsai, gemma",
        choices=["bonsai", "gemma"]
    )

    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)

    parser.add_argument(
        "--cache-k",
        default="turbo3",
        choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"]
    )

    parser.add_argument(
        "--cache-v",
        default="turbo3",
        choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"]
    )

    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)

    args = parser.parse_args()

    llama_server = select_server_for_model(args.model)
    jinja = select_jinja(args.model)

    cmd_extra = []

    if args.model == "gemma":
        cmd_extra = [
            "--reasoning", "off",
            "--reasoning-budget", "0",
            "--jinja",
            "--chat-template-file", str(jinja),
        ]

    cmd = [
        str(llama_server),
        "-m", str(Path(args.model_path).resolve()),
        "--port", str(args.port),
        "-c", str(args.ctx),
        "--cache-type-k", args.cache_k,
        "--cache-type-v", args.cache_v,
        "--flash-attn", "on",
        "--n-gpu-layers", str(args.n_gpu_layers),
    ]

    cmd.extend(cmd_extra)

    print("Starting server:")
    print(" ".join(cmd))

    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"

    try:
        wait_for_server(base_url)

        writing_path = "experiments/essay_examples/w4.md"

        identified_paragraphs = identify_paragraphs(
            writing_path,
            "experiments/tasks_vocabulary/essay_knowledge.md",
            "experiments/tasks_vocabulary/identify_paragraphs_references.md",
            base_url,
            args.max_tokens,
            args.temp
        )

        print(json.dumps(identified_paragraphs, indent=2))

        essay_paragraphs = identified_paragraphs["choices"][0]["message"]["content"]
        essay_paragraphs = json.loads(essay_paragraphs)

        introduction = essay_paragraphs["introduction_paragraph"]
        body_paragraphs = essay_paragraphs["body_paragraphs"]["items"]
        conclusion = essay_paragraphs["conclusion_paragraph"]

        essay_only = introduction

        for body_paragraph in body_paragraphs:
            essay_only += "\n" + body_paragraph["body_paragraph"]

        essay_only += "\n" + conclusion + "\n"

        analysis = run_vocabulary_analysis(
            essay_text=essay_only,
            word_counts_file=WORD_COUNTS_FILE
        )

       #  print_vocabulary_analysis(analysis)

        top_15_high_ll_top_1000_freq_3 = [
            row
            for row in analysis["word_log_likelihood_scores"]
            if row["band"] == "top_1000"
            and row["student_frequency"] >= 3
            and row["signed_log_likelihood"] > 0
        ][:15]

        print("Top 15 high-LL top-1000 lexical words with frequency >= 3")
        print("----------------------------------------------------------")
        i = 0
        initial_task = "Look for the following words in the essay: "
        for row in top_15_high_ll_top_1000_freq_3:
            if i == 2:
                initial_task = initial_task + row['word'] + "."
                enhancements = enhance_vocabulary(essay_only, "experiments/tasks_vocabulary/vocabulary_enrichment_knowledge.md", initial_task, "experiments/tasks_vocabulary/vocabulary_enrichment_task.md", base_url, args.max_tokens, args.temp)
                i = 0
                initial_task = "Look for the following words in the essay: "
                print(json.dumps(enhancements))
            else:
                initial_task = initial_task + row['word'] + ", "
                i += 1
            
            print(
                f"{row['word']}\t"
                f"freq={row['student_frequency']}\t"
                f"student_pct={row['student_relative_frequency_pct']:.3f}\t"
                f"ref_pct={row['reference_relative_frequency_pct']:.3f}\t"
                f"signed_LL={row['signed_log_likelihood']:.2f}"
            )

    finally:
        proc.terminate()

        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()

# To run a quick experiment
# With Ternary Bonsai:
# python experiments/main_essay_vocabulary.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/Ternary-Bonsai-8B-Q2_0.gguf" --model "bonsai" --cache-k="f16" --cache-v="f16" --max-tokens 2048

# With Gemma 4
# python experiments/main_essay_vocabulary.py --model_path "/Users/danielparsons/Documents/Development/EssayLens/assets/models/gemma-4-E4B-it-Q4_K_M.gguf" --model "gemma" --cache-k turbo3 --cache-v turbo3 --max-tokens 2048
# - Change line 54 to llama_server = select_server_for_model("bonsai")
# python experiments/main_essay_vocabulary.py --model "/path/to/assets/model/gemma-4-E4B-it-Q4_K_M.gguf" --cache-k turbo3 --cache-v turbo3