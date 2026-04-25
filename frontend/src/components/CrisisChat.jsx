import { useState, useRef, useEffect } from 'react';
import { Send, X, ShieldAlert, Loader, Phone } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const OPENING_MESSAGE = {
    role: 'assistant',
    content: "I'm here with you. You're not alone in this. 💙\n\nFirst — are you physically safe right now? Where are you?",
};

export function CrisisChat({ result, onClose }) {
    const { apiFetch } = useAuth();
    const [messages, setMessages] = useState([OPENING_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const send = async () => {
        const text = input.trim();
        if (!text || loading) return;

        const userMsg = { role: 'user', content: text };
        const updated = [...messages, userMsg];
        setMessages(updated);
        setInput('');
        setLoading(true);

        try {
            const res = await apiFetch('/api/crisis-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: updated,
                    context: {
                        threat_level: result?.threat_level || result?.label || 'DANGEROUS',
                        risk_score: result?.risk_score,
                        patterns: result?.patterns_detected || [],
                        message: result?.evidence?.message || result?.message || '',
                    },
                }),
            });
            const data = await res.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Please call Police at 100 or NCW at 7827170170 right now. I\'m having trouble connecting.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    };

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-[#0d1117] border border-red-800/40 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
            style={{ zIndex: 99999, maxHeight: '80vh' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-red-950/40 border-b border-red-900/40">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <ShieldAlert className="w-4 h-4 text-red-400" />
                    <span className="text-white font-bold text-sm">AEGIS Crisis Support</span>
                </div>
                <div className="flex items-center gap-2">
                    <a href="tel:100" className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-xs font-bold transition-colors">
                        <Phone className="w-3 h-3" /> 100
                    </a>
                    <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Context banner */}
            {result && (
                <div className="px-4 py-2 bg-red-950/20 border-b border-red-900/20 text-xs text-red-400">
                    ⚠️ {(result.threat_level || result.label || '').toUpperCase()} detected · Risk {result.risk_score ?? '—'}/100
                </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-[#1a2235] text-slate-200 border border-white/[0.06] rounded-bl-sm'
                            }`}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="bg-[#1a2235] border border-white/[0.06] px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2">
                            <Loader className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                            <span className="text-xs text-slate-500">typing…</span>
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.06] flex gap-2">
                <textarea
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Tell me what's happening…"
                    rows={1}
                    className="flex-1 bg-[#1a2235] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 resize-none focus:outline-none focus:border-red-800/60 transition-colors"
                    style={{ maxHeight: '80px' }}
                />
                <button
                    onClick={send}
                    disabled={!input.trim() || loading}
                    className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                    <Send className="w-4 h-4 text-white" />
                </button>
            </div>

            <p className="text-center text-[10px] text-slate-700 pb-2">
                Emergency: Police 100 · NCW 7827170170 · Women Helpline 1091
                <br />
                <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    cybercrime.gov.in
                </a>
                {' '}·{' '}
                <a href="https://ncw.nic.in" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                    ncw.nic.in
                </a>
            </p>
        </div>
    );
}
