#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
JOBS_DIR = Path(__file__).resolve().parent / "jobs"
DEFAULT_INPUT_DIR = PROJECT_ROOT / "sources" / "csv"
DEFAULT_OUTPUT_DIR = PROJECT_ROOT

JOBS: dict[str, dict[str, str]] = {
    "wibor1m": {
        "script": "parse_wibor1m.py",
        "input": "plopln1m_m.csv",
        "output": "data-wibor1m.js",
    },
    "wibor3m": {
        "script": "parse_wibor3m.py",
        "input": "plopln3m_m.csv",
        "output": "data-wibor3m.js",
    },
    "wibor6m": {
        "script": "parse_wibor6m.py",
        "input": "plopln6m_m.csv",
        "output": "data-wibor6m.js",
    },
    "nbp-rate": {
        "script": "parse_nbp_rate.py",
        "input": "inrtpl_m_m.csv",
        "output": "data-nbp-rate.js",
    },
    "wig": {
        "script": "parse_wig.py",
        "input": "wig_m.csv",
        "output": "data-wig.js",
    },
    "wig30": {
        "script": "parse_wig30.py",
        "input": "wig30_m.csv",
        "output": "data-wig30.js",
    },
    "spx": {
        "script": "parse_spx.py",
        "input": "spx_m.csv",
        "output": "data-spx.js",
    },
    "usdpln": {
        "script": "parse_usdpln.py",
        "input": "usdpln_m.csv",
        "output": "data-usdpln.js",
    },
    "cpi-monthly": {
        "script": "parse_cpi_monthly.py",
        "input": "miesieczne_wskazniki_cen_towarow_i_uslug_konsumpcyjnych_od_1982_roku__2.csv",
        "output": "data-cpi-monthly.js",
    },
}


def run_single_job(job_key: str, input_dir: str, output_dir: str) -> tuple[str, int, str, str]:
    job = JOBS[job_key]
    cmd = [
        sys.executable,
        str(JOBS_DIR / job["script"]),
        "--input",
        str(Path(input_dir) / job["input"]),
        "--output",
        str(Path(output_dir) / job["output"]),
    ]
    completed = subprocess.run(
        cmd,
        cwd=str(PROJECT_ROOT),
        capture_output=True,
        text=True,
    )
    return (
        job_key,
        completed.returncode,
        completed.stdout.strip(),
        completed.stderr.strip(),
    )


def parse_args():
    parser = argparse.ArgumentParser(description="Run all CSV -> JS parsers in parallel.")
    parser.add_argument(
        "--workers",
        type=int,
        default=min(len(JOBS), os.cpu_count() or 1),
        help="Number of parallel worker processes (default: min(cpu_count, job_count)).",
    )
    parser.add_argument(
        "--only",
        action="append",
        choices=sorted(JOBS.keys()),
        help="Run only selected job key(s). Repeat flag for multiple jobs.",
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=DEFAULT_INPUT_DIR,
        help=f"Directory with CSV sources (default: {DEFAULT_INPUT_DIR}).",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for generated data-*.js files (default: {DEFAULT_OUTPUT_DIR}).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.workers < 1:
        raise SystemExit("--workers must be >= 1")

    selected_jobs = list(dict.fromkeys(args.only)) if args.only else list(JOBS.keys())
    missing_inputs = [name for name in selected_jobs if not (args.input_dir / JOBS[name]["input"]).exists()]
    if missing_inputs:
        for job_name in missing_inputs:
            print(f"[missing] {job_name}: {(args.input_dir / JOBS[job_name]['input'])}", file=sys.stderr)
        return 1

    args.output_dir.mkdir(parents=True, exist_ok=True)
    max_workers = min(args.workers, len(selected_jobs))
    failures: list[str] = []

    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(
                run_single_job,
                job_name,
                str(args.input_dir),
                str(args.output_dir),
            ): job_name
            for job_name in selected_jobs
        }
        for future in as_completed(futures):
            job_name = futures[future]
            name, returncode, stdout, stderr = future.result()
            if returncode == 0:
                print(stdout or f"[{name}] ok")
            else:
                failures.append(job_name)
                print(f"[{name}] failed", file=sys.stderr)
                if stdout:
                    print(stdout, file=sys.stderr)
                if stderr:
                    print(stderr, file=sys.stderr)

    if failures:
        print(f"Failed jobs: {', '.join(sorted(failures))}", file=sys.stderr)
        return 1

    print(f"Completed {len(selected_jobs)} job(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
