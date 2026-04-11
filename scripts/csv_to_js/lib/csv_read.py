from __future__ import annotations

import csv
from pathlib import Path

DEFAULT_ENCODINGS = ("utf-8-sig", "cp1250", "latin-1")


def _choose_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=";,")
        if dialect.delimiter in (";", ","):
            return dialect.delimiter
    except csv.Error:
        pass
    return ";" if sample.count(";") >= sample.count(",") else ","


def _read_with_encoding(path: Path, *, delimiter: str | None, encoding: str) -> list[list[str]]:
    with path.open("r", encoding=encoding, newline="") as handle:
        sample = handle.read(4096)
        handle.seek(0)
        effective_delimiter = delimiter or _choose_delimiter(sample)
        reader = csv.reader(handle, delimiter=effective_delimiter)
        return [[cell.strip() for cell in row] for row in reader]


def read_rows(path: Path, *, delimiter: str | None = None) -> tuple[list[str], list[list[str]]]:
    last_error: Exception | None = None
    for encoding in DEFAULT_ENCODINGS:
        try:
            rows = _read_with_encoding(path, delimiter=delimiter, encoding=encoding)
            if not rows:
                raise ValueError(f"CSV is empty: {path}")
            return rows[0], rows[1:]
        except UnicodeDecodeError as error:
            last_error = error
    raise RuntimeError(f"Could not decode CSV file: {path}") from last_error


def read_dict_rows(path: Path, *, delimiter: str | None = None) -> list[dict[str, str]]:
    header, rows = read_rows(path, delimiter=delimiter)
    mapped_rows: list[dict[str, str]] = []
    for row in rows:
        padded = row + [""] * max(0, len(header) - len(row))
        mapped_rows.append({header[idx]: padded[idx] for idx in range(len(header))})
    return mapped_rows
