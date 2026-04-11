#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from job_common import PROJECT_ROOT, SOURCE_CSV_DIR, parse_job_args
from lib.checks import ensure_month_keys_contiguous, ensure_non_empty
from lib.js_writer import write_js_object
from lib.series import fill_forward_monthly_series, parse_monthly_close_series

DEFAULT_INPUT = SOURCE_CSV_DIR / "inrtpl_m_m.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data-nbp-rate.js"


def run(input_path: Path, output_path: Path) -> int:
    sparse = parse_monthly_close_series(
        input_path,
        date_column="Data",
        value_column="Zamkniecie",
        min_ym="1998-02",
    )
    ensure_non_empty(sparse, "NBP_RATE_MONTHLY sparse")
    filled = fill_forward_monthly_series(sparse)
    ensure_month_keys_contiguous(filled, "NBP_RATE_MONTHLY")
    write_js_object(
        output_path,
        "NBP_RATE_MONTHLY",
        filled,
        comments=[
            "NBP reference rate - monthly values (fill-forward)",
            'Key: "YYYY-MM", value: reference rate in percent',
            "Source: sources/csv/inrtpl_m_m.csv",
        ],
    )
    return len(filled)


def main() -> int:
    args = parse_job_args("Parse NBP rate CSV into data-nbp-rate.js", DEFAULT_INPUT, DEFAULT_OUTPUT)
    count = run(args.input, args.output)
    print(f"[nbp-rate] wrote {count} records -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
