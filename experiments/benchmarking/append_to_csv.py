from pathlib import Path
import csv


def append_to_csv(csv_dir, csv_filename, columns, row_values):
    """
    Append one row to a CSV file.

    columns: list of column names, e.g. ["ESSAY_ID", "PARA_TYPE", "PARAGRAPH"]
    row_values: list of values in the same order, e.g. ["essay_001", "intro", "..."]
    """

    if len(columns) != len(row_values):
        raise ValueError(
            f"columns and row_values must have the same length. "
            f"Got {len(columns)} columns and {len(row_values)} values."
        )

    csv_path = Path(csv_dir) / csv_filename
    csv_path.parent.mkdir(parents=True, exist_ok=True)

    file_is_empty = not csv_path.exists() or csv_path.stat().st_size == 0

    row = dict(zip(columns, row_values))

    with csv_path.open("a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=columns)

        if file_is_empty:
            writer.writeheader()

        writer.writerow(row)