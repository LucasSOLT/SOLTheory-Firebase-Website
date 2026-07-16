"use client";

import React, { useState, useMemo } from "react";
import type { Customer } from "@/stores/crm-store";
import { useCRMStore } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  AlertTriangle, Check, ChevronDown, ChevronRight, Copy, Merge,
  X, Users, Search, Shield, ArrowRight,
} from "lucide-react";

/* ─────────────── TYPES ─────────────── */

interface DuplicateGroup {
  key: string;
  contacts: Customer[];
  matchType: "email" | "phone" | "name";
  similarity: number;
}

/* ─────────────── HELPERS ─────────────── */

function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-\(\)\+]/g, "").slice(-10);
}

function findDuplicates(customers: Customer[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const seen = new Set<string>();

  // 1. Exact email match
  const byEmail = new Map<string, Customer[]>();
  for (const c of customers) {
    if (c.email) {
      const key = c.email.toLowerCase().trim();
      if (!byEmail.has(key)) byEmail.set(key, []);
      byEmail.get(key)!.push(c);
    }
  }
  for (const [email, contacts] of byEmail) {
    if (contacts.length > 1) {
      const key = `email:${email}`;
      groups.push({ key, contacts, matchType: "email", similarity: 100 });
      contacts.forEach(c => seen.add(c.id));
    }
  }

  // 2. Phone match (normalized)
  const byPhone = new Map<string, Customer[]>();
  for (const c of customers) {
    if (c.phone && c.phone.length >= 7) {
      const key = normalizePhone(c.phone);
      if (key.length >= 7) {
        if (!byPhone.has(key)) byPhone.set(key, []);
        byPhone.get(key)!.push(c);
      }
    }
  }
  for (const [phone, contacts] of byPhone) {
    if (contacts.length > 1) {
      const ids = contacts.map(c => c.id).sort().join(",");
      if (!groups.some(g => g.contacts.map(c => c.id).sort().join(",") === ids)) {
        groups.push({ key: `phone:${phone}`, contacts, matchType: "phone", similarity: 95 });
      }
    }
  }

  // 3. Name match (first + last, case-insensitive)
  const byName = new Map<string, Customer[]>();
  for (const c of customers) {
    if (c.firstName && c.lastName) {
      const key = `${c.firstName.toLowerCase().trim()} ${c.lastName.toLowerCase().trim()}`;
      if (!byName.has(key)) byName.set(key, []);
      byName.get(key)!.push(c);
    }
  }
  for (const [name, contacts] of byName) {
    if (contacts.length > 1) {
      const ids = contacts.map(c => c.id).sort().join(",");
      if (!groups.some(g => g.contacts.map(c => c.id).sort().join(",") === ids)) {
        groups.push({ key: `name:${name}`, contacts, matchType: "name", similarity: 85 });
      }
    }
  }

  return groups.sort((a, b) => b.similarity - a.similarity);
}

/* ─────────────── COMPONENT ─────────────── */

interface DuplicateDetectorProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
}

