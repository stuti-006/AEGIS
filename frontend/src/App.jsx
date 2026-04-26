import { Suspense, lazy, useState, useEffect } from 'react';
import { Shield, AlertTriangle, Download, Loader, Image as ImageIcon, Type, Table, Sun, Moon, X } from 'lucide-react';
import { AnalysisInput } from './components/AnalysisInput';
import { ScreenshotAnalyzer } from './components/ScreenshotAnalyzer';
import { BatchAnalyzer } from './components/BatchAnalyzer';
import { SpiralLoader } from './components/SpiralLoader';
import { SafeExitButton } from './components/SafeExit';
import { CrisisChat } from './components/CrisisChat';
import { useAuth } from './auth/AuthContext';
import { LoginPage } from './pages/Login';
import './styles/globals.css';

const ResultCard = lazy(() => import('./components/ResultCard').then(m => ({ default: m.ResultCard })));
const ThreatHistory = lazy(() => import('./components/ThreatHistory').then(m => ({ default: m.ThreatHistory })));
const ExplainableAI = lazy(() => import('./components/ExplainableAI').then(m => ({ default: m.ExplainableAI })));
const RiskHeatMap = lazy(() => import('./components/RiskHeatMap').then(m => ({ default: m.RiskHeatMap })));

const THREAT_MAP = { SAFE: 0, SUSPICIOUS: 1, DANGEROUS: 2, safe: 0, suspicious: 1, dangerous: 2 };

