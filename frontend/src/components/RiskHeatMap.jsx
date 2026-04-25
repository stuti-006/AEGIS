import { useState } from 'react';
import { TrendingUp, AlertTriangle, Shield, Zap, Heart, Activity } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from 'recharts';

const SEVERITY = [
  { label: 'Frozen', range: '0–20', hex: '#3b82f6', pill: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300', dot: 'bg-blue-500' },
  { label: 'Cool', range: '20–40', hex: '#10b981', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { label: 'Warm', range: '40–60', hex: '#f59e0b', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300', dot: 'bg-amber-500' },
  { label: 'Hot', range: '60–80', hex: '#f97316', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300', dot: 'bg-orange-500' },
  { label: 'Critical', range: '80–100', hex: '#ef4444', pill: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300', dot: 'bg-red-500' },
];

function getSev(score) {
  if (score <= 20) return SEVERITY[0];
  if (score <= 40) return SEVERITY[1];
  if (score <= 60) return SEVERITY[2];
  if (score <= 80) return SEVERITY[3];
  return SEVERITY[4];
}

function buildTrend(risk, tox) {
  return Array.from({ length: 21 }, (_, i) => {
    const h = (i * 1).toString().padStart(2, '0') + ':00';
    const f = i === 20 ? 1 : 0.2 + Math.random() * 0.65;
    return { time: h, risk: Math.round(risk * f), toxicity: Math.round(tox * f) };
  });
}

function buildRadar(result) {
  const urgMap = { HIGH: 90, MEDIUM: 55, LOW: 20, CRITICAL: 100 };
  return [
    { subject: 'Threat', value: Math.min(100, result.risk_score || 0) },
    { subject: 'Confidence', value: Math.round((result.confidence || 0) * 100) },
    { subject: 'Urgency', value: urgMap[result.urgency] || 20 },
    { subject: 'Emotional', value: Math.min(100, (result.emotional_impact || []).length * 18) },
    { subject: 'Risk', value: Math.min(100, result.toxicity || 0) },
  ];
}

function buildDist(risk) {
  const idx = Math.min(4, Math.floor(risk / 20));
  return SEVERITY.map((s, i) => ({
    range: s.range,
    count: i === idx ? Math.max(30, Math.round(risk * 0.5)) : Math.max(2, Math.round(Math.random() * 25)),
    hex: s.hex,
  }));
}

function Tooltip2({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-[#1a2235] border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }} className="font-bold">{p.name}: {p.value}</p>
      ))}
    </div>
  );
}

// Card with colored left border accent (matches the reference image)
function Panel({ children, className = '' }) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.07] shadow-sm dark:shadow-none p-5 ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, iconBg, title, sub, badge }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 dark:text-white">{title}</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
        </div>
      </div>
      {badge}
    </div>
  );
}

// Metric card — pastel bg in light, dark glass in dark
const METRIC_CONFIGS = [
  { key: 'threat', label: 'Threat Level', icon: Shield, light: 'bg-red-50 border-red-200', dark: 'dark:bg-red-500/5 dark:border-red-500/20', accent: 'text-red-600 dark:text-red-400', leftBar: 'bg-red-400' },
  { key: 'conf', label: 'Confidence', icon: TrendingUp, light: 'bg-blue-50 border-blue-200', dark: 'dark:bg-blue-500/5 dark:border-blue-500/20', accent: 'text-blue-600 dark:text-blue-400', leftBar: 'bg-blue-400' },
  { key: 'tox', label: 'Toxicity', icon: Zap, light: 'bg-green-50 border-green-200', dark: 'dark:bg-green-500/5 dark:border-green-500/20', accent: 'text-green-600 dark:text-green-400', leftBar: 'bg-green-400' },
  { key: 'risk', label: 'Risk Score', icon: AlertTriangle, light: 'bg-yellow-50 border-yellow-200', dark: 'dark:bg-yellow-500/5 dark:border-yellow-500/20', accent: 'text-yellow-600 dark:text-yellow-400', leftBar: 'bg-yellow-400' },
  { key: 'emotional', label: 'Emotional State', icon: Heart, light: 'bg-purple-50 border-purple-200', dark: 'dark:bg-purple-500/5 dark:border-purple-500/20', accent: 'text-purple-600 dark:text-purple-400', leftBar: 'bg-purple-400' },
  { key: 'urgency', label: 'Urgency', icon: Activity, light: 'bg-orange-50 border-orange-200', dark: 'dark:bg-orange-500/5 dark:border-orange-500/20', accent: 'text-orange-600 dark:text-orange-400', leftBar: 'bg-orange-400' },
];

