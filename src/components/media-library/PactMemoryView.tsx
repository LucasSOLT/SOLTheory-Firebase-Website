"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useUser } from "@/firebase";
import {
  BookOpen, Trash2, Loader2, RotateCcw,
  User as UserIcon, Users, ArrowUpRight, Plus, X, Brain
} from "lucide-react";

export interface PACTEntry {
  id: string;
  question: string;
  answer: string;
  category?: string;
  confidence?: string;
  source: string;
  scope: 'user' | 'org';
  org_id: string;
  user_id?: string;
  marked_for_deletion?: string; 
  deletion_reason?: string;
  review_count?: number;
  last_reviewed_at?: string; 
  last_review_result?: string;
  last_review_reason?: string;
  user_restored?: boolean;
  created_at: string; 
  updated_at: string; 
}

interface FilterResult {
  shouldDelete: boolean;
  reason: string;
}

function applyDeterministicFilter(question: string, answer: string): FilterResult {
  const q = question.toLowerCase().trim();
  const a = answer.toLowerCase().trim();
  if (
    q.includes("current temporal context") ||
    q.includes("currently") ||
    q.includes("right now") ||
    q.match(/^(is|was) the user (currently|presently|right now|now)/) ||
    q.match(/what is the user (doing|trying|attempting) (right now|currently|now|at the moment)/)
  ) return { shouldDelete: true, reason: "Ephemeral state — not a lasting fact" };
  if (
    q.includes("want the ai to") ||
    q.includes("want jarvis to") ||
    q.includes("expect the ai to") ||
    q.includes("what tool does the user expect") ||
    q.includes("what does the user want the ai") ||
    q.includes("does the user want jarvis")
  ) return { shouldDelete: true, reason: "AI command — not a personal fact" };
  if (
    q.match(/^(is|was) the user (trying|attempting|working on|in the process)/) ||
    q.match(/what (is|was) the user trying to/) ||
    q.match(/what (action|task) (did|does|is) the user/)
  ) return { shouldDelete: true, reason: "Temporary action — not a lasting fact" };
  if (
    q.includes("conversation with jarvis") ||
    q.includes("chatting with jarvis") ||
    q.includes("interaction with the ai") ||
    q.includes("conversation with the ai")
  ) return { shouldDelete: true, reason: "Self-referential" };
  if (
    q.match(/^is the user (checking|browsing|looking at|viewing|in) (their|the|an)?\s?(inbox|email|dashboard|page|screen)/) ||
    q.includes("checking their inbox")
  ) return { shouldDelete: true, reason: "Transient browsing state" };
  if (a.length <= 5 && (a === "yes" || a === "no" || a === "yes." || a === "no." || a === "true" || a === "false")) {
    return { shouldDelete: true, reason: "Binary answer with no detail" };
  }
  if (
    q.includes("trying to do with the ai") ||
    q.includes("trying to accomplish with") ||
    q.includes("user's goal with the ai") ||
    q.includes("user's intent with")
  ) return { shouldDelete: true, reason: "Temporary AI task" };

  return { shouldDelete: false, reason: "" };
}

