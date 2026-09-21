import pandas as pd

case_pack = pd.read_csv("../data/case_pack.csv")

case = case_pack[
    case_pack["case_id"] == "HHG-002"
].iloc[0]

print("\nCASE")
print("=" * 60)

for column, value in case.items():
    print(f"{column}: {value}")