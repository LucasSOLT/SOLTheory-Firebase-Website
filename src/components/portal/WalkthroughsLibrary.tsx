"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "firebase/firestore";
import { Search, Plus, X, Loader2, Play, ExternalLink, Trash2, Lightbulb, Upload, Link2, Clock, Tag, FileText, Eye, ChevronDown, Edit3, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const ADMIN_EMAIL = "lucas@soltheory.com";

const CATEGORY_OPTIONS = [
  "Getting Started",
  "CRM",
  "Action Board",
  "Agent Manager",
  "Communications",
  "Media Library",
  "Surveys",
  "Timesheets",
  "Support Tickets",
  "Google Integrations",
  "Agentic Campaigning",
  "Settings",
  "Other",
];

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner", color: "bg-emerald-100 text-emerald-700" },
  { value: "intermediate", label: "Intermediate", color: "bg-amber-100 text-amber-700" },
  { value: "advanced", label: "Advanced", color: "bg-slate-200 text-slate-700" },
];

type Walkthrough = {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  tags: string[];
  category: string;
  difficulty: string;
  estimatedMinutes: number;
  createdAt: any;
};

export function WalkthroughsLibrary() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const handleDelete = async (id: string) => {
    if (!firestore || !confirm("Delete this walkthrough?")) return;
    try {
      await deleteDoc(doc(firestore, "insight_walkthroughs", id));
    } catch (err) {
      console.error("Failed to delete walkthrough:", err);
    }
  };

  const openEdit = (w: Walkthrough) => {
    setEditingId(w.id);
    setIsAddOpen(true);
  };

  // Unique categories from existing walkthroughs
  const usedCategories = Array.from(new Set(walkthroughs.map(w => w.category).filter(Boolean)));
  const allCategories = ["All", ...Array.from(new Set([...usedCategories, ...CATEGORY_OPTIONS]))];

  // Filter
  const filtered = walkthroughs.filter(w => {
    const matchesSearch = !searchQuery.trim() || 
      w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.tags.some(t => t.includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === "All" || w.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full max-w-6xl mx-auto animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pt-8 pb-6 gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">INSiGHT Walkthroughs</h1>
          <p className="text-slate-400 text-sm mt-1">Search for feature guides, video tutorials, and step-by-step walkthroughs.</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setEditingId(null); setIsAddOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Walkthrough
          </button>
        )}
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search walkthroughs by name, topic, or keyword..."
            className="w-full pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="appearance-none pl-4 pr-9 py-3 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 cursor-pointer min-w-[180px]"
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Results count */}
      {!loading && walkthroughs.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-slate-400">
            {filtered.length} {filtered.length === 1 ? "walkthrough" : "walkthroughs"}
            {selectedCategory !== "All" && ` in ${selectedCategory}`}
            {searchQuery && ` matching "${searchQuery}"`}
          </p>
        </div>
      )}

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
              <p className="text-sm font-medium text-slate-900">No results found</p>
              <p className="text-xs text-slate-400 mt-1.5 max-w-xs leading-relaxed">
                Try searching with different keywords or select a different category.
              </p>
              <button onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }} className="mt-4 text-xs font-medium text-slate-500 hover:text-slate-700 underline underline-offset-2">
                Clear filters
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(w => (
            <WalkthroughCard key={w.id} walkthrough={w} isAdmin={isAdmin} onDelete={handleDelete} onEdit={openEdit} />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isAddOpen && (
        <AddWalkthroughDialog
          firestore={firestore}
          editingWalkthrough={editingId ? walkthroughs.find(w => w.id === editingId) || null : null}
          onClose={() => { setIsAddOpen(false); setEditingId(null); }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WALKTHROUGH CARD
   ═══════════════════════════════════════════════════════════════ */

function WalkthroughCard({ walkthrough: w, isAdmin, onDelete, onEdit }: {
  walkthrough: Walkthrough;
  isAdmin: boolean;
  onDelete: (id: string) => void;
  onEdit: (w: Walkthrough) => void;
}) {
  const diff = DIFFICULTY_OPTIONS.find(d => d.value === w.difficulty);
  
  return (
    <div className="group border border-slate-200 rounded-xl bg-white hover:border-slate-300 transition-all overflow-hidden">
      {/* Thumbnail */}
      <a href={w.videoUrl} target="_blank" rel="noopener noreferrer" className="block relative h-40 bg-slate-50 border-b border-slate-100 overflow-hidden">
        {w.thumbnailUrl ? (
          <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Play className="w-5 h-5 text-slate-400 ml-0.5" />
            </div>
          </div>
        )}

        {/* Overlay badges */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          {w.category && (
            <span className="text-[10px] font-medium bg-white/90 backdrop-blur-sm text-slate-600 px-2 py-0.5 rounded-md shadow-sm border border-slate-100">
              {w.category}
            </span>
          )}
          {diff && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${diff.color}`}>
              {diff.label}
            </span>
          )}
        </div>

        {w.estimatedMinutes > 0 && (
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3" />
            {w.estimatedMinutes} min
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="absolute top-2.5 right-2.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(w); }}
              className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center hover:bg-slate-50 text-slate-400 hover:text-slate-600 shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(w.id); }}
              className="w-7 h-7 bg-white border border-slate-200 rounded-lg flex items-center justify-center hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400 shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </a>

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
            {w.tags.length > 4 && (
              <span className="text-[10px] font-medium text-slate-400 px-1">
                +{w.tags.length - 4}
              </span>
            )}
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
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD/EDIT WALKTHROUGH DIALOG — Full-screen overlay
   ═══════════════════════════════════════════════════════════════ */

function AddWalkthroughDialog({ firestore, editingWalkthrough, onClose }: {
  firestore: any;
  editingWalkthrough: Walkthrough | null;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState<"details" | "media" | "metadata">("details");

  // Form state
  const [title, setTitle] = useState(editingWalkthrough?.title || "");
  const [description, setDescription] = useState(editingWalkthrough?.description || "");
  const [videoUrl, setVideoUrl] = useState(editingWalkthrough?.videoUrl || "");
  const [thumbnailUrl, setThumbnailUrl] = useState(editingWalkthrough?.thumbnailUrl || "");
  const [category, setCategory] = useState(editingWalkthrough?.category || "");
  const [difficulty, setDifficulty] = useState(editingWalkthrough?.difficulty || "beginner");
  const [estimatedMinutes, setEstimatedMinutes] = useState(editingWalkthrough?.estimatedMinutes || 0);
  const [tagsInput, setTagsInput] = useState(editingWalkthrough?.tags?.join(", ") || "");

  const isEditing = !!editingWalkthrough;

  const handleSubmit = async () => {
    if (!firestore || !title.trim() || !videoUrl.trim()) return;
    setSubmitting(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim(),
        videoUrl: videoUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        category: category || "Other",
        difficulty,
        estimatedMinutes: Number(estimatedMinutes) || 0,
        tags: tagsInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean),
      };

      if (isEditing) {
        await updateDoc(doc(firestore, "insight_walkthroughs", editingWalkthrough.id), data);
      } else {
        await addDoc(collection(firestore, "insight_walkthroughs"), {
          ...data,
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (err) {
      console.error("Failed to save walkthrough:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const sections = [
    { id: "details" as const, label: "Details", icon: <FileText className="w-4 h-4" /> },
    { id: "media" as const, label: "Media & Link", icon: <Link2 className="w-4 h-4" /> },
    { id: "metadata" as const, label: "Metadata", icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Dialog */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[780px] md:max-h-[85vh] z-[101] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{isEditing ? "Edit Walkthrough" : "Add New Walkthrough"}</h2>
            <p className="text-xs text-slate-400 mt-0.5">Fill out the details below to {isEditing ? "update this" : "add a new"} walkthrough to the library.</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex items-center gap-1 px-6 pt-4 pb-0 shrink-0">
          {sections.map(s => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all ${
                activeSection === s.id
                  ? "bg-slate-900 text-white"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>

        {/* Form body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {/* ── Details Section ── */}
          {activeSection === "details" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Title <span className="text-red-400">*</span></Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., How to Navigate the CRM Dashboard"
                  className="bg-white border-slate-200 h-11 text-sm placeholder:text-slate-300 focus-visible:ring-slate-400"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Description</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Provide a detailed summary of what this walkthrough covers, what the user will learn, and any prerequisites..."
                  className="bg-white border-slate-200 min-h-[140px] resize-none text-sm placeholder:text-slate-300 focus-visible:ring-slate-400 leading-relaxed"
                />
                <p className="text-[10px] text-slate-300 mt-1">{description.length} characters</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-xs font-medium">Category</Label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full appearance-none pl-3 pr-9 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 cursor-pointer"
                    >
                      <option value="">Select category...</option>
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-slate-600 text-xs font-medium">Difficulty Level</Label>
                  <div className="flex gap-2">
                    {DIFFICULTY_OPTIONS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDifficulty(d.value)}
                        className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${
                          difficulty === d.value
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Media & Link Section ── */}
          {activeSection === "media" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Video / Scribe URL <span className="text-red-400">*</span></Label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder="https://scribehow.com/shared/... or YouTube URL"
                    className="bg-white border-slate-200 h-11 pl-9 text-sm placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-300">Paste a Scribe, YouTube, Loom, or any video/guide URL</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Thumbnail Image URL</Label>
                <div className="relative">
                  <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <Input
                    value={thumbnailUrl}
                    onChange={e => setThumbnailUrl(e.target.value)}
                    placeholder="https://example.com/thumbnail.png"
                    className="bg-white border-slate-200 h-11 pl-9 text-sm placeholder:text-slate-300 focus-visible:ring-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-300">Optional. If empty, a placeholder will be shown.</p>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className="text-slate-600 text-xs font-medium flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </Label>
                <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                  <div className="h-44 flex items-center justify-center">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <Play className="w-8 h-8" />
                        <span className="text-xs">No thumbnail set</span>
                      </div>
                    )}
                  </div>
                  {title && (
                    <div className="px-4 py-3 border-t border-slate-100 bg-white">
                      <p className="text-sm font-medium text-slate-900 truncate">{title}</p>
                      {description && <p className="text-xs text-slate-400 truncate mt-0.5">{description}</p>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Metadata Section ── */}
          {activeSection === "metadata" && (
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Estimated Duration (minutes)</Label>
                <Input
                  type="number"
                  min={0}
                  value={estimatedMinutes || ""}
                  onChange={e => setEstimatedMinutes(Number(e.target.value))}
                  placeholder="e.g., 5"
                  className="bg-white border-slate-200 h-11 text-sm placeholder:text-slate-300 focus-visible:ring-slate-400 w-40"
                />
                <p className="text-[10px] text-slate-300">How long the walkthrough takes to complete</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-600 text-xs font-medium">Tags</Label>
                <Textarea
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder="crm, contacts, getting started, onboarding, dashboard"
                  className="bg-white border-slate-200 min-h-[80px] resize-none text-sm placeholder:text-slate-300 focus-visible:ring-slate-400"
                />
                <p className="text-[10px] text-slate-300">Comma-separated keywords to make this walkthrough searchable</p>
              </div>

              {/* Tag preview */}
              {tagsInput && (
                <div className="space-y-2">
                  <Label className="text-slate-600 text-xs font-medium">Tag Preview</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsInput.split(",").map(t => t.trim()).filter(Boolean).map((tag, i) => (
                      <span key={i} className="text-[10px] font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50 space-y-2">
                <p className="text-xs font-medium text-slate-500 mb-3">Summary</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Title</span>
                    <span className="text-slate-700 font-medium truncate max-w-[160px]">{title || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Category</span>
                    <span className="text-slate-700 font-medium">{category || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Difficulty</span>
                    <span className="text-slate-700 font-medium capitalize">{difficulty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Duration</span>
                    <span className="text-slate-700 font-medium">{estimatedMinutes ? `${estimatedMinutes} min` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Video URL</span>
                    <span className="text-slate-700 font-medium truncate max-w-[160px]">{videoUrl ? "Set" : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tags</span>
                    <span className="text-slate-700 font-medium">{tagsInput.split(",").filter(t => t.trim()).length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/50">
          <div className="flex items-center gap-1.5">
            {sections.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  activeSection === s.id ? "bg-slate-900" : "bg-slate-200"
                }`} />
                {i < sections.length - 1 && <div className="w-4 h-px bg-slate-200" />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeSection !== "details" && (
              <button
                onClick={() => setActiveSection(activeSection === "metadata" ? "media" : "details")}
                className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Back
              </button>
            )}
            {activeSection !== "metadata" ? (
              <button
                onClick={() => setActiveSection(activeSection === "details" ? "media" : "metadata")}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !videoUrl.trim()}
                className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditing ? "Save Changes" : "Publish Walkthrough"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
