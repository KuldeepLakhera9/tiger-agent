#!/usr/bin/env python3
"""Prepare HHGOA CSVs for the TigerGraph loading job without external packages."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import defaultdict
from pathlib import Path
from typing import Any, Iterable


REQUIRED = {
    "transactions.csv": {"TransactionID", "TransactionDT", "TransactionAmt", "customer_id", "ts", "channel", "risk_score"},
    "identity.csv": {"TransactionID"},
    "closed_cases_history.csv": {"case_id", "customer_id", "card_id", "first_fraud_txn_id", "txn_ids", "connected_card_ids"},
    "case_pack.csv": {"case_id", "flagged_txn_id", "card_id", "customer_id", "opened_at", "trigger_type", "trigger_text"},
}
CARD_COLUMNS = ("card1", "card2", "card3", "card4", "card5", "card6")


def clean(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return "" if text.lower() in {"nan", "none", "null"} else text


def header(path: Path) -> set[str]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return set(csv.reader(stream).__next__())


def rows(path: Path) -> Iterable[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        yield from csv.DictReader(stream)


def write_rows(path: Path, fieldnames: list[str], data: Iterable[dict[str, Any]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="raise", quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row in data:
            writer.writerow({key: clean(value) for key, value in row.items()})


def numeric(value: str) -> float:
    try:
        return float(clean(value))
    except ValueError:
        return 0.0


def card_signature(row: dict[str, str]) -> str:
    return "|".join(clean(row.get(column)) for column in CARD_COLUMNS)


def device_profile(row: dict[str, str]) -> tuple[str, str]:
    parts = [clean(row.get(key)) for key in ("DeviceInfo", "id_30", "id_31", "id_33")]
    descriptor = " | ".join(parts)
    digest = hashlib.sha256(descriptor.encode("utf-8")).hexdigest()[:20]
    return f"D-{digest}", descriptor


def pipe_values(value: str) -> list[str]:
    return [part.strip() for part in clean(value).split("|") if part.strip()]


def as_bool(value: str) -> str:
    return "true" if clean(value).lower() in {"1", "true", "yes", "y"} else "false"


def source_json(row: dict[str, str]) -> str:
    # Preserve every column exactly as parsed from the original source row.
    return json.dumps(row, separators=(",", ":"), ensure_ascii=False)


def declared_card_ids(case_pack: Path, closed_cases: Path) -> dict[str, str]:
    """Anchor IDs to labels that the dataset explicitly supplies, never to guesswork."""
    declared: dict[str, str] = {}
    for row in rows(case_pack):
        declared[clean(row.get("flagged_txn_id"))] = clean(row.get("card_id"))
    for row in rows(closed_cases):
        txn_id = clean(row.get("first_fraud_txn_id"))
        card_id = clean(row.get("card_id"))
        if txn_id and card_id:
            previous = declared.get(txn_id)
            if previous and previous != card_id:
                raise SystemExit(f"Conflicting declared card IDs for transaction {txn_id}: {previous} vs {card_id}")
            declared[txn_id] = card_id
    return declared


def inspect_and_build_card_map(transactions: Path, declared: dict[str, str]) -> tuple[dict[tuple[str, str], str], dict[tuple[str, str], dict[str, str]], dict[str, dict[str, str]], bool]:
    has_card_id = "card_id" in header(transactions)
    cards: dict[tuple[str, str], dict[str, str]] = {}
    anchored: dict[tuple[str, str], str] = {}
    for row in rows(transactions):
        customer = clean(row.get("customer_id"))
        raw_card_id = clean(row.get("card_id")) if has_card_id else ""
        fingerprint = card_signature(row)
        key = (customer, raw_card_id if raw_card_id else fingerprint)
        current = cards.get(key)
        candidate = {
            "customer_id": customer,
            "fingerprint": fingerprint,
            "first_dt": clean(row.get("TransactionDT")),
            "first_ts": clean(row.get("ts")),
            "last_ts": clean(row.get("ts")),
            "card4": clean(row.get("card4")),
            "card6": clean(row.get("card6")),
        }
        if current is None:
            cards[key] = candidate
        else:
            if numeric(candidate["first_dt"]) < numeric(current["first_dt"]):
                current["first_dt"] = candidate["first_dt"]
                current["first_ts"] = candidate["first_ts"]
            if candidate["last_ts"] > current["last_ts"]:
                current["last_ts"] = candidate["last_ts"]
        label = declared.get(clean(row.get("TransactionID")))
        if label:
            previous = anchored.get(key)
            if previous and previous != label:
                raise SystemExit(f"Fingerprint {key} is assigned two card IDs: {previous} vs {label}")
            anchored[key] = label

    mapping: dict[tuple[str, str], str] = {}
    by_customer: dict[str, list[tuple[tuple[str, str], dict[str, str]]]] = defaultdict(list)
    for key, value in cards.items():
        by_customer[value["customer_id"]].append((key, value))
    for customer, items in by_customer.items():
        items.sort(key=lambda item: (numeric(item[1]["first_dt"]), item[1]["fingerprint"], item[0][1]))
        if has_card_id:
            for key, _ in items:
                mapping[key] = key[1]
            continue
        used_numbers = set()
        for key, _ in items:
            label = anchored.get(key)
            if label:
                mapping[key] = label
                suffix = label.rsplit("-K", 1)
                if len(suffix) == 2 and suffix[0] == customer and suffix[1].isdigit():
                    used_numbers.add(int(suffix[1]))
        next_number = 1
        for key, _ in items:
            if key in mapping:
                continue
            while next_number in used_numbers:
                next_number += 1
            mapping[key] = f"{customer}-K{next_number}"
            used_numbers.add(next_number)
            next_number += 1
    customers: dict[str, dict[str, str]] = {}
    for card in cards.values():
        customer = card["customer_id"]
        current = customers.get(customer)
        if current is None:
            customers[customer] = {"first_dt": card["first_dt"], "first_ts": card["first_ts"], "last_ts": card["last_ts"]}
        else:
            if numeric(card["first_dt"]) < numeric(current["first_dt"]):
                current["first_dt"] = card["first_dt"]
                current["first_ts"] = card["first_ts"]
            if card["last_ts"] > current["last_ts"]:
                current["last_ts"] = card["last_ts"]
    return mapping, cards, customers, has_card_id


def prepare(input_dir: Path, output_dir: Path) -> None:
    files = {name: input_dir / name for name in REQUIRED}
    missing = [str(path) for path in files.values() if not path.is_file()]
    if missing:
        raise SystemExit("Missing required input files:\n  " + "\n  ".join(missing))
    for name, required_columns in REQUIRED.items():
        absent = required_columns - header(files[name])
        if absent:
            raise SystemExit(f"{name} is missing required columns: {', '.join(sorted(absent))}")

    output_dir.mkdir(parents=True, exist_ok=True)
    declared = declared_card_ids(files["case_pack.csv"], files["closed_cases_history.csv"])
    mapping, cards, customers, has_card_id = inspect_and_build_card_map(files["transactions.csv"], declared)

    # Validate case-pack linkage before any output is trusted.
    wanted = {clean(row["flagged_txn_id"]): clean(row["card_id"]) for row in rows(files["case_pack.csv"])}
    observed: dict[str, str] = {}
    for row in rows(files["transactions.csv"]):
        txn_id = clean(row.get("TransactionID"))
        if txn_id in wanted:
            key = (clean(row.get("customer_id")), clean(row.get("card_id")) if has_card_id else card_signature(row))
            observed[txn_id] = mapping[key]
    mismatches = [f"{txn}: expected {expected}, derived {observed.get(txn, '<missing>')}" for txn, expected in wanted.items() if observed.get(txn) != expected]
    if mismatches:
        raise SystemExit("Card ID preflight failed; do not load mismatched case relationships:\n  " + "\n  ".join(mismatches))

    card_records: dict[str, dict[str, str]] = {}
    for key, meta in cards.items():
        customer = meta["customer_id"]
        card_id = mapping[key]
        candidate = {"card_id": card_id, "customer_id": customer, "card_fingerprint": meta["fingerprint"],
                     "card4": meta["card4"], "card6": meta["card6"], "card_first_seen": meta["first_ts"],
                     "card_last_seen": meta["last_ts"], "customer_first_seen": customers[customer]["first_ts"],
                     "customer_last_seen": customers[customer]["last_ts"]}
        current = card_records.get(card_id)
        if current is None:
            card_records[card_id] = candidate
            continue
        if current["customer_id"] != customer:
            raise SystemExit(f"Card ID {card_id} maps to two customers: {current['customer_id']} vs {customer}")
        # Some transactions omit card attributes. Keep the richest observed fingerprint
        # as the vertex description, but map every corresponding transaction to this ID.
        if sum(bool(part) for part in candidate["card_fingerprint"].split("|")) > sum(bool(part) for part in current["card_fingerprint"].split("|")):
            current["card_fingerprint"] = candidate["card_fingerprint"]
            current["card4"] = candidate["card4"]
            current["card6"] = candidate["card6"]
        if meta["first_ts"] < current["card_first_seen"]:
            current["card_first_seen"] = meta["first_ts"]
        if meta["last_ts"] > current["card_last_seen"]:
            current["card_last_seen"] = meta["last_ts"]
    card_rows = list(card_records.values())
    card_rows.sort(key=lambda row: row["card_id"])
    write_rows(output_dir / "cards.csv", ["card_id", "customer_id", "card_fingerprint", "card4", "card6", "card_first_seen", "card_last_seen", "customer_first_seen", "customer_last_seen"], card_rows)

    ordered: dict[str, list[tuple[float, str]]] = defaultdict(list)
    txn_fields = ["txn_id", "customer_id", "card_id", "ts", "TransactionDT", "TransactionAmt", "risk_score", "channel", "ProductCD", "addr1", "addr2", "P_emaildomain", "R_emaildomain", "features_json", "customer_first_seen", "customer_last_seen", "card_fingerprint", "card4", "card6", "card_first_seen", "card_last_seen"]
    with (output_dir / "transactions.csv").open("w", encoding="utf-8", newline="") as txn_stream, \
         (output_dir / "txn_regions.csv").open("w", encoding="utf-8", newline="") as region_stream, \
         (output_dir / "txn_emails.csv").open("w", encoding="utf-8", newline="") as email_stream:
        txn_writer = csv.DictWriter(txn_stream, fieldnames=txn_fields, extrasaction="raise")
        region_writer = csv.DictWriter(region_stream, fieldnames=["txn_id", "region_id", "country_code"], extrasaction="raise")
        email_writer = csv.DictWriter(email_stream, fieldnames=["txn_id", "domain", "role"], extrasaction="raise")
        txn_writer.writeheader()
        region_writer.writeheader()
        email_writer.writeheader()
        txn_count = 0
        for row in rows(files["transactions.csv"]):
            customer = clean(row.get("customer_id"))
            lookup = (customer, clean(row.get("card_id")) if has_card_id else card_signature(row))
            card_id = mapping[lookup]
            card_meta = cards[lookup]
            customer_meta = customers[customer]
            txn_id = clean(row.get("TransactionID"))
            txn_writer.writerow({
                "txn_id": txn_id, "customer_id": customer, "card_id": card_id, "ts": row.get("ts", ""),
                "TransactionDT": row.get("TransactionDT", ""), "TransactionAmt": row.get("TransactionAmt", ""),
                "risk_score": row.get("risk_score", ""), "channel": row.get("channel", ""), "ProductCD": row.get("ProductCD", ""),
                "addr1": row.get("addr1", ""), "addr2": row.get("addr2", ""), "P_emaildomain": row.get("P_emaildomain", ""),
                "R_emaildomain": row.get("R_emaildomain", ""), "features_json": source_json(row),
                "customer_first_seen": customer_meta["first_ts"], "customer_last_seen": customer_meta["last_ts"],
                "card_fingerprint": card_meta["fingerprint"], "card4": card_meta["card4"], "card6": card_meta["card6"],
                "card_first_seen": card_meta["first_ts"], "card_last_seen": card_meta["last_ts"],
            })
            region = clean(row.get("addr1"))
            if region:
                region_writer.writerow({"txn_id": txn_id, "region_id": region, "country_code": clean(row.get("addr2"))})
            for column, role in (("P_emaildomain", "purchaser"), ("R_emaildomain", "recipient")):
                domain = clean(row.get(column))
                if domain:
                    email_writer.writerow({"txn_id": txn_id, "domain": domain.lower(), "role": role})
            ordered[card_id].append((numeric(row.get("TransactionDT", "")), txn_id))
            txn_count += 1

    next_rows: list[dict[str, Any]] = []
    for card_id, items in ordered.items():
        items.sort()
        for (prior_time, prior_id), (current_time, current_id) in zip(items, items[1:]):
            next_rows.append({"from_txn_id": prior_id, "to_txn_id": current_id, "gap_seconds": int(max(0, current_time - prior_time))})
    write_rows(output_dir / "next_transactions.csv", ["from_txn_id", "to_txn_id", "gap_seconds"], next_rows)

    identity_fields = ["txn_id", "device_id", "device_profile", "DeviceInfo", "id_30", "id_31", "id_33", "DeviceType", "id_15", "id_23", "features_json"]
    identity_count = 0
    with (output_dir / "identity.csv").open("w", encoding="utf-8", newline="") as identity_stream:
        identity_writer = csv.DictWriter(identity_stream, fieldnames=identity_fields, extrasaction="raise")
        identity_writer.writeheader()
        for row in rows(files["identity.csv"]):
            device_id, descriptor = device_profile(row)
            # A wholly empty identity record has no meaningful profile to connect.
            if not descriptor.replace("|", "").strip():
                continue
            identity_writer.writerow({"txn_id": clean(row.get("TransactionID")), "device_id": device_id, "device_profile": descriptor,
                                      "DeviceInfo": row.get("DeviceInfo", ""), "id_30": row.get("id_30", ""), "id_31": row.get("id_31", ""),
                                      "id_33": row.get("id_33", ""), "DeviceType": row.get("DeviceType", ""), "id_15": row.get("id_15", ""),
                                      "id_23": row.get("id_23", ""), "features_json": source_json(row)})
            identity_count += 1

    closed_rows: list[dict[str, str]] = []
    case_txns: list[dict[str, str]] = []
    case_cards: list[dict[str, str]] = []
    for row in rows(files["closed_cases_history.csv"]):
        case_id = clean(row.get("case_id"))
        closed_rows.append({"case_id": case_id, "customer_id": row.get("customer_id", ""), "card_id": row.get("card_id", ""),
                            "opened_at": row.get("opened_at", ""), "closed_at": row.get("closed_at", ""), "outcome": row.get("outcome", ""),
                            "pattern": row.get("pattern", ""), "exposure_usd": row.get("exposure_usd", ""), "actions_taken": row.get("actions_taken", ""),
                            "report_filed": as_bool(row.get("report_filed", "")), "analyst_notes": row.get("analyst_notes", ""), "source_json": source_json(row)})
        for txn_id in pipe_values(row.get("txn_ids", "")):
            case_txns.append({"case_id": case_id, "txn_id": txn_id})
        primary = clean(row.get("card_id"))
        if primary:
            case_cards.append({"case_id": case_id, "card_id": primary, "role": "primary"})
        for connected in pipe_values(row.get("connected_card_ids", "")):
            case_cards.append({"case_id": case_id, "card_id": connected, "role": "connected"})
    write_rows(output_dir / "closed_cases.csv", list(closed_rows[0].keys()), closed_rows)
    write_rows(output_dir / "closed_case_transactions.csv", ["case_id", "txn_id"], case_txns)
    write_rows(output_dir / "closed_case_cards.csv", ["case_id", "card_id", "role"], case_cards)

    pack_rows = []
    for row in rows(files["case_pack.csv"]):
        pack_rows.append({"case_id": row.get("case_id", ""), "flagged_txn_id": row.get("flagged_txn_id", ""), "card_id": row.get("card_id", ""),
                          "customer_id": row.get("customer_id", ""), "opened_at": row.get("opened_at", ""), "trigger_type": row.get("trigger_type", ""),
                          "trigger_text": row.get("trigger_text", ""), "risk_score": row.get("risk_score", "0"), "source_json": source_json(row)})
    write_rows(output_dir / "case_pack.csv", list(pack_rows[0].keys()), pack_rows)
    print(f"Prepared {txn_count:,} transactions, {identity_count:,} identity links, and {len(closed_rows):,} closed cases in {output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    arguments = parser.parse_args()
    prepare(arguments.input_dir, arguments.output_dir)
