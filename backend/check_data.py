import pandas as pd
from pathlib import Path

DATA_DIR = Path("../data")

print("Checking dataset...\n")

transactions = pd.read_csv(
    DATA_DIR / "transactions.csv",
    nrows=5
)

identity = pd.read_csv(
    DATA_DIR / "identity.csv",
    nrows=5
)

closed_cases = pd.read_csv(
    DATA_DIR / "closed_cases_history.csv",
    nrows=5
)

case_pack = pd.read_csv(
    DATA_DIR / "case_pack.csv"
)

print("TRANSACTIONS")
print(transactions.shape)
print(transactions.columns.tolist())

print("\nIDENTITY")
print(identity.shape)
print(identity.columns.tolist())

print("\nCLOSED CASES")
print(closed_cases.shape)
print(closed_cases.columns.tolist())

print("\nCASE PACK")
print(case_pack.shape)
print(case_pack.columns.tolist())

print("\n20 CASES")
print(case_pack.to_string(index=False))