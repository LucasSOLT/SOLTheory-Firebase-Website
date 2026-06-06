'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { StarBackground } from '@/components/ui/star-background';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, ArrowRight } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Product data – single source of truth for all product detail pages */
/* ------------------------------------------------------------------ */
const products = [
  {
    slug: 'email-tools',
    num: '01',
    title: 'Email Tools',
    desc: 'Automated outreach, drip campaigns, and smart email sequencing.',
    longDesc:
      "SOL Theory's Email Tools empower your team with intelligent email automation. Build custom drip campaigns, schedule automated outreach sequences, and track engagement metrics — all from a unified dashboard. Our AI-powered system optimizes send times, personalizes content, and provides real-time analytics to maximize your email ROI.",
    features: [
      'Smart drip campaign builder',
      'AI-optimized send scheduling',
      'Engagement tracking & analytics',
      'Template library with personalization',
      'A/B testing built-in',
      'CRM integration',
    ],
    color: 'from-[#3b0764]/40 via-[#4c0519]/40 to-[#2e1065]/40',
    accentColor: 'fuchsia',
    icon: '/images/icon-email.png',
    price: 'From $3/MO',
  },
  {
    slug: 'sms-tools',
    num: '02',
    title: 'SMS Tools',
    desc: 'Instant text messaging, scheduling, and conversational automation.',
    longDesc:
      "Reach your audience instantly with SOL Theory's SMS platform. Send targeted text campaigns, automate two-way conversations, and schedule messages for optimal engagement. Perfect for appointment reminders, event notifications, and real-time customer communication.",
    features: [
      'Two-way conversational messaging',
      'Scheduled & triggered sends',
      'Contact segmentation',
      'Automated response flows',
      'Delivery & read receipts',
      'Compliance management',
    ],
    color: 'from-[#4c0519]/40 via-[#701a75]/40 to-[#470024]/40',
    accentColor: 'rose',
    icon: '/images/icon-sms.png',
    price: 'From $4/MO',
  },
  {
    slug: 'google-suite-integrations',
    num: '03',
    title: 'Google Suite Integrations',
    desc: 'Seamless connections to Sheets, Docs, Calendar, and Drive.',
    longDesc:
      'Unify your workflow with deep Google Workspace integrations. Automatically sync data between your apps and Google Sheets, generate reports in Docs, manage team schedules through Calendar, and organize files in Drive — eliminating manual data entry and keeping your team in sync.',
    features: [
      'Google Sheets auto-sync',
      'Document generation',
      'Calendar integration',
      'Drive file management',
      'Real-time data pipeline',
      'Cross-platform automation',
    ],
    color: 'from-[#2e1065]/40 via-[#4c0519]/40 to-[#1e1b4b]/40',
    accentColor: 'violet',
    icon: '/images/icon-google.png',
    price: 'From $6/MO',
  },
  {
    slug: 'nxt-dashboard',
    num: '04',
    title: 'NXT Dashboard',
    desc: 'Real-time analytics, KPI tracking, and performance insights.',
    longDesc:
      'The NXT Dashboard gives your organization a command center for everything that matters. Track KPIs in real-time, visualize performance trends, monitor team productivity, and generate executive-ready reports — all in a beautifully designed, customizable interface.',
    features: [
      'Real-time KPI tracking',
      'Customizable widget layout',
      'Team performance metrics',
      'Automated report generation',
      'Data export & sharing',
      'Multi-organization support',
    ],
    color: 'from-[#3b0764]/40 via-[#881337]/40 to-[#311042]/40',
    accentColor: 'pink',
    icon: '/images/icon-dashboard.png',
    price: 'From $16/MO',
  },
  {
    slug: 'customized-is-solutions',
    num: '05',
    title: 'Customized I.S. Solutions',
    desc: 'Tailored information systems built for your unique workflow.',
    longDesc:
      'Every organization is different. Our team designs and builds bespoke information systems that fit your exact needs — from custom databases and workflow automation to specialized reporting and integration architecture. We handle the complexity so you can focus on impact.',
    features: [
      'Custom database design',
      'Workflow automation',
      'API & integration development',
      'Dedicated project manager',
      'Ongoing support & iteration',
      'Scalable architecture',
    ],
    color: 'from-[#470024]/40 via-[#3b0764]/40 to-[#2e1065]/40',
    accentColor: 'indigo',
    icon: '/images/icon-gears.png',
    price: 'Subject to Scale',
  },
];

