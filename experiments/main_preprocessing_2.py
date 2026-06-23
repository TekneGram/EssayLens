import csv
import math
from pathlib import Path

# -----------------------------
# Configuration
# -----------------------------

OUTPUT_FOLDER = "experiments/word_freq_data"

WORD_COUNTS_FILE = "word_counts.csv"
PAIR_COUNTS_FILE = "word_pair_counts.csv"

PAIR_LOGDICE_OUTPUT = "word_pair_logdice.csv"

MIN_PAIR_FREQ = 5
MIN_WORD_FREQ = 1


# -----------------------------
# CSV loading
# -----------------------------

def load_counts_csv(filepath, key_column, freq_column="freq"):
    """
    Load a CSV file into a dictionary:
        item -> frequency
    """
    counts = {}

    with open(filepath, "r", newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)

        for row in reader:
            key = row[key_column]
            freq = int(row[freq_column])
            counts[key] = freq

    return counts


# -----------------------------
# Pair logDice scoring
# -----------------------------

def calculate_pair_logdice(word_counts, pair_counts):
    """
    Calculate logDice for each word pair.

    logDice = 14 + log2((2 * pair_freq) / (word1_freq + word2_freq))
    """
    scored_pairs = []

    for pair, pair_freq in pair_counts.items():
        if pair_freq < MIN_PAIR_FREQ:
            continue

        parts = pair.split()

        if len(parts) != 2:
            continue

        word1, word2 = parts

        word1_freq = word_counts.get(word1, 0)
        word2_freq = word_counts.get(word2, 0)

        if word1_freq < MIN_WORD_FREQ or word2_freq < MIN_WORD_FREQ:
            continue

        denominator = word1_freq + word2_freq

        if denominator <= 0:
            continue

        logdice = 14 + math.log2(
            (2 * pair_freq) / denominator
        )

        scored_pairs.append({
            "word_pair": pair,
            "word1": word1,
            "word2": word2,
            "pair_freq": pair_freq,
            "word1_freq": word1_freq,
            "word2_freq": word2_freq,
            "logdice": logdice,
        })

    return scored_pairs


# -----------------------------
# CSV output
# -----------------------------

def write_pair_logdice_to_csv(scored_pairs, filepath):
    """
    Write pair logDice scores to CSV, sorted by logDice descending.
    """
    scored_pairs = sorted(
        scored_pairs,
        key=lambda row: row["logdice"],
        reverse=True
    )

    fieldnames = [
        "word_pair",
        "word1",
        "word2",
        "pair_freq",
        "word1_freq",
        "word2_freq",
        "logdice",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        for row in scored_pairs:
            writer.writerow({
                "word_pair": row["word_pair"],
                "word1": row["word1"],
                "word2": row["word2"],
                "pair_freq": row["pair_freq"],
                "word1_freq": row["word1_freq"],
                "word2_freq": row["word2_freq"],
                "logdice": round(row["logdice"], 6),
            })


# -----------------------------
# Main script
# -----------------------------

def main():
    output_path = Path(OUTPUT_FOLDER)

    word_counts = load_counts_csv(
        output_path / WORD_COUNTS_FILE,
        key_column="word"
    )

    pair_counts = load_counts_csv(
        output_path / PAIR_COUNTS_FILE,
        key_column="word_pair"
    )

    scored_pairs = calculate_pair_logdice(
        word_counts,
        pair_counts
    )

    write_pair_logdice_to_csv(
        scored_pairs,
        output_path / PAIR_LOGDICE_OUTPUT
    )

    print("Done.")
    print(f"Total unique words: {len(word_counts):,}")
    print(f"Total unique word pairs: {len(pair_counts):,}")
    print(f"Scored word pairs: {len(scored_pairs):,}")
    print(f"Written to: {output_path / PAIR_LOGDICE_OUTPUT}")


if __name__ == "__main__":
    main()