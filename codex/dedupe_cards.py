import csv
from pathlib import Path

target = Path("work/prepared/cards.csv")
temporary = target.with_suffix(".dedup.csv")
with target.open("r", encoding="utf-8", newline="") as source:
    reader = csv.DictReader(source)
    fields = reader.fieldnames
    records = {}
    for row in reader:
        current = records.get(row["card_id"])
        if current is None:
            records[row["card_id"]] = row
            continue
        if current["customer_id"] != row["customer_id"]:
            raise SystemExit(f"Card {row['card_id']} has conflicting customers")
        score = lambda item: sum(bool(value) for value in item["card_fingerprint"].split("|"))
        if score(row) > score(current):
            current["card_fingerprint"], current["card4"], current["card6"] = row["card_fingerprint"], row["card4"], row["card6"]
        current["card_first_seen"] = min(current["card_first_seen"], row["card_first_seen"])
        current["card_last_seen"] = max(current["card_last_seen"], row["card_last_seen"])

with temporary.open("w", encoding="utf-8", newline="") as output:
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(records[key] for key in sorted(records))
temporary.replace(target)
print(f"Wrote {len(records):,} unique cards")
