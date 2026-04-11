#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from job_common import PROJECT_ROOT, SOURCE_CSV_DIR, parse_job_args
from lib.checks import ensure_month_keys_contiguous, ensure_non_empty
from lib.js_writer import write_js_object
from lib.series import parse_monthly_close_series

DEFAULT_INPUT = SOURCE_CSV_DIR / "usdpln_m.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data-usdpln.js"


def run(input_path: Path, output_path: Path) -> int:
    data = parse_monthly_close_series(
        input_path,
        date_column="Data",
        value_column="Zamkniecie",
        min_ym="1984-01",
    )
    ensure_non_empty(data, "USDPLN_MONTHLY")
    ensure_month_keys_contiguous(data, "USDPLN_MONTHLY")
    write_js_object(
        output_path,
        "USDPLN_MONTHLY",
        data,
        comments=[
            "USD/PLN - monthly close values",
            'Key: "YYYY-MM", value: FX close at month end',
            "Source: sources/csv/usdpln_m.csv",
        ],
    )
    return len(data)


def main() -> int:
    args = parse_job_args("Parse USDPLN CSV into data-usdpln.js", DEFAULT_INPUT, DEFAULT_OUTPUT)
    count = run(args.input, args.output)
    print(f"[usdpln] wrote {count} records -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
