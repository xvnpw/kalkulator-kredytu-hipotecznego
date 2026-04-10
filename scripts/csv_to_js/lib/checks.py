from __future__ import annotations

from .dates import iter_months


def ensure_non_empty(series: dict, series_name: str) -> None:
    if not series:
        raise ValueError(f"{series_name}: parsed series is empty")


def ensure_month_keys_contiguous(series: dict[str, object], series_name: str) -> None:
    keys = list(series.keys())
    ensure_non_empty(series, series_name)
    expected_keys = list(iter_months(keys[0], keys[-1]))
    if keys != expected_keys:
        expected_set = set(expected_keys)
        actual_set = set(keys)
        missing = [k for k in expected_keys if k not in actual_set][:5]
        extra = [k for k in keys if k not in expected_set][:5]
        raise ValueError(
            f"{series_name}: month keys are not contiguous. Missing={missing} Extra={extra}"
        )


def ensure_year_keys_contiguous(series: dict[int, object], series_name: str) -> None:
    years = list(series.keys())
    ensure_non_empty(series, series_name)
    expected = list(range(years[0], years[-1] + 1))
    if years != expected:
        expected_set = set(expected)
        actual_set = set(years)
        missing = [year for year in expected if year not in actual_set][:5]
        extra = [year for year in years if year not in expected_set][:5]
        raise ValueError(
            f"{series_name}: year keys are not contiguous. Missing={missing} Extra={extra}"
        )
