"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useUser, useFirestore, useStorage } from "@/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { collection, addDoc, deleteDoc, updateDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from "firebase/firestore";
import { Search, Plus, X, Loader2, Play, Trash2, Lightbulb, Upload, Link2, Clock, Tag, FileText, Eye, ChevronDown, Edit3, Image as ImageIcon, File, CheckCircle2 } from "lucide-react";
import { useWalkthroughPlayerStore } from "@/stores/walkthrough-player-store";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from '@/lib/i18n';

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
  { value: "beginner", labelKey: "beginnerLabel" as const, color: "bg-emerald-100 text-emerald-700", darkColor: "bg-emerald-900/40 text-emerald-300" },
  { value: "intermediate", labelKey: "intermediateLabel" as const, color: "bg-amber-100 text-amber-700", darkColor: "bg-amber-900/40 text-amber-300" },
  { value: "advanced", labelKey: "advancedLabel" as const, color: "bg-slate-200 text-slate-700", darkColor: "bg-slate-600 text-slate-200" },
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
  const storage = useStorage();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [walkthroughs, setWalkthroughs] = useState<Walkthrough[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const handleTheme = () => {
      setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    };
    handleTheme();
    window.addEventListener('storage', handleTheme);
    const interval = setInterval(handleTheme, 500);
    return () => { window.removeEventListener('storage', handleTheme); clearInterval(interval); };
  }, []);

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
    if (!firestore || !confirm(t.deleteWalkthrough)) return;
    try {
      await deleteDoc(doc(firestore, "insight_walkthroughs", id));
      toast({
        title: t.successLabel,
        description: t.walkthroughDeletedSuccess,
      });
    } catch (err) {
      console.error("Failed to delete walkthrough:", err);
      toast({
        title: t.errorLabel,
        description: t.walkthroughDeleteFailed,
        variant: "destructive",
      });
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
    <div className={`-mx-4 -mb-4 md:-mx-10 md:-mb-10 w-full animate-in fade-in duration-700 h-full overflow-y-auto pb-10 px-6 md:px-10 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#fefdfb]'}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pt-8 pb-6 gap-6">
        <div>
          <h1 className={`text-2xl font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.insightWalkthroughs}</h1>
          <p className={`text-sm mt-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.walkthroughSubtitle}</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => { setEditingId(null); setIsAddOpen(true); }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors shrink-0 ${isDarkMode ? 'bg-white hover:bg-slate-200 text-slate-900' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
          >
            <Plus className="w-4 h-4" />
            {t.addWalkthrough}
          </button>
        )}
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.walkthroughSearchPlaceholder}
            className={`w-full pl-10 pr-10 py-3 border rounded-xl text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white focus:ring-slate-600 focus:border-slate-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-300 focus:ring-slate-200 focus:border-slate-300'}`}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className={`absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-500'}`}>
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category dropdown */}
        <div className="relative shrink-0">
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className={`appearance-none pl-4 pr-9 py-3 border rounded-xl text-sm font-medium focus:outline-none focus:ring-2 cursor-pointer min-w-[180px] ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200 focus:ring-slate-600 focus:border-slate-600' : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-200 focus:border-slate-300'}`}
          >
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat === "All" ? t.allCategories : cat}</option>
            ))}
          </select>
          <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
        </div>
      </div>

      {/* Results count */}
      {!loading && walkthroughs.length > 0 && (
        <div className="flex items-center justify-between mb-4">
          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {filtered.length} {filtered.length === 1 ? t.walkthroughSingular : t.walkthroughPlural}
            {selectedCategory !== "All" && ` ${t.inCategory} ${selectedCategory}`}
            {searchQuery && ` ${t.matchingSearch} "${searchQuery}"`}
          </p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center mb-5 ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
            <Lightbulb className={`w-6 h-6 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
          </div>
          {walkthroughs.length === 0 ? (
            <>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.noWalkthroughsYet}</p>
              <p className={`text-xs mt-1.5 max-w-xs leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {t.walkthroughsWillAppear}
              </p>
            </>
          ) : (
            <>
              <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.noResultsFound}</p>
              <p className={`text-xs mt-1.5 max-w-xs leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                {t.tryDifferentKeywords}
              </p>
              <button onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }} className={`mt-4 text-xs font-medium underline underline-offset-2 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.clearFilters}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map(w => (
            <WalkthroughCard key={w.id} walkthrough={w} isAdmin={isAdmin} isDarkMode={isDarkMode} t={t} onDelete={handleDelete} onEdit={openEdit} onPlay={(url, title, thumb) => useWalkthroughPlayerStore.getState().playVideo(url, title, thumb)} />
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      {isAddOpen && (
        <AddWalkthroughDialog
          firestore={firestore}
          storage={storage}
          editingWalkthrough={editingId ? walkthroughs.find(w => w.id === editingId) || null : null}
          onClose={() => { setIsAddOpen(false); setEditingId(null); }}
          isDarkMode={isDarkMode}
          t={t}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WALKTHROUGH CARD
   ═══════════════════════════════════════════════════════════════ */

function WalkthroughCard({ walkthrough: w, isAdmin, isDarkMode, t, onDelete, onEdit, onPlay }: {
  walkthrough: Walkthrough;
  isAdmin: boolean;
  isDarkMode: boolean;
  t: any;
  onDelete: (id: string) => void;
  onEdit: (w: Walkthrough) => void;
  onPlay: (url: string, title: string, thumbnailUrl: string) => void;
}) {
  const diff = DIFFICULTY_OPTIONS.find(d => d.value === w.difficulty);

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-stretch border rounded-xl hover:shadow-sm transition-all overflow-hidden cursor-pointer ${isDarkMode ? 'border-slate-700 bg-slate-800 hover:border-slate-600' : 'border-slate-200 bg-[#fefdfb] hover:border-slate-300'}`}
      onClick={() => onPlay(w.videoUrl, w.title, w.thumbnailUrl)}
    >
      {/* Thumbnail — left side */}
      <div className={`relative w-full h-32 sm:h-auto sm:w-[200px] sm:min-w-[200px] border-b sm:border-b-0 sm:border-r overflow-hidden shrink-0 ${isDarkMode ? 'bg-slate-700 border-slate-700' : 'bg-[#faf8f3] border-slate-100'}`}>
        {w.thumbnailUrl ? (
          <img src={w.thumbnailUrl} alt={w.title} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center min-h-[100px]">
            <div className={`w-11 h-11 rounded-full border flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform ${isDarkMode ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
              <Play className={`w-4.5 h-4.5 ml-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
            </div>
          </div>
        )}
        {w.estimatedMinutes > 0 && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded-md">
            <Clock className="w-3 h-3" />
            {w.estimatedMinutes} {t.minLabel}
          </div>
        )}
      </div>

      {/* Info — center */}
      <div className="flex-1 flex flex-col justify-center px-5 py-3.5 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {w.category && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${isDarkMode ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-slate-100 text-slate-600 border-slate-100'}`}>
              {w.category}
            </span>
          )}
          {diff && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${isDarkMode ? diff.darkColor : diff.color}`}>
              {t[diff.labelKey]}
            </span>
          )}
        </div>
        <h3 className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{w.title}</h3>
        {w.description && (
          <p className={`text-xs mt-0.5 line-clamp-1 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{w.description}</p>
        )}
        {w.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {w.tags.slice(0, 5).map((tag, i) => (
              <span key={i} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${isDarkMode ? 'text-slate-400 bg-slate-700 border-slate-600' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>
                {tag}
              </span>
            ))}
            {w.tags.length > 5 && (
              <span className={`text-[10px] font-medium px-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                +{w.tags.length - 5}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right side — actions */}
      <div className="flex items-center gap-2 px-4 shrink-0">
        {isAdmin && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(w); }}
              className={`w-7 h-7 border rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(w.id); }}
              className={`w-7 h-7 border rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-red-900/40 hover:border-red-800 hover:text-red-400' : 'bg-slate-50 border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-500 text-slate-400'}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white transition-colors shadow-sm ${isDarkMode ? 'bg-white text-slate-900 group-hover:bg-slate-200' : 'bg-slate-900 group-hover:bg-slate-800'}`}>
          <Play className="w-4 h-4 ml-0.5" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADD/EDIT WALKTHROUGH DIALOG — Full-screen overlay
   ═══════════════════════════════════════════════════════════════ */

function AddWalkthroughDialog({ firestore, storage, editingWalkthrough, onClose, isDarkMode, t }: {
  firestore: any;
  storage: any;
  editingWalkthrough: Walkthrough | null;
  onClose: () => void;
  isDarkMode: boolean;
  t: any;
}) {
  const { toast } = useToast();
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

  // File upload state
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoFileName, setVideoFileName] = useState("");
  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbProgress, setThumbProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editingWalkthrough;

  const uploadFile = useCallback(async (file: File, path: string, onProgress: (p: number) => void): Promise<string> => {
    if (!storage) throw new Error("Storage not available");
    const storageRefObj = ref(storage, path);
    const uploadTask = uploadBytesResumable(storageRefObj, file);
    return new Promise((resolve, reject) => {
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(pct);
        },
        (error) => reject(error),
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(url);
        }
      );
    });
  }, [storage]);

  const handleVideoFileSelect = async (file: File) => {
    setVideoUploading(true);
    setVideoProgress(0);
    setVideoFileName(file.name);
    try {
      const path = `walkthroughs/videos/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path, setVideoProgress);
      setVideoUrl(url);
    } catch (err) {
      console.error("Video upload failed:", err);
    } finally {
      setVideoUploading(false);
    }
  };

  const handleThumbFileSelect = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    setThumbUploading(true);
    setThumbProgress(0);
    try {
      const path = `walkthroughs/thumbnails/${Date.now()}_${file.name}`;
      const url = await uploadFile(file, path, setThumbProgress);
      setThumbnailUrl(url);
    } catch (err) {
      console.error("Thumbnail upload failed:", err);
    } finally {
      setThumbUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) handleVideoFileSelect(files[0]);
  }, []);

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
        toast({
          title: t.successLabel,
          description: t.walkthroughUpdatedSuccess,
        });
      } else {
        await addDoc(collection(firestore, "insight_walkthroughs"), {
          ...data,
          createdAt: serverTimestamp(),
        });
        toast({
          title: t.successLabel,
          description: t.walkthroughPublishedSuccess,
        });
      }
      onClose();
    } catch (err) {
      console.error("Failed to save walkthrough:", err);
      toast({
        title: t.errorLabel,
        description: t.walkthroughSaveFailed,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const sections = [
    { id: "details" as const, label: t.detailsTab, icon: <FileText className="w-4 h-4" /> },
    { id: "media" as const, label: t.mediaTab, icon: <Link2 className="w-4 h-4" /> },
    { id: "metadata" as const, label: t.metadataTab, icon: <Tag className="w-4 h-4" /> },
  ];

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Dialog */}
      <div className={`fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-[780px] md:max-h-[85vh] z-[101] rounded-2xl shadow-2xl border flex flex-col overflow-hidden ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
          <div>
            <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isEditing ? t.editWalkthrough : t.addNewWalkthrough}</h2>
            <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{t.fillOutDetails} {isEditing ? t.updateThis : t.addANew} {t.walkthroughToLibrary}</p>
          </div>
          <button onClick={onClose} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
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
                  ? (isDarkMode ? "bg-white text-slate-900" : "bg-slate-900 text-white")
                  : (isDarkMode ? "text-slate-400 hover:text-slate-200 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50")
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
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.titleLabel} <span className="text-red-400">*</span></Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={t.titlePlaceholder}
                  className={`h-11 text-sm focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.descriptionLabel}</Label>
                <Textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  className={`min-h-[140px] resize-none text-sm leading-relaxed focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                />
                <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{description.length} {t.charactersLabel}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.categoryLabel}</Label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className={`w-full appearance-none pl-3 pr-9 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 cursor-pointer ${isDarkMode ? 'bg-slate-700 border-slate-600 text-slate-200 focus:ring-slate-500 focus:border-slate-500' : 'bg-white border-slate-200 text-slate-700 focus:ring-slate-200 focus:border-slate-300'}`}
                    >
                      <option value="">{t.selectCategory}</option>
                      {CATEGORY_OPTIONS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.difficultyLevel}</Label>
                  <div className="flex gap-2">
                    {DIFFICULTY_OPTIONS.map(d => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => setDifficulty(d.value)}
                        className={`flex-1 py-2.5 text-xs font-medium rounded-lg border transition-all ${
                          difficulty === d.value
                            ? (isDarkMode ? "border-white bg-white text-slate-900" : "border-slate-900 bg-slate-900 text-white")
                            : (isDarkMode ? "border-slate-600 bg-slate-700 text-slate-400 hover:border-slate-500" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")
                        }`}
                      >
                        {t[d.labelKey]}
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
              {/* Hidden file inputs */}
              <input
                ref={videoInputRef}
                type="file"
                className="hidden"
                accept="video/*,.mp4,.mov,.avi,.mkv,.webm,.pdf,.doc,.docx"
                onChange={e => { if (e.target.files?.[0]) handleVideoFileSelect(e.target.files[0]); e.target.value = ""; }}
              />
              <input
                ref={thumbInputRef}
                type="file"
                className="hidden"
                accept="image/*"
                onChange={e => { if (e.target.files?.[0]) handleThumbFileSelect(e.target.files[0]); e.target.value = ""; }}
              />

              {/* Video/File source */}
              <div className="space-y-3">
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.videoFileSource} <span className="text-red-400">*</span></Label>
                
                {/* Drag-and-drop upload zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !videoUploading && videoInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                    isDragging ? (isDarkMode ? "border-white bg-slate-700" : "border-slate-900 bg-slate-50") :
                    videoUrl && !videoUploading ? (isDarkMode ? "border-slate-600 bg-slate-700/50" : "border-slate-200 bg-slate-50/50") :
                    (isDarkMode ? "border-slate-600 hover:border-slate-500 hover:bg-slate-700/50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/50")
                  }`}
                >
                  {videoUploading ? (
                    <div className="space-y-3">
                      <Loader2 className={`w-6 h-6 animate-spin mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.uploading} {videoFileName}...</p>
                      <div className={`w-full max-w-xs mx-auto rounded-full h-1.5 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                        <div className={`h-1.5 rounded-full transition-all duration-300 ${isDarkMode ? 'bg-white' : 'bg-slate-900'}`} style={{ width: `${videoProgress}%` }} />
                      </div>
                      <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{videoProgress}%</p>
                    </div>
                  ) : videoUrl ? (
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                        <CheckCircle2 className={`w-4 h-4 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className={`text-xs font-medium truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{videoFileName || t.fileReady}</p>
                        <p className={`text-[10px] truncate ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{videoUrl}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setVideoUrl(""); setVideoFileName(""); }}
                        className={`shrink-0 transition-colors ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-300 hover:text-slate-500'}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto ${isDarkMode ? 'bg-slate-600' : 'bg-slate-100'}`}>
                        <Upload className={`w-5 h-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                      </div>
                      <div>
                        <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.dropFileHere} <span className={`underline underline-offset-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{t.browse}</span></p>
                        <p className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.fileTypes}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* OR divider */}
                <div className="flex items-center gap-3">
                  <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`} />
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.orPasteUrl}</span>
                  <div className={`flex-1 h-px ${isDarkMode ? 'bg-slate-700' : 'bg-slate-100'}`} />
                </div>

                {/* URL input */}
                <div className="relative">
                  <Link2 className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`} />
                  <Input
                    value={videoUrl}
                    onChange={e => setVideoUrl(e.target.value)}
                    placeholder={t.urlPlaceholder}
                    className={`h-11 pl-9 text-sm focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                  />
                </div>
              </div>

              {/* Thumbnail */}
              <div className="space-y-3">
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.thumbnailImage}</Label>
                <div className="flex gap-3">
                  {/* Thumbnail preview / upload */}
                  <div
                    onClick={() => !thumbUploading && thumbInputRef.current?.click()}
                    className={`w-28 h-20 rounded-xl border border-dashed flex items-center justify-center cursor-pointer transition-all overflow-hidden shrink-0 ${isDarkMode ? 'border-slate-600 hover:border-slate-500 bg-slate-700' : 'border-slate-200 hover:border-slate-300 bg-slate-50'}`}
                  >
                    {thumbUploading ? (
                      <div className="text-center">
                        <Loader2 className={`w-4 h-4 animate-spin mx-auto ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                        <p className={`text-[9px] mt-1 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{thumbProgress}%</p>
                      </div>
                    ) : thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center">
                        <ImageIcon className={`w-4 h-4 mx-auto ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`} />
                        <p className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.uploadLabel}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <Input
                        value={thumbnailUrl}
                        onChange={e => setThumbnailUrl(e.target.value)}
                        placeholder={t.pasteImageUrl}
                        className={`h-10 text-sm focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                      />
                    </div>
                    <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.clickBoxToUpload}</p>
                    {thumbnailUrl && (
                      <button
                        onClick={() => setThumbnailUrl("")}
                        className={`text-[10px] underline underline-offset-2 ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                        {t.removeThumbnail}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label className={`text-xs font-medium flex items-center gap-1.5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  <Eye className="w-3.5 h-3.5" />
                  {t.cardPreview}
                </Label>
                <div className={`border rounded-xl overflow-hidden ${isDarkMode ? 'border-slate-700 bg-slate-700' : 'border-slate-200 bg-slate-50'}`}>
                  <div className="h-36 flex items-center justify-center">
                    {thumbnailUrl ? (
                      <img src={thumbnailUrl} alt="Thumbnail preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <div className={`flex flex-col items-center gap-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>
                        <Play className="w-8 h-8" />
                        <span className="text-xs">{t.noThumbnail}</span>
                      </div>
                    )}
                  </div>
                  {title && (
                    <div className={`px-4 py-3 border-t ${isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-100 bg-white'}`}>
                      <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</p>
                      {description && <p className={`text-xs truncate mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{description}</p>}
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
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.estimatedDuration}</Label>
                <Input
                  type="number"
                  min={0}
                  value={estimatedMinutes || ""}
                  onChange={e => setEstimatedMinutes(Number(e.target.value))}
                  placeholder={t.durationPlaceholder}
                  className={`h-11 text-sm w-40 focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                />
                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.howLongWalkthrough}</p>
              </div>

              <div className="space-y-1.5">
                <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.tagsLabel}</Label>
                <Textarea
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                  placeholder={t.tagsPlaceholder}
                  className={`min-h-[80px] resize-none text-sm focus-visible:ring-slate-400 ${isDarkMode ? 'bg-slate-700 border-slate-600 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-300'}`}
                />
                <p className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-300'}`}>{t.tagsHelp}</p>
              </div>

              {/* Tag preview */}
              {tagsInput && (
                <div className="space-y-2">
                  <Label className={`text-xs font-medium ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>{t.tagPreview}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {tagsInput.split(",").map(t => t.trim()).filter(Boolean).map((tag, i) => (
                      <span key={i} className={`text-[10px] font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'text-slate-300 bg-slate-700' : 'text-slate-600 bg-slate-100'}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Summary */}
              <div className={`border rounded-xl p-4 space-y-2 ${isDarkMode ? 'border-slate-700 bg-slate-700/50' : 'border-slate-100 bg-slate-50/50'}`}>
                <p className={`text-xs font-medium mb-3 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.summaryLabel}</p>
                <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-xs">
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.titleLabel}</span>
                    <span className={`font-medium truncate max-w-[160px] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{title || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.categoryLabel}</span>
                    <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{category || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.difficultyLevel}</span>
                    <span className={`font-medium capitalize ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{difficulty}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.durationLabel}</span>
                    <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{estimatedMinutes ? `${estimatedMinutes} ${t.minLabel}` : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.videoUrlLabel}</span>
                    <span className={`font-medium truncate max-w-[160px] ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{videoUrl ? t.setLabel : "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{t.tagsLabel}</span>
                    <span className={`font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{tagsInput.split(",").filter(t => t.trim()).length || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={`flex items-center justify-between px-6 py-4 border-t shrink-0 ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-100 bg-slate-50/50'}`}>
          <div className="flex items-center gap-1.5">
            {sections.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full transition-colors ${
                  activeSection === s.id ? (isDarkMode ? "bg-white" : "bg-slate-900") : (isDarkMode ? "bg-slate-600" : "bg-slate-200")
                }`} />
                {i < sections.length - 1 && <div className={`w-4 h-px ${isDarkMode ? 'bg-slate-600' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {activeSection !== "details" && (
              <button
                onClick={() => setActiveSection(activeSection === "metadata" ? "media" : "details")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
              >
              {t.backLabel}
              </button>
            )}
            {activeSection !== "metadata" ? (
              <button
                onClick={() => setActiveSection(activeSection === "details" ? "media" : "metadata")}
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors ${isDarkMode ? 'bg-white hover:bg-slate-200 text-slate-900' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {t.continueLabel}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting || !title.trim() || !videoUrl.trim()}
                className={`flex items-center gap-2 px-5 py-2 disabled:opacity-40 text-sm font-medium rounded-lg transition-colors ${isDarkMode ? 'bg-white hover:bg-slate-200 text-slate-900' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditing ? t.saveChangesLabel : t.publishWalkthrough}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
