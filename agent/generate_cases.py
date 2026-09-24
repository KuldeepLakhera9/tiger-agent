"""Generate one deterministic benchmark answer JSON per case-pack case."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from investigate import EvidenceStore, default_data_dir, investigate_case


def generate(data_dir: Path, output_dir: Path, case_id: str | None = None) -> list[Path]:
    store = EvidenceStore(data_dir)
    if len(store.case_pack) != 20:
        raise SystemExit(f"Expected exactly 20 benchmark cases, found {len(store.case_pack)}")
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = [row for row in store.case_pack if case_id is None or row["case_id"] == case_id]
    if case_id and len(rows) != 1:
        raise SystemExit(f"Case {case_id} was not found exactly once in the case pack")
    paths: list[Path] = []
    for row in rows:
        current_id = row["case_id"]
        result = investigate_case(store, current_id)
        path = output_dir / f"{current_id}.json"
        path.write_text(json.dumps(result, indent=2, sort_keys=False) + "\n", encoding="utf-8")
        paths.append(path)
        print(f"generated {path}")
    return paths


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    parser.add_argument("--output-dir", type=Path, default=Path(__file__).resolve().parents[1] / "cases")
    parser.add_argument("--case-id")
    args = parser.parse_args()
    generate(args.data_dir, args.output_dir, args.case_id)