'use client';


import { Header } from '@/components/sections/header';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import Link from 'next/link';
import { ArrowDown, Sparkles } from 'lucide-react';

import { BlobHero } from '@/components/ui/blob-hero';
import { motion } from 'framer-motion';
import { StarBackground } from '@/components/ui/star-background';
const whatQualifies = [
  {
    title: "Scientific step-by-step method",
    description: "Our methods are rooted in research and designed for tangible progress. We break down complex concepts into actionable steps.",
  },
  {
    title: "Nobody plays alone here",
    description: "Community is at our core. Connect with like-minded individuals, share your journey, and grow together in a supportive environment.",
  },
  {
    title: "Simple, Practical and Fun (SPF)",
    description: "We believe growth should be engaging, not a chore. Our tools are designed to be intuitive, easy to integrate into your life, and enjoyable to use.",
  }
];



export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative">
        
        {/* SECTION 1: Dynamic Abstract 3D Hero */}
        <section className="relative min-h-[100dvh] w-full flex items-center justify-center overflow-hidden z-10">
          <StarBackground />
          <BlobHero />
          <div className="relative z-10 container mx-auto px-4 pointer-events-none mt-4 md:mt-10">
            <div className="flex flex-col items-center justify-center text-center gap-6">

              <h1 className="font-jakarta text-6xl md:text-[8rem] font-bold tracking-tight text-white drop-shadow-2xl leading-none">
                SOL Theory
              </h1>

              <p className="mt-2 text-2xl md:text-5xl font-light text-slate-300 drop-shadow-lg max-w-4xl">
                The Evolution of <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Improvement</span>
              </p>



              <div className="mt-2 flex flex-col items-center gap-1.5 font-light leading-relaxed text-center">
                <span className="text-base md:text-lg text-slate-300">A social innovation firm building AI-powered tools for growth.</span>
                <span className="text-sm md:text-base text-slate-400">Agentic automation, analytics dashboards, and community resources.</span>
                <span className="text-xs md:text-sm text-slate-400/80">Rooted in science. Driven by data. Designed to be fun.</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-auto cursor-pointer flex flex-col items-center gap-3 text-fuchsia-500 hover:text-fuchsia-400 transition-colors" onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}>
            <span className="font-headline tracking-[0.3em] text-[10px] md:text-sm font-bold uppercase">Scroll to Descend</span>
            <ArrowDown className="w-5 h-5 animate-bounce" />
          </div>
        </section>

        {/* Star Background Wrapper */}
        <div className="relative w-full overflow-hidden">
          <StarBackground />
          <div className="relative z-10 w-full flex flex-col items-center bg-transparent">

            {/* ════════════════════════════════════════════════════════════
                SECTION 1.5A: Hero Statement (Lemonade top section)
            ════════════════════════════════════════════════════════════ */}
            <section className="relative py-24 md:py-32 w-full flex flex-col items-center justify-center z-20">
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0a0a0b]/80 to-[#18181b]" />
              
              <div className="relative z-10 w-full px-6 text-center">
                {/* SOL Theory Brand Name — fancy serif script */}
                <p className="font-headline text-2xl md:text-3xl text-slate-400 tracking-wide mb-10 italic font-bold">
                  SOL Theory
                </p>

                {/* Main Headline */}
                <h2 className="font-jakarta text-4xl md:text-[3.4rem] font-bold text-white tracking-tight leading-[1.15] max-w-3xl mx-auto">
                  Finally. Power tools for{' '}
                  <span className="relative inline-block group cursor-help">
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400 border-b-2 border-dashed border-fuchsia-400/40">SOL</span>
                    {/* SOL Hover Tooltip */}
                    <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-50">
                      <span className="block bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200 px-5 py-4 text-center min-w-[200px]">
                        <span className="block text-sm font-bold text-slate-800 mb-1">Self, Others, and Life</span>
                        <Link href="/sol-explained" className="inline-block mt-2 px-4 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-fuchsia-500 to-indigo-500 rounded-full hover:shadow-lg hover:shadow-fuchsia-500/25 transition-all">
                          Learn More
                        </Link>
                      </span>
                      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-3 h-3 bg-white/95 border-r border-b border-slate-200 rotate-45" />
                    </span>
                  </span>
                  {' '}improvement.
                </h2>

                {/* Subtitle */}
                <p className="mt-5 text-slate-400 text-base md:text-lg font-light max-w-xl mx-auto">
                  Cutting-edge functionality. Competitive pricing. One SOL.
                </p>

                {/* CTA Button */}
                <div className="mt-10">
                  <Link
                    href="#products"
                    className="inline-block px-8 py-3.5 text-sm font-bold uppercase tracking-wider text-white bg-[#ec4899] hover:bg-[#db2777] rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-pink-500/30 hover:-translate-y-0.5"
                  >
                    Check Our Prices
                  </Link>
                </div>
              </div>
            </section>

            {/* ════════════════════════════════════════════════════════════
                SECTION 1.5B: Product Cards (Lemonade bottom section)
            ════════════════════════════════════════════════════════════ */}
            <section id="products" className="relative py-16 md:py-24 w-full flex flex-col items-center justify-center z-20">
              {/* Warm light grey background */}
              <div className="absolute inset-0 bg-[#e8e6e4]" />

              <div className="relative z-10 w-full px-6 md:px-12 lg:px-20">
                {/* Section Heading */}
                <div className="text-center max-w-2xl mx-auto mb-4">
                  <h3 className="font-jakarta text-2xl md:text-[2rem] font-bold text-slate-800 tracking-tight leading-tight">
                    Incredible Prices. Monthly Subscription.<br />Bundle Discounts.
                  </h3>
                </div>

                {/* Heart + Savings badge */}
                <div className="flex items-center justify-center gap-2 mb-12">
                  <span className="text-[#ec4899]">♥</span>
                  <span className="text-xs text-[#ec4899] font-semibold tracking-wide">Amazing savings when you bundle</span>
                </div>

                {/* 5 Product Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 md:gap-6 max-w-[1100px] mx-auto">
                  {[
                    {
                      title: "Email Tools",
                      description: "AI agents that draft, send, and manage your emails automatically.",
                      price: "$3.99/mo",
                      checkoutId: 1,
                      icon: (
                        <svg viewBox="0 0 80 80" fill="none" className="w-[72px] h-[72px] mx-auto mb-4">
                          <rect x="12" y="20" width="56" height="40" rx="5" stroke="#94a3b8" strokeWidth="1.8" fill="none" />
                          <path d="M12 26 L40 46 L68 26" stroke="#94a3b8" strokeWidth="1.8" fill="none" strokeLinejoin="round" />
                          <path d="M12 60 L30 42" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
                          <path d="M68 60 L50 42" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
                          <circle cx="56" cy="30" r="7" fill="#ec4899" opacity="0.12" />
                          <path d="M53.5 30 L55.5 32 L59 28" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ),
                    },
                    {
                      title: "SMS Tools",
                      description: "Smart text messaging with automated replies and scheduling.",
                      price: "$10.99/mo",
                      checkoutId: 5,
                      icon: (
                        <svg viewBox="0 0 80 80" fill="none" className="w-[72px] h-[72px] mx-auto mb-4">
                          <rect x="24" y="10" width="32" height="60" rx="7" stroke="#94a3b8" strokeWidth="1.8" fill="none" />
                          <line x1="24" y1="19" x2="56" y2="19" stroke="#94a3b8" strokeWidth="1.2" />
                          <line x1="24" y1="58" x2="56" y2="58" stroke="#94a3b8" strokeWidth="1.2" />
                          <circle cx="40" cy="64" r="2.5" stroke="#94a3b8" strokeWidth="1.2" fill="none" />
                          <rect x="29" y="26" width="18" height="9" rx="4.5" fill="#ec4899" opacity="0.1" stroke="#ec4899" strokeWidth="0.8" />
                          <rect x="33" y="39" width="18" height="9" rx="4.5" fill="#94a3b8" opacity="0.08" stroke="#94a3b8" strokeWidth="0.8" />
                          <circle cx="35" cy="30.5" r="1" fill="#ec4899" opacity="0.5" />
                          <circle cx="39" cy="30.5" r="1" fill="#ec4899" opacity="0.5" />
                          <circle cx="43" cy="30.5" r="1" fill="#ec4899" opacity="0.5" />
                        </svg>
                      ),
                    },
                    {
                      title: "Google Suite",
                      description: "Calendar, Drive, and Docs integration for total workflow control.",
                      price: "$7.99/mo",
                      checkoutId: 2,
                      icon: (
                        <svg viewBox="0 0 80 80" fill="none" className="w-[72px] h-[72px] mx-auto mb-4">
                          <rect x="14" y="16" width="28" height="28" rx="4" stroke="#94a3b8" strokeWidth="1.8" fill="none" />
                          <line x1="14" y1="24" x2="42" y2="24" stroke="#94a3b8" strokeWidth="1.5" />
                          <line x1="22" y1="16" x2="22" y2="12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="34" y1="16" x2="34" y2="12" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          <rect x="19" y="29" width="4" height="4" rx="1" fill="#ec4899" opacity="0.2" />
                          <rect x="26" y="29" width="4" height="4" rx="1" fill="#94a3b8" opacity="0.15" />
                          <rect x="33" y="29" width="4" height="4" rx="1" fill="#94a3b8" opacity="0.15" />
                          <rect x="19" y="36" width="4" height="4" rx="1" fill="#94a3b8" opacity="0.15" />
                          <rect x="44" y="36" width="22" height="28" rx="3" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
                          <line x1="49" y1="44" x2="61" y2="44" stroke="#94a3b8" strokeWidth="1" />
                          <line x1="49" y1="49" x2="58" y2="49" stroke="#94a3b8" strokeWidth="1" />
                          <line x1="49" y1="54" x2="60" y2="54" stroke="#94a3b8" strokeWidth="1" />
                          <path d="M48 20 A12 12 0 0 1 60 32" stroke="#ec4899" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                          <path d="M58 28 L60 32 L56 33" stroke="#ec4899" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ),
                    },
                    {
                      title: "Agentic Dashboard",
                      description: "Full analytics suite with every agent and priority support.",
                      price: "$20.99/mo",
                      checkoutId: 3,
                      icon: (
                        <svg viewBox="0 0 80 80" fill="none" className="w-[72px] h-[72px] mx-auto mb-4">
                          <rect x="10" y="14" width="60" height="42" rx="5" stroke="#94a3b8" strokeWidth="1.8" fill="none" />
                          <line x1="10" y1="22" x2="70" y2="22" stroke="#94a3b8" strokeWidth="1.2" />
                          <circle cx="16" cy="18" r="1.5" fill="#ec4899" opacity="0.6" />
                          <circle cx="21" cy="18" r="1.5" fill="#94a3b8" opacity="0.25" />
                          <circle cx="26" cy="18" r="1.5" fill="#94a3b8" opacity="0.25" />
                          <rect x="15" y="27" width="18" height="24" rx="2" fill="#94a3b8" opacity="0.06" stroke="#94a3b8" strokeWidth="0.8" />
                          <rect x="37" y="27" width="28" height="11" rx="2" fill="#ec4899" opacity="0.06" stroke="#ec4899" strokeWidth="0.8" />
                          <rect x="37" y="41" width="28" height="10" rx="2" fill="#94a3b8" opacity="0.04" stroke="#94a3b8" strokeWidth="0.8" />
                          <rect x="18" y="40" width="3" height="8" rx="1" fill="#94a3b8" opacity="0.2" />
                          <rect x="23" y="36" width="3" height="12" rx="1" fill="#ec4899" opacity="0.15" />
                          <rect x="28" y="38" width="3" height="10" rx="1" fill="#94a3b8" opacity="0.2" />
                          <line x1="35" y1="56" x2="45" y2="56" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                          <line x1="40" y1="56" x2="40" y2="62" stroke="#94a3b8" strokeWidth="1.5" />
                          <line x1="32" y1="62" x2="48" y2="62" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      ),
                    },
                    {
                      title: "Custom Solutions",
                      description: "Bespoke dashboards designed and built for your organization.",
                      price: "Varies",
                      checkoutId: 0,
                      icon: (
                        <svg viewBox="0 0 80 80" fill="none" className="w-[72px] h-[72px] mx-auto mb-4">
                          <path d="M40 10 L66 24 L66 52 L40 66 L14 52 L14 24 Z" stroke="#94a3b8" strokeWidth="1.8" fill="none" />
                          <path d="M40 10 L40 38 L66 24" stroke="#94a3b8" strokeWidth="0.8" opacity="0.3" fill="none" />
                          <path d="M40 38 L14 24" stroke="#94a3b8" strokeWidth="0.8" opacity="0.3" fill="none" />
                          <path d="M40 38 L40 66" stroke="#94a3b8" strokeWidth="0.8" opacity="0.3" fill="none" />
                          <circle cx="40" cy="38" r="8" fill="#ec4899" opacity="0.08" stroke="#ec4899" strokeWidth="1" />
                          <path d="M37.5 38 L39.5 40 L43 36" stroke="#ec4899" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          <circle cx="40" cy="10" r="2" fill="#94a3b8" opacity="0.2" />
                          <circle cx="66" cy="24" r="2" fill="#94a3b8" opacity="0.2" />
                          <circle cx="66" cy="52" r="2" fill="#94a3b8" opacity="0.2" />
                          <circle cx="40" cy="66" r="2" fill="#94a3b8" opacity="0.2" />
                          <circle cx="14" cy="52" r="2" fill="#94a3b8" opacity="0.2" />
                          <circle cx="14" cy="24" r="2" fill="#94a3b8" opacity="0.2" />
                        </svg>
                      ),
                    },
                  ].map((product, idx) => (
                    <div
                      key={idx}
                      className="bg-[#f7f6f5] rounded-2xl px-5 py-7 flex flex-col items-center text-center shadow-[0_4px_20px_rgba(0,0,0,0.08)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.14)] hover:-translate-y-1.5 transition-all duration-300 group border border-[#e5e3e1]"
                    >
                      {/* Icon */}
                      {product.icon}

                      {/* Title */}
                      <h4 className="text-[15px] font-bold text-slate-800 mb-2">{product.title}</h4>

                      {/* Description */}
                      <p className="text-[11px] text-slate-400 leading-relaxed mb-5 min-h-[32px] max-w-[160px]">{product.description}</p>

                      {/* CTA Button */}
                      <Link
                        href={product.checkoutId > 0 ? `/checkout/${product.checkoutId}` : '/contact'}
                        className="inline-block w-full py-2.5 px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white bg-[#ec4899] hover:bg-[#db2777] rounded-md transition-all duration-200 hover:shadow-lg hover:shadow-pink-500/20"
                      >
                        Check Our Prices
                      </Link>

                      {/* Price text */}
                      <span className="mt-3 text-[10px] text-slate-400 font-medium">
                        {product.price === "Varies" ? "Price varies by project" : `FROM ${product.price}`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 2: SOL Theory The Etsy of Self Improvement */}
            <section className="relative py-24 md:py-32 w-full flex flex-col items-center justify-center bg-transparent z-20 overflow-hidden">
              {/* Subtle Animated Backgrounds */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0], opacity: [0.1, 0.15, 0.1] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute -top-[30%] -left-[10%] w-[700px] h-[700px] bg-gradient-to-tr from-fuchsia-500/20 to-indigo-500/20 rounded-full blur-[120px]"
                />
                <motion.div 
                  animate={{ scale: [1, 1.3, 1], rotate: [0, -90, 0], opacity: [0.1, 0.2, 0.1] }}
                  transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                  className="absolute -bottom-[30%] -right-[10%] w-[800px] h-[800px] bg-gradient-to-bl from-cyan-500/20 to-purple-500/20 rounded-full blur-[120px]"
                />
              </div>

              <div className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-4xl mx-auto space-y-6">
                  <h2 className="font-headline text-5xl md:text-6xl font-bold text-white tracking-tight drop-shadow-xl">The Etsy of Self Improvement</h2>
                  <div className="h-1 bg-gradient-to-r from-fuchsia-600 via-indigo-500 to-transparent mx-auto rounded-full w-24 mb-6" />
                  
                  <p className="text-slate-200 text-xl md:text-2xl leading-relaxed font-medium">
                    SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
                  </p>
                  <p className="text-slate-300 text-lg leading-relaxed max-w-3xl mx-auto border-t border-white/10 pt-6 mt-6 font-light">
                    We provide a platform for A-Hope, B-Tools, C-Practice. Every product must demonstrate a <span className="text-fuchsia-300 font-semibold px-2 bg-fuchsia-500/10 rounded-md py-0.5 border border-fuchsia-500/20 shadow-sm shadow-fuchsia-500/10">SPF (Simple, Practical and Fun)</span> rating across its products and community.
                  </p>
                </div>
              </div>
            </section>

            {/* SECTION 2.5: Animated Video Placeholder Container */}
            <section className="relative pb-32 md:pb-40 pt-10 w-full flex flex-col items-center justify-center bg-transparent z-20">
              <div className="container mx-auto px-4 max-w-5xl">
                <motion.div 
                  initial={{ opacity: 0, y: 80, scale: 0.95 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="w-full aspect-video rounded-3xl border border-white/10 bg-black/60 shadow-[0_0_60px_-15px_rgba(192,38,211,0.15)] overflow-hidden relative flex items-center justify-center group cursor-pointer backdrop-blur-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/10 via-transparent to-transparent opacity-60"></div>
                  
                  <div className="flex flex-col items-center text-slate-500 group-hover:text-fuchsia-400 transition-colors duration-500 z-10 group-hover:scale-105 transform">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-6 backdrop-blur-md bg-white/5 shadow-lg group-hover:bg-fuchsia-500/10 transition-colors duration-500">
                      <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-current border-b-[12px] border-b-transparent ml-2" />
                    </div>
                    <p className="font-headline tracking-[0.2em] text-sm md:text-base font-semibold uppercase group-hover:text-fuchsia-300">Video Presentation Container</p>
                  </div>
                </motion.div>
              </div>
            </section>
            


            {/* SECTION 4 & 5 Combined: Dense Protocol Overview */}
            <section id="qualifies" className="relative py-32 md:py-48 w-full flex flex-col items-center justify-center bg-transparent z-40 shadow-2xl overflow-hidden">
              <motion.div
                initial={{ opacity: 0, y: 60 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.7, ease: "easeOut" }}
                className="container mx-auto px-4 w-full flex flex-col justify-center"
              >
                <div className="text-center mb-10 md:mb-16 mt-6 md:mt-10">
                  <h2 className="font-nunito text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 drop-shadow-xl">The SOL Protocol</h2>
                  <p className="text-slate-400 max-w-2xl mx-auto text-lg pt-2 md:pt-0">Network qualifications and absolute directives for our premium ecosystem.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 max-w-7xl mx-auto w-full">
                  
                  {/* Left Column: Qualifications */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                        <Sparkles className="w-5 h-5 text-indigo-400" />
                      </div>
                      <h3 className="text-2xl font-headline font-bold text-white">Qualifications</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {whatQualifies.map((item, idx) => (
                        <div key={item.title} className="p-5 md:p-6 bg-black/40 backdrop-blur-sm border border-white/10 rounded-2xl hover:bg-white/10 hover:border-indigo-500/30 transition-all group relative overflow-hidden">
                          <div className="relative z-10 flex gap-4 md:gap-6">
                            <span className="text-indigo-400 font-black text-3xl md:text-4xl opacity-50 shrink-0">0{idx + 1}</span>
                            <div>
                              <h4 className="font-headline text-lg md:text-xl font-bold text-white mb-2">{item.title}</h4>
                              <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Mission Matrix */}
                  <div className="relative">
                      <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-2 bg-fuchsia-500/20 rounded-lg border border-fuchsia-500/30">
                          <Sparkles className="w-5 h-5 text-fuchsia-400" />
                        </div>
                        <h3 className="text-2xl font-headline font-bold text-white">Mission Directives</h3>
                      </div>

                      <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-3xl p-6 md:p-8 relative z-10 h-[calc(100%-4rem)] flex flex-col justify-between hover:border-fuchsia-500/30 transition-all">
                          <div className="space-y-6 md:space-y-8">
                            <div>
                              <h4 className="text-fuchsia-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.8)]" /> Why
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">To empower everyone to look for what is absolutely possible.</p>
                            </div>
                            <div>
                              <h4 className="text-indigo-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.8)]" /> Mission
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">To create a platform, ecosystem and community to systematically improve structural life.</p>
                            </div>
                            <div>
                              <h4 className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" /> Vision
                              </h4>
                              <p className="text-slate-300 text-base md:text-lg">The world's apex layer for self improvement and cognitive elevation.</p>
                            </div>
                            <div>
                              <h4 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]" /> Architectural Goals
                              </h4>
                              <ul className="text-slate-300 text-sm md:text-base space-y-2">
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Build an impact-driven community.</li>
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Innovate creative frontiers.</li>
                                <li className="flex gap-2"><span className="text-amber-400">-</span> Measure strictly by data and scientific method.</li>
                              </ul>
                            </div>
                          </div>
                      </div>
                  </div>

                </div>
              </motion.div>
            </section>

            {/* SECTION 6: Subscription & Footer Context */}
            <section className="relative w-full flex flex-col justify-between bg-transparent z-50">
              <div className="flex-grow flex items-center justify-center border-t border-white/5 bg-transparent pt-10 pb-10">
                <SubscriptionSection />
              </div>
              <div className="relative z-60 border-t border-white/10 bg-black/90 pt-8 backdrop-blur-md">
                <Footer />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
