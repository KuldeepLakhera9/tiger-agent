import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  DollarSign,
  PieChart as PieIcon,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import type { AnalyticsOverview } from '../types/fraud';

const PALETTE = ['#22d3ee', '#818cf8', '#f59e0b', '#ec4899', '#10b981', '#a855f7'];

export function Analytics() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiService
      .getAnalytics()
      .then((res) => {
        if (mounted) setData(res);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (loading || !data) {
    return (
      <div className="flex min-h-[500px] items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </div>
    );
  }

  // Format pattern names for clean chart presentation
  const patternData = data.pattern_breakdown.map((p) => ({
    name: p.pattern.replace(/_/g, ' '),
    count: p.count,
  }));

  const exposureData = data.exposure_by_case.slice(0, 10).map((c) => ({
    case: c.case_id,
    exposure: c.exposure,
  }));

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
          Signal Intelligence & Pattern Metrics
        </p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">
          Investigation Analytics
        </h1>
        <p className="mt-1 text-xs text-slate-400">
          Empirical distribution across all 20 benchmark fraud cases derived from verified graph outputs.
        </p>
      </div>

      {/* Top Stat Strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-slate-400">Total Benchmark Cases</span>
          <p className="mt-2 text-2xl font-black text-white">{data.total_cases}</p>
          <p className="mt-1 text-[11px] text-cyan-400">100% Deterministic</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-slate-400">Total Episode Exposure</span>
          <p className="mt-2 text-2xl font-black text-white">
            ${data.total_exposure.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-[11px] text-amber-400">Cumulative Identified</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-slate-400">Mean Fraud Probability</span>
          <p className="mt-2 text-2xl font-black text-rose-400">
            {Math.round(data.avg_fraud_probability * 100)}%
          </p>
          <p className="mt-1 text-[11px] text-slate-400">Across all 20 episodes</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg backdrop-blur">
          <span className="text-xs font-semibold text-slate-400">Mandatory SAR Filings</span>
          <p className="mt-2 text-2xl font-black text-purple-400">{data.sar_required_count}</p>
          <p className="mt-1 text-[11px] text-purple-400">FinCEN compliant</p>
        </div>
      </div>

      {/* 4 Main Recharts Visualizations */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Fraud Probability Distribution */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Fraud Probability Distribution</h2>
            </div>
            <span className="text-xs text-slate-400">Cases per probability bracket</span>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.probability_distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  labelStyle={{ color: '#e2e8f0', fontWeight: 'bold' }}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[4, 4, 0, 0]} name="Cases Count" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 2. Top Exposure by Case */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white">Identified Exposure by Case (Top 10)</h2>
            </div>
            <span className="text-xs text-slate-400">USD Amount</span>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={exposureData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="case" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                  formatter={(val: unknown) => [`$${Number(val).toFixed(2)}`, 'Exposure']}
                />
                <Bar dataKey="exposure" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Exposure ($)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 3. Fraud Pattern Breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <PieIcon size={16} className="text-fuchsia-400" />
              <h2 className="text-sm font-bold text-white">Fraud Pattern Breakdown</h2>
            </div>
            <span className="text-xs text-slate-400">Classified typology</span>
          </div>

          <div className="mt-4 flex h-72 w-full flex-col sm:flex-row items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={patternData}
                  cx="50%"
                  cy="50%"
                  outerRadius={85}
                  innerRadius={45}
                  dataKey="count"
                  label={({ name, percent }: { name?: string; percent?: number }) =>
                    `${name || ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                  }
                  labelLine={false}
                >
                  {patternData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 4. Policy Actions & SAR Breakdown */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-purple-400" />
              <h2 className="text-sm font-bold text-white">Policy Decision & SAR Distribution</h2>
            </div>
            <span className="text-xs text-slate-400">Automated Next Best Action</span>
          </div>

          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.policy_action_breakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                <YAxis dataKey="action" type="category" stroke="#94a3b8" fontSize={10} width={130} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8 }}
                />
                <Bar dataKey="count" fill="#a855f7" radius={[0, 4, 4, 0]} name="Cases Applying Action" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}