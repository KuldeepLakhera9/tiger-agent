import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  History,
  Network,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { FraudGraphCanvas } from '../components/graph/FraudGraphCanvas';
import type {
  BenchmarkCase,
  GraphResponse,
  HistoricalCase,
  TimelineEvent,
} from '../types/fraud';

export function InvestigationWorkspace() {
  const { id = 'HHG-002' } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<BenchmarkCase | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [historicalCases, setHistoricalCases] = useState<HistoricalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulatedActionStatus, setSimulatedActionStatus] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setSimulatedActionStatus(null);

    Promise.all([
      apiService.getCase(id),
      apiService.getGraph(id),
      apiService.getTimeline(id),
      apiService.getHistoricalCases(),
    ])
      .then(([c, g, t, h]) => {
        if (!mounted) return;
        setCaseData(c);
        setGraphData(g);
        setTimelineEvents(t);
        setHistoricalCases(h);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[600px] items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
          <p className="text-xs uppercase tracking-widest text-slate-400">Loading Case Intelligence...</p>
        </div>
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-white">Case Not Found</h2>
        <p className="mt-2 text-sm text-slate-400">The investigation case {id} does not exist.</p>
        <Link to="/investigations" className="mt-4 inline-block text-xs font-semibold text-cyan-400">
          ← Return to Case Queue
        </Link>
      </div>
    );
  }

  const {
    case: detail,
    next_best_actions: nba,
    sar,
    stop_reason,
    flagged_txn_id,
    customer_id,
    card_id,
    amount = 0,
    risk_score = 0,
    channel = 'online',
  } = caseData;

  const finalAction = nba.final && nba.final.length > 0 ? nba.final[0] : null;
  const isFraud = detail.verdict === 'fraud';
  const isUncertain = detail.verdict === 'uncertain';
  const probPercent = Math.round(detail.fraud_probability * 100);

  // Relevant historical cases
  const relevantHistorical = historicalCases.filter((h) =>
    detail.similar_prior_cases.includes(h.case_id)
  );

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Breadcrumb & Navigation */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link to="/investigations" className="hover:text-cyan-400">
            Case Queue
          </Link>
          <ChevronRight size={14} className="text-slate-600" />
          <span className="font-semibold text-slate-200">{caseData.case_id}</span>
          <span className="text-slate-600">/</span>
          <span className="text-cyan-400">Explainable Decision Engine</span>
        </div>

        {/* Quick Case Switcher */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-slate-500">Quick Select:</span>
          {['HHG-001', 'HHG-002', 'HHG-005', 'HHG-010', 'HHG-011'].map((cid) => (
            <Link
              key={cid}
              to={`/workspace/${cid}`}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                cid === caseData.case_id
                  ? 'border border-cyan-400/40 bg-cyan-400/15 text-cyan-300'
                  : 'border border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-white'
              }`}
            >
              {cid}
            </Link>
          ))}
        </div>
      </div>

      {/* Hero Header with Prominent Risk & Probability */}
      <section className="rounded-2xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-950/90 p-5 shadow-2xl backdrop-blur">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 text-xs font-bold tracking-wider text-cyan-300">
                {caseData.case_id}
              </span>
              <span
                className={`rounded-lg px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                  isFraud
                    ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    : isUncertain
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                Verdict: {detail.verdict}
              </span>
              {sar.file ? (
                <span className="flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-xs font-bold text-purple-300">
                  <FileText size={12} /> SAR REQUIRED
                </span>
              ) : (
                <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400">
                  No SAR Required
                </span>
              )}
              <span className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-400">
                Pattern: <strong className="text-slate-200">{detail.pattern}</strong>
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Investigation: Flagged Transaction #{flagged_txn_id}
            </h1>
            <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-slate-400">
              {detail.summary || caseData.trigger_text}
            </p>
          </div>

          {/* Three Prominent Visual Gauges */}
          <div className="flex flex-wrap items-center gap-4">
            {/* 1. Fraud Probability */}
            <div className="min-w-[150px] rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-center shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fraud Probability</span>
              <div className="mt-1 flex items-baseline justify-center gap-1">
                <span
                  className={`text-3xl font-extrabold ${
                    probPercent >= 75
                      ? 'text-rose-400'
                      : probPercent >= 50
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {probPercent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    probPercent >= 75 ? 'bg-rose-500' : probPercent >= 50 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${probPercent}%` }}
                />
              </div>
            </div>

            {/* 2. Total Exposure */}
            <div className="min-w-[150px] rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 text-center shadow-lg">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Episode Exposure</span>
              <p className="mt-1 text-3xl font-extrabold text-white">
                ${detail.exposure_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-[10px] text-slate-500">
                {detail.affected_txn_ids.length} affected transaction(s)
              </p>
            </div>

            {/* 3. Primary Next Best Action */}
            <div className="min-w-[200px] rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3.5 text-left shadow-lg">
              <div className="flex items-center gap-1.5">
                <Zap size={14} className="text-cyan-300" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Next Best Action</span>
              </div>
              <p className="mt-1 text-base font-bold text-white">
                {finalAction ? finalAction.action : 'REVIEW'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-300">
                Route: <strong className="text-cyan-200 uppercase">{finalAction ? finalAction.route : 'auto'}</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Quick Attribute Ribbon */}
        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-4 sm:grid-cols-4 lg:grid-cols-6 text-xs">
          <div>
            <span className="text-[10px] uppercase text-slate-500">Customer ID</span>
            <p className="mt-0.5 font-semibold text-slate-200">{customer_id || 'N/A'}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500">Card ID</span>
            <p className="mt-0.5 font-semibold text-slate-200">{card_id || 'N/A'}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500">Flagged Amount</span>
            <p className="mt-0.5 font-semibold text-slate-200">${amount.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500">Channel</span>
            <p className="mt-0.5 font-semibold text-slate-200 uppercase">{channel}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500">Model Risk Score</span>
            <p className="mt-0.5 font-semibold text-amber-300">{risk_score.toFixed(2)}</p>
          </div>
          <div>
            <span className="text-[10px] uppercase text-slate-500">Investigation Status</span>
            <p className="mt-0.5 font-semibold text-slate-200 capitalize">{detail.status}</p>
          </div>
        </div>
      </section>

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: Case Context & History */}
        <div className="col-span-12 space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <User size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Case Context</h2>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Account Origin</p>
                <p className="mt-1 font-semibold text-slate-200">{customer_id}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Instrument Used</p>
                <p className="mt-1 font-semibold text-slate-200">{card_id}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Connected Cards</p>
                {detail.connected_card_ids.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detail.connected_card_ids.map((c: string) => (
                      <span
                        key={c}
                        className="rounded bg-violet-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-300"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-slate-400">None identified</p>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Device Identity</p>
                {caseData.case_id === 'HHG-002' || detail.connected_device_profiles.length === 0 ? (
                  <div className="mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-amber-300">
                    <p className="font-semibold">Device evidence unavailable</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      No usable identity record attached. Not a shared-device signal.
                    </p>
                  </div>
                ) : (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {detail.connected_device_profiles.map((d: string) => (
                      <span
                        key={d}
                        className="rounded bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300"
                      >
                        {d}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Evidence Requests / Customer validation */}
            {caseData.evidence_requests && caseData.evidence_requests.length > 0 && (
              <div className="mt-5 border-t border-slate-800 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400">
                  Required Evidence Step
                </span>
                <div className="mt-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs">
                  <p className="font-semibold text-cyan-200 capitalize">
                    {caseData.evidence_requests[0].type.replace('_', ' ')}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                    {caseData.evidence_requests[0].assumed_response}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* Model Risk Warning */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/90 shadow-lg">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <AlertTriangle size={15} />
              Model Risk Notice
            </div>
            <p className="mt-2 text-slate-300">
              The risk score ({risk_score.toFixed(2)}) is a preliminary signal, not a final determination. Full
              verdict requires graph relationships and policy evaluation.
            </p>
          </div>
        </div>

        {/* CENTER: Relationship Graph Canvas */}
        <div className="col-span-12 space-y-3 lg:col-span-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Relationship Graph</h2>
            </div>
            <span className="text-xs text-slate-400">Interactive Canvas · Drag & Zoom</span>
          </div>

          {graphData ? (
            <FraudGraphCanvas
              nodes={graphData.nodes}
              edges={graphData.edges}
              caseId={caseData.case_id}
              hasDevice={graphData.has_device}
              deviceStatus={graphData.device_status}
              height="580px"
            />
          ) : (
            <div className="flex h-[580px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950 text-slate-500">
              Graph visualization unavailable
            </div>
          )}
        </div>

        {/* RIGHT: Investigation Copilot & Explainability */}
        <div className="col-span-12 space-y-6 lg:col-span-3">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Investigation Copilot</h2>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                Active Audit
              </span>
            </div>

            {/* Checklist */}
            <div className="mt-4 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Investigation Checklist
              </span>
              {[
                { title: 'Transaction context retrieved', done: true },
                { title: 'Card history examined', done: true },
                {
                  title:
                    caseData.case_id === 'HHG-002'
                      ? 'Device evaluated (unavailable)'
                      : 'Relationship evidence evaluated',
                  done: true,
                },
                {
                  title: 'Historical cases checked',
                  done: detail.similar_prior_cases.length > 0,
                },
                { title: `Pattern classified: ${detail.pattern}`, done: true },
                { title: 'Policy rules evaluated', done: true },
                {
                  title: `Action: ${finalAction ? finalAction.action : 'Decided'}`,
                  done: true,
                },
              ].map((step, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs">
                  <CheckCircle2
                    size={14}
                    className={`mt-0.5 flex-shrink-0 ${
                      step.done ? 'text-emerald-400' : 'text-slate-600'
                    }`}
                  />
                  <span className={step.done ? 'text-slate-200' : 'text-slate-500'}>
                    {step.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Regulatory Filing Decision (SAR) */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Regulatory Decision
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    sar.file
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {sar.file ? 'SAR Required' : 'No SAR'}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                {sar.reason || 'Criteria for regulatory filing assessed under FinCEN policy.'}
              </p>
              {sar.narrative && (
                <div className="mt-3 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 text-[11px] text-purple-200/90">
                  <p className="font-semibold text-purple-300">Filing Narrative:</p>
                  <p className="mt-1 line-clamp-4 leading-relaxed">{sar.narrative}</p>
                </div>
              )}
            </div>

            {/* Stop Reason */}
            {stop_reason && (
              <div className="mt-5 border-t border-slate-800 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Stopping Criteria
                </span>
                <p className="mt-1.5 text-xs text-slate-400">{stop_reason}</p>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* BOTTOM SECTION: Evidence Timeline + Institutional Memory + Next Best Action */}
      <div className="grid grid-cols-12 gap-6">
        {/* Evidence Timeline */}
        <div className="col-span-12 lg:col-span-6">
          <section className="h-full rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Clock3 size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Evidence Timeline</h2>
            </div>

            <div className="mt-5 space-y-4">
              {timelineEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="relative flex gap-4 pl-4">
                  <div className="absolute bottom-0 left-1.5 top-2 w-0.5 bg-slate-800" />
                  <div
                    className={`relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-slate-950 ${
                      evt.type === 'alert'
                        ? 'bg-amber-400 ring-2 ring-amber-400/30'
                        : evt.type === 'action' || evt.type === 'policy'
                        ? 'bg-cyan-400 ring-2 ring-cyan-400/30'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div className="flex-1 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-white">{evt.title}</p>
                      {evt.badge && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-semibold text-slate-300">
                          {evt.badge}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400 leading-relaxed">{evt.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Institutional Memory (Historical Cases) */}
        <div className="col-span-12 lg:col-span-3">
          <section className="h-full rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <History size={16} className="text-fuchsia-400" />
              <h2 className="text-sm font-bold text-white">Institutional Memory</h2>
            </div>

            <div className="mt-4">
              {relevantHistorical.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-[11px] text-slate-400">
                    Prior closed cases sharing card or behavioral signature:
                  </p>
                  {relevantHistorical.map((cc) => (
                    <div
                      key={cc.case_id}
                      className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-3 text-xs text-slate-300"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-fuchsia-300">{cc.case_id}</span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            cc.outcome === 'confirmed_fraud'
                              ? 'bg-rose-500/20 text-rose-300'
                              : 'bg-emerald-500/20 text-emerald-300'
                          }`}
                        >
                          {cc.outcome}
                        </span>
                      </div>
                      <p className="mt-1.5 font-medium text-white capitalize">
                        {cc.pattern.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400 line-clamp-2">
                        {cc.analyst_notes || `Identified exposure: $${cc.exposure_usd.toFixed(2)}`}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-48 flex-col items-center justify-center text-center">
                  <Shield size={24} className="text-slate-600" />
                  <p className="mt-3 text-xs font-semibold text-slate-400">
                    No similar closed case identified.
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    New behavioral signature without prior precedent in graph memory.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Next Best Action Card (Interactive with Demo Action CTA) */}
        <div className="col-span-12 lg:col-span-3">
          <section className="h-full rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/30 to-slate-900/80 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center gap-2 border-b border-cyan-500/20 pb-3">
              <Zap size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Next Best Action (NBA)</h2>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recommended Action
                </span>
                <p className="mt-1 text-lg font-extrabold text-cyan-200">
                  {finalAction ? finalAction.action : 'REVIEW'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Approval Route
                </span>
                <p className="mt-1 text-xs font-semibold uppercase text-slate-200">
                  {finalAction ? finalAction.route : 'auto'}
                </p>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Policy Rule Justification
                </span>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">
                  {finalAction ? finalAction.reason : 'Standard fraud review rules apply.'}
                </p>
              </div>

              {/* Primary Interactive CTA */}
              <div className="border-t border-slate-800 pt-4">
                <button
                  onClick={() => {
                    const actionName = finalAction ? finalAction.action : 'VERIFY';
                    setSimulatedActionStatus(
                      `Simulated Action Executed: ${actionName} applied for Case ${caseData.case_id}.`
                    );
                  }}
                  className="w-full rounded-xl bg-cyan-400 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.98]"
                >
                  Execute: {finalAction ? finalAction.action : 'Execute Action'}{' '}
                  <span className="opacity-70">(Demo Action)</span>
                </button>

                {simulatedActionStatus && (
                  <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300">
                    {simulatedActionStatus}
                  </div>
                )}

                <p className="mt-2 text-center text-[10px] text-slate-500">
                  Simulated workflow only. Does not mutate real banking ledger.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}