function AppShell() {
  const { user, logout, apiFetch } = useAuth();
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logoStage, setLogoStage] = useState('center');
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('result');
  const [refreshKey, setRefreshKey] = useState(0);
  const [timelineHistory, setTimeline] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [inputMode, setInputMode] = useState('text');
  const [showCrisisChat, setShowCrisisChat] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLogoStage('corner'), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); setShowInstallBanner(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setShowInstallBanner(false);
  };

  const handleAnalyze = async (data) => {
    setLoading(true);
    setError(null);
    try {
      const isScreenshot = data._source === 'screenshot' || data._image_base64;
      const endpoint = isScreenshot ? '/api/analyze/image' : '/api/analyze';
      const payload = isScreenshot
        ? { image_base64: data._image_base64 || '', language: 'en', ocr_text: data._ocr_text || data.message || '' }
        : { message: data.message, language: 'en' };

      const response = await apiFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const text = await response.text();
      if (!text) throw new Error('Empty response from backend');
      const analysisResult = JSON.parse(text);
      if (!response.ok) throw new Error(analysisResult?.detail || `Analysis failed (${response.status})`);

      setResult(analysisResult);
      setActiveTab('result');
      if (analysisResult.label === 'dangerous' || analysisResult.threat_level === 'DANGEROUS') {
        setTimeout(() => setShowCrisisChat(true), 800);
      }
      setTimeline(prev => [...prev, {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        level: THREAT_MAP[analysisResult.threat_level || analysisResult.label] ?? 0,
        label: (analysisResult.threat_level || analysisResult.label || 'SAFE').toUpperCase(),
        riskScore: analysisResult.risk_score ?? 0,
      }].slice(-12));
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err.message || 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleReplay = (pastResult) => {
    setResult(pastResult);
    setActiveTab('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDownloadPDF = async () => {
    if (!result) return;
    setPdfLoading(true);
    try {
      const res = await apiFetch('/api/generate-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

// backend returns: { status: "success", filename: "evidence_ana_xxx.pdf" }
      const file = data.url || data.file || data.filename;
      if (!file) throw new Error('No filename/url returned');

      const pdfPath = file.startsWith('/') ? file : `/reports/${file}`;
      const pdfUrl = `${import.meta.env.VITE_API_URL}${pdfPath}`;

      window.open(pdfUrl, '_blank', 'noopener,noreferrer');
      return;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className={`aegis-overlay ${logoStage === 'corner' ? 'hide' : ''}`} />

      <style>{`
        @keyframes aegis-pulse {
          0%   { opacity: 0; transform: scale(0.85); }
          20%  { opacity: 1; }
          100% { opacity: 0; transform: scale(1.15); }
        }
        .aegis-overlay {
          position: fixed; inset: 0; background: #020617; z-index: 40;
          transition: opacity 1.2s ease;
        }
        .aegis-overlay.hide { opacity: 0; pointer-events: none; }
        .aegis-shield-wrap { position: fixed; z-index: 50; pointer-events: auto; }
        .aegis-shield-wrap.stage-center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
        .aegis-shield-wrap.stage-corner {
          top: auto; bottom: 24px; left: 24px; transform: translate(0,0);
          transition: top 1.6s cubic-bezier(0.22,1,0.36,1), left 1.6s cubic-bezier(0.22,1,0.36,1),
            bottom 1.6s cubic-bezier(0.22,1,0.36,1), transform 1.6s cubic-bezier(0.22,1,0.36,1);
        }
        .aegis-shield-inner {
          position: relative; display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: width 1.6s cubic-bezier(0.22,1,0.36,1), height 1.6s cubic-bezier(0.22,1,0.36,1), border-radius 1.6s ease;
        }
        .aegis-shield-inner.size-center { width: 100vw; height: 100vh; border-radius: 0; }
        .aegis-shield-inner.size-corner { width: 40px; height: 40px; border-radius: 10px; }
        .aegis-shield-icon { color: #60a5fa; transition: width 1.6s cubic-bezier(0.22,1,0.36,1), height 1.6s cubic-bezier(0.22,1,0.36,1), filter 0.8s ease; }
        .aegis-shield-icon.icon-center { width: 52px; height: 52px; filter: drop-shadow(0 0 10px rgba(99,179,237,0.7)) drop-shadow(0 0 24px rgba(99,179,237,0.35)); }
        .aegis-shield-icon.icon-corner { width: 20px; height: 20px; filter: none; }
        .aegis-glow-ring-1 { position: absolute; inset: -14px; border-radius: 40px; border: 1.5px solid rgba(99,179,237,0.6); pointer-events: none; animation: aegis-pulse 2s ease-out forwards; }
        .aegis-glow-ring-2 { position: absolute; inset: -28px; border-radius: 54px; border: 1px solid rgba(99,179,237,0.28); pointer-events: none; animation: aegis-pulse 2s 0.35s ease-out forwards; }
      `}</style>

      <div className={`aegis-shield-wrap ${logoStage === 'center' ? 'stage-center' : 'stage-corner'}`}>
        <div className={`aegis-shield-inner ${logoStage === 'center' ? 'size-center' : 'size-corner'}`}>
          {logoStage === 'center' && (
            <>
              <span className="aegis-glow-ring-1" />
              <span className="aegis-glow-ring-2" />
            </>
          )}
          <Shield className={`aegis-shield-icon ${logoStage === 'center' ? 'icon-center' : 'icon-corner'}`} />
        </div>
      </div>

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-blue-600/3 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="border-b border-slate-200 dark:border-white/5 bg-white/90 dark:bg-[#080b11]/90 backdrop-blur sticky top-0 z-20">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-white" />
              </div>
              <div className="flex items-baseline gap-2.5">
                <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">AEGIS</span>
                <span className="text-slate-500 dark:text-slate-500 text-xs hidden sm:block">Women's Safety Intelligence</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <SafeExitButton result={result} />
              <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-600 dark:text-slate-300">{user?.email}</span>
                <button
                  onClick={() => { logout(); setResult(null); }}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Logout"
                >
                  Logout
                </button>
              </div>
              {result && (
                <button
                  onClick={handleDownloadPDF}
                  disabled={pdfLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 disabled:opacity-50 text-slate-700 dark:text-white text-sm font-medium transition-colors"
                >
                  {pdfLoading ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Evidence PDF
                </button>
              )}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 transition-colors"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <span className="text-xs text-slate-400 hidden md:block">v2.0 · GUARDIANTEXT</span>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-12">

          {/* PWA Install Banner */}
          {showInstallBanner && (
            <div className="mb-6 flex items-center justify-between gap-4 p-3 bg-blue-950/40 border border-blue-800/40 rounded-xl">
              <div className="flex items-center gap-3">
                <Shield className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <p className="text-sm text-blue-300">Install AEGIS on your homescreen for quick access during emergencies</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleInstall} className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors">
                  Install
                </button>
                <button onClick={() => setShowInstallBanner(false)} className="text-slate-500 hover:text-white transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Hero */}
          <div className="mb-12">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              Message threat analysis
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-base">
              Paste a message, upload a screenshot, or run a batch CSV to detect harassment, stalking, and coercion patterns.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/50 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-300 text-sm">Analysis failed</p>
                <p className="text-sm text-red-600 dark:text-red-400/80 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          {/* Input Mode Selector */}
          <div className="mb-6 flex gap-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 w-fit">
            {[
              { key: 'text', icon: <Type className="w-3.5 h-3.5" />, label: 'Text' },
              { key: 'screenshot', icon: <ImageIcon className="w-3.5 h-3.5" />, label: 'Screenshot' },
              { key: 'batch', icon: <Table className="w-3.5 h-3.5" />, label: 'Batch CSV' },
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setInputMode(key)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputMode === key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
              >
                {icon} {label}
              </button>
            ))}
          </div>

          {/* Input Component */}
          <section className="mb-12">
            {loading ? (
              <SpiralLoader />
            ) : inputMode === 'text' ? (
              <AnalysisInput onAnalyze={handleAnalyze} loading={loading} result={result} />
            ) : inputMode === 'screenshot' ? (
              <ScreenshotAnalyzer onAnalyze={handleAnalyze} loading={loading} />
            ) : (
              <BatchAnalyzer />
            )}
          </section>

          {/* Result Tabs — History always visible, others only when result exists */}
          <div className="mb-4 flex gap-0 border-b border-slate-200 dark:border-slate-800">
            {[
              { key: 'result', label: 'Result', always: false },
              { key: 'explainable', label: 'Explainable AI', always: false },
              { key: 'heatmap', label: 'Risk Map', always: false },
              { key: 'history', label: 'History', always: true },
            ].filter(t => t.always || !!result).map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${activeTab === t.key
                  ? 'text-slate-900 dark:text-white border-blue-500'
                  : 'text-slate-500 dark:text-slate-500 border-transparent hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <section className="mb-16">
            <Suspense fallback={<SpiralLoader />}>
              {activeTab === 'result' && result && <ResultCard result={result} onDownloadPDF={handleDownloadPDF} pdfLoading={pdfLoading} />}
              {activeTab === 'result' && !result && (
                <p className="text-center py-12 text-slate-500 dark:text-slate-600 text-sm">No analysis yet — paste a message above to get started.</p>
              )}
              {activeTab === 'explainable' && result && <ExplainableAI result={result} />}
              {activeTab === 'heatmap' && result && <RiskHeatMap result={result} />}
              {activeTab === 'history' && <ThreatHistory refresh={refreshKey} sessionHistory={timelineHistory} onReplay={handleReplay} />}
            </Suspense>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800/60 mt-8">
          <div className="max-w-6xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-3 gap-10">

            {/* Brand */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-slate-900 dark:text-white font-semibold text-sm">AEGIS</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-600 leading-relaxed max-w-xs">
                AI-powered threat detection for women's safety. Detect, document, and act quickly.
              </p>
            </div>

            {/* Platform */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Platform</p>
              {['Threat Analysis', 'Screenshot OCR', 'Evidence Reports', 'Risk Heat Map', 'Batch Analysis'].map(l => (
                <p key={l} className="text-sm text-slate-500 dark:text-slate-600 cursor-default leading-relaxed">{l}</p>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Indian Helplines</p>
              <div className="space-y-2">
                {[
                  { label: 'Women Helpline', number: '1091' },
                  { label: 'NCW', number: '7827170170' },
                  { label: 'Police', number: '100' },
                  { label: 'Emergency', number: '112' },
                  { label: 'Cyber Crime', number: '1930' },
                  { label: 'iCall', number: '+91 9152987821' },
                ].map(c => (
                  <a key={c.label} href={`tel:${c.number}`}
                    className="flex flex-col gap-0.5 group py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0"
                  >
                    <span className="text-xs text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">{c.label}</span>
                    <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-500 dark:group-hover:text-blue-300 transition-colors">{c.number}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-slate-200 dark:border-slate-800/60">
            <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <p className="text-xs text-slate-400">© 2026 AEGIS · GUARDIANTEXT · Demo v2.0</p>
              <div className="flex items-center gap-4 flex-wrap justify-center">
                <span className="text-xs text-slate-500 dark:text-slate-500">
                  Report online:{' '}
                  <a
                    href="https://cybercrime.gov.in"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
                  >
                    National Cyber Crime Reporting Portal
                  </a>
                  {' '}|{' '}
                  <a
                    href="https://ncw.nic.in"
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline underline-offset-2"
                  >
                    National Commission for Women
                  </a>
                </span>
                {[
                  { label: 'Privacy Policy', text: 'This demo does not store personal data. Messages are processed in-memory only.' },
                  { label: 'Terms of Use', text: 'For evaluation and research purposes only. Not for production use without proper legal review.' },
                  { label: 'About', text: 'AEGIS is a scalable AI safety platform prototype built to detect online threats against women.' },
                ].map(({ label, text }) => (
                  <button
                    key={label}
                    onClick={() => alert(text)}
                    className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors underline underline-offset-2 decoration-dotted"
                  >
                    {label}
                  </button>
                ))}
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {showCrisisChat && (
        <CrisisChat result={result} onClose={() => setShowCrisisChat(false)} />
      )}
    </div>
  );
}

function App() {
  const { bootstrapped, isAuthenticated } = useAuth();

  if (!bootstrapped) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
          <Loader className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;
  return <AppShell />;
}
export default App;