/* ------------------------------------------------------------------ */
/*  Accent-color utility maps                                         */
/* ------------------------------------------------------------------ */
const accentMap: Record<string, { dot: string; text: string; border: string; bg: string; glow: string; badge: string }> = {
  fuchsia: {
    dot: 'bg-fuchsia-500 shadow-[0_0_12px_3px_rgba(217,70,239,0.5)]',
    text: 'text-fuchsia-400',
    border: 'border-fuchsia-500/20',
    bg: 'bg-fuchsia-500/10',
    glow: 'shadow-[0_0_60px_-15px_rgba(217,70,239,0.3)]',
    badge: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25',
  },
  rose: {
    dot: 'bg-rose-500 shadow-[0_0_12px_3px_rgba(244,63,94,0.5)]',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    bg: 'bg-rose-500/10',
    glow: 'shadow-[0_0_60px_-15px_rgba(244,63,94,0.3)]',
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/25',
  },
  violet: {
    dot: 'bg-violet-500 shadow-[0_0_12px_3px_rgba(139,92,246,0.5)]',
    text: 'text-violet-400',
    border: 'border-violet-500/20',
    bg: 'bg-violet-500/10',
    glow: 'shadow-[0_0_60px_-15px_rgba(139,92,246,0.3)]',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/25',
  },
  pink: {
    dot: 'bg-pink-500 shadow-[0_0_12px_3px_rgba(236,72,153,0.5)]',
    text: 'text-pink-400',
    border: 'border-pink-500/20',
    bg: 'bg-pink-500/10',
    glow: 'shadow-[0_0_60px_-15px_rgba(236,72,153,0.3)]',
    badge: 'bg-pink-500/15 text-pink-300 border-pink-500/25',
  },
  indigo: {
    dot: 'bg-indigo-500 shadow-[0_0_12px_3px_rgba(99,102,241,0.5)]',
    text: 'text-indigo-400',
    border: 'border-indigo-500/20',
    bg: 'bg-indigo-500/10',
    glow: 'shadow-[0_0_60px_-15px_rgba(99,102,241,0.3)]',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25',
  },
};

