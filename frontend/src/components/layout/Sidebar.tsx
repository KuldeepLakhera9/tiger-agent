import { NavLink } from 'react-router-dom';
import { BarChart3, Bell, History, LayoutDashboard, Network, ShieldAlert, TerminalSquare } from 'lucide-react';

const links = [
  { label: 'Overview', to: '/overview', icon: LayoutDashboard }, { label: 'Investigations', to: '/investigations', icon: ShieldAlert }, { label: 'Graph Explorer', to: '/graph', icon: Network }, { label: 'Historical Cases', to: '/historical', icon: History }, { label: 'Analytics', to: '/analytics', icon: BarChart3 }, { label: 'Alerts', to: '/alerts', icon: Bell },
];

export function Sidebar() {
  return <aside className="hidden w-64 shrink-0 border-r border-slate-800 bg-slate-950/80 px-4 py-5 lg:flex lg:flex-col">
    <div className="flex items-center gap-3 px-3 pb-8"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/30"><TerminalSquare size={19} /></div><div><p className="text-sm font-semibold tracking-[0.22em] text-white">FRAUDGRAPH</p><p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Investigation OS</p></div></div>
    <nav className="space-y-1"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Workspace</p>{links.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${isActive ? 'bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-400/20' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
    <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900/70 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Environment</span><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,.8)]" /></div><p className="text-sm font-medium text-slate-200">Demo workspace</p><p className="mt-1 text-xs leading-5 text-slate-500">Graph connection is staged for the next integration phase.</p></div>
  </aside>;
}