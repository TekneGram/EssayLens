import csv
from pathlib import Path

# -----------------------------
# Configuration
# -----------------------------

OUTPUT_FOLDER = "experiments/word_freq_data"

INPUT_FILE = "word_triplet_collocations.csv"
OUTPUT_FILE = "word_triplet_collocations_filtered.csv"

# Frequency filters
MIN_TRIPLET_FREQ = 5
MAX_TRIPLET_FREQ = None       # set to an integer if needed, e.g. 25000

MIN_WORD_FREQ = 5
MAX_WORD_FREQ = 500_000       # helps remove very common function-word-heavy triplets

# Score filters
MIN_MI = 5.0
MIN_T_SCORE = 2.0

# Keep only the top N after filtering.
# Set to None to keep everything.
TOP_N = None


# -----------------------------
# Helpers
# -----------------------------

def to_int(value, default=0):
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def to_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize(value, min_value, max_value):
    if max_value == min_value:
        return 0.0

    return (value - min_value) / (max_value - min_value)


def load_rows(filepath):
    with open(filepath, "r", newline="", encoding="utf-8") as infile:
        reader = csv.DictReader(infile)
        return list(reader)


def passes_triplet_filters(row):
    triplet_freq = to_int(row.get("observed_freq"))

    word1_freq = to_int(row.get("word1_freq"))
    word2_freq = to_int(row.get("word2_freq"))
    word3_freq = to_int(row.get("word3_freq"))

    mi = to_float(row.get("mutual_information"))
    t_score = to_float(row.get("t_score"))

    if triplet_freq < MIN_TRIPLET_FREQ:
        return False

    if MAX_TRIPLET_FREQ is not None and triplet_freq > MAX_TRIPLET_FREQ:
        return False

    if (
        word1_freq < MIN_WORD_FREQ
        or word2_freq < MIN_WORD_FREQ
        or word3_freq < MIN_WORD_FREQ
    ):
        return False

    if (
        word1_freq > MAX_WORD_FREQ
        or word2_freq > MAX_WORD_FREQ
        or word3_freq > MAX_WORD_FREQ
    ):
        return False

    if mi < MIN_MI:
        return False

    if t_score < MIN_T_SCORE:
        return False

    return True


def add_combined_score(rows):
    """
    Adds a combined score using normalized MI and normalized t-score.

    This rewards triplets that are reasonably strong on both measures.
    """
    if not rows:
        return rows

    mi_values = [
        to_float(row.get("mutual_information"))
        for row in rows
    ]

    t_values = [
        to_float(row.get("t_score"))
        for row in rows
    ]

    min_mi = min(mi_values)
    max_mi = max(mi_values)

    min_t = min(t_values)
    max_t = max(t_values)

    for row in rows:
        mi = to_float(row.get("mutual_information"))
        t_score = to_float(row.get("t_score"))

        normalized_mi = normalize(mi, min_mi, max_mi)
        normalized_t = normalize(t_score, min_t, max_t)

        if normalized_mi + normalized_t == 0:
            combined_score = 0.0
        else:
            combined_score = (
                2 * normalized_mi * normalized_t
            ) / (
                normalized_mi + normalized_t
            )

        row["combined_score"] = f"{combined_score:.6f}"

    return rows


def write_rows(filepath, rows, fieldnames):
    with open(filepath, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


# -----------------------------
# Main script
# -----------------------------

def main():
    output_path = Path(OUTPUT_FOLDER)

    input_path = output_path / INPUT_FILE
    output_file_path = output_path / OUTPUT_FILE

    rows = load_rows(input_path)

    filtered_rows = [
        row for row in rows
        if passes_triplet_filters(row)
    ]

    filtered_rows = add_combined_score(filtered_rows)

    filtered_rows.sort(
        key=lambda row: to_float(row.get("combined_score")),
        reverse=True
    )

    if TOP_N is not None:
        filtered_rows = filtered_rows[:TOP_N]

    fieldnames = [
        "word_triplet",
        "word1",
        "word2",
        "word3",
        "observed_freq",
        "word1_freq",
        "word2_freq",
        "word3_freq",
        "expected_freq",
        "mutual_information",
        "t_score",
        "combined_score",
    ]

    write_rows(
        output_file_path,
        filtered_rows,
        fieldnames
    )

    print("Done.")
    print(f"Input rows: {len(rows):,}")
    print(f"Filtered rows: {len(filtered_rows):,}")
    print(f"Written to: {output_file_path}")


if __name__ == "__main__":
    main()