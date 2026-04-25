import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  ComposedChart,
} from 'recharts';
import { Activity, TrendingUp } from 'lucide-react';

const THREAT_LEVELS = {
  SAFE: 0,
  SUSPICIOUS: 1,
  DANGEROUS: 2,
  safe: 0,
  suspicious: 1,
  dangerous: 2,
};

const LEVEL_LABELS = ['SAFE', 'SUSPICIOUS', 'DANGEROUS'];

function normalizeHistory(history) {
  return history
    .map((item, index) => {
      const level =
        item.level ??
        THREAT_LEVELS[item.threat_level] ??
        THREAT_LEVELS[item.label] ??
        0;

      const rawTime = item.time || item.timestamp;
      const timeLabel = rawTime
        ? new Date(rawTime).toString() !== 'Invalid Date'
          ? new Date(rawTime).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })
          : rawTime
        : `T${index + 1}`;

      return {
        time: timeLabel,
        level,
        label: (item.label || item.threat_level || LEVEL_LABELS[level] || 'SAFE').toUpperCase(),
        riskScore: item.riskScore ?? item.risk_score ?? (level * 50),
      };
    })
    .sort((a, b) => new Date(a.time) - new Date(b.time));
}

function TimelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-xl border border-blue-500/30 bg-white dark:bg-slate-900/95 px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-[10px] uppercase tracking-[0.2em] text-blue-400 font-bold">{label}</p>
      <div className="flex items-center gap-2 mt-1">
        <div className={`w-2 h-2 rounded-full ${point.level === 2 ? 'bg-red-500' : point.level === 1 ? 'bg-yellow-500' : 'bg-green-500'}`} />
        <p className="text-sm font-black text-slate-900 dark:text-white">{point.label}</p>
      </div>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">Intelligence Score: <span className="text-slate-900 dark:text-white">{point.riskScore.toFixed(0)}</span></p>
    </div>
  );
}

export function ThreatTimeline({ history = [] }) {
  const data = normalizeHistory(history);

  if (!data.length) {
    return (
      <div className="glass rounded-2xl p-8 text-center border-dashed border-slate-300 dark:border-slate-700">
        <Activity className="mx-auto mb-3 h-10 w-10 text-slate-700 animate-pulse" />
        <p className="text-sm text-slate-500 font-medium">Waiting for analysis data to trace escalation timeline...</p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl border border-blue-500/10 bg-white dark:bg-slate-900/40 p-6 relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
        <TrendingUp className="w-24 h-24 text-blue-400" />
      </div>

      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-blue-400 font-black">Escalation Trace</p>
        <h3 className="mt-1 text-lg font-bold text-slate-900 dark:text-white tracking-tight">Intelligence Timeline</h3>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="timeline-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" hide />
            <YAxis domain={[0, 100]} hide />
            <Tooltip content={<TimelineTooltip />} />
            <Line
              type="monotone"
              dataKey="riskScore"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4, fill: '#1e293b', stroke: '#3b82f6', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
              animationDuration={2000}
              isAnimationActive={true}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 flex justify-between items-center text-[10px] text-slate-500 dark:text-gray-500 font-bold uppercase tracking-widest">
        <span>Oldest</span>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-blue-500/40" />
          <div className="w-1 h-1 rounded-full bg-blue-500/60" />
          <div className="w-1 h-1 rounded-full bg-blue-500" />
        </div>
        <span>Latest</span>
      </div>
    </div>
  );
}
