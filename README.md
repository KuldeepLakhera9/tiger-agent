# FRAUDGRAPH — Agentic Fraud Investigation Command Center
> **TigerGraph × HHGoa 2026 — Explainable Fraud Investigation**

FRAUDGRAPH is an agentic fraud investigation system and interactive command center powered by **TigerGraph**, **GraphRAG**, and deterministic policy enforcement. It investigates suspicious banking transaction alerts, gathers evidence across graph relationships, evaluates historical case precedents, quantifies uncertainty, and recommends policy-compliant next actions with an auditable case trail.

---

## 1. What FRAUDGRAPH Is
FRAUDGRAPH bridges the gap between raw machine-learning fraud scores and defensible banking actions. When an alert fires, FRAUDGRAPH orchestrates an investigation that:
1. Reconstructs the transaction's multi-hop relational subgraph.
2. Cross-references historical case memory for behavioral precedents.
3. Detects known typologies (card testing, card-not-present, new device, out-of-region, undocumented).
4. Rigorously assesses risk while explicitly preserving uncertainty.
5. Recommends controlled evidence-gathering steps or policy-compliant actions.
6. Maintains an immutable, auditable investigation timeline.

---

## 2. Problem Being Solved
Traditional fraud detection relies on isolated machine learning risk scores that indicate *that* something is suspicious, but cannot explain *why*, *how far* the episode extends, or *what* should be done. Investigators are overwhelmed by false positives and lack the relational context to distinguish genuine cardholder trips from stolen card credentials. FRAUDGRAPH leverages native graph relationships to evaluate account origins, shared infrastructure, and historical outcomes in seconds.

---

## 3. Why TigerGraph Is Used
Relational databases struggle with multi-hop identity traversal: querying whether a transaction was initiated from a device associated with other cards under investigation requires costly recursive joins. 

TigerGraph's native parallel graph architecture and GSQL query language enable:
* **Deep Multi-Hop Subgraph Extraction**: Traversal across `Customer ➔ OWNS ➔ Card ➔ MADE ➔ Transaction ➔ FROM_DEVICE ➔ DeviceProfile` in sub-second latency.
* **Coordinated Abuse Detection**: Identifying multiple payment cards sharing identical billing regions or device fingerprints within sliding temporal windows.
* **Institutional Memory Retrieval**: Efficiently querying thousands of closed historical cases linked to account entities.

---

## 4. Architecture

```
                    ┌────────────────────────────────────────────────────────┐
                    │            FRAUDGRAPH React + Vite Frontend            │
                    │   Interactive Command Center · React Flow · Recharts   │
                    └───────────────────────────┬────────────────────────────┘
                                                │ REST API (JSON)
                                                ▼
                    ┌────────────────────────────────────────────────────────┐
                    │               FastAPI Investigation API                │
                    │   Lifecycle · Actions · Subgraphs · Timeline · Metrics  │
                    └───────────────────────────┬────────────────────────────┘
                                                │
                     ┌──────────────────────────┴───────────────────────────┐
                     ▼                                                      ▼
     ┌───────────────────────────────┐                    ┌──────────────────────────────────┐
     │      TigerGraph Backend       │                    │    Deterministic Local Fallback  │
     │  REST++ Queries & GraphRAG   │                    │  20 Verified Benchmark Cases    │
     │  · alert_context             │                    │  · Policy Engine (R1–R9)        │
     │  · card_history              │                    │  · Institutional Memory (5,565) │
     │  · device_connected_cards    │                    │  · Strict Validation Suite      │
     │  · similar_closed_cases      │                    │  · Prepared Relational CSVs     │
     └───────────────────────────────┘                    └──────────────────────────────────┘
```

---

## 5. Agent Investigation Workflow
Every alert is investigated through an explicit 12-step pipeline:

