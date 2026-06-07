"use client";

import { Logo } from '@/components/logo';
import Link from 'next/link';
import { SolTheoryLogoText } from '../sol-theory-logo-text';
import { Button } from '@/components/ui/button';
import { Menu, HelpCircle, ChevronDown, ChevronUp, AlertCircle, CheckCircle2, X, ArrowRight, ExternalLink, Mail, Sparkles, MessageSquare } from 'lucide-react';
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
            {/* Client Portal Button */}
            <Button asChild variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:border-white/40 font-semibold tracking-wide text-xs md:text-sm rounded-lg px-3 md:px-5">
                <Link href="/portal">
                    <span className="hidden md:inline">Client Portal</span>
                    <span className="md:hidden">Portal</span>
                </Link>
            </Button>

            {/* Menu Button */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMenuOpen(!menuOpen)}
                className="relative z-[60] w-9 h-9"
              >
                {menuOpen ? (
                  <X className="h-5 w-5 text-white" />
                ) : (
                  <Menu className="h-6 w-6 text-white" />
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
                      className="fixed inset-0 z-[51] bg-black/50"
                      onClick={() => setMenuOpen(false)}
                    />

                    {/* Dropdown */}
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-2 z-[52] w-[260px] rounded-lg border border-[#222] bg-[#111113] shadow-xl overflow-hidden"
                    >
                      {/* Platforms */}
                      <div className="px-1.5 pt-2 pb-1">
                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-2.5 mb-1">Platforms</p>
                        <Link
                          href="/portal/login/insight"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-fuchsia-400 shrink-0" />
                          <div>
                            <p className="text-[13px] font-medium text-white leading-none">INSiGHT</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Analytics & org tools</p>
                          </div>
                        </Link>
                        <Link
                          href="/portal/login/drive"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <div>
                            <p className="text-[13px] font-medium text-white leading-none">DRiVE</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Learning management</p>
                          </div>
                        </Link>
                      </div>

                      <div className="h-px bg-[#1e1e22] mx-3" />

                      {/* Community */}
                      <div className="px-1.5 py-1">
                        <p className="text-[9px] font-semibold text-slate-500 uppercase tracking-[0.15em] px-2.5 mb-1">Community</p>
                        <a
                          href="https://www.lifenavigation.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <div>
                            <p className="text-[13px] font-medium text-white leading-none">LifeNavigationU</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Life design tools</p>
                          </div>
                        </a>
                        <a
                          href="https://www.thrivecoaching.ai"
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <div>
                            <p className="text-[13px] font-medium text-white leading-none">Thrive Coaching</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">AI-powered coaching</p>
                          </div>
                        </a>
                      </div>

                      <div className="h-px bg-[#1e1e22] mx-3" />

                      {/* Links */}
                      <div className="px-1.5 py-1">
                        <Link
                          href="/sms-opt-in"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[13px] font-medium text-white leading-none">SMS Opt-in</p>
                        </Link>
                        <button
                          onClick={() => { setMenuOpen(false); setShowHelpModal(true); }}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors text-left cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[13px] font-medium text-white leading-none">Help & FAQ</p>
                        </button>
                        <Link
                          href="/contact"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-white/[0.04] transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <p className="text-[13px] font-medium text-white leading-none">Contact</p>
                        </Link>
                      </div>

                      {/* Footer */}
                      <div className="px-2 py-2 border-t border-[#1e1e22]">
                        <Link
                          href="/portal"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-white/[0.06] hover:bg-white/[0.10] text-white text-[13px] font-medium transition-colors"
                        >
                          Client Portal
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
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
