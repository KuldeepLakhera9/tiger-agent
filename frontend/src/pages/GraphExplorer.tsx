import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { apiService } from '../services/apiService';
import { FraudGraphCanvas } from '../components/graph/FraudGraphCanvas';
import type { CaseSummary, GraphResponse } from '../types/fraud';

export function GraphExplorer() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('HHG-002');
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiService.getCases().then((list) => {
      if (mounted) {
        setCases(list);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    apiService
      .getGraph(selectedCaseId)
      .then((g) => {
        if (mounted) setGraphData(g);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [selectedCaseId]);

  const currentCase = cases.find((c) => c.case_id === selectedCaseId);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
            Graph Subgraph Traversal
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            Graph Relationship Explorer
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Inspect verified subgraphs connecting customers, payment cards, transactions, and devices.
          </p>
        </div>

        {/* Case Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-400">Select Investigation:</label>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="rounded-xl border border-cyan-500/40 bg-slate-900 px-4 py-2.5 text-xs font-bold text-cyan-300 focus:border-cyan-400 focus:outline-none shadow-lg"
          >
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id} className="bg-slate-950 text-white">
                {c.case_id} — #{c.transaction} ({c.pattern.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Case Overview Ribbon */}
      {currentCase && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-[10px] uppercase text-slate-500">Case</span>
              <p className="font-bold text-white">{currentCase.case_id}</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-[10px] uppercase text-slate-500">Customer</span>
              <p className="font-semibold text-slate-200">{currentCase.customer}</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-[10px] uppercase text-slate-500">Card</span>
              <p className="font-semibold text-slate-200">{currentCase.card}</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-[10px] uppercase text-slate-500">Flagged Txn</span>
              <p className="font-semibold text-amber-300">#{currentCase.transaction}</p>
            </div>
            <div className="border-l border-slate-800 pl-4">
              <span className="text-[10px] uppercase text-slate-500">Exposure</span>
              <p className="font-bold text-white">${currentCase.exposure.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {selectedCaseId === 'HHG-002' ? (
              <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                Device evidence unavailable (Truthful state)
              </span>
            ) : graphData?.has_device ? (
              <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                Device Profile Verified
              </span>
            ) : (
              <span className="rounded-lg border border-slate-800 bg-slate-800 px-2.5 py-1 text-xs text-slate-400">
                In-person or no device record
              </span>
            )}
          </div>
        </div>
      )}

      {/* Main Canvas & Details Panel Layout */}
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-9">
          {loading || !graphData ? (
            <div className="flex h-[620px] items-center justify-center rounded-2xl border border-slate-800 bg-slate-950">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            </div>
          ) : (
            <FraudGraphCanvas
              nodes={graphData.nodes}
              edges={graphData.edges}
              caseId={selectedCaseId}
              hasDevice={graphData.has_device}
              deviceStatus={graphData.device_status}
              height="620px"
            />
          )}
        </div>

        {/* Node & Schema Inspector Panel */}
        <div className="col-span-12 space-y-4 lg:col-span-3">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur text-xs">
            <h3 className="font-bold text-white border-b border-slate-800 pb-3 flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              Graph Schema & Entities
            </h3>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-2.5">
                <p className="font-bold text-cyan-300">Vertex: Customer</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Unique bank account holder identified by customer_id.
                </p>
              </div>

              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-2.5">
                <p className="font-bold text-violet-300">Vertex: Card</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Payment card with fingerprint, network, and type.
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5">
                <p className="font-bold text-amber-300">Vertex: Transaction</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Financial authorization carrying timestamp, amount, and risk score.
                </p>
              </div>

              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <p className="font-bold text-emerald-300">Vertex: DeviceProfile</p>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Hardware and connection fingerprint for online transactions.
                </p>
              </div>
            </div>

            <div className="mt-5 border-t border-slate-800 pt-4">
              <h4 className="font-semibold text-slate-300">GSQL Traversal Query</h4>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-950 p-2 text-[10px] text-slate-400 font-mono">
                {`alert_context("${currentCase?.transaction || '3478782'}")`}
              </pre>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}