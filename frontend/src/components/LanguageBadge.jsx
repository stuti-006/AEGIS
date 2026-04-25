import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

// Map of common script/pattern detectors to language info
const LANG_DETECTORS = [
    { test: /[\u0900-\u097F]/, code: 'hi', name: 'Hindi', flag: '🇮🇳' },
    { test: /[\u0600-\u06FF]/, code: 'ar', name: 'Arabic', flag: '🇸🇦' },
    { test: /[\u4E00-\u9FFF]/, code: 'zh', name: 'Chinese', flag: '🇨🇳' },
    { test: /[\u3040-\u30FF]/, code: 'ja', name: 'Japanese', flag: '🇯🇵' },
    { test: /[\uAC00-\uD7AF]/, code: 'ko', name: 'Korean', flag: '🇰🇷' },
    { test: /[\u0400-\u04FF]/, code: 'ru', name: 'Russian', flag: '🇷🇺' },
    { test: /[\u0370-\u03FF]/, code: 'el', name: 'Greek', flag: '🇬🇷' },
    { test: /[\u0590-\u05FF]/, code: 'he', name: 'Hebrew', flag: '🇮🇱' },
    { test: /[\u0E00-\u0E7F]/, code: 'th', name: 'Thai', flag: '🇹🇭' },
    { test: /[\u0980-\u09FF]/, code: 'bn', name: 'Bengali', flag: '🇧🇩' },
    // Latin-script heuristics
    { test: /\b(je|tu|il|elle|nous|vous|ils|elles|est|sont|avec|pour|dans)\b/i, code: 'fr', name: 'French', flag: '🇫🇷' },
    { test: /\b(ich|du|er|sie|wir|ihr|ist|sind|mit|für|und|nicht|das|die|der)\b/i, code: 'de', name: 'German', flag: '🇩🇪' },
    { test: /\b(yo|tú|él|ella|nosotros|vosotros|ellos|está|son|con|para|que|una)\b/i, code: 'es', name: 'Spanish', flag: '🇪🇸' },
    { test: /\b(eu|tu|ele|ela|nós|vós|eles|elas|está|são|com|para|que|uma)\b/i, code: 'pt', name: 'Portuguese', flag: '🇧🇷' },
    { test: /\b(io|tu|lui|lei|noi|voi|loro|è|sono|con|per|che|una|del)\b/i, code: 'it', name: 'Italian', flag: '🇮🇹' },
];

function detectLanguage(text) {
    if (!text || text.trim().length < 4) return null;
    for (const lang of LANG_DETECTORS) {
        if (lang.test.test(text)) return lang;
    }
    // Default to English if only ASCII letters found
    if (/^[\x00-\x7F]+$/.test(text)) return { code: 'en', name: 'English', flag: '🇬🇧' };
    return null;
}

export function LanguageBadge({ text }) {
    const [lang, setLang] = useState(null);

    useEffect(() => {
        const detected = detectLanguage(text);
        setLang(detected);
    }, [text]);

    if (!lang) return null;

    return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 transition-all duration-300">
            <Globe className="w-3 h-3 text-blue-400" />
            <span>{lang.flag}</span>
            <span className="font-medium">{lang.name}</span>
            {lang.code !== 'en' && (
                <span className="text-yellow-400 font-semibold ml-0.5">· multilingual</span>
            )}
        </div>
    );
}
