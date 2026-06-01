"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

/* ─── Mock slide data ─── */
const SLIDES = [
  {
    headline: "NXT Chapter × Advanced Pathways",
    subtitle: "New Denver Shelter Partnership — Expanding capacity to 3 additional locations across the metro area.",
    gradient: "from-indigo-600 via-violet-600 to-purple-700",
    badge: "PARTNERSHIP",
    date: "June 2025",
  },
  {
    headline: "AI Grant Discovery Launched",
    subtitle: "SOL Theory's autonomous grant agents now scan Grants.gov 24/7 — surfacing federal funding opportunities in real time.",
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
    headline: "Community Resource Fair — July 2025",
    subtitle: "Save the date: Denver Community Resource Fair bringing together 40+ service providers, employers, and housing partners.",
    gradient: "from-rose-500 via-pink-500 to-fuchsia-600",
    badge: "EVENT",
    date: "Upcoming",
  },
  {
    headline: "Dashboard v2.0 — Real-Time Analytics",
    subtitle: "New grant status tracking, Action Board with email triggers, and AI-powered insights rolling out across all client dashboards.",
    gradient: "from-sky-500 via-blue-600 to-indigo-700",
    badge: "TECH UPDATE",
    date: "June 2025",
  },
];

export function NewsSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [hoverZoneVisible, setHoverZoneVisible] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSlides = SLIDES.length;

  /* ─── Auto-advance (pauses on hover) ─── */
  const startAutoAdvance = useCallback(() => {
    if (autoAdvanceRef.current) clearInterval(autoAdvanceRef.current);
    autoAdvanceRef.current = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % totalSlides);
    }, 15000);
  }, [totalSlides]);

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

  /* ─── Navigation ─── */
  const goTo = useCallback(
    (direction: "prev" | "next") => {
      setCurrentSlide((prev) =>
        direction === "next"
          ? (prev + 1) % totalSlides
          : (prev - 1 + totalSlides) % totalSlides
      );
      // Reset auto-advance timer on manual navigation
      if (!isHovered) startAutoAdvance();
    },
    [totalSlides, isHovered, startAutoAdvance]
  );

  /* ─── Hover zone delayed fade-out ─── */
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
    // Delay hiding hover zones by 1 second
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
      {/* ═══ Slide Strip ═══ */}
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {SLIDES.map((slide, i) => (
          <div
            key={i}
            className={`w-full h-full flex-shrink-0 bg-gradient-to-br ${slide.gradient} flex flex-col justify-end p-6 sm:p-8 relative`}
          >
            {/* Decorative grid overlay */}
            <div className="absolute inset-0 opacity-[0.04]" style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
              backgroundSize: '24px 24px',
            }} />

            {/* Badge */}
            <div className="absolute top-4 left-4 sm:top-5 sm:left-6">
              <span className="px-2.5 py-1 rounded-md bg-white/15 backdrop-blur-sm text-[10px] font-extrabold text-white/90 tracking-widest uppercase border border-white/10">
                {slide.badge}
              </span>
            </div>

            {/* Date */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-6">
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
        ))}
      </div>

      {/* ═══ Hover Zones (full height, edge → arrow) ═══ */}
      {/* Left hover zone */}
      <div
        onClick={() => goTo("prev")}
        className={`absolute top-0 left-0 h-full cursor-pointer z-10 transition-opacity duration-300 ${
          hoverZoneVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ width: "100px", background: "linear-gradient(to right, rgba(0,0,0,0.10), rgba(0,0,0,0.02))" }}
      />
      {/* Right hover zone */}
      <div
        onClick={() => goTo("next")}
        className={`absolute top-0 right-0 h-full cursor-pointer z-10 transition-opacity duration-300 ${
          hoverZoneVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        style={{ width: "100px", background: "linear-gradient(to left, rgba(0,0,0,0.10), rgba(0,0,0,0.02))" }}
      />

      {/* ═══ Arrow Buttons (always visible) ═══ */}
      {/* Left arrow */}
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
      {/* Right arrow */}
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

      {/* ═══ Pane Indicator Dots ═══ */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrentSlide(i);
              if (!isHovered) startAutoAdvance();
            }}
            className={`rounded-full transition-all duration-300 cursor-pointer ${
              i === currentSlide
                ? "w-6 h-2 bg-white shadow-lg"
                : "w-2 h-2 bg-white/40 hover:bg-white/60"
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* ═══ "NEWS" persistent label ═══ */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <span className="text-[9px] font-extrabold tracking-[0.25em] uppercase text-white/30">
          Sol Theory News
        </span>
      </div>
    </div>
  );
}
