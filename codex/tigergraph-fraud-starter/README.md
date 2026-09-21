# TigerGraph fraud investigation starter

This package is the first build stage for the HHGOA dataset: graph schema, deterministic input preparation, loading jobs, and five investigation queries. It intentionally contains no case conclusions: the supplied CSVs were not available in this workspace, so HHG-002 has not been investigated or pre-judged.

## Data contract

Put the four supplied UTF-8 CSVs in `data/`:

- `transactions.csv`
- `identity.csv`
- `closed_cases_history.csv`
- `case_pack.csv`

Run:

```powershell
python .\prepare_tigergraph_inputs.py --input-dir .\data --output-dir .\prepared
```

The preflight verifies headers and checks that the deterministic `card_id` mapping agrees with every benchmark case. If the source already has `card_id`, it is used. Otherwise it derives `customer_id-K<n>` from the card fingerprint, ordered by first observed transaction. A mismatch stops the run rather than loading relationships that cannot be tied back to the case pack.

`features_json` preserves every input column, including the original Vesta columns, on `Transaction` and `DeviceProfile`. Investigation fields are also promoted to typed attributes. This keeps the graph practical while retaining source-level provenance.

## Load order

1. Create a Savanna workspace or TigerGraph Community Edition graph named `FraudInvestigation`.
2. In GSQL, run `schema.gsql`.
3. Copy `prepared/` to a path visible to TigerGraph (for Savanna, upload it to a loader-visible location) and set the four paths in `load_jobs.gsql`.
4. Run `load_jobs.gsql`, then `RUN LOADING JOB load_fraud_data`.
5. Run `queries.gsql`, then `INSTALL QUERY` for the five queries.

The loader uses named CSV headers, standard comma separators, and double-quote CSV escaping, matching TigerGraph's documented loading-job syntax. See TigerGraph's [loading-job reference](https://docs.tigergraph.com/gsql-ref/current/ddl-and-loading/creating-a-loading-job).

## What gets modeled

`Customer -> Card -> Transaction` is the core path. Online transactions link to deterministic device profiles; transactions also link to billing regions and purchaser/recipient domains. `NEXT` edges provide time order per card. Closed cases link back to their transactions and cards. `FraudCase` is reserved for open and agent-authored case memory, including the twenty benchmark-case stubs.

`prepare_tigergraph_inputs.py` creates these loader files:

| File | Purpose |
|---|---|
| `cards.csv` | deterministic, cross-checked card-ID mapping and card/customer metadata |
| `transactions.csv` | transaction, customer and card values |
| `identity.csv` | device profile values and transaction-device links |
| `txn_regions.csv` | transaction-region links |
| `txn_emails.csv` | transaction-domain links, with purchaser/recipient role |
| `next_transactions.csv` | consecutive transactions for each card |
| `closed_cases.csv` | closed-case records |
| `closed_case_transactions.csv` | expanded pipe-separated historical transaction links |
| `closed_case_cards.csv` | primary and connected-card links |
| `case_pack.csv` | open benchmark-case stubs |

## Manual HHG-002 investigation (after loading)

1. Run `alert_context("3478782")`; confirm the exact card, customer, device, region, risk input and transaction facts.
2. Run `card_history("C11891-K1")`; inspect the transaction sequence before and after 2016-11-22 23:27:07. Do not call the risk score a verdict.
3. Use the returned device ID with `device_connected_cards`; identify other cards and cases sharing it.
4. Run `region_connected_cards` for the flagged billing region; treat a regional link as evidence only if it is temporally and behaviorally meaningful.
5. Run `similar_closed_cases` for the card and device. Compare confirmed and cleared history, then record which case IDs actually influenced the decision.
6. If evidence remains weak, record an `evidence_request` and initial policy-compliant recommendation; only then simulate a response and produce final actions. Do not invent the result before querying the supplied data.

The queries are evidence retrieval primitives, not a classifier. The agent/policy layer should synthesize their results and write its completed `FraudCase` record back to the graph.