export default function DuplicateDetector({ isOpen, onClose, customers }: DuplicateDetectorProps) {
  const { isDarkMode } = useTheme();
  const updateCustomer = useCRMStore(s => s.updateCustomer);
  const deleteContact = useCRMStore(s => s.deleteContact);
  const showToast = useCRMStore(s => s.showToast);

  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [mergeMode, setMergeMode] = useState<string | null>(null);
  const [keepId, setKeepId] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const duplicateGroups = useMemo(() => findDuplicates(customers), [customers]);
  const visibleGroups = duplicateGroups.filter(g => !dismissed.has(g.key));

  const handleMerge = async (group: DuplicateGroup) => {
    if (!keepId) return;
    const keepContact = group.contacts.find(c => c.id === keepId);
    if (!keepContact) return;

    const otherContacts = group.contacts.filter(c => c.id !== keepId);

    // Merge: fill empty fields from others, combine tags, sum revenue
    const mergedTags = new Set(keepContact.tags || []);
    let mergedRevenue = keepContact.totalRevenue || 0;
    let mergedBalance = keepContact.outstandingBalance || 0;
    const updates: Partial<Customer> = {};

    for (const other of otherContacts) {
      // Fill empty fields
      if (!keepContact.email && other.email) updates.email = other.email;
      if (!keepContact.phone && other.phone) updates.phone = other.phone;
      if (!keepContact.company && other.company) updates.company = other.company;
      if (!keepContact.location && other.location) updates.location = other.location;

      // Combine tags
      (other.tags || []).forEach(t => mergedTags.add(t));

      // Sum financial data
      mergedRevenue += (other.totalRevenue || 0);
      mergedBalance += (other.outstandingBalance || 0);
    }

    updates.tags = Array.from(mergedTags);
    updates.totalRevenue = mergedRevenue;
    updates.outstandingBalance = mergedBalance;

    // Update the keeper
    await updateCustomer(keepId, updates);

    // Delete the others
    for (const other of otherContacts) {
      await deleteContact(other.id);
    }

    showToast(`✅ Merged ${group.contacts.length} contacts into ${keepContact.firstName} ${keepContact.lastName}`);
    setMergeMode(null);
    setKeepId(null);
  };

  if (!isOpen) return null;

  const MATCH_TYPE_STYLES: Record<string, { label: string; color: string }> = {
    email: { label: "Email Match", color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800" },
    phone: { label: "Phone Match", color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800" },
    name: { label: "Name Match", color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800" },
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={onClose} />

      <div className={`relative z-10 w-full max-w-3xl max-h-[85vh] overflow-hidden rounded-2xl border shadow-2xl flex flex-col ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-[#ede8da]'} animate-in zoom-in-95 fade-in duration-300`}>
        {/* Header */}
        <div className="p-6 pb-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className={`text-lg font-bold flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
              <Shield className="w-5 h-5 text-amber-500" />
              Duplicate Detection
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {visibleGroups.length > 0
                ? `Found ${visibleGroups.length} potential duplicate group${visibleGroups.length !== 1 ? "s" : ""}`
                : "No duplicates detected — your data looks clean!"
              }
            </p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} text-slate-400 hover:text-slate-600 transition-colors cursor-pointer`}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {visibleGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-emerald-950/30' : 'bg-emerald-50'}`}>
                <Check className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>All clean!</h3>
              <p className="text-xs text-slate-400 mt-1">No duplicate contacts found in your database.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleGroups.map(group => {
                const isExpanded = expandedGroup === group.key;
                const isMerging = mergeMode === group.key;
                const matchStyle = MATCH_TYPE_STYLES[group.matchType];

                return (
                  <div key={group.key} className={`rounded-xl border overflow-hidden transition-all ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}>
                    {/* Group header */}
                    <button
                      onClick={() => setExpandedGroup(isExpanded ? null : group.key)}
                      className={`w-full flex items-center gap-3 p-4 text-left transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-700/30' : 'hover:bg-slate-50'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-amber-950/30' : 'bg-amber-50'}`}>
                        <Copy className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {group.contacts.length} potential duplicates
                          </span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${matchStyle.color}`}>
                            {matchStyle.label}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {group.contacts.map(c => `${c.firstName} ${c.lastName}`).join(", ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          group.similarity >= 95 ? "bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400" :
                          group.similarity >= 85 ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400" :
                          "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {group.similarity}% match
                        </span>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {/* Expanded view */}
                    {isExpanded && (
                      <div className={`border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div className="p-4 space-y-2">
                          {group.contacts.map(c => (
                            <div
                              key={c.id}
                              onClick={() => isMerging && setKeepId(c.id)}
                              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                                isMerging && keepId === c.id
                                  ? isDarkMode ? "bg-indigo-950/30 border-indigo-500/50 ring-1 ring-indigo-500/30" : "bg-indigo-50 border-indigo-300 ring-1 ring-indigo-200"
                                  : isDarkMode ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"
                              } ${isMerging ? "cursor-pointer hover:shadow-sm" : ""}`}
                            >
                              {isMerging && (
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                  keepId === c.id ? "bg-indigo-500 border-indigo-500 text-white" : isDarkMode ? "border-slate-600" : "border-slate-300"
                                }`}>
                                  {keepId === c.id && <Check className="w-3 h-3" />}
                                </div>
                              )}
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                                {c.firstName?.[0]}{c.lastName?.[0]}
                              </div>
                              <div className="flex-1 min-w-0 grid grid-cols-4 gap-2">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Name</span>
                                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{c.firstName} {c.lastName}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Email</span>
                                  <span className={`text-xs ${c.email ? (isDarkMode ? 'text-slate-300' : 'text-slate-600') : 'text-slate-300 italic'}`}>{c.email || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Phone</span>
                                  <span className={`text-xs ${c.phone ? (isDarkMode ? 'text-slate-300' : 'text-slate-600') : 'text-slate-300 italic'}`}>{c.phone || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">Revenue</span>
                                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>${(c.totalRevenue || 0).toLocaleString()}</span>
                                </div>
                              </div>
                              {isMerging && keepId === c.id && (
                                <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">KEEP</span>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Actions */}
                        <div className={`px-4 py-3 border-t flex items-center gap-2 ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-100 bg-slate-50/50'}`}>
                          {isMerging ? (
                            <>
                              <span className="text-[11px] text-slate-400 flex-1">Select the contact to keep. Others will be merged and deleted.</span>
                              <button onClick={() => { setMergeMode(null); setKeepId(null); }} className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer">Cancel</button>
                              <button
                                onClick={() => handleMerge(group)}
                                disabled={!keepId}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 disabled:opacity-50 cursor-pointer"
                              >
                                <Merge className="w-3 h-3 inline mr-1" />
                                Merge
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => { setMergeMode(group.key); setKeepId(group.contacts[0]?.id || null); }}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                              >
                                <Merge className="w-3 h-3 inline mr-1" />
                                Merge Contacts
                              </button>
                              <button
                                onClick={() => setDismissed(prev => new Set([...prev, group.key]))}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-700' : 'text-slate-500 hover:bg-slate-100'}`}
                              >
                                Not Duplicates
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────── HELPER FOR KPI BADGE ─────────────── */
export function getDuplicateCount(customers: Customer[]): number {
  return findDuplicates(customers).length;
}
