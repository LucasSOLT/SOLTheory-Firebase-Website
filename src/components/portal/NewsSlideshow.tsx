"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useFirestore } from "@/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/* --- Default slide data (fallback) --- */
const DEFAULT_SLIDES = [
  {
    headline: "NXT Chapter x Advanced Pathways",
    subtitle: "New Denver Shelter Partnership -- Expanding capacity to 3 additional locations across the metro area.",
    gradient: "from-indigo-600 via-violet-600 to-purple-700",
    badge: "PARTNERSHIP",
    date: "June 2025",
  },
  {
    headline: "AI Grant Discovery Launched",
    subtitle: "SOL Theory's autonomous grant agents now scan Grants.gov 24/7 -- surfacing federal funding opportunities in real time.",
    gradient: "from-emerald-600 via-teal-600 to-cyan-700",
    badge: "PRODUCT",
    date: "May 2025",
  },
  {
    headline: "Q2 Impact Report: 1,200+ Served",
    subtitle: "Across all partner shelters, NXT Chapter programs reached over 1,200 individuals with housing, workforce, and behavioral health services.",
    gradient: "from-amber-500 via-orange-500 to-red-500",
    badge: "IMPACT",
    date: "April 2025",
  },
  {
    headline: "Community Resource Fair -- July 2025",
    subtitle: "Save the date: Denver Community Resource Fair bringing together 40+ service providers, employers, and housing partners.",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
    badge: "EVENT",
    date: "Upcoming",
  },
  {
    headline: "Dashboard v2.0 -- Real-Time Analytics",
    subtitle: "New grant status tracking, Action Board with email triggers, and AI-powered insights rolling out across all client dashboards.",
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    badge: "TECH UPDATE",
    date: "June 2025",
  },
];

export interface NewsSlideData {
  headline: string;
  subtitle: string;
  gradient: string;
  badge: string;
  date: string;
  backgroundImage?: string | null;
  linkUrl?: string | null;
}

