'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, Play, ArrowRight, Shield, Lock, Sparkles, Zap, Clock, Users, BarChart3, Globe, Headphones, Star, TrendingUp, RefreshCw } from 'lucide-react';
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
  highlights: { icon: string; label: string; value: string }[];
  useCases: string[];
  color: string;
  accentColor: string;
  icon: string;
  price: string;
  monthlyPrice: number;
  hasCheckout: boolean;
}

const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap, Clock, Users, BarChart3, Globe, Headphones, Star, TrendingUp, RefreshCw, Sparkles,
};

const products: Product[] = [
  {
    slug: 'email-tools',
    num: '01',
    title: 'Email Tools',
    desc: 'Automated outreach, drip campaigns, and smart email sequencing.',
    longDesc: 'SOL Theory\'s Email Tools empower your team with intelligent email automation. Build custom drip campaigns, schedule automated outreach sequences, and track engagement metrics — all from a unified dashboard. Our AI-powered system optimizes send times, personalizes content at scale, and provides real-time analytics so you can maximize every email\'s ROI.',
    features: ['Smart drip campaign builder', 'AI-optimized send scheduling', 'Engagement tracking & analytics', 'Template library with personalization', 'A/B testing built-in', 'CRM integration'],
    highlights: [
      { icon: 'Zap', label: 'Avg. Open Rate', value: '38%' },
      { icon: 'Clock', label: 'Setup Time', value: '< 5 min' },
      { icon: 'TrendingUp', label: 'ROI Increase', value: '2.4×' },
    ],
    useCases: ['Nonprofit donor outreach', 'Client follow-up sequences', 'Event invitation campaigns'],
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
    longDesc: 'Reach your audience instantly with SOL Theory\'s SMS platform. Send targeted text campaigns, automate two-way conversations, and schedule messages for optimal engagement. Perfect for appointment reminders, event notifications, and real-time customer communication with full compliance management built in.',
    features: ['Two-way conversational messaging', 'Scheduled & triggered sends', 'Contact segmentation', 'Automated response flows', 'Delivery & read receipts', 'Compliance management'],
    highlights: [
      { icon: 'Zap', label: 'Delivery Speed', value: '< 3 sec' },
      { icon: 'Users', label: 'Reach Rate', value: '98%' },
      { icon: 'RefreshCw', label: 'Auto-replies', value: '24/7' },
    ],
    useCases: ['Appointment reminders', 'Event notifications', 'Customer support follow-ups'],
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
    longDesc: 'Unify your workflow with deep Google Workspace integrations. Automatically sync data between your apps and Google Sheets, generate reports in Docs, manage team schedules through Calendar, and organize files in Drive — eliminating manual data entry and keeping your entire organization in sync across every platform.',
    features: ['Google Sheets auto-sync', 'Document generation', 'Calendar integration', 'Drive file management', 'Real-time data pipeline', 'Cross-platform automation'],
    highlights: [
      { icon: 'Clock', label: 'Hours Saved', value: '12+/wk' },
      { icon: 'Globe', label: 'Platforms', value: '6+' },
      { icon: 'BarChart3', label: 'Accuracy', value: '99.9%' },
    ],
    useCases: ['Automated reporting', 'Team schedule coordination', 'Document workflow pipelines'],
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
    longDesc: 'The NXT Dashboard gives your organization a command center for everything that matters. Track KPIs in real-time, visualize performance trends, monitor team productivity, and generate executive-ready reports — all in a beautifully designed, customizable interface that adapts to how your team works.',
    features: ['Real-time KPI tracking', 'Customizable widget layout', 'Team performance metrics', 'Automated report generation', 'Data export & sharing', 'Multi-organization support'],
    highlights: [
      { icon: 'BarChart3', label: 'Data Points', value: '50K+' },
      { icon: 'Users', label: 'Team Size', value: 'Unlimited' },
      { icon: 'Sparkles', label: 'AI Insights', value: 'Included' },
    ],
    useCases: ['Executive performance reviews', 'Grant outcome tracking', 'Cross-team productivity'],
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
    longDesc: 'Every organization is different. Our team designs and builds bespoke information systems that fit your exact needs — from custom databases and workflow automation to specialized reporting and full integration architecture. We handle the complexity so you can focus on impact.',
    features: ['Custom database design', 'Workflow automation', 'API & integration development', 'Dedicated project manager', 'Ongoing support & iteration', 'Scalable architecture'],
    highlights: [
      { icon: 'Headphones', label: 'Support', value: 'Dedicated' },
      { icon: 'Star', label: 'Satisfaction', value: '100%' },
      { icon: 'TrendingUp', label: 'Scalability', value: '∞' },
    ],
    useCases: ['Custom CRM systems', 'Internal workflow tools', 'Data pipeline architecture'],
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
        <div className="max-w-7xl w-full mx-auto px-6 py-2.5 shrink-0">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm font-medium group">
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Products
          </Link>
        </div>

        {/* Main Content — fits in one screen */}
        <div className="flex-1 max-w-7xl w-full mx-auto px-6 flex flex-col lg:flex-row gap-5 pb-4 min-h-0">

          {/* Left Column — Video + Details (60%) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="flex-[3] flex flex-col gap-4 min-h-0"
          >
            {/* Video Container */}
            <div className="flex-[5] min-h-0 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm overflow-hidden relative flex items-center justify-center group cursor-pointer">
              <div className={`absolute inset-0 bg-gradient-to-br ${product.color} opacity-40`} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {product.icon && (
                <img src={product.icon} alt="" className="absolute inset-0 w-1/3 h-1/3 object-contain opacity-[0.08] m-auto" />
              )}
              
              <div className="relative z-10 flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500">
                <div className="w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center backdrop-blur-md bg-white/5 group-hover:bg-fuchsia-500/20 group-hover:border-fuchsia-400/50 transition-all duration-500">
                  <Play className="w-8 h-8 text-white ml-1" />
                </div>
                <p className="text-sm text-slate-400 tracking-widest uppercase font-medium group-hover:text-white transition-colors text-center">
                  Watch Product Demo
                </p>
              </div>
            </div>

            {/* Bottom Row: Description + Highlights side by side */}
            <div className="flex-[3] min-h-0 flex gap-4">
              {/* Description + Use Cases */}
              <div className="flex-[3] rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-5 flex flex-col justify-between overflow-y-auto">
                <div>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">About This Product</p>
                  <p className="text-slate-300 text-sm leading-relaxed">{product.longDesc}</p>
                </div>
                
                {/* Use Cases */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Perfect For</p>
                  <div className="space-y-1.5">
                    {product.useCases.map((uc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} />
                        <span className="text-xs text-slate-400">{uc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Stats / Highlights */}
              <div className="flex-[2] rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm p-5 flex flex-col justify-between overflow-y-auto">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">Key Metrics</p>
                <div className="flex-1 flex flex-col gap-3 justify-center">
                  {product.highlights.map((h, i) => {
                    const IconComp = iconComponents[h.icon] || Zap;
                    return (
                      <div key={i} className={`rounded-xl border ${accent.border} ${accent.bg} p-3 flex items-center gap-3`}>
                        <div className={`w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center`}>
                          <IconComp className={`w-4 h-4 ${accent.check}`} />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-white leading-tight">{h.value}</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-wider">{h.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Micro note */}
                <p className="text-[9px] text-slate-600 text-center mt-3 italic">Based on average platform data</p>
              </div>
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
              <div className="p-5 border-b border-white/5 shrink-0">
                <div className="flex items-start gap-4">
                  {product.icon && (
                    <div className={`w-14 h-14 rounded-xl ${accent.bg} border ${accent.border} flex items-center justify-center shrink-0`}>
                      <img src={product.icon} alt="" className="w-9 h-9 object-contain" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${accent.text} mb-1`}>{product.num} — Product</p>
                    <h1 className="text-xl font-bold text-white tracking-tight">{product.title}</h1>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{product.desc}</p>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="px-5 py-3.5 border-b border-white/5 shrink-0">
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
              <div className="flex-1 px-5 py-4 min-h-0 overflow-y-auto">
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

                {/* Bonus Info */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Also Included</p>
                  <div className="flex flex-wrap gap-2">
                    {['Priority Support', '99.9% Uptime', 'Free Updates', 'API Access'].map((tag, i) => (
                      <span key={i} className="text-[10px] font-medium text-slate-400 px-2.5 py-1 rounded-full border border-white/10 bg-white/[0.03]">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Testimonial micro-block */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Star className="w-3 h-3 text-white" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 italic leading-relaxed">&ldquo;This tool has completely transformed how our team operates. Setup was effortless.&rdquo;</p>
                      <p className="text-[10px] text-slate-500 mt-1 font-medium">— SOL Theory Beta User</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA + Trust */}
              <div className="p-5 border-t border-white/5 space-y-3 shrink-0">
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
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <RefreshCw className="w-3 h-3" />
                    <span>Free Trial</span>
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
