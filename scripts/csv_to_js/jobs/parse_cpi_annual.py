#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from job_common import PROJECT_ROOT, SOURCE_CSV_DIR, parse_job_args
from lib.checks import ensure_non_empty, ensure_year_keys_contiguous
from lib.js_writer import write_js_object
from lib.series import parse_cpi_annual_series

DEFAULT_INPUT = SOURCE_CSV_DIR / "rocznewskaznikicentowarowiuslugkonsumpcyjnychod1950roku_2.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data-cpi-annual.js"


def run(input_path: Path, output_path: Path) -> int:
    data = parse_cpi_annual_series(input_path, min_year=1997)
    ensure_non_empty(data, "CPI_ANNUAL")
    ensure_year_keys_contiguous(data, "CPI_ANNUAL")
    write_js_object(
        output_path,
        "CPI_ANNUAL",
        data,
        comments=[
            "Poland CPI annual",
            "Value = index - 100 (for example 110.1 -> 10.1)",
            "Source: sources/csv/rocznewskaznikicentowarowiuslugkonsumpcyjnychod1950roku_2.csv",
        ],
        quote_keys=False,
    )
    return len(data)


def main() -> int:
    args = parse_job_args("Parse CPI annual CSV into data-cpi-annual.js", DEFAULT_INPUT, DEFAULT_OUTPUT)
    count = run(args.input, args.output)
    print(f"[cpi-annual] wrote {count} records -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