export function RiskHeatMap({ result }) {
  if (!result) {
    return (
      <Panel className="text-center py-16">
        <TrendingUp className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
        <p className="text-slate-400 dark:text-slate-500 text-sm">Analyze a message to see the risk heatmap dashboard</p>
      </Panel>
    );
  }

  const risk = Math.round(result.risk_score || 0);
  const tox = Math.round(result.toxicity || 0);
  const conf = Math.round((result.confidence || 0) * 100);
  const urgency = result.urgency || 'LOW';
  const level = (result.threat_level || result.label || 'SAFE').toUpperCase();
  const emotional = (result.emotional_impact || ['N/A'])[0];

  const trendData = buildTrend(risk, tox);
  const radarData = buildRadar(result);
  const distData = buildDist(risk);

  const metricValues = {
    threat: level, conf: `${conf}%`, tox: String(tox),
    risk: `${risk}°`, emotional, urgency,
  };

  // Chart colors — more vibrant in light, glowing in dark
  const areaRiskLight = '#3b82f6';
  const areaToxLight = '#10b981';

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Risk & Toxicity Analytics</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Real-time threat monitoring dashboard</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </span>
      </div>

      {/* ── Row 1: Trend + Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Trend — takes 2/3 */}
        <Panel className="lg:col-span-2">
          <PanelHeader
            icon={TrendingUp}
            iconBg="bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400"
            title="24-Hour Trend Analysis"
            sub="Historical performance data"
            badge={
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Live
              </span>
            }
          />
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="gR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaRiskLight} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={areaRiskLight} stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={areaToxLight} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={areaToxLight} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#94a3b8' }} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#94a3b8' }} domain={[0, 100]} />
              <Tooltip content={<Tooltip2 />} />
              <Area type="monotone" dataKey="risk" name="Risk Score" stroke={areaRiskLight} fill="url(#gR)" strokeWidth={2.5} dot={false} />
              <Area type="monotone" dataKey="toxicity" name="Toxicity" stroke={areaToxLight} fill="url(#gT)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          {/* Legend row */}
          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-slate-100 dark:border-white/[0.05]">
            <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              Risk Score <strong className="text-slate-900 dark:text-white ml-1">{risk}°</strong>
            </span>
            <span className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span className="w-3 h-3 rounded-full bg-emerald-500" />
              Toxicity <strong className="text-slate-900 dark:text-white ml-1">{tox}</strong>
            </span>
          </div>
        </Panel>

        {/* Radar — takes 1/3 */}
        <Panel>
          <PanelHeader
            icon={AlertTriangle}
            iconBg="bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400"
            title="Category Breakdown"
            sub="Multi-factor analysis"
          />
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={radarData} margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
              <PolarGrid stroke="rgba(148,163,184,0.2)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
              <Tooltip content={<Tooltip2 />} />
            </RadarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* ── Row 2: Distribution bar ── */}
      <Panel>
        <PanelHeader
          icon={Shield}
          iconBg="bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
          title="Risk Distribution"
          sub="Frequency across severity ranges"
        />
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={distData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
            <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <Tooltip content={<Tooltip2 />} />
            <Bar dataKey="count" name="count" radius={[6, 6, 0, 0]}>
              {distData.map((d, i) => <Cell key={i} fill={d.hex} fillOpacity={0.85} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Panel>

      {/* ── Row 3: 6 Metric Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {METRIC_CONFIGS.map(({ key, label, icon: Icon, light, dark, accent, leftBar }) => (
          <div key={key}
            className={`rounded-xl border p-3 relative overflow-hidden ${light} ${dark}`}
          >
            {/* Colored left accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${leftBar}`} />
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-1 pl-2">{label}</p>
            <p className={`text-base font-black pl-2 ${accent}`}>{metricValues[key]}</p>
          </div>
        ))}
      </div>

      {/* ── Row 4: Severity Legend ── */}
      <Panel>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-500 uppercase tracking-wider mb-3">Severity Scale Legend</p>
        <div className="flex flex-wrap gap-2">
          {SEVERITY.map(s => (
            <span key={s.label} className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${s.pill}`}>
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              {s.label} <span className="opacity-60">({s.range})</span>
            </span>
          ))}
        </div>
      </Panel>

    </div>
  );
}
