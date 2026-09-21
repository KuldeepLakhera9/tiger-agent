import csv
from collections import defaultdict

base = r"C:\Users\rania\Downloads"
with open(base + r"\case_pack.csv", encoding="utf-8-sig", newline="") as stream:
    cases = list(csv.DictReader(stream))
case_by_txn = {case["flagged_txn_id"]: case for case in cases}
customers = {case["customer_id"] for case in cases}
cards = defaultdict(dict)
flagged = {}
with open(base + r"\transactions.csv", encoding="utf-8-sig", newline="") as stream:
    for row in csv.DictReader(stream):
        if row["customer_id"] in customers:
            signature = "|".join(row.get(key, "") for key in ("card1", "card2", "card3", "card4", "card5", "card6"))
            current = cards[row["customer_id"]].get(signature)
            dt = float(row["TransactionDT"])
            if current is None or dt < current[0]:
                cards[row["customer_id"]][signature] = (dt, row["ts"], row["TransactionID"])
        if row["TransactionID"] in case_by_txn:
            flagged[row["TransactionID"]] = row

for case in cases:
    row = flagged[case["flagged_txn_id"]]
    signature = "|".join(row.get(key, "") for key in ("card1", "card2", "card3", "card4", "card5", "card6"))
    print(case["case_id"], case["card_id"], "flag=", signature, "DT", row["TransactionDT"], "cards=")
    for item, meta in sorted(cards[case["customer_id"]].items(), key=lambda entry: entry[1]):
        print(" ", meta, item)
