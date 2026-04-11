#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from job_common import PROJECT_ROOT, SOURCE_CSV_DIR, parse_job_args
from lib.checks import ensure_month_keys_contiguous, ensure_non_empty
from lib.js_writer import write_js_object
from lib.series import parse_monthly_close_series

DEFAULT_INPUT = SOURCE_CSV_DIR / "wig30_m.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data-wig30.js"


def run(input_path: Path, output_path: Path) -> int:
    data = parse_monthly_close_series(
        input_path,
        date_column="Data",
        value_column="Zamkniecie",
        min_ym="1991-04",
    )
    ensure_non_empty(data, "WIG30_MONTHLY")
    ensure_month_keys_contiguous(data, "WIG30_MONTHLY")
    write_js_object(
        output_path,
        "WIG30_MONTHLY",
        data,
        comments=[
            "WIG30 - monthly close values",
            'Key: "YYYY-MM", value: index close at month end',
            "Source: sources/csv/wig30_m.csv",
        ],
    )
    return len(data)


def main() -> int:
    args = parse_job_args("Parse WIG30 CSV into data-wig30.js", DEFAULT_INPUT, DEFAULT_OUTPUT)
    count = run(args.input, args.output)
    print(f"[wig30] wrote {count} records -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
