import React, { useEffect, useRef, useState } from 'react';

// Simple keyword scan for live scoring (no API call)
const DANGER_WORDS = [
    'kill', 'murder', 'stab', 'shoot', 'hurt', 'harm', 'attack', 'destroy', 'end you', 'dead',
    'threat', 'threaten', 'rape', 'assault', 'beat', 'punch', 'knife', 'gun', 'weapon',
    'bitch', 'slut', 'whore', 'motherfucker', 'fuck you', 'screw you', 'bastard', 'asshole',
    'i know where', 'i found you', 'i\'m outside', 'i\'m watching', 'i\'ll find you',
    'send nudes', 'show me your body', 'you belong to me', 'you can\'t leave',
    'i\'ll leak', 'i\'ll expose', 'pay me or', 'i recorded you',
    'kill myself', 'hurt myself', 'end my life', 'take my life',
];
const SUSPICIOUS_WORDS = [
    'follow', 'watch', 'track', 'locate', 'address', 'route', 'alone', 'scared',
    'don\'t tell', 'secret', 'only you', 'trust me', 'send money', 'gift card',
    'you\'re crazy', 'no one believes', 'overreacting', 'imagining', 'worthless',
    'disgusting', 'pathetic', 'you deserve', 'hate you', 'despise',
];

function liveScore(text) {
    if (!text || text.trim().length < 3) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    for (const w of DANGER_WORDS) { if (lower.includes(w)) score += 18; }
    for (const w of SUSPICIOUS_WORDS) { if (lower.includes(w)) score += 8; }
    // length factor — longer threatening messages score higher
    if (text.length > 80) score += 5;
    return Math.min(100, score);
}

function getGaugeColor(score) {
    if (score >= 65) return { stroke: '#ef4444', glow: 'rgba(239,68,68,0.4)', label: 'DANGEROUS', text: 'text-red-400' };
    if (score >= 30) return { stroke: '#eab308', glow: 'rgba(234,179,8,0.4)', label: 'SUSPICIOUS', text: 'text-yellow-400' };
    return { stroke: '#22c55e', glow: 'rgba(34,197,94,0.3)', label: 'SAFE', text: 'text-green-400' };
}

export function ThreatGauge({ text }) {
    const [displayScore, setDisplayScore] = useState(0);
    const targetRef = useRef(0);
    const rafRef = useRef(null);

    useEffect(() => {
        targetRef.current = liveScore(text);
        const animate = () => {
            setDisplayScore(prev => {
                const diff = targetRef.current - prev;
                if (Math.abs(diff) < 0.5) return targetRef.current;
                rafRef.current = requestAnimationFrame(animate);
                return prev + diff * 0.12;
            });
        };
        rafRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(rafRef.current);
    }, [text]);

    const score = displayScore;
    const { stroke, glow, label, text: textColor } = getGaugeColor(score);

    // SVG arc math — 180° semicircle gauge
    const R = 54;
    const cx = 70, cy = 70;
    const startAngle = Math.PI;           // 180° (left)
    const endAngle = 0;                   // 0°   (right)
    const totalArc = Math.PI;             // 180°
    const fillAngle = startAngle - (score / 100) * totalArc;

    const arcX = (angle) => cx + R * Math.cos(angle);
    const arcY = (angle) => cy + R * Math.sin(angle);

    const bgPath = `M ${arcX(startAngle)} ${arcY(startAngle)} A ${R} ${R} 0 0 1 ${arcX(endAngle)} ${arcY(endAngle)}`;
    const fillPath = score > 0
        ? `M ${arcX(startAngle)} ${arcY(startAngle)} A ${R} ${R} 0 ${score > 50 ? 1 : 0} 1 ${arcX(fillAngle)} ${arcY(fillAngle)}`
        : null;

    // Needle
    const needleAngle = startAngle - (score / 100) * totalArc;
    const needleLen = 42;
    const nx = cx + needleLen * Math.cos(needleAngle);
    const ny = cy + needleLen * Math.sin(needleAngle);

    return (
        <div className="flex flex-col items-center gap-1 select-none">
            <svg width="140" height="80" viewBox="0 0 140 80">
                <defs>
                    <filter id="gauge-glow">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Track */}
                <path d={bgPath} fill="none" stroke="#1e293b" strokeWidth="10" strokeLinecap="round" />

                {/* Colored fill */}
                {fillPath && (
                    <path
                        d={fillPath}
                        fill="none"
                        stroke={stroke}
                        strokeWidth="10"
                        strokeLinecap="round"
                        filter="url(#gauge-glow)"
                        style={{ transition: 'stroke 0.4s ease' }}
                    />
                )}

                {/* Needle */}
                <line
                    x1={cx} y1={cy}
                    x2={nx} y2={ny}
                    stroke={stroke}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    style={{ transition: 'stroke 0.4s ease' }}
                />
                <circle cx={cx} cy={cy} r="4" fill={stroke} style={{ transition: 'fill 0.4s ease' }} />

                {/* Score text */}
                <text x={cx} y={cy - 10} textAnchor="middle" fill="white" fontSize="15" fontWeight="bold">
                    {Math.round(score)}
                </text>
            </svg>

            <span className={`text-xs font-bold tracking-widest ${textColor} transition-colors duration-300`}>
                {label}
            </span>
            <span className="text-xs text-slate-600">live threat score</span>
        </div>
    );
}
