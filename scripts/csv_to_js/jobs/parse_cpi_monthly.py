#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from job_common import PROJECT_ROOT, SOURCE_CSV_DIR, parse_job_args
from lib.checks import ensure_month_keys_contiguous, ensure_non_empty
from lib.js_writer import write_js_object
from lib.series import parse_cpi_monthly_series

DEFAULT_INPUT = SOURCE_CSV_DIR / "miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv"
DEFAULT_OUTPUT = PROJECT_ROOT / "data-cpi-monthly.js"


def run(input_path: Path, output_path: Path) -> int:
    data = parse_cpi_monthly_series(input_path, min_ym="1982-01")
    ensure_non_empty(data, "CPI_MONTHLY")
    ensure_month_keys_contiguous(data, "CPI_MONTHLY")
    write_js_object(
        output_path,
        "CPI_MONTHLY",
        data,
        comments=[
            "Poland CPI monthly m/m (previous month = 100)",
            "Value = index - 100 (for example 100.3 -> 0.3)",
            "Source: sources/csv/miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv",
        ],
    )
    return len(data)


def main() -> int:
    args = parse_job_args("Parse CPI monthly CSV into data-cpi-monthly.js", DEFAULT_INPUT, DEFAULT_OUTPUT)
    count = run(args.input, args.output)
    print(f"[cpi-monthly] wrote {count} records -> {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
