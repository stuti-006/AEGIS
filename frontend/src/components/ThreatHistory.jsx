import React, { useEffect, useState } from 'react';
import {
  Shield,
  TrendingUp,
  AlertTriangle,
  Zap,
  History
} from 'lucide-react';
import { ThreatTimeline } from './ThreatTimeline';
import { useAuth } from '../auth/AuthContext';

export function ThreatHistory({ refresh, sessionHistory, onReplay }) {
  const { apiFetch } = useAuth();
  const [history, setHistory] = useState(sessionHistory || []);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Merge session history with backend history
    const loadHistory = async () => {
      setLoading(true);
      try {
        const historyRes = await apiFetch('/api/history?limit=20');
        const historyText = await historyRes.text();
        const historyData = historyText ? JSON.parse(historyText) : { analyses: [] };

        // Dedup and merge
        const combined = [...(sessionHistory || [])];
        const existingIds = new Set(combined.map(i => i.analysis_id));

        (historyData.analyses || []).forEach(item => {
          if (!existingIds.has(item.analysis_id)) {
            combined.push(item);
          }
        });

        setHistory(combined.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));

        // Load statistics
        const statsRes = await apiFetch('/api/statistics');
        const statsText = await statsRes.text();
        const statsData = statsText ? JSON.parse(statsText) : { statistics: null };
        setStats(statsData.statistics);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [refresh, sessionHistory]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Analyses"
          value={stats?.total_analyses || history.length}
          icon={<Shield className="w-5 h-5" />}
        />
        <StatCard
          label="Dangerous"
          value={stats?.by_label?.dangerous || history.filter(h => h.label === 'dangerous').length}
          color="red"
          icon={<AlertTriangle className="w-5 h-5" />}
        />
        <StatCard
          label="Avg. Risk Score"
          value={(stats?.average_risk_score || 0).toFixed(1)}
          icon={<Zap className="w-5 h-5" />}
        />
        <StatCard
          label="Avg. Confidence"
          value={`${((stats?.average_confidence || 0) * 100).toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5" />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline View */}
        <div className="lg:col-span-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Threat Timeline</h3>
          <ThreatTimeline history={history} />
        </div>

        {/* Recent History */}
        <div className="lg:col-span-2">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Analysis History</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
            {loading && history.length === 0 ? (
              <div className="text-center py-8 text-slate-500 dark:text-gray-500">Loading intelligence...</div>
            ) : history.length > 0 ? (
              history.map((item) => (
                <HistoryItem key={item.analysis_id} item={item} onReplay={onReplay} />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500 dark:text-gray-500">
                No analyses yet. Start by analyzing a message!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  const colors = {
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
  };

  return (
    <div className={`glass rounded-xl p-5 border ${colors[color] || 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider mb-1 font-semibold">{label}</p>
          <p className="text-2xl font-black">{value}</p>
        </div>
        {icon && <div className="opacity-40">{icon}</div>}
      </div>
    </div>
  );
}

function HistoryItem({ item, onReplay }) {
  const getLabelStyle = (label) => {
    switch (label) {
      case 'dangerous': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'suspicious': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  // normalise field names — session history uses camelCase, backend uses snake_case
  const riskScore = item.riskScore ?? item.risk_score ?? 0;
  const summary = item.conversation?.summary || item.summary || item.reason || '—';
  const preview = item.evidence?.message || item.message || null;

  return (
    <div
      onClick={() => onReplay && onReplay(item)}
      className="glass rounded-xl p-4 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className={`${getLabelStyle(item.label)} px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border`}>
              {item.label}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-gray-500 font-medium">
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-sm text-gray-200 font-semibold line-clamp-1 group-hover:text-blue-300 transition-colors">
            {summary}
          </p>
          {preview && (
            <p className="text-xs text-slate-500 dark:text-gray-500 mt-1 line-clamp-1 italic">{preview}</p>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <p className="text-[10px] text-slate-500 dark:text-gray-500 uppercase font-bold">Risk</p>
            <p className={`text-sm font-black ${riskScore > 70 ? 'text-red-400' : 'text-gray-300'}`}>
              {riskScore.toFixed(0)}
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <TrendingUp className="w-4 h-4 text-slate-600 dark:text-gray-600 group-hover:text-blue-400" />
          </div>
        </div>
      </div>
    </div>
  );
}
