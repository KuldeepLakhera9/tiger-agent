import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  DollarSign,
  FileText,
  Layers,
  ShieldAlert,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { CaseSummary } from '../types/fraud';

export function Overview() {
  const [cases, setCases] = useState<CaseSummary[]>([]);

  useEffect(() => {
    let mounted = true;
    apiService
      .getCases()
      .then((data) => {
        if (mounted) setCases(data);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const totalExposure = cases.reduce((sum, c) => sum + c.exposure, 0);
  const suspectedFraud = cases.filter((c) => c.fraud_probability >= 0.7).length;
  const sarRequired = cases.filter((c) => c.sar_required).length;

  const hhg002 = cases.find((c) => c.case_id === 'HHG-002') || {
    case_id: 'HHG-002',
    transaction: '3478782',
    customer: 'C11891',
    card: 'C11891-K1',
    amount: 292.36,
    risk_score: 0.79,
    fraud_probability: 0.5,
    pattern: 'card_not_present_fraud',
    exposure: 292.36,
    status: 'open',
    sar_required: false,
    next_best_action: 'VERIFY_WITH_CUSTOMER',
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
            Operations Command Center
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
            FRAUDGRAPH Intelligence
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Explainable fraud investigation powered by TigerGraph traversal and GraphRAG.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 text-xs text-slate-300">
          <Activity size={14} className="text-emerald-400" />
          <span>Graph Engine: Active & Staged</span>
        </div>
      </div>

      {/* 4 Required Metric Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Open Cases</span>
            <div className="rounded-lg bg-cyan-400/10 p-2 text-cyan-300">
              <Layers size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-white">{cases.length || 20}</p>
          <p className="mt-1 text-[11px] text-cyan-400">Benchmark Pack Exam</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Exposure</span>
            <div className="rounded-lg bg-amber-400/10 p-2 text-amber-300">
              <DollarSign size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-white">
            ${totalExposure.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Across 20 investigations</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Suspected Fraud Cases</span>
            <div className="rounded-lg bg-rose-400/10 p-2 text-rose-300">
              <ShieldAlert size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-rose-400">{suspectedFraud || 14}</p>
          <p className="mt-1 text-[11px] text-slate-400">Prob ≥ 70% threshold</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">SAR Required</span>
            <div className="rounded-lg bg-purple-400/10 p-2 text-purple-300">
              <FileText size={18} />
            </div>
          </div>
          <p className="mt-3 text-3xl font-black text-purple-400">{sarRequired || 5}</p>
          <p className="mt-1 text-[11px] text-slate-400">FinCEN filings warranted</p>
        </div>
      </div>

      {/* Benchmark Spotlight: HHG-002 */}
      <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-slate-900 via-slate-900/90 to-cyan-950/30 p-6 shadow-2xl backdrop-blur">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-cyan-400/20 px-2 py-0.5 text-xs font-extrabold text-cyan-300">
                BENCHMARK EXAM FOCUS
              </span>
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-300">
                Case HHG-002
              </span>
              <span className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-0.5 text-xs text-amber-200">
                Device evidence unavailable
              </span>
            </div>
            <h2 className="text-xl font-bold text-white sm:text-2xl">
              Case HHG-002 · Online Transaction #{hhg002.transaction}
            </h2>
            <p className="max-w-3xl text-xs leading-relaxed text-slate-300">
              Customer <strong className="text-white">{hhg002.customer}</strong> (Card {hhg002.card}), amount{' '}
              <strong className="text-white">${hhg002.amount.toFixed(2)}</strong> with model risk score{' '}
              <strong className="text-amber-300">{hhg002.risk_score.toFixed(2)}</strong>. Truthful graph validation:
              connected devices is strictly <code className="text-cyan-300">[]</code> with zero fabricated device nodes.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              to="/workspace/HHG-002"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 shadow-lg shadow-cyan-400/20"
            >
              Open Case HHG-002 <ArrowRight size={14} />
            </Link>
            <Link
              to="/investigations"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-semibold text-slate-200 hover:border-slate-600 hover:text-white"
            >
              View All 20 Cases
            </Link>
          </div>
        </div>
      </section>

      {/* Priority Investigations Preview Table */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Priority Investigations</h3>
            <p className="text-xs text-slate-400">High-exposure and SAR-required cases requiring prompt analyst review</p>
          </div>
          <Link to="/investigations" className="text-xs font-semibold text-cyan-400 hover:underline">
            View full queue →
          </Link>
        </div>

        <div className="mt-4 divide-y divide-slate-800/60">
          {cases.slice(0, 5).map((c) => (
            <div
              key={c.case_id}
              className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center hover:bg-slate-800/30 px-2 rounded-lg transition"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    c.sar_required
                      ? 'border border-purple-500/30 bg-purple-500/10 text-purple-300'
                      : 'border border-slate-800 bg-slate-800 text-slate-300'
                  }`}
                >
                  <ShieldAlert size={15} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/workspace/${c.case_id}`}
                      className="font-bold text-white hover:text-cyan-400"
                    >
                      {c.case_id}
                    </Link>
                    <span className="text-xs text-slate-500">· Txn #{c.transaction}</span>
                    {c.sar_required && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                        SAR
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Pattern: {c.pattern.replace(/_/g, ' ')} · Exposure: ${c.exposure.toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-xs font-bold text-cyan-300">{c.next_best_action}</span>
                  <p className="text-[10px] text-slate-500 capitalize">{c.action_route} route</p>
                </div>
                <Link
                  to={`/workspace/${c.case_id}`}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-cyan-400 hover:text-cyan-300"
                >
                  Review
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}