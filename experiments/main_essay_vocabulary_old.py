from __future__ import annotations
import json
import subprocess
import argparse
import time
from pathlib import Path
import string
import csv
from collections import Counter

from essay_analysis_vocabulary import identify_paragraphs

import requests

def wait_for_server(base_url: str, timeout_s: float = 60.0) -> None:
    deadline = time.time() + timeout_s
    health_url = f"{base_url}/health"
    while time.time() < deadline:
        try:
            r = requests.get(health_url, timeout=2)
            if r.ok:
                return
        except requests.RequestException:
            pass
        time.sleep(0.5)
    raise TimeoutError(f"Server did not become healthy in {timeout_s}s: {health_url}")

def get_prompts(system_prompt_knowledge_path: str, system_prompt_task_path: str, user_prompt_path: str) -> tuple[str, str]:
    repo_root = Path(__file__).resolve().parents[1]
    system_prompt_task_path = repo_root / system_prompt_task_path
    system_prompt_knowledge_path = repo_root / system_prompt_knowledge_path
    user_prompt_path = repo_root / user_prompt_path

    system_prompt_knowledge = system_prompt_knowledge_path.read_text(encoding="utf-8")
    system_prompt_task = system_prompt_task_path.read_text(encoding="utf-8")
    system_prompt = system_prompt_knowledge + "\n" + system_prompt_task
    user_content = user_prompt_path.read_text(encoding="utf-8")

    return (system_prompt, user_content)

