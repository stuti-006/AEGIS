import React, { useEffect, useRef, useState } from 'react';
import {
  Send, Shield, Image, FileText, Upload,
} from 'lucide-react';
import { SpiralLoader } from './SpiralLoader';
import { LanguageBadge } from './LanguageBadge';

/* ── Live keyword scanner ─────────────────────────────────────────────── */
// Regex patterns catch partial/contextual phrases the old exact-match list missed
const LIVE_DANGER_PATTERNS = [
  // stalking / location threats
  /outside your (house|home|apartment|flat|door|building|place|work|office|school|college)/i,
  /i('m| am) (right |just )?(outside|watching|following|waiting|nearby|close)/i,
  /i know where you (live|work|stay|are|go)/i,
  /i (tracked|followed|found|located|saw) you/i,
  /i can see you/i,
  /i('m| am) coming (for you|tonight|now|over|to get you)/i,
  /come out (right now|now|outside)/i,
  // violence
  /\b(kill|stab|shoot|murder|rape|burn|destroy|end)\b.{0,20}\byou\b/i,
  /\byou('re| are).{0,10}(dead|finished|done|gone)\b/i,
  /i('ll| will).{0,15}(hurt|harm|attack|beat|find|get) you/i,
  // blackmail / revenge
  /i (have|got) your (photos|pictures|videos|nudes|screenshots)/i,
  /i('ll| will) (leak|post|share|send|release|expose) your/i,
  // coercion
  /you (have no choice|belong to me|can't leave|can't escape|are mine)/i,
  /do it or (else|i will|i'll)/i,
  // sexual
  /send (me )?(nudes|your photos|your pics|your pictures|your body)/i,
  /\b(sleep|have sex|fuck) with me\b/i,
  // harassment
  /\b(slut|whore|bitch|cunt)\b/i,
  /go (kill|hang|end) yourself/i,
  /\bkys\b/i,
  // gaslighting
  /no(body| one) will believe you/i,
  /you('re| are) (crazy|imagining|overreacting|lying|delusional)/i,
];

const LIVE_SUSPICIOUS_PATTERNS = [
  /where (do you live|are you( right now)?|do you stay)/i,
  /are you (alone|home|by yourself)/i,
  /i('ll| will|'m going to).{0,20}(find|come|show up)/i,
  /\bor else\b/i,
  /\bwatch (yourself|your back|out)\b/i,
  /\bdon't test me\b/i,
  /you('ll| will) (see|regret|be sorry)/i,
  /\b(send me|show me) (a pic|your pic|a photo|your photo)\b/i,
  // romance scam
  /my (bag|wallet|passport|phone) was stolen/i,
  /\b(stranded|stuck at the airport|embassy)\b/i,
  /only (person|one) i trust/i,
  /\blend me\b/i,
  /\bpay upfront\b/i,
];

function liveClassify(text) {
  if (LIVE_DANGER_PATTERNS.some((r) => r.test(text))) return 'RED';
  if (LIVE_SUSPICIOUS_PATTERNS.some((r) => r.test(text))) return 'YELLOW';
  return 'GREEN';
}

/* ── Heat theme → border gradient + glow ─────────────────────────────── */
function getHeatTheme(color) {
  if (color === 'RED') return {
    gradient: 'linear-gradient(120deg, rgba(248,113,113,0.95), rgba(220,38,38,0.9), rgba(251,113,133,0.95))',
    shadow: '0 0 24px rgba(239,68,68,0.40), 0 0 48px rgba(220,38,38,0.22)',
    animation: 'pulse-red 1.5s infinite',
    accent: 'text-red-400',
    label: 'DANGEROUS',
  };
  if (color === 'YELLOW') return {
    gradient: 'linear-gradient(120deg, rgba(250,204,21,0.95), rgba(245,158,11,0.92), rgba(251,191,36,0.95))',
    shadow: '0 0 22px rgba(234,179,8,0.32), 0 0 44px rgba(245,158,11,0.18)',
    animation: 'pulse-yellow 1.5s infinite',
    accent: 'text-yellow-400',
    label: 'SUSPICIOUS',
  };
  return {
    gradient: 'linear-gradient(120deg, rgba(74,222,128,0.95), rgba(16,185,129,0.9), rgba(45,212,191,0.95))',
    shadow: '0 0 18px rgba(34,197,94,0.22), 0 0 36px rgba(20,184,166,0.12)',
    animation: 'pulse-green 1.5s infinite',
    accent: 'text-emerald-400',
    label: 'SAFE',
  };
}

export function AnalysisInput({ onAnalyze, loading, result }) {
  const [message, setMessage] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [selectedSource, setSelectedSource] = useState('typing');

  // Live color from typing OR confirmed result from server
  const [liveColor, setLiveColor] = useState('GREEN');
  const serverColor = result?.color;
  const activeColor = serverColor || liveColor;
  const theme = getHeatTheme(activeColor);

  // Update live color as user types
  useEffect(() => {
    if (!serverColor) {
      setLiveColor(message.trim().length > 3 ? liveClassify(message) : 'GREEN');
    }
  }, [message, serverColor]);

  const clearUploadState = () => {
    setUploadStatus('');
    setOcrProgress(0);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview('');
  };

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) onAnalyze({ message: message.trim() });
  };

  const handleTextFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      setMessage(text);
      setSelectedSource('file');
      setUploadStatus(`Loaded ${file.name} into the analysis console.`);
    } catch {
      setUploadStatus('Could not read that text file. Please try another.');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setSelectedSource('image');
    setUploadStatus(`Preparing OCR for ${file.name}…`);
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const TesseractModule = await import('tesseract.js');
      const Tesseract = TesseractModule.default || TesseractModule;
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (entry) => {
          if (entry.status === 'recognizing text') setOcrProgress(Math.round(entry.progress * 100));
        },
      });
      const extracted = data?.text?.trim() || '';
      if (extracted) {
        setMessage(extracted);
        setUploadStatus(`OCR complete — extracted text from ${file.name}.`);
      } else {
        setUploadStatus('OCR finished but found no readable text. You can paste manually.');
      }
    } catch {
      setUploadStatus('OCR could not complete. Paste the text manually.');
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* ── Main input card ── */}
        <div className="glass rounded-2xl p-6 shadow-2xl">

          {/* Header row */}
          <div className="mb-3 flex items-center justify-between gap-4">
            <label className="block text-sm font-semibold white-300">
              Threat Input Console
            </label>
            <span className={`text-xs font-bold tracking-wide ${theme.accent}`}>
              Live heat signature: {theme.label}
            </span>
          </div>

          {/* Animated border shell */}
          <div
            className="rounded-2xl p-[2px] transition-all duration-500"
            style={{
              backgroundImage: theme.gradient,
              boxShadow: theme.shadow,
              animation: theme.animation,
            }}
          >
            <div className="rounded-[14px] bg-slate-50 dark:bg-slate-950/90 p-1">
              <textarea
                value={message}
                onChange={(e) => {
                  setMessage(e.target.value);
                  setSelectedSource('typing');
                  clearUploadState();
                }}
                placeholder="Paste a message, upload a screenshot for OCR, or load a text file to analyze for threats…"
                className="w-full h-36 rounded-xl border border-transparent bg-slate-50 dark:bg-slate-950/85 p-4 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none resize-none"
                disabled={loading || ocrLoading}
              />
            </div>
          </div>

          {/* Status chips */}
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-gray-400">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              Source: {selectedSource}
            </span>
            <span className={`rounded-full border px-3 py-1 font-semibold ${activeColor === 'RED' ? 'border-red-500/40 bg-red-500/10 text-red-300' :
              activeColor === 'YELLOW' ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300' :
                'border-green-500/40 bg-green-500/10 text-green-300'
              }`}>
              {theme.label}
            </span>
            <LanguageBadge text={message} />
            {(loading || ocrLoading) && (
              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-cyan-200">
                {ocrLoading ? `OCR scanning ${ocrProgress}%` : 'Analyzing…'}
              </span>
            )}
          </div>

          {/* Submit row — no language selector */}
          <div className="mt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={!message.trim() || loading || ocrLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/50"
            >
              {loading || ocrLoading ? (
                <><Shield className="w-4 h-4 animate-pulse" />{ocrLoading ? 'Extracting…' : 'Analyzing…'}</>
              ) : (
                <><Send className="w-4 h-4" />Analyze</>
              )}
            </button>
          </div>

          {/* Upload options */}
          <div className="mt-5">
            <UploadCard
              icon={<FileText className="w-4 h-4" />}
              label="Text File Upload"
              hint="Load .txt files for bulk message testing"
              accept=".txt,text/plain"
              onChange={handleTextFile}
              disabled={loading || ocrLoading}
            />
          </div>

          {/* Upload status */}
          {(uploadStatus || imagePreview) && (
            <div className="mt-4 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-200">
                <Upload className="h-4 w-4" />
                Upload Pipeline
              </div>
              {uploadStatus && <p className="mt-2 text-sm text-cyan-100/90">{uploadStatus}</p>}
              {ocrLoading && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-xs text-cyan-200">
                    <span>OCR progress</span><span>{ocrProgress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-400 to-indigo-400 transition-all"
                      style={{ width: `${ocrProgress}%` }}
                    />
                  </div>
                </div>
              )}
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Uploaded preview"
                  className="mt-4 max-h-48 w-full rounded-xl object-cover border border-white/10"
                />
              )}
            </div>
          )}

          {message.length > 0 && (
            <div className="mt-3 text-xs text-slate-500 dark:text-gray-500">
              {message.length} / 10,000 characters
            </div>
          )}
        </div>

        {/* Spiral Loader while analyzing */}
        {loading && (
          <div className="glass rounded-2xl shadow-2xl border border-blue-500/20 bg-blue-500/5">
            <SpiralLoader label="Scanning for threats…" />
          </div>
        )}

      </form>
    </div>
  );
}

function UploadCard({ icon, label, hint, accept, onChange, disabled }) {
  return (
    <label className={`cursor-pointer rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-4 block transition-all hover:border-blue-400/50 hover:bg-blue-500/5 ${disabled ? 'pointer-events-none opacity-50' : ''}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white mb-1">
        {icon}{label}
      </div>
      <p className="text-xs text-slate-500 dark:text-gray-400">{hint}</p>
      <input type="file" accept={accept} className="hidden" onChange={onChange} disabled={disabled} />
    </label>
  );
}
