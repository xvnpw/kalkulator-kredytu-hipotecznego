from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from .csv_read import read_dict_rows, read_rows
from .dates import iter_months, ym_from_iso_date, ym_from_parts
from .numbers import parse_decimal


def parse_monthly_close_series(
    csv_path: Path,
    *,
    date_column: str,
    value_column: str,
    min_ym: str | None = None,
    max_ym: str | None = None,
) -> dict[str, Decimal]:
    rows = read_dict_rows(csv_path)
    parsed: dict[str, Decimal] = {}
    for row in rows:
        raw_date = row.get(date_column, "").strip()
        raw_value = row.get(value_column, "").strip()
        if not raw_date or not raw_value:
            continue
        value = parse_decimal(raw_value)
        if value is None:
            continue
        ym = ym_from_iso_date(raw_date)
        if min_ym and ym < min_ym:
            continue
        if max_ym and ym > max_ym:
            continue
        parsed[ym] = value
    return dict(sorted(parsed.items()))


def fill_forward_monthly_series(series: dict[str, Decimal]) -> dict[str, Decimal]:
    if not series:
        return {}
    sparse = dict(sorted(series.items()))
    keys = list(sparse.keys())
    filled: dict[str, Decimal] = {}
    current: Decimal | None = None
    for ym in iter_months(keys[0], keys[-1]):
        if ym in sparse:
            current = sparse[ym]
        if current is None:
            raise ValueError(f"Cannot fill forward before first known value ({keys[0]})")
        filled[ym] = current
    return filled


def parse_cpi_monthly_series(
    csv_path: Path,
    *,
    presentation: str = "Poprzedni miesiąc = 100",
    min_ym: str = "1982-01",
) -> dict[str, Decimal]:
    _, rows = read_rows(csv_path, delimiter=";")
    parsed: dict[str, Decimal] = {}
    for row in rows:
        if len(row) < 6:
            continue
        if row[2] != presentation:
            continue
        value = parse_decimal(row[5])
        if value is None:
            continue
        ym = ym_from_parts(row[3], row[4])
        if ym < min_ym:
            continue
        parsed[ym] = value - Decimal("100")
    return dict(sorted(parsed.items()))
