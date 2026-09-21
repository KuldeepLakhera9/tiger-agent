import pandas as pd

TRANSACTION_ID = 3478782

df = pd.read_csv(
    "../data/transactions.csv",
    usecols=[
        "TransactionID",
        "TransactionAmt",
        "ProductCD",
        "card1",
        "card2",
        "card3",
        "card4",
        "card5",
        "card6",
        "addr1",
        "addr2",
        "P_emaildomain",
        "R_emaildomain",
        "customer_id",
        "ts",
        "channel",
        "risk_score"
    ]
)

transaction = df[
    df["TransactionID"] == TRANSACTION_ID
]

print(transaction.to_string(index=False))