```
UNCERTAIN FRAUD SIGNAL (Alert Ingestion)
               ↓
STEP 1:  Identify Flagged Transaction (#3478782)
               ↓
STEP 2:  Trace Account Holder / Customer Vertex (C11891)
               ↓
STEP 3:  Trace Payment Instrument / Card Vertex (C11891-K1)
               ↓
STEP 4:  Retrieve Card Transaction History & Temporal Burst Analysis
               ↓
STEP 5:  Investigate Device Telemetry (Evaluate Presence / Availability)
               ↓
STEP 6:  Analyze Geographic Billing & Email Domain Signals
               ↓
STEP 7:  Classify Fraud Typology Pattern
               ↓
STEP 8:  Query Institutional Memory for Similar Closed Cases
               ↓
STEP 9:  Derive Evidence-Based Fraud Probability & Exposure
               ↓
STEP 10: Perform Uncertainty Check (Confidence Assessment)
               ↓
STEP 11: Controlled Action Selection (Verification vs. Immediate Block)
               ↓
STEP 12: Next Best Action Recommendation & Case Lifecycle Progression
```

---

## 6. Evidence Gathering
FRAUDGRAPH gathers evidence systematically using GSQL queries and structured GraphRAG retrieval:
* **`alert_context(txn_id)`**: Identifies the primary transaction, associated card, customer owner, device profile (if available), billing region, and email domain.
* **`card_history(card_id)`**: Retrieves all transactions on the card to identify baseline velocity, preceding amounts, and sequences.
* **`device_connected_cards(device_id)`**: Discovers whether other cards share the same hardware fingerprint.
* **`region_connected_cards(region_id)`**: Examines cross-card transaction clustering in new geographic areas.
* **`similar_closed_cases(card_id, device_id)`**: Gathers past investigation outcomes sharing identical card or device identifiers.

---

## 7. Risk Assessment
Risk is computed deterministically from evidence signals rather than arbitrary guesswork:
* **Base Probability**: `0.22 + 0.28 * model_risk_score`
* **Independent Evidence Modifiers**:
  * Card-testing sequence (3+ micro-charges < $5 followed by larger purchase): `+0.27`
  * Cardholder customer report of unauthorized use: `+0.22`
  * Shared origin across cards: `+0.12`
  * High-risk card burst (2+ charges in 48h with risk score >= 0.7): `+0.10`
  * Out-of-region billing marker: `+0.10`
  * New device marker on account: `+0.10`
  * Confirmed prior fraud on entity: `+0.06`
* Clamped strictly between `0.05` and `0.95`.
* **Verdicts**:
  * `fraud`: Probability $\ge 0.70$ or explicit customer denial.
  * `uncertain`: $0.25 < \text{Probability} < 0.70$.
  * `legitimate`: Probability $\le 0.25$ with no anomalous pattern.

---

## 8. Historical Case Memory
The repository includes 5,565 closed historical cases from July through October (`closed_cases_history.csv`), including 4,665 confirmed frauds and 900 cleared false alarms. 

FRAUDGRAPH uses these cases as institutional memory:
1. Past cases sharing the card, device, or pattern are retrieved.
2. Historical analyst notes and resolution actions are displayed for context.
3. Precedents inform confidence but **never** blindly dictate an automatic verdict.

---

## 9. Uncertainty Is a Feature
FRAUDGRAPH treats uncertainty as a critical signal rather than hiding it:
* **Evidence Availability**: Explicitly distinguishes between `Available`, `Unavailable`, and `Not Applicable`.
* **No Telemetry Fabrication**: For cases like **HHG-002** where device evidence was not captured in raw logs, the system explicitly marks device evidence as `Unavailable`, renders zero fictitious device nodes, and prevents false "shared device" claims.
* **Confidence Gating**: Low or medium confidence prevents irreversible automated card blocking, directing the workflow to customer verification first.

---

## 10. Controlled Actions
When evidence is uncertain, the system executes controlled evidence-gathering actions before taking severe account actions:
* `VERIFY_WITH_CUSTOMER`: Dispatches an out-of-band challenge (SMS/Push) to verify charge legitimacy.
* `REQUEST_ADDITIONAL_EVIDENCE`: Requests carrier telemetry, IP classification, or merchant order details.
* `BLOCK_CARD`: Restricts payment instrument upon confirmed compromise (L1/L2 approval).
* `DECLINE_TRANSACTION`: Declines pending authorization in real time.
* `CREATE_CASE`: Establishes formal docket in the internal fraud registry.
* `FILE_REPORT`: Submits FinCEN Suspicious Activity Report (SAR) when criteria are met.

