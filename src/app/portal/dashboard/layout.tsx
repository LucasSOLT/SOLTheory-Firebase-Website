"use client";

import React, { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { Search, Bell, MessageSquare, ChevronDown, ChevronRight, Hash, UserSquare, Ticket, LogOut, FileText, Presentation, Table, Settings, Video, Youtube, Megaphone, MapPin, Globe, HardDrive, Sparkles, Activity, Lightbulb, ClipboardList, BookUser, Home, Users, HelpCircle, Instagram, Facebook, X, Bot, Mail, CalendarDays, ShieldCheck, Smartphone, MessageCircle, GraduationCap, BarChart3, Database, Factory } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { logDigestEntry } from "@/components/portal/DailyDigest";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const pathname = usePathname();
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const router = useRouter();
  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [latestNotifId, setLatestNotifId] = useState<string | null>(null);

  // Collapsible section states (persisted in localStorage)
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('sidebar_collapsed') || '{}'); } catch { return {}; }
  });
  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sidebar_collapsed', JSON.stringify(next));
      return next;
    });
  };

  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.03);
      masterGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
      // Pleasant 3-note ascending chime (C5, E5, G5)
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.08);
        osc.stop(ctx.currentTime + 1.2);
      });
    } catch (e) {}
  };

  // Detect which org the user is in based on the current path
  const dashboardHome = pathname.includes('/nxtchapter') ? '/portal/dashboard/nxtchapter' : '/portal/dashboard/soltheory';

  React.useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Track window resize for mobile detection
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile menu on navigation
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Track ALL navigation at the layout level for Recent Places
  useEffect(() => {
    if (!pathname) return;
    // Skip bare dashboard roots
    if (pathname === '/portal/dashboard/soltheory' || pathname === '/portal/dashboard/nxtchapter') return;

    const getNavInfo = (p: string): { icon: string; label: string } => {
      if (p.includes('/ai-agents/')) {
        const agentName = p.split('/ai-agents/')[1]?.split('/')[0] || 'Agent';
        return { icon: 'Bot', label: `AI Chat — ${agentName.charAt(0).toUpperCase() + agentName.slice(1)}` };
      }
      if (p.includes('/youtube')) return { icon: 'Youtube', label: 'YouTube Creator' };
      if (p.includes('/calendar')) return { icon: 'CalendarDays', label: 'Google Calendar' };
      if (p.includes('/docs')) return { icon: 'FileText', label: 'Google Docs' };
      if (p.includes('/slides')) return { icon: 'Presentation', label: 'Google Slides' };
      if (p.includes('/sheets')) return { icon: 'Table', label: 'Google Sheets' };
      if (p.includes('/drive')) return { icon: 'HardDrive', label: 'Google Drive' };
      if (p.includes('/analytics')) return { icon: 'BarChart3', label: 'Analytics' };
      if (p.includes('/settings')) return { icon: 'Settings', label: 'Settings' };
      if (p.includes('/communications/dm')) return { icon: 'MessageSquare', label: 'Direct Messages' };
      if (p.includes('/communications/org-thread')) return { icon: 'MessageSquare', label: 'Org Thread' };
      if (p.includes('/communications/contacts')) return { icon: 'MessageSquare', label: 'Contacts' };
      if (p.includes('/communications')) return { icon: 'MessageSquare', label: 'Messages' };
      if (p.includes('/faq')) return { icon: 'HelpCircle', label: 'FAQ' };
      if (p.includes('/surveys')) return { icon: 'FileText', label: 'Surveys' };
      if (p.includes('/support-tickets')) return { icon: 'Mail', label: 'Support Tickets' };
      if (p.includes('/google-ads')) return { icon: 'Globe', label: 'Google Ads' };
      return { icon: 'Globe', label: p.split('/').pop() || 'Page' };
    };

    const { icon, label } = getNavInfo(pathname);
    logDigestEntry({ type: 'navigation', label, icon, path: pathname });
  }, [pathname]);

  React.useEffect(() => {
    if (user?.uid) {
      const stored = localStorage.getItem(`read_notifications_${user.uid}`);
      if (stored) {
        try { setReadNotifIds(JSON.parse(stored)); } catch (e) {}
      }
    }
  }, [user?.uid]);

  React.useEffect(() => {
    if (isNotificationsOpen && notifications.length > 0) {
      const allIds = notifications.map(n => n.id);
      if (allIds.some(id => !readNotifIds.includes(id))) {
        const newReadIds = Array.from(new Set([...readNotifIds, ...allIds]));
        setReadNotifIds(newReadIds);
        if (user?.uid) {
          localStorage.setItem(`read_notifications_${user.uid}`, JSON.stringify(newReadIds));
        }
      }
    }
  }, [isNotificationsOpen, notifications, readNotifIds, user?.uid]);

  React.useEffect(() => {
    if (notifications.length > 0) {
      const topNotif = notifications[0];
      // Only play sound if this is a new top notification and it hasn't been read yet
      if (latestNotifId && topNotif.id !== latestNotifId && !readNotifIds.includes(topNotif.id)) {
        playNotificationSound();
      }
      setLatestNotifId(topNotif.id);
    }
  }, [notifications, latestNotifId, readNotifIds]);

  React.useEffect(() => {
    if (!firestore || !user?.email) return;

    const processTickets = (docs: any[], role: 'sender' | 'receiver') => {
      let newNotifs: any[] = [];
      docs.forEach(doc => {
        const data = doc.data();
        const updatedAt = data.updatedAt?.toMillis() || data.createdAt?.toMillis() || Date.now();
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        
        if (data.comments && data.comments.length > 0) {
          const lastComment = data.comments[data.comments.length - 1];
          if (lastComment.senderEmail !== user.email && (Date.now() - lastComment.createdAt < SEVEN_DAYS)) {
            newNotifs.push({
              id: `ticket-msg-${doc.id}-${lastComment.createdAt}`,
              title: 'New support ticket message',
              desc: `Reply on ticket: ${data.subject}`,
              time: lastComment.createdAt,
              icon: <MessageSquare className="w-4 h-4 text-fuchsia-600" />,
              bg: 'bg-fuchsia-100',
              link: `${dashboardHome}/support-tickets`
            });
          }
        }
        
        if (role === 'sender' && data.status !== 'Unanswered' && (Date.now() - updatedAt < SEVEN_DAYS)) {
          newNotifs.push({
            id: `ticket-status-${doc.id}-${data.status}`,
            title: 'Ticket status updated',
            desc: `${data.subject} is now ${data.status}`,
            time: updatedAt,
            icon: <Ticket className="w-4 h-4 text-blue-600" />,
            bg: 'bg-blue-100',
            link: `${dashboardHome}/support-tickets`
          });
        }
      });
      return newNotifs;
    };

    const unsubFrom = onSnapshot(query(collection(firestore, "support_tickets"), where("fromEmail", "==", user.email)), snap => {
      const notifs = processTickets(snap.docs, 'sender');
      setNotifications(prev => {
        const filtered = prev.filter(n => !n.id.startsWith('ticket-status-') && !n.id.startsWith('ticket-msg-'));
        return [...filtered, ...notifs].sort((a,b) => b.time - a.time);
      });
    });

    const unsubTo = onSnapshot(query(collection(firestore, "support_tickets"), where("toEmail", "==", user.email)), snap => {
      const notifs = processTickets(snap.docs, 'receiver');
      setNotifications(prev => {
        const existing = prev.filter(n => !notifs.find(nn => nn.id === n.id));
        return [...existing, ...notifs].sort((a,b) => b.time - a.time);
      });
    });

    return () => {
      unsubFrom();
      unsubTo();
    };
  }, [firestore, user?.email]);

  // Listen for new DMs and generate notifications
  React.useEffect(() => {
    if (!firestore || !user?.email) return;
    let unsub: (() => void) | undefined;
    try {
      const dmsRef = collection(firestore, "dms");
      const q = query(dmsRef, where("participants", "array-contains", user.email));
      unsub = onSnapshot(q, (snap) => {
        const dmNotifs: any[] = [];
        const ONE_DAY = 24 * 60 * 60 * 1000;
        snap.docs.forEach(d => {
          const data = d.data();
          const updatedAt = data.updatedAt?.toMillis?.() || 0;
          if (!updatedAt || Date.now() - updatedAt > ONE_DAY) return;
          // We don't have per-message sender info on the chat doc, so just track recent activity
          dmNotifs.push({
            id: `dm-${d.id}-${updatedAt}`,
            title: 'New message',
            desc: `Chat updated with ${data.participants?.filter((p: string) => p !== user.email).join(', ') || 'someone'}`,
            time: updatedAt,
            icon: <MessageSquare className="w-4 h-4 text-indigo-600" />,
            bg: 'bg-indigo-100',
            link: `${dashboardHome}/communications/dm`
          });
        });
        if (dmNotifs.length > 0) {
          setNotifications(prev => {
            const filtered = prev.filter(n => !n.id.startsWith('dm-'));
            return [...filtered, ...dmNotifs].sort((a, b) => b.time - a.time);
          });
        }
      }, (error) => {
        // Silently handle missing index or permissions errors  
        console.warn('DM notification listener error (non-fatal):', error.message);
      });
    } catch (e) {
      console.warn('DM notification listener setup failed (non-fatal):', e);
    }
    return () => unsub?.();
  }, [firestore, user?.email]);

  const renderSkeletonBoxes = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer mb-2">
        <div className="w-5 h-5 rounded-md bg-slate-200"></div>
        <div className="h-2.5 w-24 rounded-full bg-slate-200"></div>
      </div>
    ));
  };

  return (
    <div className="flex h-screen bg-[#faf9f6] overflow-hidden text-slate-900 font-sans">

      {/* ========== MOBILE TOP BAR ========== */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-[#faf9f6] border-b border-slate-200/80 flex items-center justify-between px-4 z-[60] shadow-sm">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 active:bg-slate-100 cursor-pointer"
          >
            {isMobileMenuOpen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <div className="flex flex-col gap-[4px] items-center justify-center">
                <span className="block h-[2px] w-4 bg-current rounded-full" />
                <span className="block h-[2px] w-3 bg-current rounded-full" />
                <span className="block h-[2px] w-4 bg-current rounded-full" />
              </div>
            )}
          </button>
          <Link href={dashboardHome} className="flex items-center gap-2">
            {pathname.includes('/nxtchapter') ? (
              <span className="font-bold text-lg text-slate-900 tracking-tight">NXT Chapter</span>
            ) : (
              <span className="font-bold text-lg text-slate-900 tracking-tight">SOL Theory</span>
            )}
          </Link>
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      )}

      {/* ========== MOBILE FULLSCREEN MENU OVERLAY ========== */}
      {isMobile && isMobileMenuOpen && (
        <div className="fixed inset-0 z-[55] bg-[#faf9f6] pt-14 overflow-y-auto">
          <aside className="w-full flex flex-col h-full">
            <div className="w-full flex flex-col h-full">
              <Link href={dashboardHome} className="p-6 pt-6 pb-6 flex flex-col items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
                {pathname.includes('/nxtchapter') ? (
                  <>
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-32 h-auto object-contain object-left" />
                    <span className="font-bold text-xl text-slate-900 tracking-tight">NXT Chapter</span>
                  </>
                ) : (
                  <>
                    <div className="bg-black p-2 rounded-2xl flex items-center justify-center">
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-12 h-12 object-contain" />
                    </div>
                    <span className="font-bold text-xl text-slate-900 tracking-tight">SOL Theory</span>
                  </>
                )}
              </Link>

              <div className="flex-grow overflow-y-auto px-4 space-y-4 pb-8">
                {/* Reuse the same nav items — these render the same sidebar links */}
                <div className="space-y-1">
                  <Link href={`${dashboardHome}`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname === dashboardHome ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <Home className="w-5 h-5" />
                    <span>Homepage</span>
                  </Link>
                  <Link href={`${dashboardHome}/ai-agents/jarvis`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/ai-agents') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <Users className="w-5 h-5" />
                    <span>Agent Manager</span>
                  </Link>
                  <Link href={`${dashboardHome}/faq`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/faq') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <HelpCircle className="w-5 h-5" />
                    <span>FAQ</span>
                  </Link>
                </div>

                {/* Flagship Tools */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Flagship Tools</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/crm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/crm') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Users className="w-5 h-5 text-slate-500" />
                      <span>CRM</span>
                    </Link>

                    <Link href="#" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-base">
                      <BarChart3 className="w-5 h-5 text-slate-500" />
                      <span>Business Intelligence</span>
                    </Link>
                    <Link href="#" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-semibold text-base">
                      <Database className="w-5 h-5 text-slate-500" />
                      <span>ERP</span>
                    </Link>
                  </div>
                </div>

                {/* Reports */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Reports</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/analytics`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/analytics') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Activity className="w-5 h-5" />
                      <span>Analytics</span>
                    </Link>
                    <Link href={`${dashboardHome}/support-tickets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/support-tickets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Ticket className="w-5 h-5" />
                      <span>Support Tickets</span>
                    </Link>
                    <Link href={`${dashboardHome}/surveys`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/surveys') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <ClipboardList className="w-5 h-5" />
                      <span>Surveys</span>
                    </Link>
                  </div>
                </div>

                {/* Communications */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Communications</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/communications/imessage`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/imessage') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <MessageCircle className="w-5 h-5" />
                      <span>iMessage</span>
                    </Link>
                    <Link href={`${dashboardHome}/communications/whatsapp`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/whatsapp') ? 'bg-emerald-50 text-emerald-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <MessageCircle className="w-5 h-5" />
                      <span>WhatsApp</span>
                    </Link>
                    <Link href={`${dashboardHome}/communications/dm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/dm') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <MessageSquare className="w-5 h-5" />
                      <span>Direct Messages</span>
                    </Link>
                  </div>
                </div>

                {/* Social Media */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Social Media</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/upload-calendar`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/upload-calendar') ? 'bg-emerald-50 text-emerald-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <CalendarDays className="w-5 h-5" />
                      <span>Upload Calendar</span>
                    </Link>
                    <Link href={`${dashboardHome}/youtube`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/youtube') ? 'bg-fuchsia-50 text-fuchsia-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Youtube className="w-5 h-5" />
                      <span>YouTube</span>
                    </Link>
                    <Link href={`${dashboardHome}/instagram`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/instagram') ? 'bg-rose-50 text-rose-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Instagram className="w-5 h-5" />
                      <span>Instagram</span>
                    </Link>
                    <Link href={`${dashboardHome}/facebook`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/facebook') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Facebook className="w-5 h-5" />
                      <span>Facebook</span>
                    </Link>
                  </div>
                </div>

                {/* Google Integrations */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Google Integrations</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/calendar`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/calendar') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <CalendarDays className="w-5 h-5" />
                      <span>Google Calendar</span>
                    </Link>
                    <Link href={`${dashboardHome}/docs`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/docs') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <FileText className="w-5 h-5" />
                      <span>Google Docs</span>
                    </Link>
                    <Link href={`${dashboardHome}/slides`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/slides') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Presentation className="w-5 h-5" />
                      <span>Google Slides</span>
                    </Link>
                    <Link href={`${dashboardHome}/sheets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/sheets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                      <Table className="w-5 h-5" />
                      <span>Google Sheets</span>
                    </Link>
                  </div>
                </div>

                {/* Settings */}
                <div className="pt-3 border-t border-slate-200">
                  <Link href={`${dashboardHome}/settings`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/settings') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}>
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* User info at bottom */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="h-10 w-10 ring-2 ring-slate-200">
                      <AvatarImage src={user?.photoURL || undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-sm">{user?.displayName?.[0] || user?.email?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{user?.displayName || 'User'}</span>
                      <span className="text-xs text-slate-500 truncate">{user?.email || ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ========== DESKTOP SIDEBAR (hidden on mobile) ========== */}
      <div className={`relative flex-col h-full flex-shrink-0 z-40 transition-all duration-300 ease-in-out group/sidebar overflow-visible hidden md:flex ${isSidebarCollapsed ? "w-0" : "w-64"}`}>
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className={`absolute top-1/2 -translate-y-1/2 w-10 h-10 bg-white border border-slate-200 shadow-md rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 z-50 transition-all duration-300 cursor-pointer ${isSidebarCollapsed ? 'left-3' : '-right-5'}`}
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <div className="flex flex-col gap-[4px] items-center justify-center">
            <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isSidebarCollapsed ? 'w-4' : 'w-4'}`} />
            <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isSidebarCollapsed ? 'w-3' : 'w-3'}`} />
            <span className={`block h-[2px] bg-current rounded-full transition-all duration-300 ${isSidebarCollapsed ? 'w-4' : 'w-4'}`} />
          </div>
        </button>

        <aside className="w-full bg-[#faf9f6] flex flex-col h-full relative shadow-[4px_0_24px_rgba(0,0,0,0.02)] overflow-x-hidden">
          <div className="w-64 flex flex-col h-full"> {/* Inner fixed width container */}
            <Link href={dashboardHome} className="p-6 pt-8 pb-8 flex flex-col items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer">
              {pathname.includes('/nxtchapter') ? (
                <>
                  <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-40 h-auto object-contain object-left" />
                  <span className="font-bold text-2xl text-slate-900 tracking-tight">NXT Chapter</span>
                </>
              ) : (
                <>
                  <div className="bg-black p-2 rounded-2xl flex items-center justify-center">
                    <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-16 h-16 object-contain" />
                  </div>
                  <span className="font-bold text-2xl text-slate-900 tracking-tight">SOL Theory</span>
                </>
              )}
            </Link>

        <div className="flex-grow overflow-y-auto px-4 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {/* Section 1 */}
          <div>
            <button onClick={() => toggleSection('menu')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['menu'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.menu}</span>
            </button>
            {!collapsedSections['menu'] && <div className="animate-in fade-in duration-150">
              <div className="space-y-1 mb-4 pt-1">
              <Link href={`${dashboardHome}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname === dashboardHome ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname === dashboardHome ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Homepage</span>
              </Link>
              <Link href={`${dashboardHome}/ai-agents/jarvis`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.includes('/ai-agents') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.includes('/ai-agents') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Agent Manager</span>
              </Link>
              <Link href={`${dashboardHome}/faq`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/faq') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/faq') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <HelpCircle className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">FAQ</span>
              </Link>
            </div>
            
            {/* @Messages Collapsible */}
            <div className="mt-2">
              <button 
                onClick={() => setIsMessagesOpen(!isMessagesOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors cursor-pointer mb-1 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-900 transition-colors">{t.messages}</span>
                </div>
                {isMessagesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              
              {isMessagesOpen && (
                <div className="pl-12 pr-3 py-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                  <Link href={`${dashboardHome}/communications/dm`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/dm') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <UserSquare className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/dm') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.dm}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/org-thread`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/org-thread') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <Hash className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/org-thread') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.orgThread}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/contacts`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/contacts') ? 'bg-indigo-50 text-indigo-900 font-semibold shadow-sm' : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'}`}>
                    <BookUser className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/contacts') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">Contacts</span>
                  </Link>
                </div>
              )}
            </div>
            </div>}
          </div>

          {/* Section: Flagship Tools */}
          <div className="mb-2">
            <button onClick={() => toggleSection('flagship')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['flagship'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.flagshipTools}</span>
            </button>
            {!collapsedSections['flagship'] && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <Link href={`${dashboardHome}/crm`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/crm') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/crm') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.crm}</span>
                </Link>

                <Link href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer font-semibold group">
                  <div className="w-6 h-6 rounded-md bg-transparent text-slate-500 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.bi}</span>
                </Link>
                <Link href="#" className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 hover:text-indigo-900 transition-colors cursor-pointer font-semibold group">
                  <div className="w-6 h-6 rounded-md bg-transparent text-slate-500 group-hover:text-indigo-600 flex items-center justify-center transition-colors">
                    <Database className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.erp}</span>
                </Link>
              </div>
            )}
          </div>
          
          {/* Section 2 */}
          <div className="mb-2">
            <button onClick={() => toggleSection('reports')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['reports'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.reports}</span>
            </button>
            {!collapsedSections['reports'] &&
            <div className="space-y-1 animate-in fade-in duration-150">
              <Link href={`${dashboardHome}/analytics`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/analytics') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/analytics') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Activity className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Analytics</span>
              </Link>
              <Link href={`${dashboardHome}/support-tickets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/support-tickets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/support-tickets') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <Ticket className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Submit a support ticket</span>
              </Link>

              <Link href={`${dashboardHome}/surveys`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/surveys') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/surveys') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                  <ClipboardList className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Surveys</span>
              </Link>
            </div>}
          </div>

          {/* Communications */}
          <div className="mb-2">
            <button onClick={() => toggleSection('comms')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['comms'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">Communications</span>
            </button>
            {!collapsedSections['comms'] && <div className="space-y-1 animate-in fade-in duration-150">
              <Link href={`${dashboardHome}/communications/imessage`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/communications/imessage') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-blue-900'}`}>
                <MessageCircle className="w-4 h-4 ml-1" />
                <span className="text-sm">iMessage</span>
              </Link>
              <Link href={`${dashboardHome}/communications/whatsapp`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/communications/whatsapp') ? 'bg-emerald-50 text-emerald-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-emerald-900'}`}>
                <MessageCircle className="w-4 h-4 ml-1" />
                <span className="text-sm">WhatsApp</span>
              </Link>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Hash className="w-4 h-4 ml-1" />
                <span className="text-sm">Slack</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Smartphone className="w-4 h-4 ml-1" />
                <span className="text-sm">Android MSG</span>
              </div>
            </div>}
          </div>

          {/* Social Media Integrations */}
          <div className="mb-2">
            <button onClick={() => toggleSection('social')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['social'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.socialMediaIntegrations}</span>
            </button>
            {!collapsedSections['social'] && <div className="space-y-1 animate-in fade-in duration-150">
              <Link href={`${dashboardHome}/upload-calendar`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/upload-calendar') ? 'bg-emerald-50 text-emerald-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-emerald-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/upload-calendar') ? 'bg-emerald-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-emerald-600'}`}>
                  <CalendarDays className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Upload Calendar</span>
              </Link>
              <Link href={`${dashboardHome}/youtube`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/youtube') ? 'bg-fuchsia-50 text-fuchsia-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-fuchsia-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/youtube') ? 'bg-fuchsia-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-fuchsia-600'}`}>
                  <Youtube className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">YouTube</span>
              </Link>
              <Link href={`${dashboardHome}/instagram`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/instagram') ? 'bg-rose-50 text-rose-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-rose-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/instagram') ? 'bg-rose-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-rose-600'}`}>
                  <Instagram className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Instagram</span>
              </Link>
              <Link href={`${dashboardHome}/facebook`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/facebook') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-blue-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/facebook') ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-blue-600'}`}>
                  <Facebook className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Facebook</span>
              </Link>
            </div>}
          </div>

          {/* Section 3 - Google Integrations */}
          <div>
            <button onClick={() => toggleSection('google')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['google'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.googleIntegrations}</span>
            </button>
            {!collapsedSections['google'] && <div className="space-y-1 animate-in fade-in duration-150">
            
            <Link href={`${dashboardHome}/calendar`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/calendar') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
              <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/calendar') ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>
              </div>
              <span className="text-sm">{t.googleCalendar}</span>
            </Link>

           <div className="space-y-1 mb-2">
             <Link href={`${dashboardHome}/docs`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/docs') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <FileText className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleDocs}</span>
             </Link>
             <Link href={`${dashboardHome}/slides`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/slides') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <Presentation className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleSlides}</span>
             </Link>
             <Link href={`${dashboardHome}/sheets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/sheets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <Table className="w-4 h-4 ml-1 text-slate-500" />
               <span className="text-sm font-medium">{t.googleSheets}</span>
             </Link>

             {/* Disabled Integrations */}
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Video className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Meet</span>
             </div>
             <Link href={`${dashboardHome}/google-ads`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/google-ads') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
               <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/google-ads') ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-indigo-600'}`}>
                 <Megaphone className="w-4 h-4 ml-1" />
               </div>
               <span className="text-sm">Google Ads</span>
             </Link>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <MapPin className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Maps</span>
             </div>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Globe className="w-4 h-4 ml-1" />
               <span className="text-sm">Google Earth</span>
             </div>
              <Link href={`${dashboardHome}/drive`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/drive') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-slate-50 text-slate-700 hover:text-indigo-900'}`}>
                <HardDrive className="w-4 h-4 ml-1 text-slate-500" />
                <span className="text-sm font-medium">Google Drive</span>
              </Link>
             <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
               <Sparkles className="w-4 h-4 ml-1" />
               <span className="text-sm">Gemini AI</span>
             </div>
           </div>
            </div>}
          </div>

          {/* Microsoft Suite */}
          <div className="mb-2">
            <button onClick={() => toggleSection('microsoft')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-slate-100 transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['microsoft'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">Microsoft Suite</span>
            </button>
            {!collapsedSections['microsoft'] && <div className="space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Mail className="w-4 h-4 ml-1" />
                <span className="text-sm">Outlook</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <FileText className="w-4 h-4 ml-1" />
                <span className="text-sm">Word</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Table className="w-4 h-4 ml-1" />
                <span className="text-sm">Excel</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Presentation className="w-4 h-4 ml-1" />
                <span className="text-sm">PowerPoint</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <Users className="w-4 h-4 ml-1" />
                <span className="text-sm">Teams</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-400 cursor-not-allowed mb-1">
                <HardDrive className="w-4 h-4 ml-1" />
                <span className="text-sm">OneDrive</span>
              </div>
            </div>}
          </div>
        </div>

        {/* User Footer Profile */}
        <div className="p-4 mt-auto mb-4 flex items-center gap-2">
          <Link href={`${dashboardHome}/settings?tab=general`} className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors shrink-0 text-slate-400 hover:text-slate-900 bg-white border border-slate-100 shadow-sm">
             <Settings className="w-5 h-5" />
          </Link>
          <Link href={`${dashboardHome}/settings?tab=profile`} className="flex-1 flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden hover:bg-slate-50 transition-colors cursor-pointer group">
            <Avatar className="h-8 w-8 shrink-0 group-hover:scale-105 transition-transform">
              <AvatarImage src={user?.photoURL || ""} />
              <AvatarFallback className="bg-slate-100 font-bold text-sm text-slate-600">{user?.displayName?.charAt(0) || "U"}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate text-slate-900 group-hover:text-indigo-600 transition-colors">{user?.displayName || "User"}</span>
              <span className="text-[10px] text-slate-500 truncate">{user?.email || ""}</span>
            </div>
          </Link>
        </div>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden w-full relative z-10 min-h-0 ${isMobile ? 'pt-14' : ''}`}>
        {/* Top Navbar — hidden on mobile */}
        <header className="h-[88px] items-center justify-between px-4 md:px-10 shrink-0 hidden md:flex">
          <div className="flex-grow max-w-[480px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t.searchPlaceholder}
              className="pl-12 bg-white border border-slate-100 shadow-sm focus-visible:ring-1 focus-visible:ring-slate-200 rounded-full h-12 w-full text-sm font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-rose-500/90 hover:bg-rose-600 text-white text-sm font-semibold rounded-full transition-colors shadow-sm">
                <LogOut className="h-3.5 w-3.5" />
                {t.exitDashboard}
              </Link>
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-white transition-colors bg-white shadow-sm border border-slate-100 rounded-full flex items-center justify-center relative">
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {/* Notifications Popup */}
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-[380px] bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800">Notifications</h3>
                          {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
                            <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.filter(n => !readNotifIds.includes(n.id)).length} New</span>
                          )}
                        </div>
                        <button onClick={() => setIsNotificationsOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 hover:text-slate-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-[400px] overflow-y-auto">
                        <div className="px-4 py-2">
                          {notifications.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm font-medium">No new notifications</div>
                          ) : (
                            notifications.slice(0, 10).map(n => {
                              const isUnread = !readNotifIds.includes(n.id);
                              return (
                              <div 
                                key={n.id} 
                                onClick={() => {
                                  setIsNotificationsOpen(false);
                                  if (n.link) router.push(n.link);
                                }}
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors mb-1.5 cursor-pointer border border-transparent hover:border-slate-100"
                              >
                                <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                  {n.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-800">{n.title}</p>
                                  <p className="text-[11px] text-slate-500 mt-0.5">{n.desc}</p>
                                  <p className="text-[10px] text-indigo-500 font-medium mt-1">
                                    {new Date(n.time).toLocaleString()}
                                  </p>
                                </div>
                                {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2"></div>}
                              </div>
                            )})
                          )}
                        </div>
                      </div>

                      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50">
                        <button className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors py-1">
                          View All Notifications
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
             <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <div className="flex flex-col items-end justify-center cursor-pointer select-none">
                <span className="text-2xl font-black text-slate-800 leading-none tracking-tight" style={{ fontFamily: "'Sofia Soft Pro', 'Sofia Pro', sans-serif" }}>SOL</span>
                <span className="text-[11px] font-bold text-slate-500 leading-none tracking-[0.2em] mt-0.5" style={{ fontFamily: "'Sofia Soft Pro', 'Sofia Pro', sans-serif" }}>INSiGHT</span>
             </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-hidden px-4 pb-4 md:px-10 md:pb-10 flex flex-col relative w-full min-h-0 focus:outline-none" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
