'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStorage } from '@/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { X, Trash2, Plus, Upload, Image as ImageIcon, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideData {
  headline: string;
  subtitle: string;
  gradient: string;
  badge: string;
  date: string;
  backgroundImage?: string;
  linkUrl?: string;
}

export interface SlideshowSettings {
  shuffleInterval: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRADIENT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Indigo-Violet', value: 'from-indigo-600 via-violet-600 to-purple-700' },
  { label: 'Emerald-Teal', value: 'from-emerald-600 via-teal-600 to-cyan-700' },
  { label: 'Amber-Red', value: 'from-amber-500 via-orange-500 to-red-500' },
  { label: 'Rose-Fuchsia', value: 'from-rose-500 via-pink-500 to-fuchsia-600' },
  { label: 'Sky-Indigo', value: 'from-sky-500 via-blue-600 to-indigo-700' },
  { label: 'Slate-Gray', value: 'from-slate-600 via-gray-600 to-zinc-700' },
];

const DEFAULT_SLIDE: SlideData = {
  headline: 'New Slide',
  subtitle: '',
  gradient: GRADIENT_OPTIONS[0].value,
  badge: 'News',
  date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
};

const MAX_SLIDES = 25;
const MIN_SLIDES = 1;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NewsSlideshowSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  slides: SlideData[];
  onSave: (slides: SlideData[], settings: SlideshowSettings) => void;
  shuffleInterval: number; // ms
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NewsSlideshowSettings({
  isOpen,
  onClose,
  slides,
  onSave,
  shuffleInterval,
}: NewsSlideshowSettingsProps) {
  const storage = useStorage();

  // ---- local state ----
  const [localSlides, setLocalSlides] = useState<SlideData[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [localInterval, setLocalInterval] = useState(shuffleInterval);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const prevOpenRef = useRef(false);

  // Reset local state only when the dialog first opens (closed → open transition)
  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      const cloned = slides.length > 0 ? slides.map((s) => ({ ...s })) : [{ ...DEFAULT_SLIDE }];
      setLocalSlides(cloned);
      setSelectedIndex(0);
      setLocalInterval(shuffleInterval);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen, slides, shuffleInterval]);

  // ---- helpers ----
  const updateSlideField = useCallback(
    <K extends keyof SlideData>(key: K, value: SlideData[K]) => {
      setLocalSlides((prev) => {
        const next = [...prev];
        next[selectedIndex] = { ...next[selectedIndex], [key]: value };
        return next;
      });
    },
    [selectedIndex],
  );

  const handleAddSlide = () => {
    if (localSlides.length >= MAX_SLIDES) return;
    const newSlide = { ...DEFAULT_SLIDE };
    setLocalSlides((prev) => [...prev, newSlide]);
    setSelectedIndex(localSlides.length);
  };

  const handleDeleteSlide = (idx: number) => {
    if (localSlides.length <= MIN_SLIDES) return;
    setLocalSlides((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIndex((prev) => (prev >= idx ? Math.max(0, prev - 1) : prev));
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(localSlides, { shuffleInterval: localInterval });
      onClose();
    } catch (err) {
      console.error('Failed to save slideshow:', err);
      alert('Failed to save. Check browser console for details.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ---- file upload ----
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const storagePath = `cms/news-slides/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      updateSlideField('backgroundImage', downloadURL);
    } catch (err) {
      console.error('Image upload failed:', err);
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ---- render guards ----
  if (!isOpen) return null;

  const current = localSlides[selectedIndex] ?? localSlides[0];
  if (!current) return null;

  // ---- interval helpers ----
  const intervalSec = Math.round(localInterval / 1000);
  const clampedSec = Math.max(5, Math.min(60, intervalSec));

  // ---- input classes ----
  const inputClass =
    'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors';
  const labelClass = 'text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl flex flex-col"
        style={{
          width: 800,
          height: 620,
          minWidth: 600,
          minHeight: 450,
          resize: 'both',
          overflow: 'auto',
        }}
      >
        {/* -------- Header -------- */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-800">News Slideshow Editor</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* -------- Body -------- */}
        <div className="flex flex-1 min-h-0">
          {/* ---- Left panel: slide list ---- */}
          <div className="w-[38%] border-r border-slate-200 flex flex-col">
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {localSlides.map((slide, idx) => {
                const isActive = idx === selectedIndex;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedIndex(idx)}
                    className={`group relative rounded-lg cursor-pointer transition-colors ${
                      isActive
                        ? 'border-l-3 border-indigo-500 bg-indigo-50'
                        : 'border-l-3 border-transparent hover:bg-slate-50'
                    }`}
                  >
                    {/* gradient preview */}
                    <div
                      className={`mx-2 my-1.5 rounded-md bg-gradient-to-r ${slide.gradient} h-[60px] flex items-end px-2 pb-1.5 relative overflow-hidden`}
                    >
                      {slide.backgroundImage && (
                        <img
                          src={slide.backgroundImage}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover opacity-40"
                        />
                      )}
                      <span className="text-[10px] font-semibold text-white/90 relative z-10 truncate">
                        {slide.badge || 'Slide'}
                      </span>

                      {/* delete button on hover */}
                      {localSlides.length > MIN_SLIDES && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSlide(idx);
                          }}
                          className="absolute top-1 right-1 p-1 rounded bg-black/30 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* add button */}
            {localSlides.length < MAX_SLIDES && (
              <button
                onClick={handleAddSlide}
                className="mx-3 mb-3 flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 py-2 text-xs font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <Plus size={14} />
                Add Slide
              </button>
            )}
          </div>

          {/* ---- Right panel: edit form ---- */}
          <div className="w-[62%] overflow-y-auto p-4 space-y-4">
            {/* Mini preview */}
            <div
              className={`w-full h-[120px] rounded-xl bg-gradient-to-r ${current.gradient} relative overflow-hidden flex flex-col justify-end p-4`}
            >
              {current.backgroundImage && (
                <img
                  src={current.backgroundImage}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover opacity-30"
                />
              )}
              <div className="relative z-10">
                {current.badge && (
                  <span className="inline-block bg-white/20 backdrop-blur-sm text-white text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full mb-1">
                    {current.badge}
                  </span>
                )}
                <p className="text-white font-bold text-sm leading-tight truncate">{current.headline}</p>
                {current.subtitle && (
                  <p className="text-white/70 text-[10px] mt-0.5 truncate">{current.subtitle}</p>
                )}
              </div>
            </div>

            {/* Badge */}
            <div>
              <label className={labelClass}>Badge</label>
              <input
                type="text"
                value={current.badge}
                onChange={(e) => updateSlideField('badge', e.target.value)}
                className={inputClass}
                placeholder="e.g. Breaking News"
              />
            </div>

            {/* Headline */}
            <div>
              <label className={labelClass}>Headline</label>
              <input
                type="text"
                value={current.headline}
                onChange={(e) => updateSlideField('headline', e.target.value)}
                className={inputClass}
                placeholder="Headline text"
              />
            </div>

            {/* Subtitle */}
            <div>
              <label className={labelClass}>Subtitle</label>
              <textarea
                rows={3}
                value={current.subtitle}
                onChange={(e) => updateSlideField('subtitle', e.target.value)}
                className={inputClass}
                placeholder="Short description…"
              />
            </div>

            {/* Date */}
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="text"
                value={current.date}
                onChange={(e) => updateSlideField('date', e.target.value)}
                className={inputClass}
                placeholder="Jun 5, 2026"
              />
            </div>

            {/* Background Image */}
            <div>
              <label className={labelClass}>Background Image</label>

              {current.backgroundImage ? (
                <div className="flex items-center gap-3">
                  <img
                    src={current.backgroundImage}
                    alt="Slide bg"
                    className="w-20 h-12 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={() => updateSlideField('backgroundImage', undefined)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="slide-bg-upload"
                  />
                  <label
                    htmlFor="slide-bg-upload"
                    className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Upload Image
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Allow re-upload even when an image exists */}
              {current.backgroundImage && (
                <div className="mt-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="slide-bg-reupload"
                  />
                  <label
                    htmlFor="slide-bg-reupload"
                    className="inline-flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Uploading…
                      </>
                    ) : (
                      <>
                        <ImageIcon size={14} />
                        Replace Image
                      </>
                    )}
                  </label>
                </div>
              )}
            </div>

            {/* Link URL */}
            <div>
              <label className={labelClass}>Link URL</label>
              <input
                type="text"
                value={current.linkUrl ?? ''}
                onChange={(e) => updateSlideField('linkUrl', e.target.value)}
                className={inputClass}
                placeholder="https://example.com/article"
              />
            </div>

            {/* Gradient */}
            <div>
              <label className={labelClass}>Gradient</label>
              <select
                value={current.gradient}
                onChange={(e) => updateSlideField('gradient', e.target.value)}
                className={inputClass}
              >
                {GRADIENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* -------- Bottom bar -------- */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-200 shrink-0">
          {/* Shuffle interval */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500">Shuffle Interval</span>
            <input
              type="range"
              min={5}
              max={60}
              value={clampedSec}
              onChange={(e) => setLocalInterval(Number(e.target.value) * 1000)}
              className="w-28 accent-indigo-600"
            />
            <span className="text-xs font-semibold text-slate-700 tabular-nums w-8">{clampedSec}s</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 text-white rounded-xl px-5 py-2 font-semibold hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
