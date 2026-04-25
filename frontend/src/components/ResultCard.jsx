import React, { useState } from 'react';
import {
  AlertTriangle, AlertCircle, CheckCircle,
  TrendingUp, Zap, Heart, Scale, MapPin,
  Clock, Users, ShieldAlert, Download, Copy, FileText,
  BookOpen, ListChecks,
} from 'lucide-react';
import { AudioEvidence } from './AudioEvidence';
import { SpeakResult } from './SpeakResult';

const ACTION_STEPS = [
  { step: 1, text: 'Move to a safe, public place immediately', color: 'text-red-600 dark:text-red-400' },
  { step: 2, text: 'Call Police: 100 or Women Helpline: 1091', color: 'text-red-600 dark:text-red-400' },
  { step: 3, text: 'Send SOS to your trusted contacts', color: 'text-orange-600 dark:text-orange-400' },
  { step: 4, text: 'Screenshot and save all threatening messages', color: 'text-orange-600 dark:text-orange-400' },
  { step: 5, text: 'Download the Evidence PDF from this report', color: 'text-amber-600 dark:text-yellow-400' },
  { step: 6, text: 'File a complaint — IPC 354D / 506 may apply', color: 'text-amber-600 dark:text-yellow-400' },
  { step: 7, text: 'Contact NCW: 7827170170 for legal guidance', color: 'text-emerald-600 dark:text-green-400' },
];

const URGENCY_STYLES = {
  CRITICAL: 'text-red-400 bg-red-950/50 border-red-800',
  HIGH: 'text-orange-400 bg-orange-950/40 border-orange-800/60',
  MEDIUM: 'text-yellow-400 bg-yellow-950/40 border-yellow-800/60',
  LOW: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700',
};

const LABEL_CONFIG = {
  dangerous: {
    border: 'border-red-900/60',
    topBar: 'bg-red-600',
    badge: 'bg-red-950/60 text-red-400 border border-red-800/60',
    icon: AlertTriangle,
    iconColor: 'text-red-400',
    label: 'DANGEROUS',
  },
  suspicious: {
    border: 'border-yellow-900/40',
    topBar: 'bg-yellow-500',
    badge: 'bg-yellow-950/60 text-yellow-400 border border-yellow-800/60',
    icon: AlertCircle,
    iconColor: 'text-yellow-400',
    label: 'SUSPICIOUS',
  },
  safe: {
    border: 'border-slate-200 dark:border-slate-800',
    topBar: 'bg-green-600',
    badge: 'bg-green-950/60 text-green-400 border border-green-800/60',
    icon: CheckCircle,
    iconColor: 'text-green-400',
    label: 'SAFE',
  },
};

