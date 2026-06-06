"use client";

import { Logo } from '@/components/logo';
import Link from 'next/link';
import { SolTheoryLogoText } from '../sol-theory-logo-text';
import { Button } from '@/components/ui/button';
import { Menu, HelpCircle, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, X, ArrowRight, ExternalLink, Mail, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { FAQ_LIST } from '@/components/portal/FAQView';
import { StarBackground } from '@/components/ui/star-background';
import { motion, AnimatePresence } from 'framer-motion';

const navLinks = [
  { href: '/', label: 'Home' },
  { href: '#qualifies', label: 'About' },
  { href: '/contact', label: 'Contact' },
];


import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  const isNxtChapter = pathname?.startsWith('/portal/dashboard/nxtchapter');
  
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
    <header className="fixed top-0 left-0 right-0 z-50 py-3 bg-black/50 backdrop-blur-xl border-b border-white/5">
      <div className="container mx-auto px-4 flex items-center justify-between relative">
        <Link href="/" className="flex items-center gap-2 group">
          {!isNxtChapter && <Logo className="h-6 w-6" />}
          {isNxtChapter ? (
            <span className="font-bold text-lg text-white">NXT Chapter</span>
          ) : (
            <SolTheoryLogoText />
          )}
        </Link>
        
        <nav className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ul className="flex items-center gap-8">
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link 
                  href={link.href} 
                  className="text-[15px] font-semibold tracking-wider text-slate-100 hover:text-fuchsia-400 transition-all duration-300 uppercase"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">

            {/* Professional Menu Panel */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(!menuOpen)}
                className="relative z-[60]"
              >
                {menuOpen ? (
                  <X className="h-6 w-6 text-white" />
                ) : (
                  <Menu className="h-8 w-8 text-white" />
                )}
                <span className="sr-only">Open menu</span>
              </Button>

              <AnimatePresence>
                {menuOpen && (
                  <>
                    {/* Backdrop */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[51] bg-black/60 backdrop-blur-sm"
                      onClick={() => setMenuOpen(false)}
                    />

                    {/* Panel */}
                    <motion.div
                      initial={{ opacity: 0, y: -10, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -10, scale: 0.98 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-3 z-[52] w-[340px] md:w-[420px] rounded-2xl border border-white/10 bg-[#0f0f10]/95 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden"
                    >
                      {/* Header */}
                      <div className="px-5 pt-5 pb-3 border-b border-white/5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Navigation</p>
                      </div>

                      {/* Platforms Section */}
                      <div className="px-3 py-3">
                        <p className="text-[9px] font-bold text-fuchsia-400/80 uppercase tracking-[0.2em] px-2 mb-2">Platforms</p>
                        <Link
                          href="/portal/login/insight"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center shrink-0 group-hover:bg-fuchsia-500/20 transition-colors">
                            <Sparkles className="w-4 h-4 text-fuchsia-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">INSiGHT</p>
                            <p className="text-[11px] text-slate-400">Analytics dashboard & org tools</p>
                          </div>
                        </Link>
                        <Link
                          href="/portal/login/drive"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:bg-indigo-500/20 transition-colors">
                            <ArrowRight className="w-4 h-4 text-indigo-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">DRiVE</p>
                            <p className="text-[11px] text-slate-400">Learning management system</p>
                          </div>
                        </Link>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/5 mx-5" />

                      {/* Community */}
                      <div className="px-3 py-3">
                        <p className="text-[9px] font-bold text-indigo-400/80 uppercase tracking-[0.2em] px-2 mb-2">Community</p>
                        <a
                          href="https://www.lifenavigation.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                            <ExternalLink className="w-4 h-4 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">LifeNavigationU</p>
                            <p className="text-[11px] text-slate-400">Life design & navigation tools</p>
                          </div>
                        </a>
                        <a
                          href="https://www.thrivecoaching.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/20 transition-colors">
                            <ExternalLink className="w-4 h-4 text-amber-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Thrive Coaching</p>
                            <p className="text-[11px] text-slate-400">AI-powered personal coaching</p>
                          </div>
                        </a>
                      </div>

                      {/* Divider */}
                      <div className="h-px bg-white/5 mx-5" />

                      {/* Support */}
                      <div className="px-3 py-3">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.2em] px-2 mb-2">Support</p>
                        <button
                          onClick={() => { setMenuOpen(false); setShowHelpModal(true); }}
                          className="w-full flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left cursor-pointer"
                        >
                          <div className="w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shrink-0 group-hover:bg-slate-500/20 transition-colors">
                            <HelpCircle className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Help & FAQ</p>
                            <p className="text-[11px] text-slate-400">Common questions & troubleshooting</p>
                          </div>
                        </button>
                        <Link
                          href="/contact"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-3.5 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-slate-500/10 border border-slate-500/20 flex items-center justify-center shrink-0 group-hover:bg-slate-500/20 transition-colors">
                            <Mail className="w-4 h-4 text-slate-400" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">Contact</p>
                            <p className="text-[11px] text-slate-400">Get in touch with our team</p>
                          </div>
                        </Link>
                      </div>

                      {/* Footer */}
                      <div className="px-5 py-3 border-t border-white/5 bg-white/[0.02]">
                        <Link
                          href="/portal"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all shadow-lg shadow-fuchsia-500/20"
                        >
                          Client Portal
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            <Button asChild variant="outline" className="ml-2 border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 backdrop-blur-sm font-semibold tracking-wide text-xs md:text-sm rounded-xl px-3 md:px-5">
                <Link href="/portal">
                    <span className="hidden md:inline">Client Portal</span>
                    <span className="md:hidden">Portal</span>
                </Link>
            </Button>
        </div>
      </div>
    </header>

    {/* Dark Mode FAQ Modal */}
    {showHelpModal && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-hidden">
        <StarBackground />
        
        <div className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-[#0A0A0B]/90 border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-white/10 shrink-0">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
                Help & <span className="text-fuchsia-400">FAQ</span>
              </h1>
              <p className="text-slate-400 text-sm font-medium mt-1">
                Common troubleshooting solutions for the platform network.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 flex items-center justify-center hidden md:flex">
                <HelpCircle className="w-6 h-6 text-fuchsia-400" />
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowHelpModal(false)} className="text-slate-400 hover:text-white hover:bg-white/10">
                <X className="w-6 h-6" />
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
            <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden backdrop-blur-sm">
              <div className="p-4 border-b border-white/5 bg-white/5">
                <h2 className="text-sm font-black text-slate-300 uppercase tracking-widest flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" /> Top 10 Common Issues
                </h2>
              </div>
              
              <div className="divide-y divide-white/5">
                {FAQ_LIST.map((faq, index) => (
                  <div key={index} className="transition-colors hover:bg-white/5">
                    <button 
                      onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                      className="w-full flex items-center justify-between p-5 text-left focus:outline-none"
                    >
                      <span className="font-bold text-slate-200 text-sm pr-8">{faq.question}</span>
                      {openFaqIndex === index ? (
                        <ChevronUp className="w-5 h-5 text-fuchsia-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
                      )}
                    </button>
                    
                    {openFaqIndex === index && (
                      <div className="px-5 pb-5 animate-in slide-in-from-top-2 fade-in duration-200">
                        <div className="bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-xl p-4 flex items-start gap-4">
                          <CheckCircle2 className="w-5 h-5 text-fuchsia-400 mt-0.5 shrink-0" />
                          <p className="text-sm text-slate-300 leading-relaxed font-medium">
                            {faq.answer}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-8 pb-4 text-center">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Need more help? Email lucas@soltheory.com</p>
            </div>
          </div>

        </div>
      </div>
    )}
    </>
  );
}
