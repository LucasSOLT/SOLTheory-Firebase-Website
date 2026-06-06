'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Play, ArrowRight, Shield, Lock, Sparkles } from 'lucide-react';
import { StarBackground } from '@/components/ui/star-background';
import { Header } from '@/components/sections/header';
import { motion } from 'framer-motion';

interface Product {
  slug: string;
  num: string;
  title: string;
  desc: string;
  longDesc: string;
  features: string[];
  color: string;
  accentColor: string;
  icon: string;
  price: string;
  monthlyPrice: number;
  hasCheckout: boolean;
}

const products: Product[] = [
  {
    slug: 'email-tools',
    num: '01',
    title: 'Email Tools',
    desc: 'Automated outreach, drip campaigns, and smart email sequencing.',
    longDesc: 'SOL Theory\'s Email Tools empower your team with intelligent email automation. Build custom drip campaigns, schedule automated outreach sequences, and track engagement metrics — all from a unified dashboard.',
    features: ['Smart drip campaigns', 'AI-optimized scheduling', 'Engagement analytics', 'Template library', 'A/B testing', 'CRM integration'],
    color: 'from-[#3b0764]/40 via-[#4c0519]/40 to-[#2e1065]/40',
    accentColor: 'fuchsia',
    icon: '/images/icon-email.png',
    price: 'From $3/MO',
    monthlyPrice: 3,
    hasCheckout: true,
  },
  {
    slug: 'sms-tools',
    num: '02',
    title: 'SMS Tools',
    desc: 'Instant text messaging, scheduling, and conversational automation.',
    longDesc: 'Reach your audience instantly with SOL Theory\'s SMS platform. Send targeted text campaigns, automate two-way conversations, and schedule messages for optimal engagement.',
    features: ['Two-way messaging', 'Scheduled sends', 'Contact segmentation', 'Auto-responses', 'Delivery receipts', 'Compliance tools'],
    color: 'from-[#4c0519]/40 via-[#701a75]/40 to-[#470024]/40',
    accentColor: 'rose',
    icon: '/images/icon-sms.png',
    price: 'From $4/MO',
    monthlyPrice: 4,
    hasCheckout: true,
  },
  {
    slug: 'google-suite-integrations',
    num: '03',
    title: 'Google Suite Integrations',
    desc: 'Seamless connections to Sheets, Docs, Calendar, and Drive.',
    longDesc: 'Unify your workflow with deep Google Workspace integrations. Automatically sync data, generate reports, manage schedules, and organize files — eliminating manual data entry.',
    features: ['Sheets auto-sync', 'Doc generation', 'Calendar sync', 'Drive management', 'Real-time pipeline', 'Cross-platform'],
    color: 'from-[#2e1065]/40 via-[#4c0519]/40 to-[#1e1b4b]/40',
    accentColor: 'violet',
    icon: '/images/icon-google.png',
    price: 'From $6/MO',
    monthlyPrice: 6,
    hasCheckout: true,
  },
  {
    slug: 'nxt-dashboard',
    num: '04',
    title: 'NXT Dashboard',
    desc: 'Real-time analytics, KPI tracking, and performance insights.',
    longDesc: 'The NXT Dashboard gives your organization a command center for everything that matters. Track KPIs, visualize performance trends, and generate executive-ready reports.',
    features: ['Real-time KPIs', 'Custom widgets', 'Team metrics', 'Auto-reports', 'Data export', 'Multi-org support'],
    color: 'from-[#3b0764]/40 via-[#881337]/40 to-[#311042]/40',
    accentColor: 'pink',
    icon: '/images/icon-dashboard.png',
    price: 'From $16/MO',
    monthlyPrice: 16,
    hasCheckout: true,
  },
  {
    slug: 'customized-is-solutions',
    num: '05',
    title: 'Customized I.S. Solutions',
    desc: 'Tailored information systems built for your unique workflow.',
    longDesc: 'Every organization is different. Our team designs and builds bespoke information systems that fit your exact needs — from custom databases and workflow automation to specialized reporting.',
    features: ['Custom databases', 'Workflow automation', 'API development', 'Project manager', 'Ongoing support', 'Scalable architecture'],
    color: 'from-[#470024]/40 via-[#3b0764]/40 to-[#2e1065]/40',
    accentColor: 'indigo',
    icon: '/images/icon-gears.png',
    price: 'Subject to Scale',
    monthlyPrice: 0,
    hasCheckout: false,
  },
];

