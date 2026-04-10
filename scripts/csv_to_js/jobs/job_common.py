from __future__ import annotations

import argparse
import sys
from pathlib import Path

CSV_TO_JS_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = Path(__file__).resolve().parents[3]
SOURCE_CSV_DIR = PROJECT_ROOT / "sources" / "csv"

if str(CSV_TO_JS_DIR) not in sys.path:
    sys.path.insert(0, str(CSV_TO_JS_DIR))


def parse_job_args(description: str, default_input: Path, default_output: Path):
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("--input", type=Path, default=default_input)
    parser.add_argument("--output", type=Path, default=default_output)
    return parser.parse_args()
