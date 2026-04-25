import { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Loader } from 'lucide-react';

function buildSpeechText(result) {
    if (!result) return '';
    const level = (result.threat_level || result.label || 'unknown').toUpperCase();
    const score = result.risk_score ? `Risk score ${Math.round(result.risk_score)} out of 100.` : '';
    const summary = result.reason || result.summary || '';

    if (level === 'DANGEROUS') {
        return `Alert. This message has been classified as DANGEROUS. ${score} ${summary}. Please move to a safe place and call Police on 100 or the Women Helpline on 1091 immediately.`;
    }
    if (level === 'SUSPICIOUS') {
        return `Warning. This message has been classified as SUSPICIOUS. ${score} ${summary}. Stay alert and document this message as evidence.`;
    }
    return `This message appears safe. ${summary}. No immediate action required.`;
}

export function SpeakResult({ result }) {
    const [speaking, setSpeaking] = useState(false);
    const [supported, setSupported] = useState(false);
    const uttRef = useRef(null);

    useEffect(() => {
        setSupported('speechSynthesis' in window);
        return () => window.speechSynthesis?.cancel();
    }, []);

    useEffect(() => {
        // Auto-speak on dangerous result
        if (result?.label === 'dangerous' || result?.threat_level === 'DANGEROUS') {
            setTimeout(() => speak(), 600);
        }
    }, [result?.analysis_id]);

    const speak = () => {
        if (!supported || speaking) return;
        window.speechSynthesis.cancel();

        const text = buildSpeechText(result);
        const utt = new SpeechSynthesisUtterance(text);

        // Pick a female voice if available, above 2000hz range
        const voices = window.speechSynthesis.getVoices();
        const femaleVoice = voices.find(v =>
            v.name.toLowerCase().includes('female') ||
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('victoria') ||
            v.name.toLowerCase().includes('karen') ||
            v.name.toLowerCase().includes('moira') ||
            v.name.toLowerCase().includes('zira') ||
            (v.lang.startsWith('en') && v.name.toLowerCase().includes('google'))
        );
        if (femaleVoice) utt.voice = femaleVoice;

        utt.rate = 0.92;   // slightly slower — clearer under stress
        utt.pitch = 1.1;   // slightly higher — above 2000hz threshold
        utt.volume = 1;

        utt.onstart = () => setSpeaking(true);
        utt.onend = () => setSpeaking(false);
        utt.onerror = () => setSpeaking(false);

        uttRef.current = utt;
        window.speechSynthesis.speak(utt);
    };

    const stop = () => {
        window.speechSynthesis.cancel();
        setSpeaking(false);
    };

    if (!supported) return null;

    return (
        <button
            onClick={speaking ? stop : speak}
            title={speaking ? 'Stop reading' : 'Read result aloud'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${speaking
                ? 'bg-purple-100 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-500/30 text-purple-700 dark:text-purple-300'
                : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
        >
            {speaking
                ? <><VolumeX className="w-3.5 h-3.5" /> Stop</>
                : <><Volume2 className="w-3.5 h-3.5" /> Read aloud</>
            }
        </button>
    );
}