def select_server_for_model(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model == "gemma":
        return repo_root / "third_party_new" / "llama-cpp-turboquant" / "build" / "bin" / "llama-server"
    if model == "bonsai":
        return repo_root / "third_party_prismml" / "llama-cpp" / "build" / "bin" / "llama-server"
    
def select_jinja(model: str) -> Path:
    repo_root = Path(__file__).resolve().parents[1]
    if model =="gemma":
        return repo_root / "assets" / "models" / "gemma_4_chat_template.jinja"


def main() -> None:
    # Set up arguments for command line
    parser = argparse.ArgumentParser()
    parser.add_argument("--model_path", required=True, help="Path to GGUF model")
    parser.add_argument("--model", required=True, help="Name of model: bonsai, gemma", choices=["bonsai", "gemma"])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--ctx", type=int, default=8192)
    parser.add_argument("--cache-k", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--cache-v", default="turbo3", choices=["f32", "f16", "bf16", "q8_0", "q4_0", "turbo2", "turbo3", "turbo4"])
    parser.add_argument("--n-gpu-layers", type=int, default=99)
    parser.add_argument("--max-tokens", type=int, default=512)
    parser.add_argument("--temp", type=float, default=0.7)
    args = parser.parse_args()

    # File path to server
    llama_server = select_server_for_model(args.model)
    jinja = select_jinja(args.model)
    cmd_extra = []
    if args.model=="gemma":
        # Set thinking to 0 for gemma
        cmd_extra = ["--reasoning", "off", "--reasoning-budget", "0", "--jinja", "--chat-template-file", str(jinja)]

    # Basic server settings
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

    # Extra model-dependent flags
    cmd.extend(cmd_extra)
    print(cmd)


    # Start the server
    print("Starting server:\n", " ".join(cmd))
    proc = subprocess.Popen(cmd)
    base_url = f"http://127.0.0.1:{args.port}"

    try:
        wait_for_server(base_url)
        writing_path = "experiments/essay_examples/w4.md"
        
        identified_paragraphs = identify_paragraphs(writing_path, "experiments/tasks_vocabulary/essay_knowledge.md", "experiments/tasks_vocabulary/identify_paragraphs_references.md", base_url, args.max_tokens, args.temp)
        print(json.dumps(identified_paragraphs, indent=2))
        essay_paragraphs = identified_paragraphs["choices"][0]["message"]["content"]
        essay_paragraphs = json.loads(essay_paragraphs)
        
        # Introduction
        introduction = essay_paragraphs["introduction_paragraph"]

        # Body paragraphs
        body_paragraphs = essay_paragraphs["body_paragraphs"]["items"]

        # Conclusion paragraph
        conclusion = essay_paragraphs["conclusion_paragraph"]

        # References section
        references = essay_paragraphs["references_section"]

        # Essay main idea
        full_essay = introduction
        for bp in body_paragraphs:
            full_essay = full_essay + "\n" +  bp["body_paragraph"]
        
        essay_only = full_essay + "\n" + conclusion + "\n"
        full_essay = essay_only + "\n" + references


        # Vocabulary analysis
        # First, get the list of words, word pairs and triplets.
        WORD_COUNTS_FILE = "experiments/word_freq_data/word_counts.csv"
        raw_words = full_essay.split()

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
        
        # Cleaning
        def contains_punctuation(word):
            return any(char in string.punctuation for char in word)
        
        def remove_punctuation(word):
            return "".join(
                char for char in word
                if char not in string.punctuation
            )
        
        def clean_word(word):
            return remove_punctuation(word).lower().strip()
        
        def get_clean_words(text):
            raw_words = text.split()
            words = [
                clean_word(word)
                for word in raw_words
            ]

            # Remove empty strings caused by punctuatioin only tokens
            words = [
                word for word in words
                if word
            ]

            return words
        
        # Word list loading
        def load_ranked_words(filepath, function_words):
            ranked_words = []
            with open(filepath, "r", newline="", encoding="utf-8") as infile:
                reader = csv.DictReader(infile)
                for row in reader:
                    word = row["word"].lower().strip()

                    if not word:
                        continue

                    if word in function_words:
                        continue

                    ranked_words.append(word)

            return ranked_words
        
        def create_frequency_bands(ranked_words):
            return {
                "top_1000": set(ranked_words[:1000]),
                "range_1001_2000": set(ranked_words[1000:2000]),
                "range_2001_3500": set(ranked_words[2000:3500]),
            }


        def analyse_essay_words_with_function_exclusion(words, frequency_bands, function_words):
            total_tokens = len(words)
            essay_word_counts = Counter(words)
            total_types = len(essay_word_counts)

            function_word_counts = {
                word: freq
                for word, freq in essay_word_counts.items()
                if word in function_words
            }

            lexical_word_counts = {
                word: freq
                for word, freq in essay_word_counts.items()
                if word not in function_words
            }

            lexical_total_tokens = sum(lexical_word_counts.values())
            lexical_total_types = len(lexical_word_counts)

            results = {}

            function_token_count = sum(function_word_counts.values())
            function_type_count = len(function_word_counts)

            results["function_words_excluded"] = {
                "token_count": function_token_count,
                "token_percentage_all_words": (
                    function_token_count / total_tokens * 100
                    if total_tokens > 0
                    else 0
                ),
                "token_percentage_lexical_words": None,
                "type_count": function_type_count,
                "type_percentage_all_words": (
                    function_type_count / total_types * 100
                    if total_types > 0
                    else 0
                ),
                "type_percentage_lexical_words": None,
                "words": dict(
                    sorted(
                        function_word_counts.items(),
                        key=lambda item: item[1],
                        reverse=True
                    )
                ),
            }

            assigned_lexical_words = set()

            for band_name, band_words in frequency_bands.items():
                words_in_band = {
                    word: freq
                    for word, freq in lexical_word_counts.items()
                    if word in band_words
                }

                assigned_lexical_words.update(words_in_band.keys())

                token_count = sum(words_in_band.values())
                type_count = len(words_in_band)

                results[band_name] = {
                    "token_count": token_count,
                    "token_percentage_all_words": (
                        token_count / total_tokens * 100
                        if total_tokens > 0
                        else 0
                    ),
                    "token_percentage_lexical_words": (
                        token_count / lexical_total_tokens * 100
                        if lexical_total_tokens > 0
                        else 0
                    ),
                    "type_count": type_count,
                    "type_percentage_all_words": (
                        type_count / total_types * 100
                        if total_types > 0
                        else 0
                    ),
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
                for word, freq in lexical_word_counts.items()
                if word not in assigned_lexical_words
            }

            outside_token_count = sum(outside_words.values())
            outside_type_count = len(outside_words)

            results["lexical_outside_3500"] = {
                "token_count": outside_token_count,
                "token_percentage_all_words": (
                    outside_token_count / total_tokens * 100
                    if total_tokens > 0
                    else 0
                ),
                "token_percentage_lexical_words": (
                    outside_token_count / lexical_total_tokens * 100
                    if lexical_total_tokens > 0
                    else 0
                ),
                "type_count": outside_type_count,
                "type_percentage_all_words": (
                    outside_type_count / total_types * 100
                    if total_types > 0
                    else 0
                ),
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

            lower_frequency_token_count = (
                results["range_1001_2000"]["token_count"]
                + results["range_2001_3500"]["token_count"]
                + results["lexical_outside_3500"]["token_count"]
            )

            lower_frequency_type_count = (
                results["range_1001_2000"]["type_count"]
                + results["range_2001_3500"]["type_count"]
                + results["lexical_outside_3500"]["type_count"]
            )

            summary = {
                "total_tokens_all_words": total_tokens,
                "total_types_all_words": total_types,
                "lexical_total_tokens": lexical_total_tokens,
                "lexical_total_types": lexical_total_types,
                "function_token_count": function_token_count,
                "function_type_count": function_type_count,
                "function_token_percentage": (
                    function_token_count / total_tokens * 100
                    if total_tokens > 0
                    else 0
                ),
                "lexical_token_percentage": (
                    lexical_total_tokens / total_tokens * 100
                    if total_tokens > 0
                    else 0
                ),
                "lexical_type_token_ratio": (
                    lexical_total_types / lexical_total_tokens
                    if lexical_total_tokens > 0
                    else 0
                ),
                "lower_frequency_lexical_token_count": lower_frequency_token_count,
                "lower_frequency_lexical_token_percentage": (
                    lower_frequency_token_count / lexical_total_tokens * 100
                    if lexical_total_tokens > 0
                    else 0
                ),
                "lower_frequency_lexical_type_count": lower_frequency_type_count,
                "lower_frequency_lexical_type_percentage": (
                    lower_frequency_type_count / lexical_total_types * 100
                    if lexical_total_types > 0
                    else 0
                ),
            }

            return summary, results

        ranked_words = load_ranked_words(WORD_COUNTS_FILE, COMMON_FUNCTION_WORDS)
        frequency_bands = create_frequency_bands(ranked_words)
        essay_words = get_clean_words(essay_only)
        
        summary, results = analyse_essay_words_with_function_exclusion(
            essay_words,
            frequency_bands,
            COMMON_FUNCTION_WORDS
        )

        print("Summary")
        print(f"Total tokens, all words: {summary['total_tokens_all_words']}")
        print(f"Total types, all words: {summary['total_types_all_words']}")
        print(f"Lexical tokens: {summary['lexical_total_tokens']}")
        print(f"Lexical types: {summary['lexical_total_types']}")
        print(f"Function-word tokens excluded: {summary['function_token_count']}")
        print(f"Function-word token percentage: {summary['function_token_percentage']:.2f}%")
        print(f"Lexical token percentage: {summary['lexical_token_percentage']:.2f}%")
        print(f"Lexical TTR: {summary['lexical_type_token_ratio']:.3f}")
        print(
            "Lower-frequency lexical token percentage: "
            f"{summary['lower_frequency_lexical_token_percentage']:.2f}%"
        )
        print(
            "Lower-frequency lexical type percentage: "
            f"{summary['lower_frequency_lexical_type_percentage']:.2f}%"
        )

        print()

        for band_name, result in results.items():
            print(band_name)
            print(f"  Tokens: {result['token_count']}")

            print(
                "  Token % of all words: "
                f"{result['token_percentage_all_words']:.2f}%"
            )

            if result["token_percentage_lexical_words"] is not None:
                print(
                    "  Token % of lexical words: "
                    f"{result['token_percentage_lexical_words']:.2f}%"
                )

            print(f"  Types: {result['type_count']}")

            print(
                "  Type % of all words: "
                f"{result['type_percentage_all_words']:.2f}%"
            )

            if result["type_percentage_lexical_words"] is not None:
                print(
                    "  Type % of lexical words: "
                    f"{result['type_percentage_lexical_words']:.2f}%"
                )

            print("  Most frequent words:")
            for word, freq in list(result["words"].items())[:20]:
                print(f"    {word}: {freq}")

            print()

        # Decision making
        def decide_vocabulary_enrichment(summary, results):
            """
            Returns a decision about whether the student's vocabulary likely needs enrichment.

            Assumes function words have already been excluded from the lexical bands.
            """

            lexical_top_1000_token_pct = results["top_1000"]["token_percentage_lexical_words"]
            lexical_top_1000_type_pct = results["top_1000"]["type_percentage_lexical_words"]

            lower_freq_token_pct = summary["lower_frequency_lexical_token_percentage"]
            lower_freq_type_pct = summary["lower_frequency_lexical_type_percentage"]

            lexical_ttr = summary["lexical_type_token_ratio"]

            lexical_total_tokens = summary["lexical_total_tokens"]
            lexical_total_types = summary["lexical_total_types"]

            # Count repeated common lexical words in the top 1000 band.
            # These are words from the student's essay, not the reference corpus.
            top_1000_words = results["top_1000"]["words"]

            top_repeated_lexical_words = [
                (word, freq)
                for word, freq in top_1000_words.items()
                if freq >= 3
            ]

            repeated_top_1000_count = sum(
                freq for word, freq in top_repeated_lexical_words
            )

            repeated_top_1000_pct = (
                repeated_top_1000_count / lexical_total_tokens * 100
                if lexical_total_tokens > 0
                else 0
            )

            risk_points = 0
            reasons = []

            # Main range signal
            if lower_freq_type_pct < 25:
                risk_points += 2
                reasons.append(
                    "Low proportion of distinct lower-frequency lexical words."
                )
            elif lower_freq_type_pct < 35:
                risk_points += 1
                reasons.append(
                    "Moderate but limited lower-frequency lexical range."
                )

            # Over-reliance on common content vocabulary
            if lexical_top_1000_type_pct > 70:
                risk_points += 2
                reasons.append(
                    "Most distinct lexical words come from the top 1000 band."
                )
            elif lexical_top_1000_type_pct > 60:
                risk_points += 1
                reasons.append(
                    "A relatively high share of lexical types comes from the top 1000 band."
                )

            if lexical_top_1000_token_pct > 75:
                risk_points += 1
                reasons.append(
                    "Most lexical tokens are from the top 1000 band."
                )

            # Repetition signal
            if repeated_top_1000_pct > 35:
                risk_points += 2
                reasons.append(
                    "A large share of the essay repeats common lexical words."
                )
            elif repeated_top_1000_pct > 25:
                risk_points += 1
                reasons.append(
                    "There is some repetition of common lexical words."
                )

            # Essay length-sensitive TTR warning.
            # This is only a rough signal; TTR naturally decreases as text length increases.
            if lexical_total_tokens >= 150 and lexical_ttr < 0.40:
                risk_points += 1
                reasons.append(
                    "Lexical type-token ratio is low for a text of this length."
                )

            if risk_points >= 5:
                decision = "vocabulary_enrichment_needed"
            elif risk_points >= 3:
                decision = "targeted_vocabulary_feedback_recommended"
            else:
                decision = "vocabulary_enrichment_not_primary_issue"

            return {
                "decision": decision,
                "risk_points": risk_points,
                "reasons": reasons,
                "diagnostics": {
                    "lexical_top_1000_token_pct": lexical_top_1000_token_pct,
                    "lexical_top_1000_type_pct": lexical_top_1000_type_pct,
                    "lower_frequency_lexical_token_pct": lower_freq_token_pct,
                    "lower_frequency_lexical_type_pct": lower_freq_type_pct,
                    "lexical_ttr": lexical_ttr,
                    "repeated_top_1000_pct": repeated_top_1000_pct,
                    "top_repeated_lexical_words": top_repeated_lexical_words[:20],
                }
            }
        
        decision = decide_vocabulary_enrichment(summary, results)
        print("Vocabulary decision:")
        print(decision["decision"])
        print(f"Risk points: {decision['risk_points']}")
        print()

        print("Reasons:")
        for reason in decision["reasons"]:
            print(f"- {reason}")

        print()

        print("Diagnostics:")
        for key, value in decision["diagnostics"].items():
            print(f"{key}: {value}")

        word_pairs = [
            " ".join(remove_punctuation(word) for word in raw_words[i:i+2])
            for i in range(len(raw_words) - 1)
            if not any(contains_punctuation(word) for word in raw_words[i:i+2])
        ]

        word_triplets = [
            " ".join(remove_punctuation(word) for word in raw_words[i:i+3])
            for i in range(len(raw_words) - 2)
            if not any(contains_punctuation(word) for word in raw_words[i:i+3])
        ]

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
