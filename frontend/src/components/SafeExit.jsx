import { useState, useRef, useEffect } from 'react';
import { PhoneCall, Copy, CheckCheck, X, ShieldAlert, AlertTriangle, MapPin, Loader, Users, MessageSquare } from 'lucide-react';
import { useContacts, TrustedContactsManager } from './TrustedContacts';

const EMERGENCY_CONTACTS = [
    { label: 'NCW Helpline', number: '7827170170' },
    { label: 'Women Helpline', number: '1091' },
    { label: 'Police', number: '100' },
    { label: 'Cyber Crime', number: '1930' },
];

function buildEmergencyText(result, location) {
    const lines = ['🚨 EMERGENCY — I NEED HELP ', '', 'I am using AEGIS Safety System to report a threat.', ''];
    if (location) lines.push(`📍 My Location: ${location}`, '');
    if (result) {
        lines.push(`Threat Level: ${(result.threat_level || result.label || 'UNKNOWN').toUpperCase()}`);
        lines.push(`Risk Score: ${result.risk_score ?? 'N/A'} / 100`);
        if (result.reason) lines.push(`Summary: ${result.reason}`);
        const msg = result.evidence?.message || result.message;
        if (msg) lines.push('', `Threatening message: "${msg}"`);
        if (result.analysis_id) lines.push(`Evidence ID: ${result.analysis_id}`);
        lines.push('', 'Please contact me immediately.');
    } else {
        lines.push('I feel unsafe and need immediate assistance.');
    }
    lines.push('', 'Emergency: Police 100 · NCW 7827170170 · Women Helpline 1091');
    return lines.join('\n');
}

function buildSmsLink(phone, text) {
    // Normalize phone — ensure it starts with country code
    const normalized = phone.startsWith('+') ? phone : `+91${phone.replace(/^0/, '')}`;
    return `sms:${normalized}?body=${encodeURIComponent(text)}`;
}

export function SafeExitButton({ result }) {
    const [open, setOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [location, setLocation] = useState(null);
    const [locLoading, setLocLoading] = useState(false);
    const [locError, setLocError] = useState(null);
    const [showContactsManager, setShowContactsManager] = useState(false);
    const ref = useRef(null);
    const { contacts } = useContacts();

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Fetch location when dropdown opens
    useEffect(() => {
        if (!open || location || locLoading) return;
        setLocLoading(true);
        setLocError(null);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                const { latitude, longitude } = pos.coords;
                try {
                    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
                    const data = await res.json();
                    setLocation(data.display_name || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                } catch {
                    setLocation(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                }
                setLocLoading(false);
            },
            () => { setLocError('Location access denied'); setLocLoading(false); },
            { timeout: 8000 }
        );
    }, [open, location, locLoading]);

    const emergencyText = buildEmergencyText(result, location);

    const handleCopy = () => {
        navigator.clipboard.writeText(emergencyText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
    };

    const isDangerous = result?.label === 'dangerous' || result?.threat_level === 'DANGEROUS';

    return (
        <>
            <div className="relative" ref={ref}>
                {/* Trigger */}
                <button
                    onClick={() => setOpen(o => !o)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${isDangerous
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/40 animate-pulse'
                            : 'bg-red-950/60 hover:bg-red-600 text-red-400 hover:text-white border border-red-800/50'
                        }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    I'm in Danger
                </button>

                {/* Dropdown */}
                {open && (
                    <div
                        className="absolute right-0 top-full mt-2 w-84 bg-[#0d1117] border border-red-800/40 rounded-2xl shadow-2xl shadow-black/70 overflow-hidden"
                        style={{ zIndex: 99999, width: '340px' }}
                    >
                        <div className="h-1 w-full bg-red-600" />
                        <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">

                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-red-950/60 border border-red-700/50 flex items-center justify-center">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-sm">Emergency Assistance</p>
                                        <p className="text-red-400/70 text-xs">You are not alone.</p>
                                    </div>
                                </div>
                                <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-white transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Location */}
                            <div className="p-2.5 bg-[#1a2235] border border-white/[0.06] rounded-xl flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-0.5">Your location</p>
                                    {locLoading && <p className="text-xs text-slate-400 flex items-center gap-1"><Loader className="w-3 h-3 animate-spin" /> Detecting…</p>}
                                    {location && <p className="text-xs text-slate-300 leading-relaxed line-clamp-2">{location}</p>}
                                    {locError && <p className="text-xs text-slate-500">{locError}</p>}
                                </div>
                            </div>

                            {/* Threatening message */}
                            {(result?.evidence?.message || result?.message) && (
                                <div className="p-2.5 bg-red-950/20 border border-red-900/30 rounded-xl">
                                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Threatening message</p>
                                    <p className="text-xs text-red-300 line-clamp-2 italic">"{result.evidence?.message || result.message}"</p>
                                </div>
                            )}

                            {/* ── Trusted Contacts SOS ── */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Send SOS to trusted contacts</p>
                                    <button
                                        onClick={() => { setOpen(false); setShowContactsManager(true); }}
                                        className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        {contacts.length === 0 ? '+ Add contacts' : 'Edit'}
                                    </button>
                                </div>

                                {contacts.length === 0 ? (
                                    <button
                                        onClick={() => { setOpen(false); setShowContactsManager(true); }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-500 hover:border-blue-600/50 hover:text-blue-400 text-xs transition-colors"
                                    >
                                        <Users className="w-3.5 h-3.5" />
                                        Add trusted contacts for one-tap SOS
                                    </button>
                                ) : (
                                    <div className="space-y-1.5">
                                        {contacts.map(c => (
                                            <a
                                                key={c.id}
                                                href={buildSmsLink(c.phone, emergencyText)}
                                                className="flex items-center justify-between p-2.5 bg-[#1a2235] hover:bg-[#1e2a40] border border-white/[0.06] rounded-xl transition-colors group"
                                            >
                                                <div>
                                                    <p className="text-white text-xs font-semibold">{c.name}</p>
                                                    <p className="text-slate-500 text-[10px]">{c.phone}</p>
                                                </div>
                                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/20 group-hover:bg-red-600 border border-red-700/40 transition-colors">
                                                    <MessageSquare className="w-3 h-3 text-red-400 group-hover:text-white" />
                                                    <span className="text-[10px] font-bold text-red-400 group-hover:text-white">Send SOS</span>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Emergency helplines */}
                            <div>
                                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Emergency helplines</p>
                                <div className="grid grid-cols-2 gap-1.5">
                                    {EMERGENCY_CONTACTS.map(c => (
                                        <a
                                            key={c.number}
                                            href={`tel:${c.number}`}
                                            className="flex items-center gap-2 p-2.5 bg-[#1a2235] hover:bg-[#1e2a40] border border-white/[0.06] rounded-xl transition-colors"
                                        >
                                            <PhoneCall className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="text-slate-300 text-[10px] font-medium truncate">{c.label}</p>
                                                <p className="text-red-400 text-sm font-bold">{c.number}</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>
                            </div>

                            {/* Copy full message */}
                            <button
                                onClick={handleCopy}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-sm transition-colors"
                            >
                                {copied ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                {copied ? 'Copied!' : 'Copy full emergency message'}
                            </button>

                            <p className="text-center text-[10px] text-slate-700">
                                Includes your location + threatening message
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Contacts manager modal */}
            {showContactsManager && (
                <TrustedContactsManager onClose={() => setShowContactsManager(false)} />
            )}
        </>
    );
}
