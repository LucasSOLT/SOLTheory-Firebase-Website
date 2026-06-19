"use client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "firebase/firestore";
import { Search, Plus, X, Loader2, Play, ExternalLink, Trash2, Lightbulb } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const ADMIN_EMAIL = "lucas@soltheory.com";

type Walkthrough = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  tags: string[];
  createdAt: any;
};

export function WalkthroughsLibrary() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newTags, setNewTags] = useState("");

  const isAdmin = user?.email === ADMIN_EMAIL;

  // Listen to walkthroughs collection
  useEffect(() => {
    if (!firestore) return;
    const q = query(collection(firestore, "insight_walkthroughs"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Walkthrough));
      setWalkthroughs(items);
      setLoading(false);
    });
    return () => unsub();
  }, [firestore]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firestore || !newTitle.trim() || !newVideoUrl.trim()) return;
    setSubmitting(true);
    try {
      await addDoc(collection(firestore, "insight_walkthroughs"), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        videoUrl: newVideoUrl.trim(),
        tags: newTags.split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
        createdAt: serverTimestamp(),
      });
      setNewTitle("");
      setNewDescription("");
      setNewVideoUrl("");
      setNewTags("");
      setIsAddOpen(false);
    } catch (err) {
      console.error("Failed to add walkthrough:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm("Delete this walkthrough?")) return;
    try {
      await deleteDoc(doc(firestore, "insight_walkthroughs", id));
    } catch (err) {
      console.error("Failed to delete walkthrough:", err);
    }
  };

  // Filter by search
  const filtered = walkthroughs.filter(w => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      w.title.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      w.tags.some(t => t.includes(q))
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pt-8 pb-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">INSiGHT Walkthroughs</h1>
          <p className="text-slate-400 text-sm mt-1">Search for feature guides and video tutorials.</p>
        </div>

        {isAdmin && (
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shrink-0">
                <Plus className="w-4 h-4" />
                Add Walkthrough
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] border-slate-200 bg-white text-slate-900 shadow-xl rounded-xl p-0">
              <DialogHeader className="px-6 pt-6 pb-0">
                <DialogTitle className="text-lg font-semibold text-slate-900">Add New Walkthrough</DialogTitle>
                <p className="text-sm text-slate-400 mt-1">Create a new video walkthrough for the library.</p>
              </DialogHeader>
              <form onSubmit={handleAdd} className="px-6 pb-6 pt-4 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-slate-500 text-xs font-medium">Title</Label>
                  <Input
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g., How to Use the CRM"
                    required
                    className="bg-white border-slate-200 h-10 placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-500 text-xs font-medium">Description</Label>
                  <Textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Brief summary of what this walkthrough covers..."
                    className="bg-white border-slate-200 min-h-[80px] resize-none placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-500 text-xs font-medium">Video URL</Label>
                  <Input
                    value={newVideoUrl}
                    onChange={e => setNewVideoUrl(e.target.value)}
                    placeholder="https://scribehow.com/... or YouTube URL"
                    required
                    className="bg-white border-slate-200 h-10 placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-500 text-xs font-medium">Tags <span className="text-slate-300">(comma-separated)</span></Label>
                  <Input
                    value={newTags}
                    onChange={e => setNewTags(e.target.value)}
                    placeholder="crm, contacts, getting started"
                    className="bg-white border-slate-200 h-10 placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Add
                  </button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search Bar */}
      <div className="relative mb-8">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search walkthroughs by name, topic, or keyword..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-6 h-6 text-slate-300 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-5">
            <Lightbulb className="w-6 h-6 text-slate-300" />
          </div>
          {walkthroughs.length === 0 ? (
            <>
              <p className="text-sm font-medium text-slate-900">No walkthroughs yet</p>
              <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Video walkthroughs and feature guides will appear here once they&apos;re added.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-900">No results for &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Try searching with different keywords or browse all walkthroughs.
              </p>
              <button onClick={() => setSearchQuery("")} className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2">
                Clear search
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(w => (
            <div key={w.id} className="group border border-slate-200 rounded-xl bg-white hover:bg-slate-50/50 transition-all overflow-hidden">
              {/* Thumbnail placeholder */}
              <div className="relative h-36 bg-slate-50 flex items-center justify-center border-b border-slate-100">
                <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
                  <Play className="w-5 h-5 text-slate-400 ml-0.5" />
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(w.id); }}
                    className="absolute top-2 right-2 w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-sm font-medium text-slate-900 line-clamp-1">{w.title}</h3>
                {w.description && (
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{w.description}</p>
                )}
                {w.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {w.tags.slice(0, 4).map((tag, i) => (
                      <span key={i} className="text-[10px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <a
                  href={w.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  Watch walkthrough
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