export default function PactMemoryView({ orgId, isDark = false }: { orgId: string, isDark?: boolean }) {
  const { user } = useUser();
  const [activeScope, setActiveScope] = useState<'user' | 'org'>('user');
  const [entries, setEntries] = useState<PACTEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [reviewProgress, setReviewProgress] = useState("");
  const [toasts, setToasts] = useState<{ id: string, text: string, type: 'success' | 'error' | 'warn' | 'info' }[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ question: '', answer: '', category: 'preference' });
  
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'warn' | 'info' = 'info') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pact/memories?scope=${activeScope}&orgId=${orgId}`, {
        headers: await getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setEntries(data || []);
      } else {
        showToast("Failed to fetch memories", "error");
      }
    } catch (e) {
      showToast("Error loading memories", "error");
    } finally {
      setLoading(false);
    }
  }, [activeScope, orgId, showToast]);

  useEffect(() => {
    if (user?.uid) {
      fetchEntries();
    }
  }, [fetchEntries, user?.uid]);

  const stats = useMemo(() => {
    const total = entries.length;
    const expiring = entries.filter(e => e.marked_for_deletion).length;
    const active = total - expiring;
    return { total, expiring, active };
  }, [entries]);

  const handlePromote = async (id: string) => {
    try {
      const res = await fetch(`/api/pact/memories`, {
        method: "PATCH",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, orgId, action: 'promote' })
      });
      if (res.ok) {
        showToast("Promoted fact to Organization Memory!", "success");
        fetchEntries();
      } else {
        showToast("Failed to promote fact", "error");
      }
    } catch (e) {
      showToast("Error promoting fact", "error");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/pact/memories`, {
        method: "DELETE",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, scope: activeScope, orgId })
      });
      if (res.ok) {
        showToast("Fact deleted", "success");
        setEntries(prev => prev.filter(e => e.id !== id));
      } else {
        showToast("Failed to delete fact", "error");
      }
    } catch (e) {
      showToast("Error deleting fact", "error");
    }
  };

  const handleRestore = async (id: string) => {
    try {
      const res = await fetch(`/api/pact/memories`, {
        method: "PATCH",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ id, orgId, action: 'restore' })
      });
      if (res.ok) {
        showToast("Fact restored!", "success");
        fetchEntries();
      } else {
        showToast("Failed to restore fact", "error");
      }
    } catch (e) {
      showToast("Error restoring fact", "error");
    }
  };

  const handleAddFact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.question || !addForm.answer) return;
    try {
      const res = await fetch(`/api/pact/memories`, {
        method: "POST",
        headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify({ 
          scope: activeScope, 
          orgId, 
          question: addForm.question, 
          answer: addForm.answer, 
          category: addForm.category, 
          confidence: 'high', 
          source: 'manual' 
        })
      });
      if (res.ok) {
        showToast("Fact added successfully", "success");
        setShowAddModal(false);
        setAddForm({ question: '', answer: '', category: 'preference' });
        fetchEntries();
      } else {
        showToast("Failed to add fact", "error");
      }
    } catch (err) {
      showToast("Error adding fact", "error");
    }
  };

  const handleReviewFacts = async () => {
    if (reviewing || stats.active === 0) return;
    setReviewing(true);
    setReviewProgress("Scanning with deterministic filters...");
    
    try {
      const activeEntries = entries.filter(e => !e.marked_for_deletion);
      const toAI = [];
      
      for (const entry of activeEntries) {
        if (entry.user_restored) {
          toAI.push(entry);
          continue;
        }
        const filterRes = applyDeterministicFilter(entry.question, entry.answer);
        if (filterRes.shouldDelete) {
          await fetch(`/api/pact/memories`, {
            method: "PATCH",
            headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
            body: JSON.stringify({ id: entry.id, orgId, action: 'flag', reason: filterRes.reason })
          });
        } else {
          toAI.push(entry);
        }
      }
      
      if (toAI.length > 0) {
        setReviewProgress(`Evaluating ${toAI.length} items with AI...`);
        const res = await fetch("/api/pact-evaluate", {
          method: "POST",
          headers: await getAuthHeaders(),
          body: JSON.stringify({
            entries: toAI.map(e => ({ question: e.question, answer: e.answer, reviewCount: e.review_count || 0 })),
            userName: user?.displayName
          })
        });
        
        if (res.ok) {
          const data = await res.json();
          const decisions = data.decisions || [];
          for (const d of decisions) {
            const entry = toAI[d.index];
            if (entry) {
              if (d.keep === false) {
                await fetch(`/api/pact/memories`, {
                  method: "PATCH",
                  headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
                  body: JSON.stringify({ id: entry.id, orgId, action: 'flag', reason: d.reason || "Low value" })
                });
              } else {
                await fetch(`/api/pact/memories`, {
                  method: "PATCH",
                  headers: { ...(await getAuthHeaders()), "Content-Type": "application/json" },
                  body: JSON.stringify({ id: entry.id, orgId, action: 'review_keep', review_count: (entry.review_count || 0) + 1, last_review_reason: d.reason || "Deemed valuable" })
                });
              }
            }
          }
        }
      }
      showToast("Review complete", "success");
      fetchEntries();
    } catch (err) {
      showToast("Review failed", "error");
    } finally {
      setReviewing(false);
      setReviewProgress("");
    }
  };

  const cardBg = isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textMuted = isDark ? "text-slate-500" : "text-slate-400";
  const bgMain = isDark ? "bg-slate-950" : "bg-slate-50";

  return (
    <div className={`flex flex-col gap-6 animate-in fade-in duration-300 relative rounded-2xl p-6 border ${cardBg}`}>
      {toasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
          {toasts.map((toast) => (
            <div key={toast.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold border backdrop-blur-md ${
              isDark ? "bg-slate-800 text-white border-slate-700" : "bg-white text-black border-slate-200"
            }`}>
              {toast.text}
            </div>
          ))}
        </div>
      )}

      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className={`text-lg font-bold flex items-center gap-2 ${textPrimary}`}>
            <Brain className="w-5 h-5 text-indigo-500" />
            Dual-Scope Working Memory
          </h2>
          <p className={`text-xs mt-1 ${textMuted}`}>Agent facts synced across personal & organization scopes</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReviewFacts} disabled={reviewing || stats.active === 0} className={isDark ? "bg-slate-800 text-white border-slate-700 hover:bg-slate-700" : ""}>
            {reviewing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RotateCcw className="w-4 h-4 mr-2" />}
            Review Items
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} className={isDark ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-indigo-600 text-white"}>
            <Plus className="w-4 h-4 mr-2" />
            Add Fact
          </Button>
        </div>
      </div>
      
      {reviewing && reviewProgress && (
        <div className={`text-xs font-medium animate-pulse ${isDark ? "text-indigo-400" : "text-indigo-600"}`}>
          {reviewProgress}
        </div>
      )}

      <div className={`flex p-1 rounded-xl w-fit ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
        <button onClick={() => setActiveScope('user')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeScope === 'user' ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
          <UserIcon className="w-4 h-4" /> Personal Memory (My Assistant)
        </button>
        <button onClick={() => setActiveScope('org')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeScope === 'org' ? (isDark ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
          <Users className="w-4 h-4" /> Organization Memory (Org Hub)
        </button>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className={`h-40 flex flex-col items-center justify-center border border-dashed rounded-xl ${isDark ? "border-slate-700 bg-slate-900/50" : "border-slate-200 bg-slate-50"}`}>
          <BookOpen className="w-8 h-8 text-slate-400 mb-2" />
          <p className={`text-sm font-semibold ${textPrimary}`}>No learned facts yet</p>
          <p className={textMuted}>As you chat, details will appear here automatically.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {entries.map(entry => {
            const isMarked = !!entry.marked_for_deletion;
            return (
              <div key={entry.id} className={`border rounded-xl p-4 flex flex-col gap-3 group transition-all ${isMarked ? (isDark ? "border-red-900/60 bg-red-950/20" : "border-red-200 bg-red-50/50") : (isDark ? "bg-slate-900 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300")}`}>
                <div className="flex justify-between items-start gap-4">
                  <span className={`text-sm font-semibold leading-tight ${isMarked ? "line-through text-slate-400" : textPrimary}`}>
                    {entry.question}
                  </span>
                  <div className="flex opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0">
                    {activeScope === 'user' && !isMarked && (
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${isDark ? "text-indigo-400 hover:bg-indigo-900/50" : "text-indigo-500 hover:bg-indigo-50"}`} title="Promote to Org" onClick={() => handlePromote(entry.id)}>
                        <ArrowUpRight className="w-4 h-4" />
                      </Button>
                    )}
                    {isMarked ? (
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${isDark ? "text-emerald-400 hover:bg-emerald-900/50" : "text-emerald-500 hover:bg-emerald-50"}`} title="Restore Fact" onClick={() => handleRestore(entry.id)}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className={`h-8 w-8 ${isDark ? "text-red-400 hover:bg-red-900/50" : "text-red-500 hover:bg-red-50"}`} title="Delete Fact" onClick={() => handleDelete(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
                <p className={`text-sm leading-relaxed ${isMarked ? "line-through text-slate-500" : (isDark ? "text-slate-300" : "text-slate-600")}`}>
                  {entry.answer}
                </p>
                <div className={`flex items-center gap-2 text-[10px] font-medium mt-auto pt-3 border-t flex-wrap ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
                  <span className="capitalize">{entry.category || 'General'}</span>
                  <span>•</span>
                  <span>{new Date(entry.updated_at).toLocaleDateString()}</span>
                  {entry.review_count ? (
                    <>
                      <span>•</span>
                      <span>Reviewed {entry.review_count}x</span>
                    </>
                  ) : null}
                  {isMarked && (
                    <span className={`px-1.5 py-0.5 rounded ml-auto ${isDark ? "text-red-400 bg-red-950 border border-red-800/50" : "text-red-600 bg-red-100 border border-red-200"}`}>
                      Flagged: {entry.deletion_reason}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl p-6 shadow-2xl ${isDark ? "bg-slate-900 border border-slate-700 text-white" : "bg-white border border-slate-200"}`}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-bold text-lg">Add Manual Fact</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowAddModal(false)} className={`h-8 w-8 rounded-full ${isDark ? "hover:bg-slate-800 text-slate-400 hover:text-white" : "hover:bg-slate-100 text-slate-500 hover:text-black"}`}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <form onSubmit={handleAddFact} className="space-y-4">
              <div>
                <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Question / Concept</label>
                <Input value={addForm.question} onChange={e => setAddForm({...addForm, question: e.target.value})} placeholder="e.g. User's preferred coding language" required className={isDark ? "bg-slate-800 border-slate-700 text-white focus:ring-slate-600" : ""} />
              </div>
              <div>
                <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Answer / Detail</label>
                <textarea className={`w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 resize-none ${isDark ? "bg-slate-800 border-slate-700 text-white focus:ring-slate-600" : "border-slate-200 focus:ring-slate-200"}`} rows={3} value={addForm.answer} onChange={e => setAddForm({...addForm, answer: e.target.value})} placeholder="e.g. Prefers TypeScript with strict mode enabled" required />
              </div>
              <div>
                <label className={`text-xs font-bold mb-1.5 block uppercase tracking-wide ${isDark ? "text-slate-400" : "text-slate-500"}`}>Category</label>
                <select className={`w-full border rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 ${isDark ? "bg-slate-800 border-slate-700 text-white focus:ring-slate-600" : "border-slate-200 focus:ring-slate-200"}`} value={addForm.category} onChange={e => setAddForm({...addForm, category: e.target.value})}>
                  {['preference', 'identity', 'work', 'goal', 'relationship', 'project', 'team', 'process', 'contact'].map(c => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div className="pt-2">
                <Button type="submit" className={`w-full py-6 text-sm font-bold ${isDark ? "bg-indigo-600 hover:bg-indigo-500 text-white" : "bg-slate-900 hover:bg-slate-800 text-white"}`}>
                  Save Fact
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
