import {
  Lightbulb, AlertCircle, Target, Zap, Heart,
  Activity, BookOpen, ShieldAlert, Fingerprint, CheckCircle,
} from 'lucide-react';

// ── Color maps — light bg + dark bg + text for each status ──────────────────
const STATUS_STYLES = {
  dangerous: {
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    bar: 'bg-red-500',
    row: 'bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/15',
  },
  suspicious: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    bar: 'bg-amber-500',
    row: 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/15',
  },
  safe: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    row: 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/15',
  },
  high: {
    badge: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/30',
    bar: 'bg-red-500',
    row: 'bg-red-50 dark:bg-red-500/5 border-red-100 dark:border-red-500/15',
  },
  medium: {
    badge: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
    bar: 'bg-amber-500',
    row: 'bg-amber-50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/15',
  },
  low: {
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/30',
    bar: 'bg-emerald-500',
    row: 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-500/15',
  },
  info: {
    badge: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30',
    bar: 'bg-blue-500',
    row: 'bg-blue-50 dark:bg-blue-500/5 border-blue-100 dark:border-blue-500/15',
  },
  critical: {
    badge: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-600/20 dark:text-red-200 dark:border-red-500/40',
    bar: 'bg-red-600',
    row: 'bg-red-50 dark:bg-red-600/5 border-red-200 dark:border-red-500/20',
  },
};

function getStatus(s) { return STATUS_STYLES[s] || STATUS_STYLES.info; }

// ── Section card wrapper ──────────────────────────────────────────────────────
function Section({ icon: Icon, iconColor, title, children, accent }) {
  return (
    <div className={`rounded-2xl p-5 bg-white dark:bg-[#0d1117] border shadow-sm dark:shadow-none
      ${accent || 'border-slate-200 dark:border-white/[0.07]'}`}>
      <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Icon className={`w-4 h-4 ${iconColor}`} />
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Factor row — label left, colored badge right ──────────────────────────────
function FactorRow({ label, value, status }) {
  const s = getStatus(status);
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${s.row}`}>
      <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{label}</span>
      <span className={`px-3 py-1 rounded-lg text-xs font-bold border capitalize ${s.badge}`}>
        {value}
      </span>
    </div>
  );
}

// ── Pipeline step ─────────────────────────────────────────────────────────────
function PipelineStep({ step, title, desc, highlight }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-colors
      ${highlight
        ? 'bg-orange-50 dark:bg-orange-500/8 border-orange-200 dark:border-orange-500/25'
        : 'bg-slate-50 dark:bg-white/[0.02] border-slate-100 dark:border-white/[0.05]'
      }`}>
      <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
        ${highlight
          ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/25 dark:text-orange-300'
          : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
        }`}>
        {step}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${highlight ? 'text-orange-700 dark:text-orange-300' : 'text-slate-700 dark:text-slate-300'}`}>
          {title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5 break-words">{desc}</p>
      </div>
      <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
    </div>
  );
}

