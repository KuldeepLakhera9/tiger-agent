import { useEffect, useState } from 'react';
import {
  History,
  Search,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { HistoricalCase } from '../types/fraud';

export function HistoricalCases() {
  const [cases, setCases] = useState<HistoricalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('ALL');

  useEffect(() => {
    let mounted = true;
    apiService
      .getHistoricalCases()
      .then((res) => {
        if (mounted) setCases(res);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.case_id.toLowerCase().includes(q) ||
      c.customer_id.toLowerCase().includes(q) ||
      c.card_id.toLowerCase().includes(q) ||
      c.pattern.toLowerCase().includes(q) ||
      c.analyst_notes.toLowerCase().includes(q);

    const matchesOutcome = outcomeFilter === 'ALL' || c.outcome === outcomeFilter;
    return matchesSearch && matchesOutcome;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-fuchsia-400">
            Institutional Memory
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            Historical Closed Cases
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Past closed investigations (July–October) cited by the investigation engine to evaluate behavioral precedents.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
          <History size={14} className="text-fuchsia-400" />
          <span>Graph-Retrieved Precedents</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search historical cases (e.g. CC-4160, card, pattern, notes)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-fuchsia-400 focus:outline-none"
          />
        </div>

        <select
          value={outcomeFilter}
          onChange={(e) => setOutcomeFilter(e.target.value)}
          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-300 focus:border-fuchsia-400 focus:outline-none"
        >
          <option value="ALL">All Outcomes</option>
          <option value="confirmed_fraud">Confirmed Fraud</option>
          <option value="cleared">Cleared (False Alarm)</option>
        </select>
      </div>

      {/* Cases Grid */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-fuchsia-400 border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-8 text-center text-slate-500">
          No historical cases match your filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => {
            const isFraud = c.outcome === 'confirmed_fraud';
            return (
              <div
                key={c.case_id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg backdrop-blur hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-white text-sm">{c.case_id}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                        isFraud
                          ? 'border border-rose-500/30 bg-rose-500/15 text-rose-300'
                          : 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
                      }`}
                    >
                      {c.outcome.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1 text-xs">
                    <p className="text-slate-400">
                      Pattern:{' '}
                      <strong className="text-slate-200 capitalize">
                        {c.pattern.replace(/_/g, ' ')}
                      </strong>
                    </p>
                    <p className="text-slate-400">
                      Customer / Card:{' '}
                      <span className="font-mono text-slate-300">{c.customer_id}</span> ·{' '}
                      <span className="font-mono text-slate-300">{c.card_id}</span>
                    </p>
                    <p className="text-slate-400">
                      Exposure: <strong className="text-white">${c.exposure_usd.toFixed(2)}</strong>
                    </p>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-slate-300 line-clamp-3">
                    {c.analyst_notes || 'Investigation closed with full resolution.'}
                  </p>
                </div>

                <div className="mt-4 border-t border-slate-800/80 pt-3 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Actions: {c.actions_taken || 'N/A'}</span>
                  <span>SAR: {c.report_filed}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}