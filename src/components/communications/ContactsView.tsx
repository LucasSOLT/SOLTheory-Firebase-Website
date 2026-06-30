"use client";

import React, { useState, useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { logActivity } from "@/lib/activity-logger";
import { Users, Mail, User, BookUser, Plus, Trash2, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import ManageFieldsSidebar from "@/components/crm/ManageFieldsSidebar";
import { useContactFields } from "@/hooks/useContactFields";

interface Contact {
  id: string;
  name: string;
  aliases: string;
  email: string;
  ignore: boolean;
}

export function ContactsView() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { t } = useTranslation();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [aliases, setAliases] = useState("");

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => { const check = () => setIsDarkMode(localStorage.getItem('insight_theme') === 'dark'); check(); const interval = setInterval(check, 500); window.addEventListener('storage', check); return () => { clearInterval(interval); window.removeEventListener('storage', check); }; }, []);

  // ── Manage Fields ──
  const [showManageFields, setShowManageFields] = useState(false);
  const { fieldConfig, applyConfig, saveConfig } = useContactFields("contactBook");

  useEffect(() => {
    if (!firestore || !user?.uid) return;

    const q = query(collection(firestore, `users/${user.uid}/contacts`));
    const unsub = onSnapshot(q, (snap) => {
      const fetched: Contact[] = [];
      snap.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Contact);
      });
      // Sort organically by name
      fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setContacts(fetched);
    });

    return () => unsub();
  }, [firestore, user?.uid]);

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !user?.uid || !email.trim() || !name.trim()) return;

    try {
      await addDoc(collection(firestore, `users/${user.uid}/contacts`), {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        aliases: aliases.trim() || name.trim(),
        ignore: false,
        createdAt: serverTimestamp()
      });
      logActivity(firestore, 'item_created', { email: user?.email || '', displayName: user?.displayName || '' }, `Created contact "${name.trim()}" (${email.trim().toLowerCase()})`);
      setName("");
      setEmail("");
      setAliases("");
    } catch(e) {
      console.error(e);
      alert(t.cbFailedAdd);
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!firestore || !user?.uid) return;
    try {
      const contactName = contacts.find((c) => c.id === id)?.name || id;
      await deleteDoc(doc(firestore, `users/${user.uid}/contacts/${id}`));
      logActivity(firestore, 'item_deleted', { email: user?.email || '', displayName: user?.displayName || '' }, `Deleted contact "${contactName}"`);
    } catch(e) {
      console.error(e);
      alert(t.cbFailedDelete);
    }
  };

  return (
    <div className={`flex h-full w-full rounded-3xl overflow-hidden border shadow-sm flex-col ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
      <div className={`h-16 px-6 border-b flex items-center gap-3 shrink-0 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-[#f0e8d0]'}`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/30 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
          <BookUser className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <h2 className={`text-[15px] font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.cbTitle}</h2>
          <p className={`text-xs font-medium tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cbSubtitle}</p>
        </div>
        <button
          onClick={() => setShowManageFields(true)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${isDarkMode ? 'border-slate-600 bg-slate-700 text-slate-300 hover:bg-slate-600' : 'border-slate-200 bg-[#faf8f3] text-slate-600 hover:bg-[#f5f1e8]'}`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          Manage Fields
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Add Form */}
        <div className={`w-80 border-r p-6 shrink-0 flex flex-col relative z-10 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-[#f0e8d0]'}`}>
          <h3 className={`text-sm font-bold mb-6 uppercase tracking-widest flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
             <Plus className={`w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
             {t.cbAddContact}
          </h3>

          <form onSubmit={handleAddContact} className="flex flex-col gap-4">
            <div>
              <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cbFullName}</label>
              <div className="relative">
                <Input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder={t.cbFullNamePlaceholder}
                  required
                  className={`pl-9 h-11 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
                <User className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
            </div>

            <div>
              <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cbEmail}</label>
              <div className="relative">
                <Input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder={t.cbEmailPlaceholder}
                  required
                  className={`pl-9 h-11 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                />
                <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              </div>
            </div>

            <div>
              <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cbAliases}</label>
              <Input 
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                placeholder={t.cbAliasesPlaceholder}
                className={`h-11 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
              />
              <p className={`text-[10px] mt-2 leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {t.cbAliasesDesc}
              </p>
            </div>

            <Button type="submit" disabled={!name.trim() || !email.trim()} className={`mt-4 h-11 rounded-xl transition-colors shadow-md text-white font-semibold ${isDarkMode ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-slate-900 hover:bg-indigo-600'}`}>
              {t.cbSaveContact}
            </Button>
          </form>
        </div>

        {/* Right pane: Contact List */}
        <div className={`flex-1 overflow-y-auto p-6 ${isDarkMode ? 'bg-slate-900/50' : 'bg-[#f5f1e8]/50'}`}>
           {contacts.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <div className={`w-20 h-20 rounded-3xl shadow-sm flex items-center justify-center border rotate-12 transition-transform hover:rotate-0 duration-300 mb-6 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-[#faf8f3] border-slate-100 text-slate-300'}`}>
                  <Users className="w-8 h-8" />
                </div>
                <h3 className={`text-xl font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.cbEmptyTitle}</h3>
                <p className={`text-sm font-medium mt-2 max-w-[280px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cbEmptyDesc}</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {contacts.map((contact) => (
                 <div key={contact.id} className={`rounded-2xl p-4 shadow-sm flex flex-col relative group transition-all ${isDarkMode ? 'bg-slate-800 border border-slate-700 hover:border-indigo-700 hover:shadow-md' : 'bg-[#faf8f3] border border-slate-200 hover:border-indigo-200 hover:shadow-md'}`}>
                   <div className="flex items-start justify-between">
                     <div className="flex items-center gap-3">
                       <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-500'}`}>
                         {(contact.name || contact.email || "?").charAt(0).toUpperCase()}
                       </div>
                       <div className="flex flex-col">
                         <span className={`font-bold text-[15px] ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{contact.name || "Unnamed"}</span>
                         <span className={`text-xs font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{contact.email}</span>
                       </div>
                     </div>
                     <button 
                       onClick={() => handleDeleteContact(contact.id)}
                       className={`p-2 -mt-1 -mr-1 rounded-xl transition-colors opacity-0 group-hover:opacity-100 ${isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-rose-900/30' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                   {contact.aliases && contact.aliases !== contact.name && (
                     <div className={`mt-4 pt-3 border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                       <span className={`text-[10px] uppercase tracking-widest font-bold block mb-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.cbAliasLabel}</span>
                       <div className="flex flex-wrap gap-1">
                         {contact.aliases.split(',').map(a => a.trim()).filter(Boolean).map((alias, idx) => (
                           <span key={idx} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                             {alias}
                           </span>
                         ))}
                       </div>
                     </div>
                   )}
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* ── Manage Fields Sidebar ── */}
      <ManageFieldsSidebar
        isOpen={showManageFields}
        onClose={() => setShowManageFields(false)}
        fieldConfig={fieldConfig}
        onApply={async (visibleFields, allFields) => {
          applyConfig(visibleFields, allFields);
          await saveConfig({ visibleFields, allFields });
          setShowManageFields(false);
        }}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
