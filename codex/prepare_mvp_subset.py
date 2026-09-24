#!/usr/bin/env python3
"""Build a case-focused TigerGraph input set from the prepared CSVs."""

from __future__ import annotations

import argparse
import csv
import shutil
from collections import defaultdict
from pathlib import Path


OUTPUT_FILES = (
    "cards.csv",
    "case_pack.csv",
    "closed_case_cards.csv",
    "closed_case_transactions.csv",
    "closed_cases.csv",
    "identity.csv",
    "next_transactions.csv",
    "transactions.csv",
    "txn_emails.csv",
    "txn_regions.csv",
)


def rows(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def clean(value: object) -> str:
    text = "" if value is None else str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def read_case_pack(input_dir: Path) -> tuple[list[dict[str, str]], set[str], set[str], set[str]]:
    case_rows = list(rows(input_dir / "case_pack.csv"))
    if len(case_rows) != 20:
        raise SystemExit(f"Expected 20 case-pack rows, found {len(case_rows)}")
    case_ids = {clean(row["case_id"]) for row in case_rows}
    customer_ids = {clean(row["customer_id"]) for row in case_rows}
    card_ids = {clean(row["card_id"]) for row in case_rows}
    txn_ids = {clean(row["flagged_txn_id"]) for row in case_rows}
    return case_rows, case_ids, customer_ids, card_ids | txn_ids


def load_closed_relationships(input_dir: Path, customer_ids: set[str], card_ids: set[str]):
    closed_rows = list(rows(input_dir / "closed_cases.csv"))
    closed_cards = list(rows(input_dir / "closed_case_cards.csv"))
    closed_txns = list(rows(input_dir / "closed_case_transactions.csv"))

    cards_by_case: dict[str, set[str]] = defaultdict(set)
    txns_by_case: dict[str, set[str]] = defaultdict(set)
    for row in closed_cards:
        cards_by_case[clean(row["case_id"])].add(clean(row["card_id"]))
    for row in closed_txns:
        txns_by_case[clean(row["case_id"])].add(clean(row["txn_id"]))

    selected_cases = {
        clean(row["case_id"])
        for row in closed_rows
        if clean(row["customer_id"]) in customer_ids
        or clean(row["card_id"]) in card_ids
        or cards_by_case[clean(row["case_id"])] & card_ids
    }
    selected_txns = set().union(*(txns_by_case[case_id] for case_id in selected_cases), set())
    selected_cards = set().union(*(cards_by_case[case_id] for case_id in selected_cases), set())
    selected_cards.update(card_ids)
    return closed_rows, closed_cards, closed_txns, selected_cases, selected_txns, selected_cards


def append_matching_transactions(
    source: Path,
    destination: Path,
    customer_ids: set[str],
    card_ids: set[str],
    wanted_txns: set[str],
    selected_txns: set[str],
    selected_cards: set[str],
    mode: str,
) -> int:
    added = 0
    with source.open("r", encoding="utf-8-sig", newline="") as source_stream:
        reader = csv.DictReader(source_stream)
        fieldnames = reader.fieldnames or []
        with destination.open(mode, encoding="utf-8", newline="") as destination_stream:
            writer = csv.DictWriter(destination_stream, fieldnames=fieldnames)
            if mode == "w":
                writer.writeheader()
            for row in reader:
                txn_id = clean(row.get("txn_id"))
                matches = (
                    txn_id in wanted_txns
                    or clean(row.get("customer_id")) in customer_ids
                    or clean(row.get("card_id")) in card_ids
                )
                if matches and txn_id not in selected_txns:
                    writer.writerow(row)
                    selected_txns.add(txn_id)
                    selected_cards.add(clean(row.get("card_id")))
                    added += 1
    return added


def prepare(input_dir: Path, output_dir: Path) -> dict[str, int]:
    if output_dir.exists() and any(output_dir.iterdir()):
        raise SystemExit(f"Refusing to overwrite non-empty output directory: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    _, _, customer_ids, _ = read_case_pack(input_dir)
    case_rows = list(rows(input_dir / "case_pack.csv"))
    case_card_ids = {clean(row["card_id"]) for row in case_rows}
    closed_rows, closed_cards, closed_txns, selected_cases, closed_txn_ids, selected_cards = load_closed_relationships(
        input_dir, customer_ids, case_card_ids
    )
    flagged_txns = {clean(row["flagged_txn_id"]) for row in case_rows}
    seed_txns = closed_txn_ids | flagged_txns

    # Discover shared-device transactions before the single large transaction pass.
    device_ids: set[str] = set()
    identity_rows = list(rows(input_dir / "identity.csv"))
    for row in identity_rows:
        if clean(row["txn_id"]) in seed_txns:
            device_ids.add(clean(row["device_id"]))
    device_txns = {clean(row["txn_id"]) for row in identity_rows if clean(row["device_id"]) in device_ids}
    reached_cases = {clean(row["case_id"]) for row in closed_txns if clean(row["txn_id"]) in device_txns}
    selected_cases.update(reached_cases)
    selected_txns = seed_txns | device_txns
    selected_txns.update(clean(row["txn_id"]) for row in closed_txns if clean(row["case_id"]) in reached_cases)
    selected_cards.update(clean(row["card_id"]) for row in closed_cards if clean(row["case_id"]) in selected_cases)

    # One pass over the large file retains complete case-customer/card histories and device links.
    transaction_path = output_dir / "transactions.csv"
    transaction_count = 0
    with (input_dir / "transactions.csv").open("r", encoding="utf-8-sig", newline="") as source_stream, transaction_path.open(
        "w", encoding="utf-8", newline=""
    ) as destination_stream:
        reader = csv.DictReader(source_stream)
        fieldnames = reader.fieldnames or []
        writer = csv.DictWriter(destination_stream, fieldnames=fieldnames)
        writer.writeheader()
        for row in reader:
            if (
                clean(row["txn_id"]) in selected_txns
                or clean(row["customer_id"]) in customer_ids
                or clean(row["card_id"]) in selected_cards
            ):
                writer.writerow(row)
                selected_txns.add(clean(row["txn_id"]))
                selected_cards.add(clean(row["card_id"]))
                transaction_count += 1

    identity_path = output_dir / "identity.csv"
    with identity_path.open("w", encoding="utf-8", newline="") as destination_stream:
        fieldnames = list(identity_rows[0].keys()) if identity_rows else []
        writer = csv.DictWriter(destination_stream, fieldnames=fieldnames)
        writer.writeheader()
        for row in identity_rows:
            if clean(row["txn_id"]) in selected_txns:
                writer.writerow(row)

    # Retain only rows whose transaction/case/card is present in the MVP graph.
    def filter_file(name: str, predicate) -> None:
        source = input_dir / name
        destination = output_dir / name
        with source.open("r", encoding="utf-8-sig", newline="") as source_stream, destination.open(
            "w", encoding="utf-8", newline=""
        ) as destination_stream:
            reader = csv.DictReader(source_stream)
            fieldnames = reader.fieldnames or []
            writer = csv.DictWriter(destination_stream, fieldnames=fieldnames)
            writer.writeheader()
            for row in reader:
                if predicate(row):
                    writer.writerow(row)

    filter_file("cards.csv", lambda row: clean(row["card_id"]) in selected_cards)
    filter_file("next_transactions.csv", lambda row: clean(row["from_txn_id"]) in selected_txns and clean(row["to_txn_id"]) in selected_txns)
    filter_file("txn_emails.csv", lambda row: clean(row["txn_id"]) in selected_txns)
    filter_file("txn_regions.csv", lambda row: clean(row["txn_id"]) in selected_txns)
    filter_file("closed_cases.csv", lambda row: clean(row["case_id"]) in selected_cases)
    filter_file("closed_case_transactions.csv", lambda row: clean(row["case_id"]) in selected_cases and clean(row["txn_id"]) in selected_txns)
    filter_file("closed_case_cards.csv", lambda row: clean(row["case_id"]) in selected_cases and clean(row["card_id"]) in selected_cards)
    shutil.copyfile(input_dir / "case_pack.csv", output_dir / "case_pack.csv")

    counts = {name: sum(1 for _ in rows(output_dir / name)) for name in OUTPUT_FILES}
    counts["transactions.csv"] = transaction_count
    return counts


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, default=Path("prepared"))
    parser.add_argument("--output-dir", type=Path, default=Path("prepared_mvp"))
    args = parser.parse_args()
    counts = prepare(args.input_dir, args.output_dir)
    for name in OUTPUT_FILES:
        print(f"{name}: {counts[name]:,} rows")