"use client";

import React, { useState, useEffect } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, query, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from "firebase/firestore";
import { Users, Mail, User, BookUser, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [aliases, setAliases] = useState("");

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
      setName("");
      setEmail("");
      setAliases("");
    } catch(e) {
      console.error(e);
      alert("Failed to add contact.");
    }
  };

  const handleDeleteContact = async (id: string) => {
    if (!firestore || !user?.uid) return;
    try {
      await deleteDoc(doc(firestore, `users/${user.uid}/contacts/${id}`));
    } catch(e) {
      console.error(e);
      alert("Failed to delete contact.");
    }
  };

  return (
    <div className="flex h-full w-full bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-sm flex-col">
      <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3 shrink-0 bg-slate-50">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-600">
          <BookUser className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-slate-900">Address Book</h2>
          <p className="text-xs text-slate-500 font-medium tracking-wide">Manage your contacts for the AI agent and messaging.</p>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left pane: Add Form */}
        <div className="w-80 border-r border-slate-100 bg-white p-6 shrink-0 flex flex-col relative z-10">
          <h3 className="text-sm font-bold text-slate-800 mb-6 uppercase tracking-widest flex items-center gap-2">
             <Plus className="w-4 h-4 text-slate-400" />
             Add New Contact
          </h3>

          <form onSubmit={handleAddContact} className="flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Full Name</label>
              <div className="relative">
                <Input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="John Doe"
                  required
                  className="pl-9 h-11 bg-slate-50 border-slate-200 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl"
                />
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <Input 
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  required
                  className="pl-9 h-11 bg-slate-50 border-slate-200 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl"
                />
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block uppercase tracking-wider">Nicknames / Aliases</label>
              <Input 
                value={aliases}
                onChange={e => setAliases(e.target.value)}
                placeholder="Johnny, JD"
                className="h-11 bg-slate-50 border-slate-200 text-sm focus-visible:ring-indigo-100 shadow-sm rounded-xl"
              />
              <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                Provide nicknames separated by commas. The AI uses these names to figure out who "email johnny" refers to!
              </p>
            </div>

            <Button type="submit" disabled={!name.trim() || !email.trim()} className="mt-4 h-11 rounded-xl bg-slate-900 hover:bg-indigo-600 transition-colors shadow-md text-white font-semibold">
              Save Contact
            </Button>
          </form>
        </div>

        {/* Right pane: Contact List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-6">
           {contacts.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-center opacity-70">
                <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center border border-slate-100 rotate-12 transition-transform hover:rotate-0 duration-300 mb-6 text-slate-300">
                  <Users className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-slate-800">Your address book is empty</h3>
                <p className="text-sm font-medium text-slate-500 mt-2 max-w-[280px]">Add contacts so that your AI assistant knows who to email, and so you can easily start direct messages.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
               {contacts.map((contact) => (
                 <div key={contact.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col relative group transition-all hover:border-indigo-200 hover:shadow-md">
                   <div className="flex items-start justify-between">
                     <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-sm">
                         {contact.name.charAt(0).toUpperCase()}
                       </div>
                       <div className="flex flex-col">
                         <span className="font-bold text-slate-900 text-[15px]">{contact.name}</span>
                         <span className="text-xs text-slate-500 font-medium">{contact.email}</span>
                       </div>
                     </div>
                     <button 
                       onClick={() => handleDeleteContact(contact.id)}
                       className="p-2 -mt-1 -mr-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   </div>
                   {contact.aliases && contact.aliases !== contact.name && (
                     <div className="mt-4 pt-3 border-t border-slate-100">
                       <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 block mb-1">Aliases</span>
                       <div className="flex flex-wrap gap-1">
                         {contact.aliases.split(',').map(a => a.trim()).filter(Boolean).map((alias, idx) => (
                           <span key={idx} className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
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
    </div>
  );
}
