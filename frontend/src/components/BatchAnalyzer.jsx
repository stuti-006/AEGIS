import React, { useState, useRef } from 'react';
import { Upload, FileText, AlertTriangle, CheckCircle, AlertCircle, Download, X } from 'lucide-react';
import { SpiralLoader } from './SpiralLoader';
import { LanguageBadge } from './LanguageBadge';
import { useAuth } from '../auth/AuthContext';

const LEVEL_STYLE = {
    DANGEROUS: 'bg-red-500/20 text-red-400 border-red-500/30',
    SUSPICIOUS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    SAFE: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const LEVEL_ICON = {
    DANGEROUS: <AlertTriangle className="w-3.5 h-3.5" />,
    SUSPICIOUS: <AlertCircle className="w-3.5 h-3.5" />,
    SAFE: <CheckCircle className="w-3.5 h-3.5" />,
};

export function BatchAnalyzer() {
    const { apiFetch } = useAuth();
    const [loading, setLoading] = useState(false);
    const [report, setReport] = useState(null);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const fileRef = useRef(null);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        setError('');
        setReport(null);
        setLoading(true);

        try {
            const form = new FormData();
            form.append('file', file);

            const res = await apiFetch('/api/analyze/batch-csv', { method: 'POST', body: form });
            const data = await res.json();

            if (!res.ok) throw new Error(data?.detail || 'Batch analysis failed');
            setReport(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const downloadCSV = () => {
        if (!report) return;
        const headers = ['Row', 'Message', 'Threat Level', 'Confidence %', 'Risk Score', 'Patterns', 'Legal Refs', 'Summary'];
        const rows = report.results
            .filter(r => !r.skipped)
            .map(r => [
                r.row,
                `"${(r.message || '').replace(/"/g, '""')}"`,
                r.threat_level,
                r.confidence,
                r.risk_score,
                `"${(r.patterns || []).join(', ')}"`,
                `"${(r.legal_refs || []).join(', ')}"`,
                `"${(r.summary || '').replace(/"/g, '""')}"`,
            ]);
        const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `AEGIS_Batch_Report_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">

            {/* Upload card */}
            <div className="glass rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Batch CSV Analyzer</h3>
                        <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                            Upload a CSV with a <span className="font-mono text-blue-400">message</span> column — up to 200 rows
                        </p>
                    </div>
                    {report && (
                        <button onClick={() => { setReport(null); setFileName(''); }}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Drop zone */}
                <label className={`flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${loading ? 'pointer-events-none opacity-50' : 'border-slate-600 hover:border-blue-400/60 hover:bg-blue-500/5'}`}>
                    <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                        <Upload className="w-7 h-7 text-blue-400" />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {fileName ? fileName : 'Drop your CSV here or click to browse'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-gray-500 mt-1">CSV must have a column named <span className="font-mono">message</span></p>
                    </div>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} disabled={loading} />
                </label>

                {/* Sample format hint */}
                <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-700">
                    <p className="text-xs text-slate-500 dark:text-gray-500 font-mono">
                        message<br />
                        "I know where you live"<br />
                        "Hey are you free tomorrow?"<br />
                        "You better watch your back"
                    </p>
                </div>
            </div>

            {/* Loading */}
            {loading && (
                <div className="glass rounded-2xl border border-blue-500/20 bg-blue-500/5">
                    <SpiralLoader label="Analyzing batch…" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-300">{error}</p>
                </div>
            )}

            {/* Results */}
            {report && !loading && (
                <div className="space-y-4">

                    {/* Summary bar */}
                    <div className="glass rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                        <SummaryCard label="Total" value={report.total} color="text-slate-900 dark:text-white" />
                        <SummaryCard label="Dangerous" value={report.counts?.dangerous || 0} color="text-red-400" />
                        <SummaryCard label="Suspicious" value={report.counts?.suspicious || 0} color="text-yellow-400" />
                        <SummaryCard label="Safe" value={report.counts?.safe || 0} color="text-green-400" />
                    </div>

                    {/* Download button */}
                    <div className="flex justify-end">
                        <button onClick={downloadCSV}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-slate-900 dark:text-white text-sm font-semibold transition-all">
                            <Download className="w-4 h-4" /> Export Results CSV
                        </button>
                    </div>

                    {/* Row results */}
                    <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                        {report.results.filter(r => !r.skipped).map((r) => (
                            <div key={r.row}
                                className="glass rounded-xl p-4 border border-slate-200 dark:border-slate-800 grid grid-cols-[auto_1fr_auto] gap-4 items-start">
                                <span className="text-xs text-slate-600 dark:text-gray-600 font-mono mt-0.5">#{r.row}</span>
                                <div className="min-w-0 space-y-1">
                                    <p className="text-sm text-gray-200 line-clamp-2">{r.message}</p>
                                    <LanguageBadge text={r.message} />
                                    {r.patterns?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {r.patterns.map(p => (
                                                <span key={p} className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-600 dark:text-gray-400 text-[10px] font-mono capitalize">{p}</span>
                                            ))}
                                        </div>
                                    )}
                                    {r.legal_refs?.length > 0 && (
                                        <p className="text-[10px] text-amber-500/70 font-mono">{r.legal_refs.join(' · ')}</p>
                                    )}
                                </div>
                                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black uppercase ${LEVEL_STYLE[r.threat_level] || LEVEL_STYLE.SAFE}`}>
                                        {LEVEL_ICON[r.threat_level]} {r.threat_level}
                                    </span>
                                    <span className="text-[10px] text-slate-500 dark:text-gray-500 font-mono">{r.confidence}% · {r.risk_score}°</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function SummaryCard({ label, value, color }) {
    return (
        <div className="text-center">
            <p className={`text-3xl font-black ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 dark:text-gray-500 uppercase tracking-wider mt-1">{label}</p>
        </div>
    );
}