export function NewsSlideshow() {
  const firestore = useFirestore();
  const [slides, setSlides] = useState<NewsSlideData[]>(DEFAULT_SLIDES);
  const [shuffleInterval, setShuffleInterval] = useState(15000);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverZoneVisible, setHoverZoneVisible] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* â”€â”€â”€ Listen to Firestore for persisted slide data â”€â”€â”€ */
  useEffect(() => {
    if (!firestore) return;
    const docRef = doc(firestore, "cms_config", "news_slideshow");
    const unsub = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.slides && Array.isArray(data.slides) && data.slides.length > 0) {
          setSlides(data.slides);
        }
        if (data.shuffleInterval && typeof data.shuffleInterval === 'number') {
          setShuffleInterval(data.shuffleInterval);
        }
      }
    }, () => {
      // Silently handle missing doc/permissions â€” use defaults
    });
    return () => unsub();
  }, [firestore]);

  const totalSlides = slides.length;

  /* â”€â”€â”€ Auto-advance (pauses on hover) â”€â”€â”€ */
  const startAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    autoAdvanceRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, shuffleInterval);
  }, [totalSlides, shuffleInterval]);

  useEffect(() => {
    if (!isHovered) {
      startAutoAdvance();
    } else {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    }
    return () => {
      if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    };
  }, [isHovered, startAutoAdvance]);

  // Reset currentSlide if it exceeds the new slide count
  useEffect(() => {
    if (currentSlide >= totalSlides) {
      setCurrentSlide(0);
    }
  }, [totalSlides, currentSlide]);

  /* â”€â”€â”€ Navigation â”€â”€â”€ */
  const goTo = useCallback(
    (direction: "prev" | "next") => {
      setCurrentSlide((prev) =>
        direction === "next"
          ? (prev + 1) % totalSlides
          : (prev - 1 + totalSlides) % totalSlides
      );
      if (!isHovered) startAutoAdvance();
    },
    [totalSlides, isHovered, startAutoAdvance]
  );

  /* â”€â”€â”€ Hover zone delayed fade-out â”€â”€â”€ */
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
    setHoverZoneVisible(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    hoverTimeoutRef.current = setTimeout(() => {
      setHoverZoneVisible(false);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className="relative w-full h-full rounded-2xl overflow-hidden bg-slate-900 select-none"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* â•â•â• Slide Strip â•â•â• */}
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, i) => {
          const hasBgImage = !!(slide.backgroundImage && slide.backgroundImage.trim());
          return (
          <div
            key={i}
            className={`w-full h-full flex-shrink-0 bg-gradient-to-br ${slide.gradient} flex flex-col justify-end p-6 sm:p-8 relative`}
            onClick={() => {
              if (slide.linkUrl) {
                window.open(slide.linkUrl, '_blank', 'noopener,noreferrer');
              }
            }}
          >
            {/* Background image — actual img tag for reliable rendering */}
            {hasBgImage && (
              <img
                src={slide.backgroundImage!}
                alt=""
                className="absolute inset-0 w-full h-full object-cover z-0"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  // Hide broken images gracefully — gradient shows through
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}

            {/* Dark overlay for readability */}
            {hasBgImage && (
              <div className="absolute inset-0 bg-black/40 z-[1]" />
            )}

            {/* Decorative grid overlay */}
            <div className="absolute inset-0 opacity-[0.04] z-[2]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />

            {/* Badge */}
            <div className="absolute top-4 left-4 sm:top-5 sm:left-6 z-[3]">
              <span className="px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-sm text-[10px] font-extrabold text-white/90 tracking-widest uppercase border border-white/10">
                {slide.badge}
              </span>
            </div>

            {/* Date */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-6 z-[3]">
              <span className="text-[11px] font-bold text-white/50 tracking-wide">
                {slide.date}
              </span>
            </div>

            {/* Content */}
            <div className="relative z-10 max-w-xl">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white leading-tight mb-2 drop-shadow-lg">
                {slide.headline}
              </h2>
              <p className="text-sm sm:text-base text-white/70 font-medium leading-relaxed line-clamp-3">
                {slide.subtitle}
              </p>
            </div>
          </div>
          );
        })}
      </div>

      {/* â•â•â• Hover Zones â•â•â• */}
      <div
        onClick={() => goTo("prev")}
        style={{ background: "linear-gradient(to right, rgba(0,0,0,0.10), rgba(0,0,0,0.02))" }}
        className={`absolute top-0 left-0 h-full cursor-pointer z-10 transition-opacity duration-300 w-12 md:w-[100px] ${
          hoverZoneVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      <div
        onClick={() => goTo("next")}
        style={{ background: "linear-gradient(to left, rgba(0,0,0,0.10), rgba(0,0,0,0.02))" }}
        className={`absolute top-0 right-0 h-full cursor-pointer z-10 transition-opacity duration-300 w-12 md:w-[100px] ${
          hoverZoneVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* â•â•â• Arrow Buttons â•â•â• */}
      <button
        onClick={() => goTo("prev")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-10 h-14 flex items-center justify-center rounded-r-lg cursor-pointer transition-all hover:w-11 hover:h-16"
        style={{ background: "rgba(0,0,0,0.45)" }}
        aria-label="Previous slide"
      >
        <svg className="w-4 h-4 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      <button
        onClick={() => goTo("next")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-10 h-14 flex items-center justify-center rounded-l-lg cursor-pointer transition-all hover:w-11 hover:h-16"
        style={{ background: "rgba(0,0,0,0.45)" }}
        aria-label="Next slide"
      >
        <svg className="w-4 h-4 text-white drop-shadow" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>

      {/* â•â•â• Pane Indicator Dots â•â•â• */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrentSlide(i);
              if (!isHovered) startAutoAdvance();
            }}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              i === currentSlide
                ? "w-6 h-2 bg-[#faf8f3] shadow-lg"
                : "w-2 h-2 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* â•â•â• "NEWS" persistent label â•â•â• */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <span className="text-[9px] font-extrabold tracking-[0.25em] uppercase text-white/30">
          Sol Theory News
        </span>
      </div>
    </div>
  );
}
