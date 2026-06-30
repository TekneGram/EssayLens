import csv
import string
from pathlib import Path
from collections import Counter

ROOT_FOLDER = "experiments/word_freq_data/BAWE_TXT"
OUTPUT_FOLDER = "experiments/word_freq_data"

WORD_OUTPUT = "word_counts.csv"
PAIR_OUTPUT = "word_pair_counts.csv"
TRIPLET_OUTPUT = "word_triplet_counts.csv"

ENCODING = "utf-8"

PUNCTUATION_TRANSLATOR = str.maketrans("", "", string.punctuation)

def clean_word(word):
    return word.lower().translate(PUNCTUATION_TRANSLATOR)

def words_from_text(text):
    return [
        cleaned_word
        for raw_word in text.split()
        if (cleaned_word := clean_word(raw_word))
    ]

def update_counts_from_words(words, word_counts, pair_counts, triplet_counts):
    word_counts.update(words)

    pair_counts.update(
        " ".join(words[i:i+2])
        for i in range(len(words) - 1)
    )

    triplet_counts.update(
        " ".join(words[i:i+3])
        for i in range(len(words) - 2)
    )

def write_counter_to_csv(counter, output_path, columns):
    with open(output_path, "w", newline="", encoding="utf-8") as outfile:
        writer = csv.writer(outfile)
        writer.writerow(columns)

        for item, freq in counter.most_common():
            writer.writerow([item, freq])


def main():
    root_path = Path(ROOT_FOLDER)
    output_path = Path(OUTPUT_FOLDER)
    output_path.mkdir(parents=True, exist_ok=True)

    word_counts = Counter()
    pair_counts = Counter()
    triplet_counts = Counter()

    txt_files_processed = 0
    total_words_processed = 0

    for txt_file in root_path.rglob("*.txt"):
        try:
            with open(txt_file, "r", encoding=ENCODING) as infile:
                text = infile.read()
            
            words = words_from_text(text)

            update_counts_from_words(
                words,
                word_counts,
                pair_counts,
                triplet_counts
            )

            txt_files_processed += 1
            total_words_processed += len(words)

            if txt_files_processed % 100 == 0:
                print(
                    f"processed {txt_files_processed} files, "
                    f"{total_words_processed:,} words"
                )
        except UnicodeDecodeError:
            print(f"Skipping file due to encoding error: {txt_file}")

        except Exception as error:
            print(f"Skipping file due to error: {txt_file}")
            print(error)

    write_counter_to_csv(
        word_counts,
        output_path / WORD_OUTPUT,
        ["word", "freq"]
    )

    write_counter_to_csv(
        pair_counts,
        output_path / PAIR_OUTPUT,
        ["word_pair", "freq"]
    )

    write_counter_to_csv(
        triplet_counts,
        output_path / TRIPLET_OUTPUT,
        ["word_triplet", "freq"]
    )

    print("Done")
    print("Done.")
    print(f"Files processed: {txt_files_processed}")
    print(f"Words processed: {total_words_processed:,}")
    print(f"Unique words: {len(word_counts):,}")
    print(f"Unique word pairs: {len(pair_counts):,}")
    print(f"Unique word triplets: {len(triplet_counts):,}")

if __name__ == "__main__":
    main()