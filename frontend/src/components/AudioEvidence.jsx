import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Square, Download, Trash2, AlertTriangle } from 'lucide-react';

function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

export function AudioEvidence({ analysisId }) {
    const [state, setState] = useState('idle'); // idle | requesting | recording | stopped
    const [seconds, setSeconds] = useState(0);
    const [audioUrl, setAudioUrl] = useState(null);
    const [error, setError] = useState(null);
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);

    useEffect(() => () => {
        clearInterval(timerRef.current);
        if (mediaRef.current) mediaRef.current.stream?.getTracks().forEach(t => t.stop());
        if (audioUrl) URL.revokeObjectURL(audioUrl);
    }, [audioUrl]);

    const startRecording = async () => {
        setError(null);
        setState('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            mediaRef.current = recorder;
            chunksRef.current = [];

            recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
                setAudioUrl(URL.createObjectURL(blob));
                stream.getTracks().forEach(t => t.stop());
                setState('stopped');
            };

            recorder.start(200);
            setState('recording');
            setSeconds(0);
            timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        } catch {
            setError('Microphone access denied. Please allow mic access in your browser.');
            setState('idle');
        }
    };

    const stopRecording = () => {
        clearInterval(timerRef.current);
        mediaRef.current?.stop();
    };

    const discard = () => {
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        setSeconds(0);
        setState('idle');
    };

    const download = () => {
        if (!audioUrl) return;
        const a = document.createElement('a');
        a.href = audioUrl;
        a.download = `AEGIS_Audio_Evidence_${analysisId || Date.now()}.webm`;
        a.click();
    };

    return (
        <div className="p-4 bg-slate-50 dark:bg-[#0f1623] border border-slate-200 dark:border-white/[0.06] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-red-400" />
                    <p className="text-slate-900 dark:text-white text-sm font-semibold">Audio Evidence Recorder</p>
                </div>
                {state === 'recording' && (
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-xs font-mono font-bold">{formatTime(seconds)}</span>
                    </div>
                )}
            </div>

            <p className="text-xs text-slate-500">
                Record audio evidence of a threatening call or conversation. Saved locally on your device.
            </p>

            {error && (
                <div className="flex items-start gap-2 p-2.5 bg-red-950/30 border border-red-900/40 rounded-xl">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-300">{error}</p>
                </div>
            )}

            {/* Waveform visualizer while recording */}
            {state === 'recording' && (
                <div className="flex items-center justify-center gap-0.5 h-10">
                    {Array.from({ length: 24 }).map((_, i) => (
                        <div
                            key={i}
                            className="w-1 bg-red-500 rounded-full"
                            style={{
                                height: `${20 + Math.sin(Date.now() / 200 + i) * 14}px`,
                                animation: `pulse ${0.4 + (i % 5) * 0.1}s ease-in-out infinite alternate`,
                                animationDelay: `${i * 0.05}s`,
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Playback */}
            {audioUrl && state === 'stopped' && (
                <audio controls src={audioUrl} className="w-full h-8 rounded-lg" />
            )}

            {/* Controls */}
            <div className="flex gap-2">
                {state === 'idle' && (
                    <button
                        onClick={startRecording}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
                    >
                        <Mic className="w-4 h-4" /> Start Recording
                    </button>
                )}

                {state === 'requesting' && (
                    <button disabled className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                        <Mic className="w-4 h-4 animate-pulse" /> Requesting mic…
                    </button>
                )}

                {state === 'recording' && (
                    <button
                        onClick={stopRecording}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-white font-semibold text-sm transition-colors"
                    >
                        <Square className="w-4 h-4 fill-white" /> Stop Recording
                    </button>
                )}

                {state === 'stopped' && (
                    <>
                        <button
                            onClick={download}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
                        >
                            <Download className="w-4 h-4" /> Save as Evidence
                        </button>
                        <button
                            onClick={discard}
                            className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-[#1a2235] hover:bg-red-50 dark:hover:bg-red-950/40 border border-slate-200 dark:border-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </>
                )}
            </div>

            {state === 'stopped' && (
                <p className="text-[10px] text-slate-600 text-center">
                    Save the file — it can be submitted as evidence to police or NCW
                </p>
            )}
        </div>
    );
}
