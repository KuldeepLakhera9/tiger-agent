import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  MessageSquare,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { CaseSummary } from '../types/fraud';

export function Alerts() {
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    let mounted = true;
    apiService
      .getCases()
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
    if (filterType === 'ALL') return true;
    return c.trigger_type === filterType;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Real-Time Ingestion Feed
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            Trigger Alert Feed
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Incoming triggers from machine learning scoring models, cardholder dispute reports, and fraud analysts.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          {['ALL', 'risk_score', 'customer_report', 'analyst_request'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${
                filterType === type
                  ? 'border border-amber-400/40 bg-amber-400/15 text-amber-300'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white'
              }`}
            >
              {type === 'ALL' ? 'All Triggers' : type.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Alert Feed List */}
      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => {
            const isRisk = c.trigger_type === 'risk_score';
            const isCust = c.trigger_type === 'customer_report';

            return (
              <div
                key={c.case_id}
                className="flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center hover:border-slate-700 transition"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg border ${
                      isRisk
                        ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                        : isCust
                        ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                        : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                    }`}
                  >
                    {isRisk ? (
                      <AlertTriangle size={18} />
                    ) : isCust ? (
                      <MessageSquare size={18} />
                    ) : (
                      <Zap size={18} />
                    )}
                  </div>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-xs">{c.case_id}</span>
                      <span className="text-xs text-slate-500">·</span>
                      <span className="text-xs font-semibold text-slate-300">
                        Txn #{c.transaction}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          isRisk
                            ? 'bg-amber-500/20 text-amber-300'
                            : isCust
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {c.trigger_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        Opened: {c.opened_at || '2016-11-20'}
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-3xl">
                      {c.trigger_text || `Alert fired on transaction ${c.transaction}`}
                    </p>

                    <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Customer: <strong className="text-slate-400">{c.customer}</strong></span>
                      <span>·</span>
                      <span>Card: <strong className="text-slate-400">{c.card}</strong></span>
                      <span>·</span>
                      <span>Amount: <strong className="text-slate-300">${c.amount.toFixed(2)}</strong></span>
                      {c.risk_score > 0 && (
                        <>
                          <span>·</span>
                          <span>Model Risk: <strong className="text-amber-300">{c.risk_score.toFixed(2)}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 border-t border-slate-800/60 pt-3 sm:border-0 sm:pt-0">
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-cyan-300">{c.next_best_action}</span>
                    <p className="text-[10px] text-slate-500">Prob: {Math.round(c.fraud_probability * 100)}%</p>
                  </div>
                  <Link
                    to={`/workspace/${c.case_id}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:border-cyan-400 hover:text-white transition"
                  >
                    Investigate <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}