/* ------------------------------------------------------------------ */
/*  Animation variants                                                */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ------------------------------------------------------------------ */
/*  Page component                                                    */
/* ------------------------------------------------------------------ */
export default function ProductDetailPage() {
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const product = products.find((p) => p.slug === slug);

  /* ---------- Not-found state ---------- */
  if (!product) {
    return (
      <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
        <div className="fixed top-0 w-full z-50">
          <Header />
        </div>

        <main className="flex-grow flex items-center justify-center relative">
          <StarBackground />
          <div className="relative z-10 text-center px-6">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}>
              <h1 className="text-6xl md:text-8xl font-bold text-white mb-4">404</h1>
              <p className="text-xl text-slate-400 mb-8">Product not found.</p>
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all font-semibold"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Home
              </Link>
            </motion.div>
          </div>
        </main>

        <div className="relative z-50 border-t border-white/10 bg-black/90 backdrop-blur-md">
          <Footer />
        </div>
      </div>
    );
  }

  const accent = accentMap[product.accentColor] ?? accentMap.fuchsia;

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      {/* Header */}
      <div className="fixed top-0 w-full z-50">
        <Header />
      </div>

      <main className="flex-grow w-full relative">
        {/* ========== HERO ========== */}
        <section className="relative min-h-[70vh] w-full flex items-center justify-center overflow-hidden pt-24 pb-16 md:pt-32 md:pb-24">
          <StarBackground />

          {/* Radial glow behind icon */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className={`w-[500px] h-[500px] rounded-full bg-gradient-to-br ${product.color} blur-3xl opacity-60`} />
          </div>

          <div className="relative z-10 container mx-auto px-6 max-w-5xl">
            {/* Back link */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }}>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-fuchsia-400 transition-colors mb-10 group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </Link>
            </motion.div>

            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              {/* Icon */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className={`shrink-0 w-32 h-32 md:w-44 md:h-44 rounded-3xl bg-gradient-to-br ${product.color} border border-white/10 backdrop-blur-md flex items-center justify-center ${accent.glow}`}
              >
                <img
                  src={product.icon}
                  alt={`${product.title} icon`}
                  className="w-[70%] h-[70%] object-contain drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                />
              </motion.div>

              {/* Title / desc / price */}
              <div className="text-center md:text-left">
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className={`inline-block text-xs font-black tracking-[0.3em] uppercase ${accent.text} mb-3`}
                >
                  Product {product.num}
                </motion.span>

                <motion.h1
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.15 }}
                  className="font-serif text-4xl md:text-6xl font-bold text-white tracking-tight leading-tight"
                >
                  {product.title}
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.25 }}
                  className="mt-4 text-lg md:text-xl text-slate-400 max-w-xl leading-relaxed"
                >
                  {product.desc}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, delay: 0.35 }}
                  className="mt-6 flex flex-wrap items-center gap-4 justify-center md:justify-start"
                >
                  <span
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold tracking-wide ${accent.badge}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
                    {product.price}
                  </span>
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== LONG DESCRIPTION ========== */}
        <section className="relative py-20 md:py-28 w-full bg-[#0A0A0B]">
          <div className="container mx-auto px-6 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className={`h-[2px] w-48 bg-gradient-to-r from-transparent via-fuchsia-500 to-transparent mx-auto mb-12 rounded-full`} />

              <p className="text-slate-300 text-lg md:text-xl leading-[1.8] text-center font-light">
                {product.longDesc}
              </p>
            </motion.div>
          </div>
        </section>

        {/* ========== FEATURES GRID ========== */}
        <section className="relative py-20 md:py-28 w-full bg-[#0A0A0B] overflow-hidden">
          <StarBackground />
          <div className="container mx-auto px-6 max-w-5xl relative z-10">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7 }}
              className="text-center mb-14"
            >
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight">
                Key Features
              </h2>
              <p className="mt-3 text-slate-400 text-base">
                Everything you need, built right in.
              </p>
            </motion.div>

            <motion.div
              variants={stagger}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-60px' }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {product.features.map((feature, idx) => (
                <motion.div
                  key={feature}
                  variants={fadeUp}
                  custom={idx}
                  className={`group relative p-6 rounded-2xl border border-white/5 bg-gradient-to-br ${product.color} backdrop-blur-md hover:border-white/15 transition-all duration-300 shadow-[inset_0_2px_8px_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.3)]`}
                >
                  {/* Satin shine */}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-transparent via-white/5 to-white/10 opacity-0 group-hover:opacity-40 transition-opacity duration-500 pointer-events-none" />

                  <div className="relative z-10 flex items-start gap-4">
                    <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-lg ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                      <CheckCircle2 className={`w-4 h-4 ${accent.text}`} />
                    </div>
                    <span className="text-slate-200 text-sm font-medium leading-relaxed">
                      {feature}
                    </span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ========== CTA SECTION ========== */}
        <section className="relative py-24 md:py-32 w-full bg-[#0A0A0B]">
          <div className="container mx-auto px-6 max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.8 }}
              className="text-center"
            >
              <div className={`mx-auto mb-10 w-16 h-16 rounded-2xl ${accent.bg} border ${accent.border} flex items-center justify-center`}>
                <img src={product.icon} alt="" className="w-9 h-9 object-contain opacity-80" />
              </div>

              <h2 className="font-serif text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                Ready to get started?
              </h2>
              <p className="text-slate-400 text-lg mb-10 max-w-lg mx-auto leading-relaxed">
                Let us show you how <span className="text-white font-medium">{product.title}</span> can transform your workflow. Reach out for a personalized demo.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-semibold tracking-wide hover:from-fuchsia-500 hover:to-indigo-500 transition-all shadow-[0_0_30px_-5px_rgba(192,38,211,0.4)] hover:shadow-[0_0_40px_-5px_rgba(192,38,211,0.6)]"
                >
                  Contact Us
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white/5 border border-white/10 text-white font-semibold tracking-wide hover:bg-white/10 hover:border-white/20 transition-all"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Home
                </Link>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <div className="relative z-50 border-t border-white/10 bg-black/90 pt-8 backdrop-blur-md">
          <Footer />
        </div>
      </main>
    </div>
  );
}
