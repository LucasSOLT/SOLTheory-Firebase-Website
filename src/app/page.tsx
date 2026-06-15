'use client';


import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/sections/header';
import { SubscriptionSection } from '@/components/sections/subscription';
import { Footer } from '@/components/sections/footer';
import Link from 'next/link';
import { ArrowDown, Sparkles } from 'lucide-react';

import { BlobHero } from '@/components/ui/blob-hero';
import { motion, AnimatePresence } from 'framer-motion';
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
  const [showSOLWords, setShowSOLWords] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<"self" | "others" | "life" | null>(null);
  const solTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSOLHover = () => {
    setShowSOLWords(true);
    if (solTimerRef.current) clearTimeout(solTimerRef.current);
    solTimerRef.current = setTimeout(() => {
      setShowSOLWords(false);
    }, 30000);
  };

  useEffect(() => {
    return () => {
      if (solTimerRef.current) clearTimeout(solTimerRef.current);
    };
  }, []);

  const tiles = [
    {
      num: "01",
      slug: "email-tools",
      title: "Email Tools",
      desc: "Automated outreach, drip campaigns, and smart email sequencing.",
      color: "from-[#3b0764]/25 via-[#4c0519]/25 to-[#2e1065]/25",
      dot: "bg-fuchsia-500 shadow-[0_0_8px_2px_rgba(217,70,239,0.5)]",
      icon: "/images/icon-email-new.png",
      iconSize: "w-[150%] max-w-none rotate-[-5deg]",
      price: "From $3/MO"
    },
    {
      num: "02",
      slug: "sms-tools",
      title: "SMS Tools",
      desc: "Instant text messaging, scheduling, and conversational automation.",
      color: "from-[#4c0519]/25 via-[#701a75]/25 to-[#470024]/25",
      dot: "bg-rose-500 shadow-[0_0_8px_2px_rgba(244,63,94,0.5)]",
      icon: "/images/icon-sms-new.png",
      iconSize: "w-[70%]",
      price: "From $4/MO"
    },
    {
      num: "03",
      slug: "google-suite-integrations",
      title: "Google Suite Integrations",
      desc: "Seamless connections to Sheets, Docs, Calendar, and Drive.",
      color: "from-[#2e1065]/25 via-[#4c0519]/25 to-[#1e1b4b]/25",
      dot: "bg-violet-500 shadow-[0_0_8px_2px_rgba(139,92,246,0.5)]",
      icon: "/images/icon-google.png",
      iconSize: "w-[70%]",
      price: "From $6/MO"
    },
    {
      num: "04",
      slug: "nxt-dashboard",
      title: "NXT Dashboard",
      desc: "Real-time analytics, KPI tracking, and performance insights.",
      color: "from-[#3b0764]/25 via-[#881337]/25 to-[#311042]/25",
      dot: "bg-pink-500 shadow-[0_0_8px_2px_rgba(236,72,153,0.5)]",
      icon: "/images/icon-dashboard-new.png",
      iconSize: "w-[95%]",
      price: "From $16/MO"
    },
    {
      num: "05",
      slug: "customized-is-solutions",
      title: "Customized I.S. Solutions",
      desc: "Tailored information systems built for your unique workflow.",
      color: "from-[#470024]/25 via-[#3b0764]/25 to-[#2e1065]/25",
      dot: "bg-indigo-500 shadow-[0_0_8px_2px_rgba(99,102,241,0.5)]",
      icon: "/images/icon-building.png",
      iconSize: "w-[100%]",
      price: "Subject to Scale"
    }
  ];

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
                The Evolution of <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">Self Improvement</span>
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
        <div className="relative w-full overflow-hidden bg-[#0A0A0B]">
          <StarBackground />
          <div className="relative z-10 w-full flex flex-col items-center bg-transparent">


            {/* Top Grey Section with text, custom tooltip, and gradient */}
            <section className="relative w-full h-[40vh] bg-gradient-to-b from-transparent to-[#222222] z-20 flex items-end justify-center pt-24 pb-20 overflow-visible">
              {/* 5 Hand-placed twinkly stars at the top of the gradient */}
              <div className="absolute top-0 inset-x-0 h-32 overflow-hidden pointer-events-none z-0">
                <div 
                  className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)] animate-pulse" 
                  style={{ top: '15%', left: '18%', width: '1.5px', height: '1.5px', animationDuration: '3s' }} 
                />
                <div 
                  className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)] animate-pulse" 
                  style={{ top: '25%', left: '42%', width: '2.0px', height: '2.0px', animationDuration: '4.5s' }} 
                />
                <div 
                  className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)] animate-pulse" 
                  style={{ top: '10%', left: '72%', width: '1.2px', height: '1.2px', animationDuration: '5s' }} 
                />
                <div 
                  className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)] animate-pulse" 
                  style={{ top: '35%', left: '88%', width: '1.8px', height: '1.8px', animationDuration: '3.5s' }} 
                />
                <div 
                  className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)] animate-pulse" 
                  style={{ top: '20%', left: '58%', width: '1.5px', height: '1.5px', animationDuration: '4s' }} 
                />
              </div>
              <div className="relative z-10 w-full flex flex-col items-center text-center overflow-visible">
                <AnimatePresence>
                  {showSOLWords && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="flex justify-center items-center gap-16 md:gap-28 mb-6 overflow-visible"
                    >
                      {/* Self */}
                      <div className="relative group/word">
                        <AnimatePresence>
                          {hoveredWord === "self" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-80 text-center z-50 pointer-events-none"
                            >
                              <p className="text-xs md:text-sm font-light text-slate-300/90 leading-relaxed tracking-wide">
                                SOLTheory improves the inner world of <span className="font-semibold text-white">Self</span> through cognitive elevation.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <span
                          onMouseEnter={() => setHoveredWord("self")}
                          onMouseLeave={() => setHoveredWord(null)}
                          className="font-serif text-3xl md:text-5xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-fuchsia-300 hover:from-fuchsia-300 hover:to-fuchsia-200 transition-all duration-300 cursor-help"
                        >
                          Self
                        </span>
                      </div>

                      {/* Others */}
                      <div className="relative group/word">
                        <AnimatePresence>
                          {hoveredWord === "others" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-80 text-center z-50 pointer-events-none"
                            >
                              <p className="text-xs md:text-sm font-light text-slate-300/90 leading-relaxed tracking-wide">
                                SOLTheory improves the intrapersonal and interpersonal world of <span className="font-semibold text-white">Others</span>.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <span
                          onMouseEnter={() => setHoveredWord("others")}
                          onMouseLeave={() => setHoveredWord(null)}
                          className="font-serif text-3xl md:text-5xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-indigo-300 hover:from-indigo-300 hover:to-indigo-200 transition-all duration-300 cursor-help"
                        >
                          Others
                        </span>
                      </div>

                      {/* Life */}
                      <div className="relative group/word">
                        <AnimatePresence>
                          {hoveredWord === "life" && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-6 w-80 text-center z-50 pointer-events-none"
                            >
                              <p className="text-xs md:text-sm font-light text-slate-300/90 leading-relaxed tracking-wide">
                                SOLTheory systematically improves daily <span className="font-semibold text-white">Life</span> and operational workflows.
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <span
                          onMouseEnter={() => setHoveredWord("life")}
                          onMouseLeave={() => setHoveredWord(null)}
                          className="font-serif text-3xl md:text-5xl font-semibold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400 hover:from-fuchsia-300 hover:to-indigo-300 transition-all duration-300 cursor-help"
                        >
                          Life
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.h2 
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
                  className="font-serif text-2xl md:text-4xl lg:text-5xl font-normal text-slate-100/90 tracking-tight leading-tight px-6"
                >
                  Forget everything you know
                  <br />
                  about{' '}
                  <span className="relative inline-block group">
                    <Link 
                      href="/sol-explained" 
                      onMouseEnter={handleSOLHover}
                      className="cursor-help font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400 hover:from-fuchsia-300 hover:to-indigo-300 border-b-2 border-dashed border-fuchsia-400/40 transition-all duration-300 pb-0.5"
                    >
                      (SOL)
                    </Link>
                  </span>{' '}
                  improvement.
                </motion.h2>
              </div>
            </section>

            {/* Blank Bottom Section (Vertically Larger with multi-stop seamless gradient & 5 vertical tiles) */}
            <section className="relative w-full h-[80vh] bg-gradient-to-b from-[#222222] via-[#0d0d0d] via-[#0d0d0d] to-[#0A0A0B] z-20 flex items-end justify-center pb-16 overflow-hidden">
              


              {/* Village Landscape Line Art above the left-side people drawing */}
              <div className="absolute top-[10%] left-0 w-[420px] sm:w-[520px] md:w-[660px] lg:w-[780px] xl:w-[900px] h-auto pointer-events-none z-[5] select-none">
                <img 
                  src="/images/line-art-village.png" 
                  alt="Village Landscape Line Art" 
                  className="w-full h-auto opacity-75 transform translate-x-[-10%]"
                />
              </div>

              {/* Woman Line Art at Bottom-Right Boundary (mirrors left-side people drawing) */}
              <div className="absolute bottom-0 right-0 w-[220px] sm:w-[280px] md:w-[360px] lg:w-[440px] xl:w-[500px] h-auto pointer-events-none z-10 select-none">
                <img 
                  src="/images/line-art-woman.png" 
                  alt="Woman Line Art" 
                  className="w-full h-auto opacity-80 transform translate-x-[16%] translate-y-[-3%]"
                />
              </div>



              <div className="container mx-auto px-6 max-w-6xl md:max-w-[1360px] relative z-10 w-full">
                

                
                {/* Desktop Flexbox Hover Scale layout */}
                <div className="hidden md:flex flex-row items-end justify-center gap-7 xl:gap-9 w-full h-[540px]">
                  {tiles.map((tile, idx) => (
                    <Link href={`/products/${tile.slug}`} key={idx} className="contents">
                    <motion.div
                      initial={{ opacity: 0, y: 50 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.8, delay: idx * 0.15, ease: "easeOut" }}
                      className={`relative group/tile overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tile.color} backdrop-blur-md w-[20.5%] h-[440px] flex flex-col justify-start gap-4 p-7 shadow-[inset_0_2px_8px_rgba(255,255,255,0.06),0_15px_35px_rgba(0,0,0,0.5)] hover:scale-[1.04] hover:shadow-[0_0_35px_-5px_rgba(219,39,119,0.25)] hover:border-pink-500/25 transition-all duration-500 ease-out cursor-pointer`}
                    >
                      {/* Satin Matte Shine Reflection & Faded White Overlay */}
                      <div className="absolute inset-0 bg-white/[0.04] bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-35 group-hover/tile:opacity-50 transition-opacity duration-500 pointer-events-none" />
                      
                      {/* Top Icon */}
                      {tile.icon && (
                        <div className="relative z-10 h-[220px] w-full flex items-center justify-center shrink-0">
                          <img src={tile.icon} alt={`${tile.title} icon`} className={`${tile.iconSize || 'w-[80%]'} h-auto max-w-none opacity-70 group-hover/tile:opacity-100 transition-opacity drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]`} />
                        </div>
                      )}
                      {!tile.icon && <div className="h-[220px] shrink-0" />}
                      
                      {/* Bottom Info */}
                      <div className="whitespace-normal overflow-hidden">
                        <h4 className="font-serif text-2xl text-slate-200 font-medium group-hover/tile:text-white transition-colors">{tile.title}</h4>
                        <p className="text-xs text-slate-400/80 mt-3 font-sans tracking-wide leading-relaxed">{tile.desc}</p>
                        {tile.price && (
                          <p className="text-sm text-fuchsia-300/90 mt-3 font-semibold font-sans tracking-wide">{tile.price}</p>
                        )}
                      </div>
                    </motion.div>
                    </Link>
                  ))}
                </div>

                {/* Mobile Grid Layout */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full md:hidden">
                  {tiles.map((tile, idx) => (
                    <Link href={`/products/${tile.slug}`} key={idx}>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-30px" }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className={`relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${tile.color} backdrop-blur-md h-[300px] flex flex-col justify-end p-6 shadow-[inset_0_2px_8px_rgba(255,255,255,0.06),0_15px_35px_rgba(0,0,0,0.5)] cursor-pointer`}
                    >
                      <div className="absolute inset-0 bg-white/[0.04] bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-35 pointer-events-none" />
                      {tile.icon && (
                        <div className="relative z-10 mt-1">
                          <img src={tile.icon} alt={`${tile.title} icon`} className="w-10 h-10 object-contain opacity-80" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-serif text-xl text-slate-200 font-medium">{tile.title}</h4>
                        <p className="text-[11px] text-slate-400/80 mt-2 font-sans tracking-wide leading-relaxed">{tile.desc}</p>
                        {tile.price && (
                          <p className="text-sm text-fuchsia-300/90 mt-2 font-semibold font-sans tracking-wide">{tile.price}</p>
                        )}
                      </div>
                    </motion.div>
                    </Link>
                  ))}
                </div>

              </div>
            </section>

          </div>
        </div>

            {/* SECTION 2: SOL Theory Description */}
            <section className="relative pt-20 md:pt-28 pb-24 md:pb-32 w-full flex flex-col items-center justify-center bg-[#0A0A0B] z-20 overflow-hidden">
              <div className="container mx-auto px-4 relative z-10">
                <div className="text-center max-w-4xl mx-auto">
                  <div className="h-[2px] w-48 bg-gradient-to-r from-transparent via-indigo-500 via-fuchsia-500 to-transparent mx-auto mb-12 rounded-full" />
                  <div className="space-y-6">
                    <p className="text-slate-200 text-2xl md:text-3xl leading-[1.5] font-medium">
                      SOL Theory is a curated community of creators and an ecosystem of apps where members can discover and share their products, services, and knowledge.
                    </p>
                    <p className="text-slate-300 text-lg leading-relaxed max-w-3xl mx-auto border-t border-white/10 pt-6 mt-6 font-light">
                      We provide a platform for A-Hope, B-Tools, C-Practice. Every product must demonstrate a<br /><span className="text-fuchsia-300 font-semibold px-2 bg-fuchsia-500/10 rounded-md py-0.5 border border-fuchsia-500/20 shadow-sm shadow-fuchsia-500/10">SPF (Simple, Practical and Fun)</span> rating across its products and community.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2.5: Animated Video Placeholder Container */}
            <section className="relative pb-32 md:pb-40 pt-10 w-full flex flex-col items-center justify-center bg-[#0A0A0B] z-20">
              <div className="container mx-auto px-4 max-w-5xl">
                <motion.div 
                  initial={{ opacity: 0, y: 80 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="w-full aspect-video rounded-3xl border border-white/10 bg-black/60 shadow-[0_0_60px_-15px_rgba(192,38,211,0.15)] overflow-hidden relative flex items-center justify-center group cursor-pointer backdrop-blur-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-fuchsia-500/10 via-transparent to-transparent opacity-60"></div>
                  
                  <div className="flex flex-col items-center justify-center text-center text-slate-500 group-hover:text-fuchsia-400 transition-colors duration-500 z-10 group-hover:scale-105 transform">
                    <div className="w-24 h-24 rounded-full border-2 border-dashed border-current flex items-center justify-center mb-6 backdrop-blur-md bg-white/5 shadow-lg group-hover:bg-fuchsia-500/10 transition-colors duration-500">
                      <div className="w-0 h-0 border-t-[12px] border-t-transparent border-l-[20px] border-l-current border-b-[12px] border-b-transparent ml-2" />
                    </div>
                    <p className="font-headline tracking-[0.2em] text-sm md:text-base font-semibold uppercase group-hover:text-fuchsia-300 text-center">Instructional content coming soon<br />via DRiVE LMS</p>
                  </div>
                </motion.div>
              </div>
            </section>
            


            {/* SECTION 4 & 5: Callout Radial Design */}
            <section id="qualifies" className="relative py-24 md:py-32 w-full bg-[#0A0A0B] z-40 overflow-hidden">
              <div className="container mx-auto px-4 max-w-7xl">

                {/* QUALIFICATIONS - Radial Callout */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="relative mb-32 md:mb-40"
                >
                  {/* Center Label */}
                  <div className="flex justify-center mb-16 md:mb-0 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-20">
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_16px_4px_rgba(255,255,255,0.3)] mb-4" />
                      <h3 className="font-headline text-2xl md:text-3xl font-bold text-white tracking-tight text-center">Qualifications</h3>
                    </div>
                  </div>

                  {/* Callout Cards - Desktop */}
                  <div className="hidden md:block relative h-[420px]">
                    {/* SVG Dotted Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                      {/* Line to Card 1 (top-left) */}
                      <line x1="50%" y1="50%" x2="12%" y2="18%" stroke="rgba(129,140,248,0.35)" strokeWidth="1" strokeDasharray="6 4" />
                      {/* Line to Card 2 (top-right) */}
                      <line x1="50%" y1="50%" x2="88%" y2="18%" stroke="rgba(129,140,248,0.35)" strokeWidth="1" strokeDasharray="6 4" />
                      {/* Line to Card 3 (bottom-center) */}
                      <line x1="50%" y1="50%" x2="50%" y2="92%" stroke="rgba(129,140,248,0.35)" strokeWidth="1" strokeDasharray="6 4" />
                    </svg>

                    {/* Card 1 - Top Left */}
                    <div className="absolute top-0 left-0 w-[38%] z-20">
                      <div className="p-5 bg-indigo-950/30 backdrop-blur-sm border border-indigo-500/15 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <div className="flex items-start gap-4">
                          <span className="text-indigo-400/50 font-black text-3xl shrink-0">01</span>
                          <div>
                            <h4 className="font-headline text-base font-bold text-white mb-1.5">Scientific step-by-step method</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">Our methods are rooted in research and designed for tangible progress. We break down complex concepts into actionable steps.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2 - Top Right */}
                    <div className="absolute top-0 right-0 w-[38%] z-20">
                      <div className="p-5 bg-indigo-950/30 backdrop-blur-sm border border-indigo-500/15 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <div className="flex items-start gap-4">
                          <span className="text-indigo-400/50 font-black text-3xl shrink-0">02</span>
                          <div>
                            <h4 className="font-headline text-base font-bold text-white mb-1.5">Nobody plays alone here</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">Community is at our core. Connect with like-minded individuals, share your journey, and grow together in a supportive environment.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card 3 - Bottom Center */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[42%] z-20">
                      <div className="p-5 bg-indigo-950/30 backdrop-blur-sm border border-indigo-500/15 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <div className="flex items-start gap-4">
                          <span className="text-indigo-400/50 font-black text-3xl shrink-0">03</span>
                          <div>
                            <h4 className="font-headline text-base font-bold text-white mb-1.5">Simple, Practical and Fun (SPF)</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">We believe growth should be engaging, not a chore. Our tools are designed to be intuitive, easy to integrate into your life, and enjoyable to use.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Callout Cards - Mobile Stack */}
                  <div className="md:hidden space-y-4">
                    {whatQualifies.map((item, idx) => (
                      <div key={item.title} className="p-5 bg-indigo-950/30 backdrop-blur-sm border border-indigo-500/15 rounded-2xl">
                        <div className="flex items-start gap-4">
                          <span className="text-indigo-400/50 font-black text-3xl shrink-0">0{idx + 1}</span>
                          <div>
                            <h4 className="font-headline text-base font-bold text-white mb-1.5">{item.title}</h4>
                            <p className="text-slate-400 text-sm leading-relaxed">{item.description}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* MISSION DIRECTIVES - Radial Callout */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className="relative"
                >
                  {/* Center Label */}
                  <div className="flex justify-center mb-16 md:mb-0 md:absolute md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-20">
                    <div className="flex flex-col items-center">
                      <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_16px_4px_rgba(255,255,255,0.3)] mb-4" />
                      <h3 className="font-headline text-2xl md:text-3xl font-bold text-white tracking-tight text-center">Mission Directives</h3>
                    </div>
                  </div>

                  {/* Callout Cards - Desktop */}
                  <div className="hidden md:block relative h-[480px]">
                    {/* SVG Dotted Lines */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" preserveAspectRatio="none">
                      {/* Line to Why (top-left) */}
                      <line x1="50%" y1="50%" x2="14%" y2="12%" stroke="rgba(232,121,249,0.3)" strokeWidth="1" strokeDasharray="6 4" />
                      {/* Line to Mission (top-right) */}
                      <line x1="50%" y1="50%" x2="86%" y2="12%" stroke="rgba(129,140,248,0.3)" strokeWidth="1" strokeDasharray="6 4" />
                      {/* Line to Vision (bottom-left) */}
                      <line x1="50%" y1="50%" x2="14%" y2="88%" stroke="rgba(52,211,153,0.3)" strokeWidth="1" strokeDasharray="6 4" />
                      {/* Line to Goals (bottom-right) */}
                      <line x1="50%" y1="50%" x2="86%" y2="88%" stroke="rgba(251,191,36,0.3)" strokeWidth="1" strokeDasharray="6 4" />
                    </svg>

                    {/* Why - Top Left */}
                    <div className="absolute top-0 left-0 w-[36%] z-20">
                      <div className="p-5 bg-fuchsia-950/20 backdrop-blur-sm border border-fuchsia-500/15 rounded-2xl hover:border-fuchsia-500/30 transition-all">
                        <h4 className="text-fuchsia-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-fuchsia-400 shadow-[0_0_8px_rgba(232,121,249,0.6)]" /> Why
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">To empower everyone to look for what is absolutely possible.</p>
                      </div>
                    </div>

                    {/* Mission - Top Right */}
                    <div className="absolute top-0 right-0 w-[36%] z-20">
                      <div className="p-5 bg-indigo-950/20 backdrop-blur-sm border border-indigo-500/15 rounded-2xl hover:border-indigo-500/30 transition-all">
                        <h4 className="text-indigo-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]" /> Mission
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">To create a platform, ecosystem and community to systematically improve structural life.</p>
                      </div>
                    </div>

                    {/* Vision - Bottom Left */}
                    <div className="absolute bottom-0 left-0 w-[36%] z-20">
                      <div className="p-5 bg-emerald-950/20 backdrop-blur-sm border border-emerald-500/15 rounded-2xl hover:border-emerald-500/30 transition-all">
                        <h4 className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" /> Vision
                        </h4>
                        <p className="text-slate-300 text-sm leading-relaxed">The world's apex layer for self improvement and cognitive elevation.</p>
                      </div>
                    </div>

                    {/* Architectural Goals - Bottom Right */}
                    <div className="absolute bottom-0 right-0 w-[36%] z-20">
                      <div className="p-5 bg-amber-950/20 backdrop-blur-sm border border-amber-500/15 rounded-2xl hover:border-amber-500/30 transition-all">
                        <h4 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" /> Architectural Goals
                        </h4>
                        <ul className="text-slate-300 text-sm space-y-1.5">
                          <li className="flex gap-2"><span className="text-amber-400">-</span> Build an impact-driven community.</li>
                          <li className="flex gap-2"><span className="text-amber-400">-</span> Innovate creative frontiers.</li>
                          <li className="flex gap-2"><span className="text-amber-400">-</span> Measure strictly by data and scientific method.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Mission Directives - Mobile Stack */}
                  <div className="md:hidden space-y-4">
                    <div className="p-5 bg-fuchsia-950/20 backdrop-blur-sm border border-fuchsia-500/15 rounded-2xl">
                      <h4 className="text-fuchsia-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-fuchsia-400" /> Why
                      </h4>
                      <p className="text-slate-300 text-sm">To empower everyone to look for what is absolutely possible.</p>
                    </div>
                    <div className="p-5 bg-indigo-950/20 backdrop-blur-sm border border-indigo-500/15 rounded-2xl">
                      <h4 className="text-indigo-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-400" /> Mission
                      </h4>
                      <p className="text-slate-300 text-sm">To create a platform, ecosystem and community to systematically improve structural life.</p>
                    </div>
                    <div className="p-5 bg-emerald-950/20 backdrop-blur-sm border border-emerald-500/15 rounded-2xl">
                      <h4 className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" /> Vision
                      </h4>
                      <p className="text-slate-300 text-sm">The world's apex layer for self improvement and cognitive elevation.</p>
                    </div>
                    <div className="p-5 bg-amber-950/20 backdrop-blur-sm border border-amber-500/15 rounded-2xl">
                      <h4 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" /> Architectural Goals
                      </h4>
                      <ul className="text-slate-300 text-sm space-y-1.5">
                        <li className="flex gap-2"><span className="text-amber-400">-</span> Build an impact-driven community.</li>
                        <li className="flex gap-2"><span className="text-amber-400">-</span> Innovate creative frontiers.</li>
                        <li className="flex gap-2"><span className="text-amber-400">-</span> Measure strictly by data and scientific method.</li>
                      </ul>
                    </div>
                  </div>
                </motion.div>

              </div>
            </section>

            {/* SECTION 6: Subscription & Footer Context */}
            <section className="relative w-full flex flex-col justify-between bg-[#0A0A0B] z-50">
              <div className="flex-grow flex items-center justify-center border-t border-white/5 bg-[#0A0A0B] pt-10 pb-10">
                <SubscriptionSection />
              </div>
              <div className="relative z-60 border-t border-white/10 bg-black/90 pt-8 backdrop-blur-md">
                <Footer />
              </div>
            </section>
      </main>
    </div>
  );
}