> **Note on Simulation**: In compliance with the anti-hallucination guidelines, external interventions (e.g. sending cardholder SMS or ledger mutations) are labeled as **`SIMULATED / DEMO ACTION`** in the interface.

---

## 11. Case Lifecycle
Cases transition through seven formal lifecycle stages:
$$\text{ALERTED} \longrightarrow \text{INVESTIGATING} \longrightarrow \text{EVIDENCE\_GATHERED} \longrightarrow \text{REVIEW} \longrightarrow \text{ACTION\_RECOMMENDED} \longrightarrow \text{ACTION\_APPROVED} \longrightarrow \text{RESOLVED}$$

Every stage transition and executed action is appended to the case's immutable audit log with:
* Timestamp
* Actor (`Agent`, `Fraud Analyst (L1)`, `Fraud Manager (L2)`, `Customer`)
* Action Name & Rationale
* What Changed description

---

## 12. Frontend
Built with **React 19**, **Vite**, **TypeScript**, and **Tailwind CSS**:
* **Operations Command Center (`/overview`)**: High-level KPIs, benchmark spotlight, and priority triage table.
* **Case Queue (`/investigations`)**: Filterable operations queue with search, pattern breakdown, SAR filters, and quick inspection links.
* **Investigation Workspace (`/workspace/:id`)**:
  * Interactive **Case Lifecycle Stepper**
  * Risk and Exposure Gauges
  * Interactive **React Flow Subgraph Canvas** (`FraudGraphCanvas`)
  * Uncertainty & Evidence Quality Breakdown
  * Next Best Action & Controlled Actions Hub
  * Immutable Investigation Timeline & Audit Trail
  * Institutional Memory Precedents Card
* **Graph Explorer (`/graph`)**: Inspect subgraphs with vertex schema legend and GSQL query viewer.
* **Historical Cases (`/historical`)**: Searchable index of all 5,565 historical precedents.
* **Analytics (`/analytics`)**: Recharts visualizations of exposure distribution, pattern typologies, and policy actions.
* **Trigger Alerts Feed (`/alerts`)**: Real-time incoming event feed by trigger type.

---

## 13. Backend
Built with **FastAPI**, **Uvicorn**, and **Pydantic v2**:
* `GET /api/health`: Connection status, cases count, and backend mode.
* `GET /api/cases`: List all 20 benchmark case summaries.
* `GET /api/cases/{case_id}`: Full case intelligence record.
* `GET /api/cases/{case_id}/graph`: Verified nodes and edges for React Flow canvas.
* `GET /api/cases/{case_id}/timeline`: Audit trail and timeline events.
* `GET /api/cases/{case_id}/evidence`: Raw evidence items, requests, and stop reasons.
* `POST /api/cases/{case_id}/action`: Execute controlled actions and record audit events.
* `POST /api/cases/{case_id}/lifecycle`: Advance lifecycle stages.
* `POST /api/cases/{case_id}/reset`: Reset case state to default benchmark baseline.
* `POST /api/investigate`: Run investigation for any case or transaction ID.
* `GET /api/analytics`: Aggregate statistics across benchmark dataset.
* `GET /api/historical`: List referenced closed historical cases.

---

## 14. TigerGraph Setup
GSQL schema and query definitions reside in `codex/tigergraph-fraud-starter/`:

1. **Create Schema**:
   ```bash
   gsql codex/tigergraph-fraud-starter/schema.gsql
   ```
2. **Install Queries**:
   ```bash
   gsql codex/tigergraph-fraud-starter/queries.gsql
   ```
3. **Execute Loading Jobs**:
   ```bash
   gsql codex/load_jobs_mvp.gsql
   ```

