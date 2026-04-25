import React, { useState, useRef, useCallback } from 'react';
import { Image, Upload, X, Loader, CheckCircle, AlertTriangle, Eye } from 'lucide-react';
import Tesseract from 'tesseract.js';
import { SpiralLoader } from './SpiralLoader';
import { LanguageBadge } from './LanguageBadge';

const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];

export function ScreenshotAnalyzer({ onAnalyze, loading }) {
  const [dragging, setDragging] = useState(false);
  const [image, setImage] = useState(null);   // { url, base64, file }
  const [ocrText, setOcrText] = useState('');
  const [ocrStatus, setOcrStatus] = useState('idle'); // idle | running | done | error
  const [ocrProgress, setOcrProgress] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [editedText, setEditedText] = useState('');
  const fileRef = useRef(null);

  // ── File helpers ──────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      alert('Unsupported file type. Please upload PNG, JPG, WEBP, or GIF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      setImage({ url: dataUrl, base64: dataUrl, file });
      setOcrText('');
      setOcrStatus('running');
      setOcrProgress(0);
      setEditMode(false);
      setEditedText('');

      try {
        const result = await Tesseract.recognize(dataUrl, 'eng', {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100));
            }
          },
        });
        const text = result.data.text.trim();
        setOcrText(text);
        setEditedText(text);
        setOcrStatus(text.length > 0 ? 'done' : 'error');
      } catch (err) {
        console.error('OCR error:', err);
        setOcrStatus('error');
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  const handleClear = () => {
    setImage(null);
    setOcrText('');
    setOcrStatus('idle');
    setOcrProgress(0);
    setEditedText('');
    setEditMode(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSubmit = () => {
    const text = (editMode ? editedText : ocrText).trim();
    if (!text) return;
    // Send extracted text directly to the standard analyze endpoint —
    // no need to re-upload the image; OCR already ran client-side.
    onAnalyze({ message: text });
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">

      {/* Spiral loader while backend is analyzing */}
      {loading && (
        <div className="glass rounded-2xl shadow-2xl border border-blue-500/20 bg-blue-500/5">
          <SpiralLoader label="Analyzing screenshot…" />
        </div>
      )}

      {/* Drop Zone */}
      {!image && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`glass rounded-2xl p-12 text-center cursor-pointer transition-all duration-200 border-2 border-dashed ${dragging
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : 'border-slate-600 hover:border-blue-400/50 hover:bg-blue-500/5'
            }`}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20">
              <Image className="w-10 h-10 text-blue-400" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                Drop a screenshot here
              </p>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                PNG, JPG, WEBP, GIF — auto-extracts text via OCR
              </p>
              <p className="text-xs text-slate-500 dark:text-gray-500 mt-2">
                Supports WhatsApp, Instagram DMs, iMessage, emails, and more
              </p>
            </div>
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold transition-colors">
              <Upload className="w-4 h-4" />
              Choose File
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept={SUPPORTED_TYPES.join(',')}
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* Image Preview + OCR Status */}
      {image && (
        <div className="glass rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-300 flex items-center gap-2">
              <Image className="w-4 h-4 text-blue-400" />
              Screenshot Preview
            </p>
            <button
              onClick={handleClear}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Image thumbnail */}
          <div className="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 max-h-64">
            <img src={image.url} alt="Uploaded screenshot" className="w-full object-contain" />
          </div>

          {/* OCR Progress */}
          {ocrStatus === 'running' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-blue-300">
                <Loader className="w-4 h-4 animate-spin" />
                Extracting text… {ocrProgress}%
              </div>
              <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-200"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* OCR Result */}
          {ocrStatus === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-green-400 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Text extracted ({ocrText.length} characters)
                </p>
                <div className="flex items-center gap-2">
                  <LanguageBadge text={ocrText} />
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-gray-300 font-semibold transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    {editMode ? 'Preview' : 'Edit Text'}
                  </button>
                </div>
              </div>

              {editMode ? (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="w-full h-36 bg-white dark:bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500/50"
                  placeholder="Edit extracted text…"
                />
              ) : (
                <div className="p-4 rounded-lg bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700 max-h-40 overflow-y-auto">
                  <p className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                    {ocrText || '(no text extracted)'}
                  </p>
                </div>
              )}

              <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                <p className="text-xs text-blue-300">
                  💡 Review the extracted text above. If OCR missed anything, click <strong>Edit Text</strong> to correct it before analyzing.
                </p>
              </div>

              <button
                onClick={handleSubmit}
                disabled={loading || !(editMode ? editedText : ocrText).trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-3 rounded-xl font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/30"
              >
                {loading ? (
                  <><Loader className="w-4 h-4 animate-spin" /> Analyzing Screenshot…</>
                ) : (
                  <><AlertTriangle className="w-4 h-4" /> Analyze Screenshot</>
                )}
              </button>
            </div>
          )}

          {/* OCR Error */}
          {ocrStatus === 'error' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-300">
                  ⚠️ OCR couldn't extract readable text. This can happen with low-resolution or heavily stylized screenshots.
                </p>
              </div>
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Paste the message text manually below:
              </p>
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full h-28 bg-white dark:bg-slate-900/50 border border-slate-600 rounded-lg p-3 text-sm text-gray-200 resize-none focus:outline-none focus:border-blue-500/50"
                placeholder="Paste the message text here…"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || !editedText.trim()}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 px-6 py-3 rounded-xl font-semibold transition-all"
              >
                {loading ? <Loader className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
                Analyze Text
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
