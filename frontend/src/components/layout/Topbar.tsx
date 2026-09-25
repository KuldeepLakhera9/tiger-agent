import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShieldCheck } from 'lucide-react';
import { apiService } from '../../services/apiService';
import type { SystemHealth } from '../../types/fraud';

export function Topbar() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    apiService.getHealth().then((h) => {
      if (mounted) setHealth(h);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    if (query.toUpperCase().startsWith('HHG-')) {
      navigate(`/workspace/${query.toUpperCase()}`);
    } else {
      navigate(`/investigations?q=${encodeURIComponent(query)}`);
    }
  };

  const isTgLive = Boolean(health?.tigergraph?.connected);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-950/70 px-5 backdrop-blur sm:px-8">
      <form onSubmit={handleSearchSubmit} className="relative w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-2 pl-10 pr-4 text-xs text-slate-200 outline-none transition placeholder:text-slate-500 focus:border-cyan-400/60"
          placeholder="Search by case ID (e.g. HHG-002), card, or txn..."
        />
      </form>

      <div className="ml-4 flex items-center gap-3 sm:gap-5">
        {isTgLive ? (
          <span className="hidden items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            TigerGraph Live
          </span>
        ) : (
          <span className="hidden items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 sm:flex">
            <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
            Deterministic Fallback Active
          </span>
        )}

        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400">
          <ShieldCheck size={16} className="text-cyan-400" />
        </div>
      </div>
    </header>
  );
}