export function ResultCard({ result, onDownloadPDF, pdfLoading }) {
  if (!result) return null;

  const cfg = LABEL_CONFIG[result.label] || LABEL_CONFIG.safe;
  const LabelIcon = cfg.icon;
  const urgency = result.urgency || 'LOW';
  const urgencyStyle = URGENCY_STYLES[urgency] || URGENCY_STYLES.LOW;

  const evidence = result.evidence || {};
  const threatDna = result.threat_dna || [];
  const entities = result.entities || {};
  const hasEntities = (entities.locations?.length > 0) || (entities.time?.length > 0) || (entities.people?.length > 0);
  const escalation = result.escalation || {};
  const toxicity = result.toxicity || 0;

  const handleCopyEvidence = () => {
    const text = [
      `AEGIS EVIDENCE REPORT`,
      `Date: ${evidence.timestamp || result.timestamp}`,
      `Analysis ID: ${result.analysis_id}`,
      `Threat Level: ${result.threat_level || result.label.toUpperCase()}`,
      `Confidence: ${(result.confidence * 100).toFixed(1)}%`,
      `Toxicity: ${toxicity}/100`,
      ``,
      `— Original Message —`,
      evidence.message || '(not available)',
      ``,
      `— Summary —`,
      evidence.summary || result.reason,
      ``,
      `— Detected Patterns —`,
      (evidence.detected_patterns || result.patterns_detected || []).join(', ') || 'None',
      ``,
      `— Legal References —`,
      (evidence.legal_references || result.legal_references || []).join('\n') || 'None',
      ``,
      `— Recommendations —`,
      (result.recommendations || []).join('\n'),
    ].join('\n');
    navigator.clipboard.writeText(text);
  };

  const getHeatColor = (s) => {
    if (s < 20) return 'bg-blue-500';
    if (s < 40) return 'bg-green-500';
    if (s < 60) return 'bg-yellow-500';
    if (s < 80) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className={`rounded-xl border ${cfg.border} bg-white dark:bg-[#0c0f1a] overflow-hidden animate-reveal`}>

      {/* Thin color-coded top stripe */}
      <div className={`h-0.5 w-full ${cfg.topBar}`} />

      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <LabelIcon className={`w-5 h-5 flex-shrink-0 ${cfg.iconColor}`} />
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Threat Analysis Report</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">{result.analysis_id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <SpeakResult result={result} />
            <span className={`px-2.5 py-1 rounded text-xs font-bold tracking-wide ${cfg.badge}`}>
              {cfg.label}
            </span>
            <span className={`px-2.5 py-1 rounded text-xs font-semibold border ${urgencyStyle}`}>
              {urgency}
            </span>
          </div>
        </div>

        {/* Danger alert — prominent action plan for dangerous results */}
        {result.label === 'dangerous' && (
          <div className="space-y-3">
            {/* Action plan */}
            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-4 h-4 text-red-500 dark:text-red-400" />
                <p className="text-sm font-bold text-red-700 dark:text-red-300">Immediate Action Plan</p>
              </div>
              <div className="space-y-2">
                {ACTION_STEPS.map(({ step, text, color }, i) => (
                  <div key={step} className={`flex items-start gap-3 animate-fade-up stagger-${i + 1}`}>
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full bg-red-100 dark:bg-red-950/60 border border-red-300 dark:border-red-800/60 flex items-center justify-center text-[11px] font-bold ${color}`}>
                      {step}
                    </span>
                    <p className={`text-sm leading-relaxed ${color}`}>{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audio evidence recorder */}
            <AudioEvidence analysisId={result.analysis_id} />
          </div>
        )}

        {/* Escalation */}
        {escalation.detected && (
          <div className="p-4 bg-orange-950/30 border border-orange-900/50 rounded-lg flex items-start gap-3">
            <ShieldAlert className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-300">Escalation pattern detected</p>
              <p className="text-xs text-orange-400/80 mt-0.5">{escalation.type || 'Signals indicate increasing intensity.'}</p>
            </div>
          </div>
        )}

        {/* Summary */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Summary</p>
          <p className="text-base text-slate-800 dark:text-slate-200 leading-relaxed">
            {result.summary || result.reason}
          </p>
        </div>

        {/* Threat story */}
        {result.story && (
          <div className="p-4 rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/60">
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" /> Context
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic">
              {result.story}
            </p>
          </div>
        )}

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-3">
          <MetricCell label="Risk score" value={`${result.risk_score.toFixed(0)}`} max={100} score={result.risk_score} getColor={getHeatColor} />
          <MetricCell label="Confidence" value={`${(result.confidence * 100).toFixed(0)}%`} max={100} score={result.confidence * 100} getColor={getHeatColor} />
          <MetricCell label="Toxicity" value={`${toxicity}`} max={100} score={toxicity} getColor={getHeatColor} />
        </div>

        {/* Breakdown */}
        {result.breakdown?.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Breakdown</p>
            <div className="space-y-2">
              {result.breakdown.map((item, i) => (
                <BreakdownRow key={i} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* Risk factors */}
        {(result.risk_factors?.length > 0) && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Risk factors</p>
            <div className="space-y-1.5">
              {(result.risk_factors || []).map((factor, i) => (
                typeof factor === 'string'
                  ? <div key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <span className="text-slate-600 mt-0.5 flex-shrink-0">—</span>
                    <span>{factor}</span>
                  </div>
                  : <RiskFactorRow key={i} factor={factor} />
              ))}
            </div>
          </div>
        )}

        {/* Patterns removed — shown in Explainable AI tab instead */}

        {/* Entities */}
        {hasEntities && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {entities.locations?.length > 0 && (
              <EntitySection icon={<MapPin className="w-3.5 h-3.5" />} label="Locations" items={entities.locations} />
            )}
            {entities.time?.length > 0 && (
              <EntitySection icon={<Clock className="w-3.5 h-3.5" />} label="Time references" items={entities.time} />
            )}
            {entities.people?.length > 0 && (
              <EntitySection icon={<Users className="w-3.5 h-3.5" />} label="People" items={entities.people} />
            )}
          </div>
        )}

        {/* Threat DNA */}
        {threatDna.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Threat DNA</p>
            <div className="space-y-3">
              {threatDna.map((dna, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-700 dark:text-slate-300 capitalize">{dna.pattern}</span>
                    <span className="text-slate-500 font-mono text-xs">{dna.match}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${dna.match >= 75 ? 'bg-red-500' : dna.match >= 40 ? 'bg-yellow-500' : 'bg-blue-500'}`}
                      style={{ width: `${dna.match}%` }}
                    />
                  </div>
                  {dna.explanation && <p className="text-xs text-slate-500">{dna.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legal refs */}
        {(result.legal_references?.length > 0 || evidence.legal_references?.length > 0) && (
          <div className="p-4 bg-amber-50 dark:bg-[#1a1500] border border-amber-300 dark:border-amber-600/40 rounded-lg">
            <p className="text-xs text-amber-900 dark:text-amber-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5" /> Legal references (India)
            </p>
            <ul className="space-y-1.5">
              {(result.legal_references || evidence.legal_references || []).map((ref, i) => (
                <li key={i} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2 font-medium">
                  <span className="text-amber-600 dark:text-amber-500 mt-0.5 font-bold">§</span>
                  <span>{ref}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendations */}
        {result.recommendations?.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Recommended actions</p>
            <ul className="space-y-2">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                  <span className="text-blue-500 mt-0.5 flex-shrink-0">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Additional fields */}
        {(result.tone || result.emotional_state) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {result.tone && <InfoCell label="Tone" value={result.tone} />}
            {result.emotional_state && <InfoCell label="Emotional state" value={result.emotional_state} />}
          </div>
        )}

        {/* Emotional impact */}
        {result.emotional_impact?.length > 0 && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2">Emotional impact</p>
            <div className="flex flex-wrap gap-1.5">
              {result.emotional_impact.map((e, i) => (
                <span key={i} className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs">{e}</span>
              ))}
            </div>
          </div>
        )}

        {/* Support message */}
        {result.support_message && (
          <div className="p-4 bg-slate-100 dark:bg-slate-800/40 border border-slate-300 dark:border-slate-700/50 rounded-lg flex items-start gap-3">
            <Heart className="w-4 h-4 text-pink-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{result.support_message}</p>
          </div>
        )}

        {/* MCP Status Notification */}
        {result.mcp_status !== undefined && result.mcp_status === true && (
          <div className="p-4 bg-green-950/20 border border-green-900/40 rounded-lg flex items-start gap-3">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-green-400">Evidence stored successfully</p>
              <p className="text-xs text-green-500/70 mt-0.5">Your report has been securely saved locally via MCP.</p>
            </div>
          </div>
        )}
        {result.mcp_status !== undefined && result.mcp_status === false && result.label === 'dangerous' && (
          <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">Evidence storage failed</p>
              <p className="text-xs text-red-500/70 mt-0.5">MCP server offline — start it with <span className="font-mono">node app.js</span> in the mcp-server folder.</p>
            </div>
          </div>
        )}

        {/* Evidence footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Evidence record
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyEvidence}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-medium transition-colors"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
              <button
                onClick={onDownloadPDF}
                disabled={pdfLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                <Download className="w-3 h-3" />
                {pdfLoading ? 'Generating…' : 'PDF'}
              </button>
            </div>
          </div>
          <div className="text-xs text-slate-600 font-mono space-y-1 p-3 bg-white dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800">
            <p><span className="text-slate-700">ID:</span> {result.analysis_id}</p>
            <p><span className="text-slate-700">Hash:</span> {result.analysis_id ? btoa(result.analysis_id).slice(0, 32) : 'N/A'}</p>
            <p><span className="text-slate-700">Threat level:</span> {result.threat_level}</p>
            <p><span className="text-slate-700">Confidence:</span> {(result.confidence * 100).toFixed(1)}%</p>
            <p><span className="text-slate-700">Patterns:</span> {(evidence.detected_patterns || result.patterns_detected || []).join(', ') || 'None'}</p>
            <p><span className="text-slate-700">Timestamp:</span> {new Date(result.timestamp).toLocaleString()}</p>
          </div>
        </div>

        {/* Helplines */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-5">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Helplines (India)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: 'Women Helpline', number: '1091' },
              { label: 'NCW', number: '7827170170' },
              { label: 'Police', number: '100' },
              { label: 'Emergency', number: '112' },
              { label: 'Cyber Crime', number: '1930' },
              { label: 'iCall', number: '9152987821' },
            ].map((c) => (
              <a
                key={c.label}
                href={`tel:${c.number}`}
                className="flex items-center justify-between p-2.5 rounded bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:border-slate-700 transition-colors"
              >
                <span className="text-xs text-slate-500">{c.label}</span>
                <span className="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{c.number}</span>
              </a>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

/* Sub-components */

function MetricCell({ label, value, score, getColor }) {
  return (
    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{value}</p>
      <div className="h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${getColor(score)}`} style={{ width: `${Math.min(score, 100)}%` }} />
      </div>
    </div>
  );
}

function BreakdownRow({ item }) {
  const colors = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-slate-600 dark:text-slate-400',
  };
  return (
    <div className="flex items-start gap-3 py-2 border-b border-slate-200 dark:border-slate-800/60 last:border-0">
      <span className={`text-xs font-semibold uppercase mt-0.5 w-14 flex-shrink-0 ${colors[item.severity] || colors.medium}`}>
        {item.severity}
      </span>
      <div>
        <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{item.title}</p>
        {item.description && <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>}
      </div>
    </div>
  );
}

function RiskFactorRow({ factor }) {
  const colors = { high: 'text-red-400', medium: 'text-yellow-400', low: 'text-slate-600 dark:text-slate-400' };
  return (
    <div className="flex items-start gap-3 text-sm">
      <span className={`font-medium flex-shrink-0 capitalize ${colors[factor.severity] || colors.medium}`}>{factor.factor}</span>
      {factor.description && <span className="text-slate-500 text-xs mt-0.5">{factor.description}</span>}
    </div>
  );
}

function EntitySection({ icon, label, items }) {
  return (
    <div>
      <p className="text-xs text-slate-500 mb-1.5 flex items-center gap-1">{icon} {label}</p>
      <div className="flex flex-wrap gap-1">
        {items.map((item, i) => (
          <span key={i} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs">{item}</span>
        ))}
      </div>
    </div>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200 capitalize">{value}</p>
    </div>
  );
}