Verified schema vertices:
* `Customer`, `Card`, `Transaction`, `DeviceProfile`, `BillingRegion`, `EmailDomain`, `ClosedCase`, `FraudCase`
Directed edges:
* `OWNS` (`Customer` $\to$ `Card`), `MADE` (`Card` $\to$ `Transaction`), `FROM_DEVICE` (`Transaction` $\to$ `DeviceProfile`), `BILLED_IN` (`Transaction` $\to$ `BillingRegion`), `NEXT` (`Transaction` $\to$ `Transaction`), `INVOLVES` (`ClosedCase` $\to$ `Transaction`).

---

## 15. Local Development

### Prerequisites
* Python 3.10+
* Node.js 18+ and npm

### Backend Setup
```bash
# From repository root:
pip install -r backend/requirements.txt
python3 -m uvicorn backend.main:app --reload --port 8000
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 16. Environment Variables
Copy `.env.example` to `.env` to configure your environment:

| Variable | Description | Default / Example |
|---|---|---|
| `TIGERGRAPH_HOST` | TigerGraph REST++ endpoint | `https://your-domain.i.tgcloud.io` (Optional) |
| `TIGERGRAPH_GRAPH` | Graph name | `FraudInvestigation` |
| `TIGERGRAPH_TOKEN` | Bearer API token | *(Optional)* |
| `TIGERGRAPH_USERNAME` | Basic auth username | `tigergraph` *(Optional)* |
| `TIGERGRAPH_PASSWORD` | Basic auth password | *(Optional)* |
| `PORT` | FastAPI backend port | `8000` |
| `VITE_API_URL` | Frontend API URL | `/api` |

> **Graceful Fallback**: If `TIGERGRAPH_HOST` is omitted, FRAUDGRAPH runs in **Deterministic Benchmark Fallback Mode** with 100% functionality and zero errors.

---

## 17. Benchmark Validation
Run the benchmark validation suite and API unit tests at any time:

```bash
# Run full automated test suite:
npm test

# Run benchmark validator directly:
python3 agent/validate_answers.py

# Run unit tests directly:
python3 -m unittest discover tests
```

---

## 18. Example Walkthrough: Case HHG-002
Case **HHG-002** is the primary benchmark reference case:
* **Trigger**: Model risk score `0.79` on online transaction `#3478782` ($292.36).
* **Card & Customer**: Customer `C11891`, Card `C11891-K1`.
* **Graph Traversal**: Verifies `Customer(C11891) -[:OWNS]-> Card(C11891-K1) -[:MADE]-> Transaction(3478782)`.
* **Device Telemetry**: **UNAVAILABLE**. No device profile was captured.
  * `connected_device_profiles`: `[]`
  * `has_device`: `false`
  * `device_status`: `"Device evidence unavailable"`
* **Probability**: `0.50` (Uncertainty preserved due to lack of device signal).
* **Pattern**: `card_not_present_fraud`.
* **Recommended Next Best Action**: `VERIFY_WITH_CUSTOMER`, `CREATE_CASE` (Route: `auto`).
* **SAR Filing**: `false` (Below $1,000 threshold without shared origin).
* **Interactive Demo**: Clicking **"Execute: VERIFY_WITH_CUSTOMER"** simulates the cardholder verification challenge, updates the case lifecycle to `REVIEW`, and records an auditable event in the timeline.

---

## 19. Limitations
1. **Simulated Interventions**: Out-of-band customer verification calls/SMS and banking ledger mutations are simulated in demo mode.
2. **Dataset Anonymization**: Entity IDs (`C11891`, `C11891-K1`) and billing codes (`addr1`) are derived from the anonymized IEEE-CIS dataset.
3. **Graph Write Permissions**: Graph writes in the public challenge environment require write privileges on the host graph.

---

## 20. Deployment

### Production Docker Build
A multi-stage Dockerfile is provided to build and serve both the frontend and backend in a unified container:

```bash
docker build -t fraudgraph:latest .
docker run -p 8000:8000 fraudgraph:latest
```

### Render Deployment
Configuration is defined in `render.yaml`:
* Web Service for FastAPI (`fraudgraph-backend`)
* Static Site for Frontend (`fraudgraph-frontend`)

### Vercel Deployment
Frontend is configured for seamless deployment with zero configuration using `vercel.json`.

---

## License
MIT License. Built for the TigerGraph × Hacker House Goa 2026 Hackathon.
