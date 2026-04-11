from __future__ import annotations


def ym_from_iso_date(value: str) -> str:
    parts = value.strip().split("-")
    if len(parts) < 2:
        raise ValueError(f"Invalid date format: {value!r}")
    year = int(parts[0])
    month = int(parts[1])
    return f"{year:04d}-{month:02d}"


def ym_from_parts(year: int | str, month: int | str) -> str:
    return f"{int(year):04d}-{int(month):02d}"


def iter_months(start_ym: str, end_ym: str):
    start_year, start_month = [int(x) for x in start_ym.split("-")]
    end_year, end_month = [int(x) for x in end_ym.split("-")]
    year = start_year
    month = start_month
    while (year, month) <= (end_year, end_month):
        yield f"{year:04d}-{month:02d}"
        month += 1
        if month > 12:
            month = 1
            year += 1
