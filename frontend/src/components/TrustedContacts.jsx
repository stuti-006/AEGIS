import { useState, useEffect } from 'react';
import { UserPlus, Trash2, X, Users, Check } from 'lucide-react';

const STORAGE_KEY = 'aegis_trusted_contacts';

export function useContacts() {
    const [contacts, setContacts] = useState(() => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
        catch { return []; }
    });

    const save = (list) => {
        setContacts(list);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    };

    const add = (contact) => {
        if (contacts.length >= 5) return;
        save([...contacts, { ...contact, id: Date.now() }]);
    };

    const remove = (id) => save(contacts.filter(c => c.id !== id));

    return { contacts, add, remove };
}

export function TrustedContactsManager({ onClose }) {
    const { contacts, add, remove } = useContacts();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [saved, setSaved] = useState(false);

    const handleAdd = () => {
        const trimName = name.trim();
        const trimPhone = phone.trim().replace(/\s+/g, '');
        if (!trimName || !trimPhone) return;
        add({ name: trimName, phone: trimPhone });
        setName('');
        setPhone('');
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
    };

    return (
        <div className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-[#0f1623] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                <div className="h-1 w-full bg-blue-600" />
                <div className="p-5">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <p className="text-white font-bold text-sm">Trusted Contacts</p>
                            <span className="text-xs text-slate-500">{contacts.length}/5</span>
                        </div>
                        <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Existing contacts */}
                    {contacts.length > 0 && (
                        <div className="space-y-2 mb-4">
                            {contacts.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-2.5 bg-[#1a2235] border border-white/[0.06] rounded-xl">
                                    <div>
                                        <p className="text-white text-sm font-medium">{c.name}</p>
                                        <p className="text-slate-500 text-xs">{c.phone}</p>
                                    </div>
                                    <button onClick={() => remove(c.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add new */}
                    {contacts.length < 5 && (
                        <div className="space-y-2">
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Add contact</p>
                            <input
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="Name (e.g. Mom, Best Friend)"
                                className="w-full bg-[#1a2235] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600/50"
                            />
                            <input
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                                placeholder="Phone number (e.g. +919876543210)"
                                type="tel"
                                className="w-full bg-[#1a2235] border border-white/[0.06] rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-600/50"
                            />
                            <button
                                onClick={handleAdd}
                                disabled={!name.trim() || !phone.trim()}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
                            >
                                {saved ? <><Check className="w-4 h-4" /> Saved!</> : <><UserPlus className="w-4 h-4" /> Add Contact</>}
                            </button>
                        </div>
                    )}

                    {contacts.length === 0 && (
                        <p className="text-center text-xs text-slate-600 mt-3">
                            Add up to 5 people who should be alerted in an emergency
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
