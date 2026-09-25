import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  HelpCircle,
  History,
  Network,
  PhoneCall,
  RefreshCw,
  Shield,
  User,
  Zap,
} from 'lucide-react';
import { apiService } from '../services/apiService';
import { FraudGraphCanvas } from '../components/graph/FraudGraphCanvas';
import type {
  BenchmarkCase,
  CaseActionResponse,
  GraphResponse,
  HistoricalCase,
  TimelineEvent,
} from '../types/fraud';

const LIFECYCLE_STAGES = [
  { key: 'ALERTED', label: '1. Alerted', desc: 'Initial trigger' },
  { key: 'INVESTIGATING', label: '2. Investigating', desc: 'Graph traversal' },
  { key: 'EVIDENCE_GATHERED', label: '3. Evidence Gathered', desc: 'Subgraph mapped' },
  { key: 'REVIEW', label: '4. Review', desc: 'Uncertainty check' },
  { key: 'ACTION_RECOMMENDED', label: '5. Action Recommended', desc: 'Policy evaluated' },
  { key: 'ACTION_APPROVED', label: '6. Action Approved', desc: 'L1/L2 sign-off' },
  { key: 'RESOLVED', label: '7. Resolved', desc: 'Docket closed' },
];

export function InvestigationWorkspace() {
  const { id = 'HHG-002' } = useParams<{ id: string }>();
  const [caseData, setCaseData] = useState<BenchmarkCase | null>(null);
  const [graphData, setGraphData] = useState<GraphResponse | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [historicalCases, setHistoricalCases] = useState<HistoricalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<CaseActionResponse | null>(null);

  const loadCase = (caseId: string) => {
    setLoading(true);
    setActionFeedback(null);

    Promise.all([
      apiService.getCase(caseId),
      apiService.getGraph(caseId),
      apiService.getTimeline(caseId),
      apiService.getHistoricalCases(),
    ])
      .then(([c, g, t, h]) => {
        setCaseData(c);
        setGraphData(g);
        setTimelineEvents(t);
        setHistoricalCases(h);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadCase(id);
  }, [id]);

  const handleExecuteAction = async (actionName: string, actor = 'Fraud Analyst (L1)', notes?: string) => {
    if (!caseData) return;
    setActionInProgress(true);
    try {
      const res = await apiService.executeCaseAction(caseData.case_id, {
        action: actionName,
        actor,
        notes,
        approval_route: caseData.next_best_actions.final[0]?.route || 'auto',
      });
      setActionFeedback(res);

      // Refresh case data and timeline
      const [updatedCase, updatedTimeline] = await Promise.all([
        apiService.getCase(caseData.case_id),
        apiService.getTimeline(caseData.case_id),
      ]);
      if (updatedCase) setCaseData(updatedCase);
      if (updatedTimeline) setTimelineEvents(updatedTimeline);
    } catch (err) {
      console.error('Failed to execute action:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleSetLifecycleStage = async (stage: string) => {
    if (!caseData) return;
    setActionInProgress(true);
    try {
      await apiService.updateCaseLifecycle(caseData.case_id, stage, 'Fraud Lead');
      const [updatedCase, updatedTimeline] = await Promise.all([
        apiService.getCase(caseData.case_id),
        apiService.getTimeline(caseData.case_id),
      ]);
      if (updatedCase) setCaseData(updatedCase);
      if (updatedTimeline) setTimelineEvents(updatedTimeline);
    } catch (err) {
      console.error('Failed to update stage:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const handleResetCase = async () => {
    if (!caseData) return;
    setActionInProgress(true);
    try {
      await apiService.resetCase(caseData.case_id);
      loadCase(caseData.case_id);
    } catch (err) {
      console.error('Failed to reset case:', err);
    } finally {
      setActionInProgress(false);
    }
  };

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
    lifecycle_stage = 'ACTION_RECOMMENDED',
  } = caseData;

  const finalAction = nba.final && nba.final.length > 0 ? nba.final[0] : null;
  const isFraud = detail.verdict === 'fraud';
  const isUncertain = detail.verdict === 'uncertain';
  const probPercent = Math.round(detail.fraud_probability * 100);
  const isHHG002 = caseData.case_id === 'HHG-002';

  // Current stage index in lifecycle
  const currentStageIndex = Math.max(
    0,
    LIFECYCLE_STAGES.findIndex((s) => s.key === lifecycle_stage.toUpperCase())
  );

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

        {/* Quick Case Switcher & Reset Button */}
        <div className="flex flex-wrap items-center gap-2">
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
          <button
            onClick={handleResetCase}
            disabled={actionInProgress}
            title="Reset case to baseline state"
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-400 hover:border-amber-500/40 hover:text-amber-300 transition"
          >
            <RefreshCw size={12} className={actionInProgress ? 'animate-spin' : ''} />
            Reset State
          </button>
        </div>
      </div>

      {/* Case Lifecycle Stepper */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Clock3 size={15} className="text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Case Lifecycle & Investigation Progression
            </h3>
          </div>
          <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            Current Stage: <strong className="text-cyan-300 uppercase">{lifecycle_stage}</strong>
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {LIFECYCLE_STAGES.map((stg, idx) => {
            const isCompleted = idx < currentStageIndex;
            const isCurrent = idx === currentStageIndex;

            return (
              <button
                key={stg.key}
                onClick={() => handleSetLifecycleStage(stg.key)}
                disabled={actionInProgress}
                className={`relative flex flex-col items-start rounded-xl p-2.5 text-left transition ${
                  isCurrent
                    ? 'border border-cyan-400/50 bg-cyan-400/10 text-cyan-200 ring-2 ring-cyan-400/20 shadow-lg'
                    : isCompleted
                    ? 'border border-emerald-500/30 bg-emerald-500/5 text-emerald-300 hover:border-emerald-500/50'
                    : 'border border-slate-800/70 bg-slate-950/60 text-slate-500 hover:border-slate-700 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${
                      isCurrent
                        ? 'bg-cyan-400 text-slate-950'
                        : isCompleted
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isCompleted ? <Check size={10} /> : idx + 1}
                  </div>
                  <span className="text-[11px] font-bold tracking-tight">{stg.label.split('. ')[1]}</span>
                </div>
                <span className="mt-1 text-[9px] text-slate-400 line-clamp-1">{stg.desc}</span>
              </button>
            );
          })}
        </div>
      </section>

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
                Pattern: <strong className="text-slate-200">{detail.pattern.replace(/_/g, ' ')}</strong>
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
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Recommended Action</span>
              </div>
              <p className="mt-1 text-base font-bold text-white">
                {finalAction ? finalAction.action : 'REVIEW'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-300">
                Approval: <strong className="text-cyan-200 uppercase">{finalAction ? finalAction.route : 'auto'}</strong>
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

      {/* Action Execution Feedback Banner */}
      {actionFeedback && (
        <section className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-emerald-500/20 p-2 text-emerald-300">
                <CheckCircle2 size={18} />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                  {actionFeedback.audit_event.title}
                </p>
                <p className="mt-1 text-xs text-slate-200 leading-relaxed">
                  {actionFeedback.audit_event.description}
                </p>
                {actionFeedback.what_changed && (
                  <p className="mt-2 text-[11px] font-semibold text-cyan-300">
                    What Changed: {actionFeedback.what_changed}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </section>
      )}

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* LEFT: Case Context & Uncertainty Audit */}
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
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Device Identity Status</p>
                {isHHG002 || detail.connected_device_profiles.length === 0 ? (
                  <div className="mt-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 text-amber-300">
                    <p className="font-semibold">Device evidence unavailable</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Truthful graph state: No usable identity record attached. Zero device nodes rendered.
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

          {/* Explicit Uncertainty Breakdown Card */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur text-xs">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <HelpCircle size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white">Uncertainty & Evidence Check</h2>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Graph Evidence:</span>
                <span className="font-semibold text-emerald-400">AVAILABLE</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Device Telemetry:</span>
                <span className={`font-semibold ${isHHG002 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {isHHG002 ? 'UNAVAILABLE' : detail.connected_device_profiles.length > 0 ? 'AVAILABLE' : 'NOT PRESENT'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Typology Confidence:</span>
                <span className="font-semibold text-amber-300">{isUncertain ? 'MEDIUM' : 'HIGH'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Policy Recommendation:</span>
                <span className="font-semibold text-cyan-300">CONFIDENT (R1)</span>
              </div>
            </div>

            <p className="mt-3 border-t border-slate-800/80 pt-3 text-[11px] leading-relaxed text-slate-400">
              Uncertainty is treated as a first-class feature. Rather than pretending certainty, the agent requests
              controlled evidence gathering before executing irreversible account interventions.
            </p>
          </section>
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

        {/* RIGHT: Investigation Copilot & Controlled Actions Hub */}
        <div className="col-span-12 space-y-6 lg:col-span-3">
          {/* Controlled Actions Hub */}
          <section className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/20 to-slate-900/80 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Zap size={16} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Action & Intervention Hub</h2>
              </div>
              <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-300">
                Decision vs Execution
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Recommended Action
                </span>
                <p className="mt-1 text-base font-extrabold text-cyan-200">
                  {finalAction ? finalAction.action : 'REVIEW'}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-300">
                  {finalAction ? finalAction.reason : 'Standard policy evaluation.'}
                </p>
              </div>

              {/* Primary Action Button */}
              <div className="pt-2">
                <button
                  onClick={() => handleExecuteAction(finalAction ? finalAction.action : 'VERIFY_WITH_CUSTOMER')}
                  disabled={actionInProgress}
                  className="w-full rounded-xl bg-cyan-400 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-300 active:scale-[0.98] shadow-lg shadow-cyan-400/10 flex items-center justify-center gap-1.5"
                >
                  <PhoneCall size={14} />
                  Execute: {finalAction ? finalAction.action : 'Verify'}
                  <span className="text-[10px] opacity-75">(Simulated Action)</span>
                </button>
              </div>

              {/* Secondary Controlled Actions Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => handleExecuteAction('APPROVE_ACTION', 'Fraud Manager (L2)', 'L2 Manager approved policy action.')}
                  disabled={actionInProgress}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 py-2 px-2 text-[10px] font-semibold text-slate-200 hover:border-cyan-400 hover:text-white transition text-center"
                >
                  Approve (L2 Sign-off)
                </button>
                <button
                  onClick={() => handleExecuteAction('REQUEST_ADDITIONAL_EVIDENCE', 'Fraud Analyst (L1)', 'Requested telemetry and carrier verification.')}
                  disabled={actionInProgress}
                  className="rounded-lg border border-slate-700 bg-slate-800/80 py-2 px-2 text-[10px] font-semibold text-slate-200 hover:border-cyan-400 hover:text-white transition text-center"
                >
                  Request Telemetry
                </button>
                <button
                  onClick={() => handleExecuteAction('BLOCK_CARD', 'Fraud Lead (L1)', 'Restricted payment card on all channels.')}
                  disabled={actionInProgress}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 px-2 text-[10px] font-semibold text-rose-300 hover:bg-rose-500/20 transition text-center"
                >
                  Block Card (L1)
                </button>
                <button
                  onClick={() => handleExecuteAction('RESOLVE_CASE', 'Fraud Lead', 'Investigation resolved and docket archived.')}
                  disabled={actionInProgress}
                  className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-2 px-2 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition text-center"
                >
                  Resolve Case
                </button>
              </div>

              <p className="text-center text-[10px] text-slate-500 pt-1">
                Controlled actions are simulated for audit demonstration. Does not mutate live ledger.
              </p>
            </div>
          </section>

          {/* Investigation Copilot Checklist */}
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Investigation Copilot</h2>
              </div>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                Audited
              </span>
            </div>

            <div className="mt-4 space-y-2.5">
              {[
                { title: 'Transaction context retrieved', done: true },
                { title: 'Card history examined', done: true },
                {
                  title: isHHG002 ? 'Device evaluated (unavailable)' : 'Relationship evidence evaluated',
                  done: true,
                },
                {
                  title: 'Historical cases checked',
                  done: detail.similar_prior_cases.length > 0,
                },
                { title: `Pattern classified: ${detail.pattern.replace(/_/g, ' ')}`, done: true },
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

            {/* Regulatory SAR Decision */}
            <div className="mt-6 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Regulatory Decision
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    sar.file ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'
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

      {/* BOTTOM SECTION: Live Timeline & Audit Trail + Institutional Memory */}
      <div className="grid grid-cols-12 gap-6">
        {/* Evidence Timeline & Audit Trail */}
        <div className="col-span-12 lg:col-span-8">
          <section className="h-full rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-xl backdrop-blur">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Clock3 size={16} className="text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Investigation Timeline & Audit Trail</h2>
              </div>
              <span className="text-xs text-slate-400">{timelineEvents.length} Recorded Events</span>
            </div>

            <div className="mt-5 space-y-4">
              {timelineEvents.map((evt, idx) => (
                <div key={evt.id || idx} className="relative flex gap-4 pl-4">
                  <div className="absolute bottom-0 left-1.5 top-2 w-0.5 bg-slate-800" />
                  <div
                    className={`relative z-10 mt-1 h-3 w-3 rounded-full border-2 border-slate-950 ${
                      evt.type === 'alert'
                        ? 'bg-amber-400 ring-2 ring-amber-400/30'
                        : evt.type === 'controlled_action'
                        ? 'bg-emerald-400 ring-2 ring-emerald-400/40'
                        : evt.type === 'lifecycle'
                        ? 'bg-cyan-400 ring-2 ring-cyan-400/30'
                        : evt.type === 'action' || evt.type === 'policy'
                        ? 'bg-violet-400 ring-2 ring-violet-400/30'
                        : 'bg-slate-400'
                    }`}
                  />
                  <div className="flex-1 pb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-white">{evt.title}</p>
                      <div className="flex items-center gap-1.5">
                        {evt.actor && (
                          <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[9px] font-medium text-cyan-300">
                            Actor: {evt.actor}
                          </span>
                        )}
                        {evt.badge && (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${
                              evt.badge === 'AUDIT TRAIL'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : evt.badge === 'LIFECYCLE'
                                ? 'bg-cyan-500/20 text-cyan-300'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {evt.badge}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-300 leading-relaxed">{evt.description}</p>
                    <p className="mt-1 text-[10px] text-slate-500">{evt.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Institutional Memory (Historical Cases) */}
        <div className="col-span-12 lg:col-span-4">
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
      </div>
    </div>
  );
}