import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  DollarSign,
  FileText,
  Layers,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { CaseSummary } from '../types/fraud';

export function Investigations() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [patternFilter, setPatternFilter] = useState('ALL');
  const [sarFilter, setSarFilter] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiService
      .getCases()
      .then((data) => {
        if (mounted) setCases(data);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // Filtered cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      const q = search.toLowerCase();
      const matchesSearch =
        c.case_id.toLowerCase().includes(q) ||
        c.transaction.toLowerCase().includes(q) ||
        c.customer.toLowerCase().includes(q) ||
        c.card.toLowerCase().includes(q) ||
        c.pattern.toLowerCase().includes(q);

      const matchesPattern = patternFilter === 'ALL' || c.pattern === patternFilter;
      const matchesSar = !sarFilter || c.sar_required;

      return matchesSearch && matchesPattern && matchesSar;
    });
  }, [cases, search, patternFilter, sarFilter]);

  // Aggregate Metrics
  const totalExposure = useMemo(
    () => cases.reduce((acc, c) => acc + c.exposure, 0),
    [cases]
  );
  const suspectedFraudCount = useMemo(
    () => cases.filter((c) => c.fraud_probability >= 0.7).length,
    [cases]
  );
  const sarRequiredCount = useMemo(
    () => cases.filter((c) => c.sar_required).length,
    [cases]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
            Triage & Operations Queue
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            Active Investigations
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            20 IEEE-CIS benchmark fraud cases verified by deterministic graph evidence.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400" />
          <span>Real-time local cache · 20 Cases active</span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Open Cases */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Open Cases</span>
            <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
              <Layers size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{cases.length}</p>
          <p className="mt-1 text-[11px] text-cyan-400">20 Benchmark Pack</p>
        </div>

        {/* Total Exposure */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Exposure</span>
            <div className="rounded-lg bg-amber-400/10 p-2 text-amber-300">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">
            ${totalExposure.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Identified fraud amount</p>
        </div>

        {/* Suspected Fraud Cases */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Suspected Fraud</span>
            <div className="rounded-lg bg-rose-400/10 p-2 text-rose-300">
              <ShieldAlert size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-rose-400">{suspectedFraudCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">Prob ≥ 70% threshold</p>
        </div>

        {/* SAR Required */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">SAR Required</span>
            <div className="rounded-lg bg-purple-400/10 p-2 text-purple-300">
              <FileText size={18} />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-purple-400">{sarRequiredCount}</p>
          <p className="mt-1 text-[11px] text-slate-400">FinCEN filings needed</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by Case ID (e.g. HHG-002), Customer, Card, or Txn..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Pattern Selector */}
          <select
            value={patternFilter}
            onChange={(e) => setPatternFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 focus:border-cyan-400 focus:outline-none"
          >
            <option value="ALL">All Patterns</option>
            <option value="card_not_present_new_device">CNP (New Device)</option>
            <option value="out_of_region_use">Out of Region</option>
            <option value="card_not_present_fraud">Card Not Present</option>
            <option value="card_testing">Card Testing</option>
            <option value="undocumented">Undocumented</option>
          </select>

          {/* SAR Only Toggle */}
          <button
            onClick={() => setSarFilter(!sarFilter)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              sarFilter
                ? 'border-purple-500/40 bg-purple-500/20 text-purple-300'
                : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-white'
            }`}
          >
            <FileText size={13} />
            <span>SAR Only</span>
          </button>
        </div>
      </div>

      {/* Professional Triage Queue Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70 shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3.5">Case ID</th>
                <th className="px-4 py-3.5">Transaction</th>
                <th className="px-4 py-3.5">Risk / Prob</th>
                <th className="px-4 py-3.5">Pattern</th>
                <th className="px-4 py-3.5">Exposure</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">SAR</th>
                <th className="px-4 py-3.5">Next Best Action</th>
                <th className="px-4 py-3.5 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    Loading queue items...
                  </td>
                </tr>
              ) : filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    No investigations match your filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((c) => {
                  const probPct = Math.round(c.fraud_probability * 100);
                  const isHHG002 = c.case_id === 'HHG-002';

                  return (
                    <tr
                      key={c.case_id}
                      className={`transition-colors hover:bg-slate-800/40 ${
                        isHHG002 ? 'bg-cyan-500/[0.04]' : ''
                      }`}
                    >
                      {/* Case ID */}
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/workspace/${c.case_id}`}
                          className="flex items-center gap-1.5 font-bold text-white hover:text-cyan-400"
                        >
                          <span className={isHHG002 ? 'text-cyan-300' : ''}>{c.case_id}</span>
                          {isHHG002 && (
                            <span className="rounded bg-cyan-400/20 px-1 py-0.5 text-[9px] font-extrabold text-cyan-300">
                              BENCHMARK
                            </span>
                          )}
                        </Link>
                        <p className="text-[10px] text-slate-500">{c.customer}</p>
                      </td>

                      {/* Transaction */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-slate-200">#{c.transaction}</span>
                        <p className="text-[10px] text-slate-500">${c.amount.toFixed(2)}</p>
                      </td>

                      {/* Risk / Fraud Probability */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold ${
                              probPct >= 75
                                ? 'text-rose-400'
                                : probPct >= 50
                                ? 'text-amber-400'
                                : 'text-emerald-400'
                            }`}
                          >
                            {probPct}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            (Risk: {c.risk_score.toFixed(2)})
                          </span>
                        </div>
                      </td>

                      {/* Pattern */}
                      <td className="px-4 py-3.5">
                        <span className="rounded bg-slate-800/90 px-2 py-0.5 text-[11px] text-slate-300">
                          {c.pattern.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Exposure */}
                      <td className="px-4 py-3.5 font-bold text-white">
                        ${c.exposure.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 capitalize text-slate-300">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                          {c.status}
                        </span>
                      </td>

                      {/* SAR */}
                      <td className="px-4 py-3.5">
                        {c.sar_required ? (
                          <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[10px] font-bold text-purple-300">
                            REQUIRED
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">No</span>
                        )}
                      </td>

                      {/* Next Best Action */}
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-cyan-300">{c.next_best_action}</span>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500">{c.action_route}</p>
                      </td>

                      {/* Inspect link */}
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/workspace/${c.case_id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 transition hover:border-cyan-400 hover:bg-cyan-400 hover:text-slate-950"
                        >
                          Open <ArrowRight size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}