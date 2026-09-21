import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

base = Path(r"C:\Users\rania\Downloads")
prepared = Path("work/prepared")
output = Path("outputs/tigergraph-fraud-starter/hhg-002-source-evidence.json")
selected = ("TransactionID", "ts", "TransactionDT", "TransactionAmt", "ProductCD", "channel", "risk_score", "addr1", "addr2", "P_emaildomain", "R_emaildomain", "card1", "card2", "card3", "card4", "card5", "card6", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9")

def read_rows(path):
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))

cases = read_rows(base / "case_pack.csv")
case = next(row for row in cases if row["case_id"] == "HHG-002")
cards = {row["card_id"]: row for row in read_rows(prepared / "cards.csv")}
card = cards[case["card_id"]]
fingerprint = card["card_fingerprint"]

identity_by_txn = {}
with (base / "identity.csv").open("r", encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        identity_by_txn[row["TransactionID"]] = row
flagged_identity = identity_by_txn.get(case["flagged_txn_id"], {})
profile = " | ".join(flagged_identity.get(key, "") for key in ("DeviceInfo", "id_30", "id_31", "id_33"))
device_txn_ids = set()
if profile.replace("|", "").strip():
    device_txn_ids = {txn_id for txn_id, row in identity_by_txn.items() if " | ".join(row.get(key, "") for key in ("DeviceInfo", "id_30", "id_31", "id_33")) == profile}

flagged = None
card_history = []
device_transactions = []
with (base / "transactions.csv").open("r", encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        txn_id = row["TransactionID"]
        signature = "|".join(row.get(key, "") for key in ("card1", "card2", "card3", "card4", "card5", "card6"))
        compact = {key: row.get(key, "") for key in selected}
        if txn_id == case["flagged_txn_id"]:
            flagged = compact
        if row["customer_id"] == case["customer_id"] and signature == fingerprint:
            card_history.append(compact)
        if txn_id in device_txn_ids:
            device_transactions.append({**compact, "customer_id": row["customer_id"], "card_fingerprint": signature})

card_history.sort(key=lambda row: float(row["TransactionDT"]))
device_transactions.sort(key=lambda row: float(row["TransactionDT"]))
flagged_dt = float(flagged["TransactionDT"])
window_48h = [row for row in card_history if abs(float(row["TransactionDT"]) - flagged_dt) <= 48 * 3600]
before = [row for row in card_history if float(row["TransactionDT"]) < flagged_dt]
before_30d = [row for row in before if flagged_dt - float(row["TransactionDT"]) <= 30 * 86400]

closed = read_rows(base / "closed_cases_history.csv")
device_txn_set = set(device_txn_ids)
same_card_cases = [row for row in closed if row["card_id"] == case["card_id"]]
device_cases = [row for row in closed if device_txn_set.intersection(part for part in row["txn_ids"].split("|") if part)]

def txn_view(rows, limit=100):
    return [{key: row.get(key, "") for key in ("TransactionID", "ts", "TransactionAmt", "ProductCD", "channel", "risk_score", "addr1", "addr2", "P_emaildomain", "R_emaildomain", "M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9")} for row in rows[:limit]]

result = {
    "case": case,
    "card_mapping": card,
    "flagged_transaction": flagged,
    "flagged_identity": {key: flagged_identity.get(key, "") for key in ("id_15", "id_23", "id_30", "id_31", "id_33", "DeviceType", "DeviceInfo")},
    "device_profile": profile,
    "card_history_summary": {
        "n_transactions": len(card_history),
        "first_ts": card_history[0]["ts"], "last_ts": card_history[-1]["ts"],
        "transactions_in_48h_of_alert": len(window_48h),
        "previous_30d_count": len(before_30d),
        "previous_30d_amount_mean": round(sum(float(row["TransactionAmt"]) for row in before_30d) / len(before_30d), 2) if before_30d else 0,
        "previous_channels": dict(Counter(row["channel"] for row in before)),
        "previous_regions": dict(Counter(row["addr1"] for row in before)),
        "previous_product_codes": dict(Counter(row["ProductCD"] for row in before)),
        "window_48h": txn_view(window_48h),
    },
    "shared_device_summary": {
        "n_transactions": len(device_transactions),
        "n_customers": len({row["customer_id"] for row in device_transactions}),
        "customer_ids": sorted({row["customer_id"] for row in device_transactions}),
        "transactions": txn_view(device_transactions),
    },
    "similar_closed_cases": {
        "same_card": [{key: row.get(key, "") for key in ("case_id", "outcome", "pattern", "exposure_usd", "opened_at", "closed_at", "analyst_notes")} for row in same_card_cases],
        "same_device": [{key: row.get(key, "") for key in ("case_id", "card_id", "outcome", "pattern", "exposure_usd", "opened_at", "closed_at", "analyst_notes")} for row in device_cases],
    },
}
output.write_text(json.dumps(result, indent=2), encoding="utf-8")
print(json.dumps({"output": str(output), "card_transactions": len(card_history), "window_48h": len(window_48h), "shared_device_transactions": len(device_transactions), "shared_device_customers": len({row['customer_id'] for row in device_transactions}), "same_card_closed_cases": len(same_card_cases), "same_device_closed_cases": len(device_cases)}, indent=2))
