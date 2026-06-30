import csv
import math
from pathlib import Path

# -----------------------------
# Configuration
# -----------------------------

OUTPUT_FOLDER = "experiments/word_freq_data"

WORD_COUNTS_FILE = "word_counts.csv"
TRIPLET_COUNTS_FILE = "word_triplet_counts.csv"

TRIPLET_LOGDICE_OUTPUT = "word_triplet_logdice.csv"

MIN_TRIPLET_FREQ = 5
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
# Triplet logDice scoring
# -----------------------------

def calculate_triplet_logdice(word_counts, triplet_counts):
    """
    Calculate a logDice-style score for each word triplet.

    logDice3 = 14 + log2(
        (3 * triplet_freq) / (word1_freq + word2_freq + word3_freq)
    )

    This is a practical trigram extension of the pair logDice formula.
    """
    scored_triplets = []

    for triplet, triplet_freq in triplet_counts.items():
        if triplet_freq < MIN_TRIPLET_FREQ:
            continue

        parts = triplet.split()

        if len(parts) != 3:
            continue

        word1, word2, word3 = parts

        word1_freq = word_counts.get(word1, 0)
        word2_freq = word_counts.get(word2, 0)
        word3_freq = word_counts.get(word3, 0)

        if (
            word1_freq < MIN_WORD_FREQ
            or word2_freq < MIN_WORD_FREQ
            or word3_freq < MIN_WORD_FREQ
        ):
            continue

        denominator = word1_freq + word2_freq + word3_freq

        if denominator <= 0:
            continue

        logdice = 14 + math.log2(
            (3 * triplet_freq) / denominator
        )

        scored_triplets.append({
            "word_triplet": triplet,
            "word1": word1,
            "word2": word2,
            "word3": word3,
            "triplet_freq": triplet_freq,
            "word1_freq": word1_freq,
            "word2_freq": word2_freq,
            "word3_freq": word3_freq,
            "logdice": logdice,
        })

    return scored_triplets


# -----------------------------
# CSV output
# -----------------------------

def write_triplet_logdice_to_csv(scored_triplets, filepath):
    """
    Write triplet logDice scores to CSV, sorted by logDice descending.
    """
    scored_triplets = sorted(
        scored_triplets,
        key=lambda row: row["logdice"],
        reverse=True
    )

    fieldnames = [
        "word_triplet",
        "word1",
        "word2",
        "word3",
        "triplet_freq",
        "word1_freq",
        "word2_freq",
        "word3_freq",
        "logdice",
    ]

    with open(filepath, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()

        for row in scored_triplets:
            writer.writerow({
                "word_triplet": row["word_triplet"],
                "word1": row["word1"],
                "word2": row["word2"],
                "word3": row["word3"],
                "triplet_freq": row["triplet_freq"],
                "word1_freq": row["word1_freq"],
                "word2_freq": row["word2_freq"],
                "word3_freq": row["word3_freq"],
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

    triplet_counts = load_counts_csv(
        output_path / TRIPLET_COUNTS_FILE,
        key_column="word_triplet"
    )

    scored_triplets = calculate_triplet_logdice(
        word_counts,
        triplet_counts
    )

    write_triplet_logdice_to_csv(
        scored_triplets,
        output_path / TRIPLET_LOGDICE_OUTPUT
    )

    print("Done.")
    print(f"Total unique words: {len(word_counts):,}")
    print(f"Total unique word triplets: {len(triplet_counts):,}")
    print(f"Scored word triplets: {len(scored_triplets):,}")
    print(f"Written to: {output_path / TRIPLET_LOGDICE_OUTPUT}")


if __name__ == "__main__":
    main()