function getConfidenceStatus(c) {
  if (c >= 0.8) return 'high';
  if (c >= 0.5) return 'medium';
  return 'low';
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function ExplainableAI({ result }) {
  if (!result) {
    return (
      <div className="rounded-2xl p-12 text-center bg-white dark:bg-[#0d1117] border border-slate-200 dark:border-white/[0.07] shadow-sm dark:shadow-none">
        <Lightbulb className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
        <p className="text-slate-400 dark:text-slate-500 text-sm">Analyze a message to see explainable AI insights</p>
      </div>
    );
  }

  const threatDna = result.threat_dna || [];
  const patterns = result.patterns_detected || [];
  const emotional = result.emotional_impact || [];
  const legalRefs = result.legal_references || [];
  const escalation = result.escalation || {};
  const legal = result.legal || {};
  const toxicity = result.toxicity || 0;

  return (
    <div className="space-y-4 animate-fade-up">

      {/* ── Key Decision Factors ── */}
      <Section icon={Target} iconColor="text-blue-500 dark:text-blue-400" title="Key Decision Factors">
        <div className="space-y-2">
          <FactorRow label="Classification" value={result.label?.toUpperCase()} status={result.label} />
          <FactorRow label="Confidence" value={`${(result.confidence * 100).toFixed(1)}%`} status={getConfidenceStatus(result.confidence)} />
          <FactorRow label="Risk Score" value={`${result.risk_score?.toFixed(1)} / 100`} status="info" />
          <FactorRow label="Toxicity" value={`${toxicity} / 100`} status={toxicity > 60 ? 'high' : toxicity > 30 ? 'medium' : 'low'} />
          <FactorRow label="Urgency" value={result.urgency || 'LOW'} status={(result.urgency || 'LOW').toLowerCase()} />
          {result.tone && <FactorRow label="Detected Tone" value={result.tone} status="info" />}
          {result.context_type && <FactorRow label="Context" value={result.context_type} status="info" />}
        </div>
      </Section>

      {/* ── Pipeline Steps ── */}
      <Section icon={Zap} iconColor="text-indigo-500 dark:text-indigo-400" title="GUARDIANTEXT Pipeline Steps">
        <div className="space-y-2">
          <PipelineStep step="0" title="Input Detection" desc="Normalised input text for analysis." />
          <PipelineStep step="1" title="Heatmap Scoring" desc={`Threat: ${result.threat_level || 'SAFE'} | Color: ${result.color || 'GREEN'} | Toxicity: ${toxicity}/100`} />
          <PipelineStep step="2" title="Core Threat Analysis" desc={`${result.risk_factors?.length || 0} risk factor(s) identified.`} />
          <PipelineStep step="3" title="Entity Extraction" desc="Scanned for locations, time refs, and people." />
          <PipelineStep step="4" title="Threat DNA" desc={`${threatDna.length} abuse pattern(s) matched.`} highlight={threatDna.length > 0} />
          <PipelineStep step="5" title="Escalation Intelligence" desc={escalation.detected ? `⚡ ${escalation.type}` : 'No escalation detected.'} highlight={escalation.detected} />
          <PipelineStep step="6" title="Legal Context" desc={legalRefs.length > 0 ? legalRefs.join(' · ') : 'No legal sections triggered.'} />
          <PipelineStep step="7" title="Evidence Generation" desc="Structured evidence prepared for reporting." />
          <PipelineStep step="8" title="Action Engine" desc={`${result.recommendations?.length || 0} action(s) recommended.`} />
          <PipelineStep step="9" title="Emotional Support" desc="Human-centred support message generated." />
        </div>
      </Section>

      {/* ── Threat DNA ── */}
      {threatDna.length > 0 && (
        <Section icon={Fingerprint} iconColor="text-purple-500 dark:text-purple-400" title="Threat DNA Analysis">
          <div className="space-y-3">
            {threatDna.map((dna, idx) => {
              const matchStatus = dna.match >= 75 ? 'dangerous' : dna.match >= 40 ? 'suspicious' : 'info';
              const s = getStatus(matchStatus);
              return (
                <div key={idx} className={`p-4 rounded-xl border ${s.row}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white text-sm capitalize">{dna.pattern}</span>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${s.badge}`}>{dna.match}% match</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div className={`h-full rounded-full transition-all duration-700 ${s.bar}`} style={{ width: `${dna.match}%` }} />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{dna.explanation}</p>
                  {dna.real_world_context && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic border-l-2 border-slate-300 dark:border-slate-700 pl-3">
                      {dna.real_world_context}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Escalation ── */}
      {escalation.detected && (
        <Section icon={ShieldAlert} iconColor="text-orange-500 dark:text-orange-400" title="Escalation Intelligence"
          accent="border-orange-200 dark:border-orange-500/25">
          <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-500/8 border border-orange-200 dark:border-orange-500/25">
            <p className="text-sm text-orange-700 dark:text-orange-300 font-medium">
              {escalation.type || 'Multiple threat signals indicate a pattern of increasing intensity.'}
            </p>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 leading-relaxed">
            Escalation detection analyses whether the sender is exhibiting patterns of increasing aggression, control, or surveillance — a key predictor of real-world harm.
          </p>
        </Section>
      )}

      {/* ── Behavioural Patterns ── */}
      {patterns.length > 0 && (
        <Section icon={Activity} iconColor="text-orange-500 dark:text-orange-400" title="Behavioural Patterns Detected">
          <div className="flex flex-wrap gap-2">
            {patterns.map((p, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30 text-sm font-medium capitalize">
                {p}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Emotional Impact ── */}
      {emotional.length > 0 && (
        <Section icon={Heart} iconColor="text-pink-500 dark:text-pink-400" title="Estimated Emotional Impact">
          <div className="flex flex-wrap gap-2">
            {emotional.map((e, i) => (
              <span key={i} className="px-3 py-1.5 rounded-full bg-pink-100 text-pink-700 border border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30 text-sm font-medium">
                {e}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Legal Framework ── */}
      {legalRefs.length > 0 && (
        <Section icon={BookOpen} iconColor="text-amber-500 dark:text-amber-400" title="Legal Framework (India)"
          accent="border-amber-200 dark:border-amber-500/25">
          {legal.explanation && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">{legal.explanation}</p>
          )}
          <ul className="space-y-2">
            {legalRefs.map((ref, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-100 bg-amber-50 dark:bg-amber-500/20 border border-amber-200 dark:border-amber-400/30 rounded-xl px-4 py-2.5 font-medium">
                <span className="font-bold mt-0.5 flex-shrink-0 text-amber-600 dark:text-amber-400">§</span>
                <span>{ref}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* ── Recommended Next Steps ── */}
      {result.recommendations?.length > 0 && (
        <Section icon={AlertCircle} iconColor="text-blue-500 dark:text-blue-400" title="Recommended Next Steps"
          accent="border-blue-200 dark:border-blue-500/25">
          <ul className="space-y-2">
            {result.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/8 border border-blue-100 dark:border-blue-500/20 rounded-xl px-4 py-2.5">
                <span className="font-bold mt-0.5 flex-shrink-0 text-blue-500">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

    </div>
  );
}