const accentMap: Record<string, { dot: string; check: string; border: string; bg: string; text: string; glow: string }> = {
  fuchsia: { dot: 'bg-fuchsia-500', check: 'text-fuchsia-400', border: 'border-fuchsia-500/30', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-300', glow: 'shadow-fuchsia-500/20' },
  rose: { dot: 'bg-rose-500', check: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10', text: 'text-rose-300', glow: 'shadow-rose-500/20' },
  violet: { dot: 'bg-violet-500', check: 'text-violet-400', border: 'border-violet-500/30', bg: 'bg-violet-500/10', text: 'text-violet-300', glow: 'shadow-violet-500/20' },
  pink: { dot: 'bg-pink-500', check: 'text-pink-400', border: 'border-pink-500/30', bg: 'bg-pink-500/10', text: 'text-pink-300', glow: 'shadow-pink-500/20' },
  indigo: { dot: 'bg-indigo-500', check: 'text-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10', text: 'text-indigo-300', glow: 'shadow-indigo-500/20' },
};

export default function ProductPage() {
  const params = useParams();
  const slug = params.slug as string;
  const product = products.find(p => p.slug === slug);

  if (!product) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] flex items-center justify-center text-white relative">
        <div className="fixed inset-0 z-0"><StarBackground /></div>
        <div className="relative z-10 text-center space-y-4">
          <h1 className="text-4xl font-bold">Product Not Found</h1>
          <p className="text-slate-400">The product you&apos;re looking for doesn&apos;t exist.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const accent = accentMap[product.accentColor] || accentMap.fuchsia;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-hidden">
      <div className="fixed inset-0 z-0"><StarBackground /></div>
      <div className="absolute top-0 w-full z-50 fixed"><Header /></div>

      <main className="relative z-10 h-screen flex flex-col pt-16">
        {/* Back nav */}
        <div className="max-w-7xl w-full mx-auto px-6 py-3 shrink-0">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Products
          </Link>
        </div>

        {/* Main Content — fits in one screen */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-6 flex flex-col lg:flex-row gap-6 pb-6 min-h-0">

          {/* Left Column — Video + Description (60%) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex-[3] flex flex-col gap-4 min-h-0"
          >
            {/* Video Container */}
            <div className="flex-[3] min-h-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden relative flex items-center justify-center group cursor-pointer">
              <div className={`absolute inset-0 bg-gradient-to-br ${product.color} opacity-40`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {/* Product icon faintly in background */}
              {product.icon && (
                <img src={product.icon} alt="" className="absolute inset-0 w-1/3 h-1/3 object-contain opacity-[0.08] m-auto" />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500">
                <div className={`w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center backdrop-blur-md bg-white/5 group-hover:${accent.bg} group-hover:border-current ${accent.text} transition-all duration-500`}>
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                <p className="text-sm text-slate-400 tracking-widest uppercase font-medium group-hover:text-white transition-colors text-center">
                  Watch Product Demo
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="flex-[1] min-h-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-5 flex flex-col justify-center overflow-y-auto">
              <p className="text-slate-300 text-sm leading-relaxed">{product.longDesc}</p>
            </div>
          </motion.div>

          {/* Right Column — Product Details + Checkout (40%) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
            className="flex-[2] flex flex-col min-h-0"
          >
            <div className="flex-1 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden flex flex-col">
              {/* Product Header */}
              <div className="p-6 border-b border-white/5 shrink-0">
                <div className="flex items-start gap-4">
                  {product.icon && (
                    <div className={`w-14 h-14 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}>
                      <img src={product.icon} alt="" className="w-9 h-9 object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accent.text} mb-1`}>{product.num} — {product.accentColor}</p>
                    <h1 className="text-xl font-bold text-white tracking-tight">{product.title}</h1>
                    <p className="text-xs text-slate-400 mt-1">{product.desc}</p>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="px-6 py-4 border-b border-white/5 shrink-0">
                {product.hasCheckout ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-white">${product.monthlyPrice}</span>
                    <span className="text-slate-500 text-sm">/month</span>
                    <span className={`ml-auto text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${accent.bg} ${accent.text} border ${accent.border}`}>
                      <Sparkles className="w-3 h-3 inline mr-1" />Subscription
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold text-white">Custom Pricing</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/30">
                      Subject to Scale
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              <div className="flex-1 px-6 py-4 min-h-0 overflow-y-auto">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">What&apos;s Included</p>
                <div className="grid grid-cols-1 gap-2">
                  {product.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2.5">
                      <div className={`w-5 h-5 rounded-md ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}>
                        <Check className={`w-3 h-3 ${accent.check}`} />
                      </div>
                      <span className="text-sm text-slate-300">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA + Trust */}
              <div className="p-6 border-t border-white/5 space-y-3 shrink-0">
                {product.hasCheckout ? (
                  <Link
                    href={`/checkout/${product.slug === 'email-tools' ? '1' : product.slug === 'sms-tools' ? '1' : product.slug === 'google-suite-integrations' ? '2' : '3'}`}
                    className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-semibold text-sm hover:from-fuchsia-500 hover:to-indigo-500 transition-all duration-300 shadow-lg ${accent.glow} hover:-translate-y-0.5 active:translate-y-0`}
                  >
                    Get Started — ${product.monthlyPrice}/mo
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                ) : (
                  <Link
                    href="/contact"
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white font-semibold text-sm hover:from-fuchsia-500 hover:to-indigo-500 transition-all duration-300 shadow-lg shadow-fuchsia-500/20 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Contact Us for a Quote
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                )}

                {/* Trust Badges */}
                <div className="flex items-center justify-center gap-5 pt-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Shield className="w-3 h-3" />
                    <span>SSL Encrypted</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <Lock className="w-3 h-3" />
                    <span>Cancel Anytime</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </main>
    </div>
  );
}
