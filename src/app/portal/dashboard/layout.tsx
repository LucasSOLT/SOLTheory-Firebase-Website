"use client";

import React, { useState, useEffect, useRef } from "react";
import { useUser, useFirestore, useAuth } from "@/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { Search, Bell, MessageSquare, ChevronDown, ChevronRight, Hash, UserSquare, Ticket, LogOut, FileText, Presentation, Table, Settings, Video, Youtube, Megaphone, MapPin, Globe, HardDrive, Sparkles, Activity, Lightbulb, ClipboardList, BookUser, Home, Users, HelpCircle, Instagram, Facebook, X, Bot, Mail, CalendarDays, ShieldCheck, Smartphone, MessageCircle, GraduationCap, BarChart3, Database, Factory, LayoutDashboard, Check, AlertTriangle, Monitor, RefreshCw, Moon, Sun, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { logDigestEntry } from "@/components/portal/DailyDigest";
import { isAdmin } from "@/lib/admin";
import { useContentManagerStore } from "@/stores/content-manager-store";
import { WalkthroughPlayer } from "@/components/portal/WalkthroughPlayer";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { user } = useUser();
  const auth = useAuth();

  // Welcome Walkthrough States
  const [showWelcome, setShowWelcome] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(1);
  const [wtDisplayName, setWtDisplayName] = useState("");
  const [wtLanguage, setWtLanguage] = useState<"en" | "es">("en");
  const [wtTheme, setWtTheme] = useState<"light" | "dark">("light");
  const [wtLocation, setWtLocation] = useState("");
  const [isSavingWt, setIsSavingWt] = useState(false);

  const pathname = usePathname();
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const sidebarResizeRef = React.useRef(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<any[]>([]);
  const router = useRouter();

  const [isDarkMode, setIsDarkMode] = useState(false);

  // Dashboard-wide dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('insight_theme');
    if (savedTheme === 'dark') setIsDarkMode(true);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark');
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Listen for sidebar collapse/expand requests from child components (e.g. document editor)
  const sidebarBeforeEditorRef = React.useRef<{ collapsed: boolean; width: number } | null>(null);
  useEffect(() => {
    const handleCollapse = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.action === 'collapse') {
        sidebarBeforeEditorRef.current = { collapsed: isSidebarCollapsed, width: sidebarWidth };
        setIsSidebarCollapsed(true);
      } else if (detail?.action === 'restore' && sidebarBeforeEditorRef.current) {
        setIsSidebarCollapsed(sidebarBeforeEditorRef.current.collapsed);
        sidebarBeforeEditorRef.current = null;
      }
    };
    window.addEventListener('soltheory-sidebar-toggle', handleCollapse);
    return () => window.removeEventListener('soltheory-sidebar-toggle', handleCollapse);
  }, [isSidebarCollapsed, sidebarWidth]);

  const [readNotifIds, setReadNotifIds] = useState<string[]>([]);
  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('st_deleted_notifications') || '[]'); } catch { return []; }
  });
  const [latestNotifId, setLatestNotifId] = useState<string | null>(null);
  const [isOrgSwitcherOpen, setIsOrgSwitcherOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);
  const orgSwitcherMobileRef = useRef<HTMLDivElement>(null);

  const DUAL_ORG_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com'];
  const isDualOrgUser = DUAL_ORG_EMAILS.includes(user?.email || '');
  const isNxtChapter = pathname.includes('/nxtchapter');
  const userIsAdmin = isAdmin(user?.email);
  const contentManagerActive = useContentManagerStore((s) => s.active);
  const setContentManagerActive = useContentManagerStore((s) => s.setActive);

  // Welcome Walkthrough Language Dictionary
  const WT_LANG = {
    en: {
      welcomeTitle: "Welcome to INSiGHT",
      welcomeSubtitle: "We're glad that you are here. Before you get started, let's set things up for you!",
      next: "Next",
      back: "Back",
      finish: "Finish Setup & Enter Dashboard",
      saving: "Saving...",
      accountsTitle: "Connected Accounts",
      accountsDesc: "Sync Google (Calendar, Docs, Sheets, Drive), Slack, QuickBooks, and messaging channels (iMessage, SMS, WhatsApp).",
      prefTitle: "User Preferences",
      prefDesc: "Personalize how you appear to team members and AI agents, and customize visual settings.",
      homeTitle: "Home Screen Feed",
      homeDesc: "Design your workspace layout. (To modify display feeds, request access by messaging an admin).",
      langTitle: "Interface Language",
      langDesc: "All features and insights are natively available in English and Español.",
      step1Title: "A New Era of Business Operations",
      step1Tagline: "Connect. Automate. Scale.",
      step2Title: "Quick Preferences",
      step2Desc: "Configure your basic profile and display settings. You can always edit these in settings later.",
      displayName: "Display Name",
      location: "Location / Timezone",
      locationPlaceholder: "e.g. New York, NY (EST)",
      interfaceLanguage: "Interface Language",
      theme: "Interface Theme",
      light: "Light Mode",
      dark: "Dark Mode",
    },
    es: {
      welcomeTitle: "Bienvenido a INSiGHT",
      welcomeSubtitle: "Nos alegra que estés aquí. ¡Antes de comenzar, configuremos algunas cosas para ti!",
      next: "Siguiente",
      back: "Atrás",
      finish: "Finalizar Configuración e Ingresar",
      saving: "Guardando...",
      accountsTitle: "Cuentas Conectadas",
      accountsDesc: "Sincroniza Google (Calendar, Docs, Sheets, Drive), Slack, QuickBooks y canales de mensajería (iMessage, SMS, WhatsApp).",
      prefTitle: "Preferencias de Usuario",
      prefDesc: "Personaliza cómo te ves ante tus compañeros y agentes de IA, y configura ajustes visuales.",
      homeTitle: "Inicio Personalizado",
      homeDesc: "Diseña la distribución de tu panel. (Para modificar feeds, solicita acceso enviando un mensaje a un administrador).",
      langTitle: "Idioma de Interfaz",
      langDesc: "Todas las funciones y análisis están disponibles de forma nativa en inglés y español.",
      step1Title: "Una Nueva Era en Operaciones",
      step1Tagline: "Conectar. Automatizar. Escalar.",
      step2Title: "Preferencias Rápidas",
      step2Desc: "Configura tu perfil básico y ajustes de visualización. Siempre puedes editarlos en configuración más tarde.",
      displayName: "Nombre para Mostrar",
      location: "Ubicación / Zona Horaria",
      locationPlaceholder: "ej. Madrid, ES (CET)",
      interfaceLanguage: "Idioma de Interfaz",
      theme: "Tema de la Interfaz",
      light: "Modo Claro",
      dark: "Modo Oscuro",
    }
  };

  // Check if welcome walkthrough is completed
  useEffect(() => {
    if (!user?.uid || !firestore) return;

    const checkWalkthrough = async () => {
      // Check local storage first
      const isCompletedLocal = localStorage.getItem(`walkthrough_completed_${user.uid}`);
      if (isCompletedLocal === "true") {
        return;
      }

      try {
        const userRef = doc(firestore, "users", user.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.walkthroughCompleted) {
            localStorage.setItem(`walkthrough_completed_${user.uid}`, "true");
            return;
          }
          if (data.location) {
            setWtLocation(data.location);
          }
        }

        // If not completed, show welcome walkthrough
        setWtDisplayName(user.displayName || "");
        const savedLang = localStorage.getItem('agent_language') as "en" | "es";
        if (savedLang === "en" || savedLang === "es") {
          setWtLanguage(savedLang);
        }
        setShowWelcome(true);
      } catch (err) {
        console.warn("Error checking walkthrough status:", err);
        setShowWelcome(true);
      }
    };

    checkWalkthrough();
  }, [user?.uid, firestore]);

  const selectLanguage = (selected: "en" | "es") => {
    setWtLanguage(selected);
    localStorage.setItem('agent_language', selected);
  };

  const handleCompleteWalkthrough = async () => {
    if (!user?.uid || !firestore) return;
    setIsSavingWt(true);
    try {
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { displayName: wtDisplayName });
      }

      // Update Firestore user document
      const userRef = doc(firestore, "users", user.uid);
      await setDoc(userRef, {
        walkthroughCompleted: true,
        displayName: wtDisplayName,
        location: wtLocation,
        preferredLanguage: wtLanguage,
        preferredTheme: wtTheme,
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Sync local storage for language and theme
      localStorage.setItem('agent_language', wtLanguage);
      localStorage.setItem('insight_theme', wtTheme);
      window.dispatchEvent(new StorageEvent('storage', { key: 'insight_theme', newValue: wtTheme }));

      // Log activity
      const { logActivity } = await import("@/lib/activity-logger");
      logActivity(firestore, 'settings_changed', { email: user.email || '', displayName: wtDisplayName }, 'Completed walkthrough setup');

      localStorage.setItem(`walkthrough_completed_${user.uid}`, "true");
      setShowWelcome(false);
    } catch (err) {
      console.error("Error completing walkthrough setup:", err);
    } finally {
      setIsSavingWt(false);
    }
  };

  // Skip / dismiss walkthrough without filling in details
  const handleSkipWalkthrough = async () => {
    if (!user?.uid) { setShowWelcome(false); return; }
    try {
      localStorage.setItem(`walkthrough_completed_${user.uid}`, "true");
      if (firestore) {
        const userRef = doc(firestore, "users", user.uid);
        await setDoc(userRef, { walkthroughCompleted: true, updatedAt: new Date().toISOString() }, { merge: true });
      }
    } catch (err) {
      console.warn("Error skipping walkthrough:", err);
    }
    setShowWelcome(false);
  };

  // Close org switcher on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node) &&
        orgSwitcherMobileRef.current && !orgSwitcherMobileRef.current.contains(e.target as Node)
      ) {
        setIsOrgSwitcherOpen(false);
      }
      if (
        !orgSwitcherRef.current && orgSwitcherMobileRef.current && !orgSwitcherMobileRef.current.contains(e.target as Node)
      ) {
        setIsOrgSwitcherOpen(false);
      }
      if (
        orgSwitcherRef.current && !orgSwitcherRef.current.contains(e.target as Node) && !orgSwitcherMobileRef.current
      ) {
        setIsOrgSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  // Guest mode: admins visiting orgs that aren't their home org
  // Exception: lucas and steve have FULL access to both orgs (never guest)
  const ADMIN_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com'];
  const FULL_ACCESS_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com'];
  const isAdminUser = user?.email ? ADMIN_EMAILS.includes(user.email) : false;
  const isFullAccessUser = user?.email ? FULL_ACCESS_EMAILS.includes(user.email) : false;
  const isOnHomeOrg = pathname.includes('/soltheory');
  const isGuestMode = isAdminUser && !isOnHomeOrg && !isFullAccessUser;
  const guestDisplayName = isGuestMode ? 'Guest' : (user?.displayName || 'User');
  const guestEmail = isGuestMode ? '' : (user?.email || '');
  const guestInitials = isGuestMode ? 'G' : (user?.displayName?.split(' ').map((n: string) => n.charAt(0)).join('') || 'U');
  const guestAvatar = isGuestMode ? '' : (user?.photoURL || '');

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
        return { icon: 'Bot', label: `AI Chat â€” ${agentName.charAt(0).toUpperCase() + agentName.slice(1)}` };
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
      if (p.includes('/walkthroughs')) return { icon: 'Lightbulb', label: 'INSiGHT Walkthroughs' };
      if (p.includes('/surveys')) return { icon: 'FileText', label: 'Surveys' };
      if (p.includes('/support-tickets')) return { icon: 'Mail', label: 'Support Tickets' };
      if (p.includes('/action-board')) return { icon: 'LayoutDashboard', label: 'Action Board' };
      if (p.includes('/timesheets')) return { icon: 'CalendarDays', label: 'Timesheets' };
      if (p.includes('/media-library')) return { icon: 'HardDrive', label: 'Media Library' };
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
    // Load heartbeat/agent notifications from shared localStorage
    try {
      const lsNotifs = JSON.parse(localStorage.getItem('st_all_notifications') || '[]');
      if (lsNotifs.length > 0) {
        const TWO_MIN = 2 * 60 * 1000;
        const mapped = lsNotifs
          .filter((n: any) => Date.now() - n.time < 24 * 60 * 60 * 1000) // keep 24h
          .map((n: any) => ({
            id: n.id,
            title: n.title,
            desc: n.desc,
            time: n.time,
            type: n.type,
            link: n.link,
            icon: n.type === 'heartbeat'
              ? React.createElement(RefreshCw, { className: 'w-4 h-4 text-blue-600' })
              : React.createElement(Bell, { className: 'w-4 h-4 text-slate-600' }),
            bg: n.type === 'heartbeat' ? 'bg-blue-100' : 'bg-slate-100',
            _isRecent: Date.now() - n.time < TWO_MIN, // for preview tray filtering
          }));
        if (mapped.length > 0) {
          setNotifications(prev => {
            const filtered = prev.filter(p => !p.id.startsWith('heartbeat-'));
            return [...filtered, ...mapped].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
          });
        }
      }
    } catch {}
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
        return [...filtered, ...notifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a,b) => b.time - a.time);
      });
    });

    const unsubTo = onSnapshot(query(collection(firestore, "support_tickets"), where("toEmail", "==", user.email)), snap => {
      const notifs = processTickets(snap.docs, 'receiver');
      setNotifications(prev => {
        const existing = prev.filter(n => !notifs.find(nn => nn.id === n.id));
        return [...existing, ...notifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a,b) => b.time - a.time);
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
            return [...filtered, ...dmNotifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
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

  // Listen for Action Board tasks assigned to this user
  React.useEffect(() => {
    if (!firestore || !user?.uid || !user?.email) return;
    let unsub: (() => void) | undefined;
    try {
      const tasksRef = collection(firestore, "action_board_tasks");
      const q = query(tasksRef, where("assignedToEmail", "==", user.email));
      unsub = onSnapshot(q, (snap) => {
        const taskNotifs: any[] = [];
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        snap.docs.forEach(d => {
          const data = d.data();
          const createdAt = data.createdAt?.toMillis?.() || data.createdAt || 0;

          // Check for overdue tasks (regardless of who created them)
          if (data.dueDate && data.column !== 'done') {
            const dueMs = data.dueDate?.toMillis?.() || (typeof data.dueDate === 'number' ? data.dueDate : 0);
            if (dueMs && dueMs < Date.now()) {
              taskNotifs.push({
                id: `task-overdue-${d.id}`,
                title: 'Task overdue',
                desc: `"${data.title || 'Untitled task'}" is past due`,
                time: dueMs,
                icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
                bg: 'bg-red-100',
                link: `${dashboardHome}/action-board`
              });
            }
          }

          if (!createdAt || Date.now() - createdAt > SEVEN_DAYS) return;
          // Only notify if the task was NOT created by the current user (incoming assignment)
          if (data.createdBy === user.uid || data.createdByEmail === user.email) return;
          // Notify for: pending approval tasks (in their inbox) or recently direct-assigned tasks not yet done
          const isPending = data.assignmentStatus === 'pending_approval';
          const isNewDirectAssign = data.assignmentStatus === 'direct' && data.column !== 'done';
          if (isPending || isNewDirectAssign) {
            taskNotifs.push({
              id: `task-${d.id}-${createdAt}`,
              title: isPending ? 'New task request' : 'New task assigned',
              desc: `${data.createdByName || 'Someone'} assigned you: ${data.title || 'Untitled task'}`,
              time: typeof createdAt === 'number' ? createdAt : Date.now(),
              icon: <LayoutDashboard className="w-4 h-4 text-amber-600" />,
              bg: 'bg-amber-100',
              link: `${dashboardHome}/action-board`
            });
          }
        });
        setNotifications(prev => {
          const filtered = prev.filter(n => !n.id.startsWith('task-'));
          return [...filtered, ...taskNotifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
        });
      }, (error) => {
        console.warn('Action Board notification listener error (non-fatal):', error.message);
      });
    } catch (e) {
      console.warn('Action Board notification listener setup failed (non-fatal):', e);
    }
    return () => unsub?.();
  }, [firestore, user?.uid, user?.email]);

  // Listen for new support tickets where user is the recipient
  React.useEffect(() => {
    if (!firestore || !user?.email) return;
    let unsub: (() => void) | undefined;
    try {
      const ticketsRef = collection(firestore, "support_tickets");
      const q = query(ticketsRef, where("toEmail", "==", user.email));
      unsub = onSnapshot(q, (snap) => {
        const ticketNotifs: any[] = [];
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        snap.docs.forEach(d => {
          const data = d.data();
          const createdAt = data.createdAt?.toMillis?.() || 0;
          if (!createdAt || Date.now() - createdAt > SEVEN_DAYS) return;
          // New incoming ticket (not from self)
          if (data.fromEmail !== user.email && data.status === 'Unanswered') {
            ticketNotifs.push({
              id: `new-ticket-${d.id}`,
              title: 'New support ticket',
              desc: `From ${data.fromName || data.fromEmail}: ${data.subject || 'No subject'}`,
              time: createdAt,
              icon: <Ticket className="w-4 h-4 text-rose-600" />,
              bg: 'bg-rose-100',
              link: `${dashboardHome}/support-tickets`
            });
          }
        });
        if (ticketNotifs.length > 0) {
          setNotifications(prev => {
            const filtered = prev.filter(n => !n.id.startsWith('new-ticket-'));
            return [...filtered, ...ticketNotifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
          });
        }
      }, (error) => {
        console.warn('Support ticket notification listener error (non-fatal):', error.message);
      });
    } catch (e) {
      console.warn('Support ticket notification listener setup failed (non-fatal):', e);
    }
    return () => unsub?.();
  }, [firestore, user?.email]);

  // Listen for surveys assigned to this user
  React.useEffect(() => {
    if (!firestore || !user?.email) return;
    let unsub: (() => void) | undefined;
    try {
      const surveysRef = collection(firestore, "custom_surveys");
      unsub = onSnapshot(surveysRef, (snap) => {
        const surveyNotifs: any[] = [];
        const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
        snap.docs.forEach(d => {
          const data = d.data();
          const createdAt = data.createdAt?.toMillis?.() || data.createdAt || 0;
          if (!createdAt || Date.now() - createdAt > SEVEN_DAYS) return;
          // Check if this survey targets the current user
          const targets = data.targetEmails || data.assignedTo || [];
          const isTargeted = Array.isArray(targets) && targets.includes(user.email);
          // Also check if it's a general survey sent recently (within 1 day)
          const isRecent = Date.now() - (typeof createdAt === 'number' ? createdAt : 0) < 24 * 60 * 60 * 1000;
          if (isTargeted || (data.creatorEmail !== user.email && isRecent && !data.isPrivate)) {
            surveyNotifs.push({
              id: `survey-${d.id}`,
              title: 'New survey available',
              desc: `${data.title || 'Untitled survey'}${data.creatorName ? ` by ${data.creatorName}` : ''}`,
              time: typeof createdAt === 'number' ? createdAt : Date.now(),
              icon: <ClipboardList className="w-4 h-4 text-emerald-600" />,
              bg: 'bg-emerald-100',
              link: `${dashboardHome}/surveys`
            });
          }
        });
        if (surveyNotifs.length > 0) {
          setNotifications(prev => {
            const filtered = prev.filter(n => !n.id.startsWith('survey-'));
            return [...filtered, ...surveyNotifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
          });
        }
      }, (error) => {
        console.warn('Survey notification listener error (non-fatal):', error.message);
      });
    } catch (e) {
      console.warn('Survey notification listener setup failed (non-fatal):', e);
    }
    return () => unsub?.();
  }, [firestore, user?.email]);

  // Listen for org channel @messages activity
  React.useEffect(() => {
    if (!firestore || !user?.email) return;
    const userDomain = user.email.split('@')[1];
    if (!userDomain) return;
    let unsub: (() => void) | undefined;
    try {
      const channelsRef = collection(firestore, "org_channels");
      const q = query(channelsRef, where("domain", "==", userDomain));
      unsub = onSnapshot(q, (snap) => {
        const msgNotifs: any[] = [];
        const ONE_HOUR = 60 * 60 * 1000;
        snap.docs.forEach(d => {
          const data = d.data();
          const updatedAt = data.updatedAt?.toMillis?.() || data.lastMessageAt?.toMillis?.() || 0;
          if (!updatedAt || Date.now() - updatedAt > ONE_HOUR) return;
          // Only notify if the last message was from someone else
          if (data.lastMessageBy && data.lastMessageBy !== user.email) {
            msgNotifs.push({
              id: `org-msg-${d.id}-${updatedAt}`,
              title: 'New channel message',
              desc: `New message in #${data.name || 'channel'} from ${data.lastMessageBy?.split('@')[0] || 'someone'}`,
              time: updatedAt,
              icon: <Hash className="w-4 h-4 text-indigo-600" />,
              bg: 'bg-indigo-100',
              link: `${dashboardHome}/communications/org-thread`
            });
          }
        });
        if (msgNotifs.length > 0) {
          setNotifications(prev => {
            const filtered = prev.filter(n => !n.id.startsWith('org-msg-'));
            return [...filtered, ...msgNotifs].filter(n => !deletedNotifIds.includes(n.id)).sort((a, b) => b.time - a.time);
          });
        }
      }, (error) => {
        console.warn('Org channel notification listener error (non-fatal):', error.message);
      });
    } catch (e) {
      console.warn('Org channel notification listener setup failed (non-fatal):', e);
    }
    return () => unsub?.();
  }, [firestore, user?.email]);

  const renderSkeletonBoxes = (count: number) => {
    return Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#faf6ed] transition-colors cursor-pointer mb-2">
        <div className="w-5 h-5 rounded-md bg-slate-200"></div>
        <div className="h-2.5 w-24 rounded-full bg-slate-200"></div>
      </div>
    ));
  };

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#faf6ed] text-slate-900'}`}>

      {/* ========== MOBILE TOP BAR ========== */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-[#faf6ed] border-b border-slate-200/80 flex items-center justify-between px-4 z-[60] shadow-sm">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 rounded-xl bg-[#fefcf6] border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 active:bg-slate-100 cursor-pointer"
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
        <div className="fixed inset-0 z-[55] bg-[#faf6ed] pt-14 overflow-y-auto">
          <aside className="w-full flex flex-col h-full">
            <div className="w-full flex flex-col h-full">
              {isDualOrgUser ? (
                <div ref={orgSwitcherMobileRef} className="relative p-4 pt-4 pb-4">
                  <button
                    onClick={() => setIsOrgSwitcherOpen(!isOrgSwitcherOpen)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-200 bg-[#fefcf6] shadow-sm hover:bg-[#faf6ed] transition-colors cursor-pointer"
                  >
                    {isNxtChapter ? (
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                    ) : (
                      <div className="bg-black p-1 rounded-lg flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                      </div>
                    )}
                    <span className="font-bold text-lg text-slate-900 tracking-tight flex-1 text-left">{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOrgSwitcherOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOrgSwitcherOpen && (
                    <div className="absolute left-4 right-4 top-full mt-1 bg-[#fefcf6] rounded-xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                      {/* SOL Theory option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${!isNxtChapter ? 'bg-indigo-50' : 'hover:bg-[#faf6ed]'}`}
                      >
                        <div className="bg-black p-1 rounded-lg flex items-center justify-center">
                          <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className={`text-sm font-semibold flex-1 text-left ${!isNxtChapter ? 'text-indigo-900' : 'text-slate-700'}`}>SOL Theory</span>
                        {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                      {/* NXT Chapter option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-t border-slate-100 ${isNxtChapter ? 'bg-indigo-50' : 'hover:bg-[#faf6ed]'}`}
                      >
                        <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                        <span className={`text-sm font-semibold flex-1 text-left ${isNxtChapter ? 'text-indigo-900' : 'text-slate-700'}`}>NXT Chapter</span>
                        {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href={dashboardHome} className="p-6 pt-6 pb-6 flex flex-col items-start gap-3 hover:bg-[#faf6ed] transition-colors cursor-pointer" onClick={() => setIsMobileMenuOpen(false)}>
                  {isNxtChapter ? (
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
              )}

              <div className="flex-grow overflow-y-auto px-4 space-y-4 pb-8">
                {/* Reuse the same nav items â€” these render the same sidebar links */}
                <div className="space-y-1">
                  <Link href={`${dashboardHome}`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname === dashboardHome ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                    <Home className="w-5 h-5" />
                    <span>Homepage</span>
                  </Link>
                  <Link href={`${dashboardHome}/ai-agents/jarvis`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/ai-agents') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                    <Users className="w-5 h-5" />
                    <span>Agent Manager</span>
                  </Link>
                  <Link href={`${dashboardHome}/walkthroughs`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/walkthroughs') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                    <Lightbulb className="w-5 h-5" />
                    <span>INSiGHT Walkthroughs</span>
                  </Link>
                </div>

                {/* Flagship Tools */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Flagship Tools</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/crm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/crm') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Users className="w-5 h-5 text-slate-500" />
                      <span>CRM</span>
                    </Link>

                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 cursor-not-allowed font-semibold text-base">
                      <BarChart3 className="w-5 h-5" />
                      <span>Business Intelligence</span>
                    </div>
                    <Link href={`${dashboardHome}/action-board`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/action-board') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <LayoutDashboard className="w-5 h-5 text-slate-500" />
                      <span>Action Board</span>
                    </Link>
                    <Link href={`${dashboardHome}/timesheets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/timesheets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <CalendarDays className="w-5 h-5 text-slate-500" />
                      <span>Timesheets</span>
                    </Link>
                    <Link href={`${dashboardHome}/media-library`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/media-library') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <HardDrive className="w-5 h-5 text-slate-500" />
                      <span>Media Library</span>
                    </Link>
                    <Link href={`${dashboardHome}/agentic-campaigning`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/agentic-campaigning') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Send className="w-5 h-5 text-slate-500" />
                      <span>Agentic Campaigning</span>
                    </Link>
                  </div>
                </div>

                {/* Reports */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Reporting</span>
                  <div className="space-y-1 mt-2">

                    <Link href={`${dashboardHome}/support-tickets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/support-tickets') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Ticket className="w-5 h-5" />
                      <span>Support Tickets</span>
                    </Link>
                    <Link href={`${dashboardHome}/surveys`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/surveys') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <ClipboardList className="w-5 h-5" />
                      <span>Surveys</span>
                    </Link>
                    <Link href={`${dashboardHome}/activity-log`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/activity-log') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Activity className="w-5 h-5" />
                      <span>Activity Log</span>
                    </Link>
                  </div>
                </div>

                {/* Communications */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Communications</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/communications/imessage`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/imessage') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <MessageCircle className="w-5 h-5" />
                      <span>SMS</span>
                    </Link>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 cursor-not-allowed font-semibold text-base">
                      <MessageCircle className="w-5 h-5" />
                      <span>WhatsApp</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 cursor-not-allowed font-semibold text-base">
                      <Hash className="w-5 h-5" />
                      <span>Slack</span>
                    </div>
                    <Link href={`${dashboardHome}/communications/dm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/dm') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <MessageSquare className="w-5 h-5" />
                      <span>Direct Messages</span>
                    </Link>
                  </div>
                </div>

                {/* Social Media */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Social Media <span className="text-blue-500 font-bold text-[10px] tracking-normal">BETA</span></span>
                  <div className="space-y-1 mt-2">
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-base text-slate-400 cursor-not-allowed opacity-50">
                      <CalendarDays className="w-5 h-5 text-slate-400" />
                      <span>Upload Calendar</span>
                    </div>
                    <Link href={`${dashboardHome}/youtube`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/youtube') ? 'bg-fuchsia-50 text-fuchsia-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Youtube className="w-5 h-5" />
                      <span>YouTube</span>
                    </Link>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-base text-slate-400 cursor-not-allowed opacity-50">
                      <Instagram className="w-5 h-5 text-slate-400" />
                      <span>Instagram</span>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-base text-slate-400 cursor-not-allowed opacity-50">
                      <Facebook className="w-5 h-5 text-slate-400" />
                      <span>Facebook</span>
                    </div>
                  </div>
                </div>

                {/* Google */}
                <div className="pt-3 border-t border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">Google</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/gmail`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/gmail') ? 'bg-red-50 text-red-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                      <Mail className="w-5 h-5" />
                      <span>Gmail</span>
                    </Link>
                  </div>
                </div>

                {/* Settings */}
                <div className="pt-3 border-t border-slate-200">
                  <Link href={`${dashboardHome}/settings`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/settings') ? 'bg-indigo-50 text-indigo-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700'}`}>
                    <Settings className="w-5 h-5" />
                    <span>Settings</span>
                  </Link>
                </div>

                {/* User info at bottom */}
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="h-10 w-10 ring-2 ring-slate-200">
                      <AvatarImage src={guestAvatar || undefined} />
                      <AvatarFallback className="bg-slate-100 text-slate-600 font-bold text-sm">{guestInitials?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-900">{guestDisplayName}</span>
                      <span className="text-xs text-slate-500 truncate">{guestEmail}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ========== DESKTOP SIDEBAR (hidden on mobile) ========== */}
      <div className={`relative flex-col h-full flex-shrink-0 z-40 overflow-visible hidden md:flex`} style={{ width: isSidebarCollapsed ? 0 : sidebarWidth, minWidth: isSidebarCollapsed ? 0 : 230, maxWidth: 500, transition: sidebarResizeRef.current ? 'none' : 'width 0.3s ease' }}>
        {/* Collapse toggle button — shows when collapsed */}
        {isSidebarCollapsed && (
          <div 
            className="absolute top-1/2 -translate-y-1/2 z-50 left-1 cursor-pointer"
            onClick={() => setIsSidebarCollapsed(false)}
            title="Expand sidebar"
          >
            <div className={`w-[36px] h-[84px] rounded-2xl border shadow-lg hover:shadow-xl flex flex-col items-center justify-center gap-1 group transition-all duration-200 select-none ${isDarkMode ? 'bg-slate-800 border-slate-600/80 hover:border-slate-500 hover:bg-slate-700' : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <div className="flex flex-col items-center gap-[3px] mb-1.5 opacity-50 group-hover:opacity-80 transition-opacity">
                <span className="block w-4 h-[2px] bg-slate-400 rounded-full" />
                <span className="block w-4 h-[2px] bg-slate-400 rounded-full" />
                <span className="block w-4 h-[2px] bg-slate-400 rounded-full" />
              </div>
              <svg className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-all duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        )}

        {/* Drag-to-resize right edge */}
        {!isSidebarCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full z-50 cursor-col-resize group hover:bg-indigo-400/40 transition-colors"
            onPointerDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startW = sidebarWidth;
              sidebarResizeRef.current = true;
              const el = e.currentTarget;
              el.setPointerCapture(e.pointerId);
              const onMove = (ev: PointerEvent) => {
                const newW = Math.max(180, Math.min(500, startW + (ev.clientX - startX)));
                setSidebarWidth(newW);
                if (newW <= 180 && ev.clientX - startX < -40) {
                  setIsSidebarCollapsed(true);
                  sidebarResizeRef.current = false;
                  el.releasePointerCapture(ev.pointerId);
                  el.removeEventListener('pointermove', onMove);
                  el.removeEventListener('pointerup', onUp);
                }
              };
              const onUp = (ev: PointerEvent) => {
                sidebarResizeRef.current = false;
                el.releasePointerCapture(ev.pointerId);
                el.removeEventListener('pointermove', onMove);
                el.removeEventListener('pointerup', onUp);
              };
              el.addEventListener('pointermove', onMove);
              el.addEventListener('pointerup', onUp);
            }}
            title="Drag to resize"
          />
        )}

        <aside className={`w-full flex flex-col h-full relative overflow-x-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-900 dark-sidebar shadow-[4px_0_24px_rgba(0,0,0,0.15)]' : 'bg-[#f8f6f1] shadow-[4px_0_24px_rgba(0,0,0,0.02)]'}`}>
          {isDarkMode && (
            <style>{`
              .dark-sidebar .bg-\[\#f0ede4\] { background-color: rgb(30 41 59) !important; }
              .dark-sidebar .bg-\[\#f2efe8\] { background-color: rgb(30 41 59) !important; }
              .dark-sidebar .bg-\[\#fefcf6\] { background-color: rgb(15 23 42) !important; }
              .dark-sidebar .bg-slate-100 { background-color: rgb(51 65 85) !important; }
              .dark-sidebar .hover\:bg-\[\#f2efe8\]:hover { background-color: rgb(30 41 59 / 0.6) !important; }
              .dark-sidebar .hover\:bg-\[\#faf6ed\]:hover { background-color: rgb(30 41 59 / 0.6) !important; }
              .dark-sidebar .hover\:bg-\[\#f0ede4\]:hover { background-color: rgb(30 41 59 / 0.6) !important; }
              .dark-sidebar .hover\:bg-slate-50:hover { background-color: rgb(30 41 59 / 0.6) !important; }
              .dark-sidebar .text-stone-900 { color: rgb(226 232 240) !important; }
              .dark-sidebar .text-slate-900 { color: rgb(226 232 240) !important; }
              .dark-sidebar .text-slate-800 { color: rgb(203 213 225) !important; }
              .dark-sidebar .text-slate-700 { color: rgb(148 163 184) !important; }
              .dark-sidebar .text-slate-600 { color: rgb(148 163 184) !important; }
              .dark-sidebar .text-slate-500 { color: rgb(100 116 139) !important; }
              .dark-sidebar .text-slate-400 { color: rgb(71 85 105) !important; }
              .dark-sidebar .text-slate-300 { color: rgb(71 85 105) !important; }
              .dark-sidebar .hover\:text-stone-900:hover { color: rgb(226 232 240) !important; }
              .dark-sidebar .hover\:text-slate-900:hover { color: rgb(226 232 240) !important; }
              .dark-sidebar .hover\:text-slate-700:hover { color: rgb(203 213 225) !important; }
              .dark-sidebar .border-\[\#e0ddd4\] { border-color: rgb(51 65 85) !important; }
              .dark-sidebar .border-slate-200 { border-color: rgb(51 65 85) !important; }
              .dark-sidebar .border-slate-200\/80 { border-color: rgb(51 65 85 / 0.8) !important; }
              .dark-sidebar .border-slate-100 { border-color: rgb(51 65 85 / 0.5) !important; }
              .dark-sidebar .shadow-sm { box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.15) !important; }
              .dark-sidebar .group-hover\:text-slate-700:hover { color: rgb(203 213 225) !important; }
            `}</style>
          )}
          <div style={{ width: sidebarWidth, minWidth: 230 }} className="flex flex-col h-full"> {/* Inner container matches outer width */}
            {isDualOrgUser ? (
              <div ref={orgSwitcherRef} className="relative p-5 pt-7 pb-5">
                <button
                  onClick={() => setIsOrgSwitcherOpen(!isOrgSwitcherOpen)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border border-[#e0ddd4] bg-[#f2efe8] shadow-sm hover:bg-[#f0ede4] transition-colors cursor-pointer"
                >
                  {isNxtChapter ? (
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                  ) : (
                    <div className="bg-black p-1.5 rounded-xl flex items-center justify-center">
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                    </div>
                  )}
                  <span className="font-bold text-lg text-slate-900 tracking-tight flex-1 text-left">{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOrgSwitcherOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOrgSwitcherOpen && (
                  <div className="absolute left-5 right-5 top-full mt-1 bg-[#fefcf6] rounded-xl border border-[#e0ddd4] shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
                    {/* SOL Theory option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${!isNxtChapter ? 'bg-[#f0ede4]' : 'hover:bg-[#f2efe8]'}`}
                    >
                      <div className="bg-black p-1.5 rounded-xl flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                      </div>
                      <span className={`text-sm font-semibold flex-1 text-left ${!isNxtChapter ? 'text-stone-900' : 'text-slate-700'}`}>SOL Theory</span>
                      {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                    {/* NXT Chapter option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-t border-slate-100 ${isNxtChapter ? 'bg-[#f0ede4]' : 'hover:bg-[#f2efe8]'}`}
                    >
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                      <span className={`text-sm font-semibold flex-1 text-left ${isNxtChapter ? 'text-stone-900' : 'text-slate-700'}`}>NXT Chapter</span>
                      {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={dashboardHome} className="p-6 pt-8 pb-8 flex flex-col items-start gap-3 hover:bg-[#f2efe8] transition-colors cursor-pointer">
                {isNxtChapter ? (
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
            )}

        <div className="flex-grow overflow-y-auto px-4 space-y-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]" onClick={(e) => {
          // Exit CMS mode when any sidebar link is clicked
          if (contentManagerActive) {
            const target = e.target as HTMLElement;
            const link = target.closest('a');
            if (link) setContentManagerActive(false);
          }
        }}>
          {/* Section 1 */}
          <div>
            <button onClick={() => toggleSection('menu')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['menu'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.menu}</span>
            </button>
            {!collapsedSections['menu'] && <div className="animate-in fade-in duration-150">
              <div className="space-y-1 mb-4 pt-1">
              {/* Content Manager moved to Dev Tools dropdown in header */}
              <Link href={`${dashboardHome}`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname === dashboardHome ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname === dashboardHome ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Homepage</span>
              </Link>
              <Link href={`${dashboardHome}/ai-agents/jarvis`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.includes('/ai-agents') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.includes('/ai-agents') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">Agent Manager</span>
              </Link>
              <Link href={`${dashboardHome}/walkthroughs`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.includes('/walkthroughs') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.includes('/walkthroughs') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <Lightbulb className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">INSiGHT Walkthroughs</span>
              </Link>
            </div>
            
            {/* @Messages Collapsible */}
            <div className="mt-2">
              <button 
                onClick={() => setIsMessagesOpen(!isMessagesOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-[#f2efe8] transition-colors cursor-pointer mb-1 group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md bg-[#f0ede4] flex items-center justify-center text-stone-700 group-hover:bg-stone-800 group-hover:text-white transition-colors">
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 group-hover:text-stone-900 transition-colors">{t.messages}</span>
                </div>
                {isMessagesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              
              {isMessagesOpen && (
                <div className="pl-12 pr-3 py-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                  <Link href={`${dashboardHome}/communications/dm`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/dm') ? 'bg-[#f0ede4] text-stone-900 font-semibold shadow-sm' : 'hover:bg-[#f2efe8] text-slate-600 hover:text-slate-900'}`}>
                    <UserSquare className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/dm') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.dm}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/org-thread`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/org-thread') ? 'bg-[#f0ede4] text-stone-900 font-semibold shadow-sm' : 'hover:bg-[#f2efe8] text-slate-600 hover:text-slate-900'}`}>
                    <Hash className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/org-thread') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.orgThread}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/contacts`} className={`flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${pathname.endsWith('/communications/contacts') ? 'bg-[#f0ede4] text-stone-900 font-semibold shadow-sm' : 'hover:bg-[#f2efe8] text-slate-600 hover:text-slate-900'}`}>
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
            <button onClick={() => toggleSection('flagship')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['flagship'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.flagshipTools}</span>
            </button>
            {!collapsedSections['flagship'] && (
              <div className="space-y-1 animate-in fade-in duration-150">
                <Link href={`${dashboardHome}/crm`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/crm') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/crm') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.crm}</span>
                </Link>

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 cursor-not-allowed font-semibold">
                  <div className="w-6 h-6 rounded-md bg-transparent flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Business Intelligence</span>
                </div>

                <Link href={`${dashboardHome}/action-board`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/action-board') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/action-board') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.actionBoard}</span>
                </Link>

                <Link href={`${dashboardHome}/timesheets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/timesheets') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/timesheets') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Timesheets</span>
                </Link>

                <Link href={`${dashboardHome}/media-library`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/media-library') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/media-library') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Media Library</span>
                </Link>

                <Link href={`${dashboardHome}/agentic-campaigning`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/agentic-campaigning') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/agentic-campaigning') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                    <Send className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">Agentic Campaigning</span>
                </Link>
              </div>
            )}
          </div>
          
          {/* Section 2 */}
          <div className="mb-2">
            <button onClick={() => toggleSection('reports')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['reports'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.reports}</span>
            </button>
            {!collapsedSections['reports'] &&
            <div className="space-y-1 animate-in fade-in duration-150">

              <Link href={`${dashboardHome}/support-tickets`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-2 font-semibold ${pathname.endsWith('/support-tickets') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/support-tickets') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <Ticket className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Submit a support ticket</span>
              </Link>

              <Link href={`${dashboardHome}/surveys`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/surveys') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/surveys') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <ClipboardList className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Surveys</span>
              </Link>

              <Link href={`${dashboardHome}/activity-log`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${pathname.endsWith('/activity-log') ? 'bg-[#f0ede4] text-stone-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/activity-log') ? 'bg-stone-800 text-white' : 'bg-transparent text-slate-500 group-hover:text-stone-800'}`}>
                  <Activity className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">Activity Log</span>
              </Link>
            </div>}
          </div>

          {/* Communications */}
          <div className="mb-2">
            <button onClick={() => toggleSection('comms')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['comms'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">Communications</span>
            </button>
            {!collapsedSections['comms'] && <div className="space-y-1 animate-in fade-in duration-150">
              <Link href={`${dashboardHome}/communications/imessage`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/communications/imessage') ? 'bg-blue-50 text-blue-900 shadow-sm' : 'hover:bg-[#faf6ed] text-slate-700 hover:text-blue-900'}`}>
                <MessageCircle className="w-4 h-4 ml-1" />
                <span className="text-sm">SMS</span>
              </Link>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 cursor-not-allowed mb-1">
                <MessageCircle className="w-4 h-4 ml-1" />
                <span className="text-sm">WhatsApp</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 cursor-not-allowed mb-1">
                <Hash className="w-4 h-4 ml-1" />
                <span className="text-sm">Slack</span>
              </div>
            </div>}
          </div>

          {/* Social Media Integrations */}
          <div className="mb-2">
            <button onClick={() => toggleSection('social')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['social'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">{t.socialMediaIntegrations} <span className="text-blue-500 font-bold text-[10px] tracking-normal">BETA</span></span>
            </button>
            {!collapsedSections['social'] && <div className="space-y-1 animate-in fade-in duration-150">
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 font-semibold text-slate-400 cursor-not-allowed opacity-50">
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent text-slate-400">
                  <CalendarDays className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Upload Calendar</span>
              </div>
              <Link href={`${dashboardHome}/youtube`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/youtube') ? 'bg-fuchsia-50 text-fuchsia-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-fuchsia-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/youtube') ? 'bg-fuchsia-600 text-white' : 'bg-transparent text-slate-500 group-hover:text-fuchsia-600'}`}>
                  <Youtube className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">YouTube</span>
              </Link>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 font-semibold text-slate-400 cursor-not-allowed opacity-50">
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent text-slate-400">
                  <Instagram className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Instagram</span>
              </div>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 font-semibold text-slate-400 cursor-not-allowed opacity-50">
                <div className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent text-slate-400">
                  <Facebook className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm">Facebook</span>
              </div>
            </div>}
          </div>


          {/* Google */}
          <div>
            <button onClick={() => toggleSection('google')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${collapsedSections['google'] ? '-rotate-90' : ''}`} />
              <span className="text-[10px] font-bold text-slate-500 tracking-widest uppercase group-hover:text-slate-700">Google</span>
            </button>
            {!collapsedSections['google'] && <div className="space-y-1 animate-in fade-in duration-150">
              <Link href={`${dashboardHome}/gmail`} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 font-semibold ${pathname.endsWith('/gmail') ? 'bg-red-50 text-red-900 shadow-sm' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-red-900'}`}>
                <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${pathname.endsWith('/gmail') ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm">Gmail</span>
              </Link>
            </div>}
          </div>

          {/* Microsoft Suite */}
          <div className="mb-2">
            <button onClick={() => toggleSection('microsoft')} className="w-full flex items-center gap-1.5 px-3 py-1 -ml-1 rounded-lg hover:bg-[#f2efe8] transition-colors mb-2 group/hdr">
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
          <Link href={`${dashboardHome}/settings?tab=general`} className="p-2.5 hover:bg-[#f0ede4] rounded-xl transition-colors shrink-0 text-slate-400 hover:text-slate-900 bg-[#f2efe8] border border-[#e0ddd4] shadow-sm">
             <Settings className="w-5 h-5" />
          </Link>
          <Link href={`${dashboardHome}/settings?tab=profile`} className="flex-1 flex items-center gap-3 px-3 py-2 rounded-xl border border-[#e0ddd4] bg-[#f2efe8] shadow-sm overflow-hidden hover:bg-[#f0ede4] transition-colors cursor-pointer group">
            <Avatar className="h-8 w-8 shrink-0 group-hover:scale-105 transition-transform">
              <AvatarImage src={guestAvatar} />
              <AvatarFallback className="bg-slate-100 font-bold text-sm text-slate-600">{guestInitials?.[0] || 'G'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold truncate text-slate-900 group-hover:text-indigo-600 transition-colors">{guestDisplayName}</span>
              <span className="text-[10px] text-slate-500 truncate">{guestEmail}</span>
            </div>
          </Link>
        </div>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden w-full relative z-10 min-h-0 ${isMobile ? 'pt-14' : ''}`}>
        {/* Top Navbar â€” hidden on mobile */}
        <header className="h-[88px] items-center justify-between px-4 md:px-10 shrink-0 hidden md:flex">
          <div className="flex-grow max-w-[480px] relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder={t.searchPlaceholder}
              className="pl-12 bg-[#fefcf6] border border-slate-100 shadow-sm focus-visible:ring-1 focus-visible:ring-slate-200 rounded-full h-12 w-full text-sm font-medium text-slate-700 placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-3">
              {/* User Profile Dropdown */}
              <div className="relative" ref={(el) => { if (el) (el as any)._profileDropdown = true; }}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#faf6ed] transition-colors cursor-pointer border border-transparent hover:border-slate-100"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={guestAvatar} />
                    <AvatarFallback className="bg-slate-200 font-bold text-sm text-slate-700">{guestInitials || 'G'}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-semibold text-slate-800 hidden lg:inline">{guestDisplayName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {isProfileDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-52 bg-[#fefcf6] border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900 truncate">{guestDisplayName}</p>
                        <p className="text-[11px] text-slate-400 truncate">{guestEmail}</p>
                      </div>
                      <Link
                        href={`${dashboardHome}/settings?tab=profile`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                      >
                        <UserSquare className="w-4 h-4 text-slate-400" />
                        Profile
                      </Link>
                      <Link
                        href={`${dashboardHome}/settings?tab=general`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        Settings
                      </Link>
                      <Link
                        href={`${dashboardHome}/faq`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                      >
                        <HelpCircle className="w-4 h-4 text-slate-400" />
                        Help
                      </Link>
                    </div>
                  </>
                )}
              </div>

              {/* Notifications Bell */}
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-[#fefcf6] transition-colors bg-[#fefcf6] shadow-sm border border-slate-100 rounded-full flex items-center justify-center relative">
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {/* Notifications Popup */}
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-[380px] bg-[#fefcf6] rounded-2xl border border-slate-200 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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
                            notifications.slice(0, 3).map(n => {
                              const isUnread = !readNotifIds.includes(n.id);
                              return (
                              <div 
                                key={n.id} 
                                onClick={() => {
                                  setIsNotificationsOpen(false);
                                  if (n.link) router.push(n.link);
                                }}
                                className="flex items-start gap-3 p-3 rounded-xl hover:bg-[#faf6ed] transition-colors mb-1.5 cursor-pointer border border-transparent hover:border-slate-100 group/notif"
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
                                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                  {isUnread && <div className="w-2 h-2 rounded-full bg-indigo-500"></div>}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Track deleted ID so Firestore listeners don't re-add it
                                      setDeletedNotifIds(prev => {
                                        const updated = [...prev, n.id];
                                        localStorage.setItem('st_deleted_notifications', JSON.stringify(updated));
                                        return updated;
                                      });
                                      setNotifications(prev => prev.filter(p => p.id !== n.id));
                                      // Also clean from localStorage
                                      try {
                                        const raw = localStorage.getItem('st_all_notifications');
                                        if (raw) {
                                          const parsed = JSON.parse(raw).filter((p: any) => p.id !== n.id);
                                          localStorage.setItem('st_all_notifications', JSON.stringify(parsed));
                                        }
                                      } catch {}
                                    }}
                                    className="p-1 rounded-md opacity-0 group-hover/notif:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all"
                                    title="Delete notification"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            )})
                          )}
                        </div>
                      </div>

                      <div className="px-5 py-3 border-t border-slate-100 bg-[#faf6ed]/50">
                        <button onClick={() => { setIsNotificationsOpen(false); router.push(`${dashboardHome}/notifications`); }} className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors py-1">
                          View All Notifications
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Developer Tools — Admin Only */}
              {userIsAdmin && (
                <div className="relative">
                  <button
                    onClick={() => setIsDevToolsOpen(!isDevToolsOpen)}
                    className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-[#fefcf6] transition-colors bg-[#fefcf6] shadow-sm border border-slate-100 rounded-full flex items-center justify-center relative group"
                    title="Dev Tools"
                  >
                    <Monitor className="h-4 w-4" />
                    {/* Tooltip */}
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">Dev Tools</span>
                  </button>

                  {/* Dev Tools Dropdown */}
                  {isDevToolsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDevToolsOpen(false)} />
                      <div className="absolute right-0 top-full mt-2 w-52 bg-[#fefcf6] border border-slate-200 rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-4 py-2 border-b border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Developer Tools</p>
                        </div>
                        <button
                          onClick={() => {
                            setContentManagerActive(!contentManagerActive);
                            setIsDevToolsOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                        >
                          <ShieldCheck className={`w-4 h-4 ${contentManagerActive ? 'text-green-600' : 'text-slate-400'}`} />
                          <span>Content Manager</span>
                          {contentManagerActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />}
                        </button>
                        <Link
                          href={`${dashboardHome}/activity-log`}
                          onClick={() => setIsDevToolsOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                        >
                          <Activity className="w-4 h-4 text-slate-400" />
                          Session Auditor
                        </Link>
                        <Link
                          href={`${dashboardHome}/end-users`}
                          onClick={() => setIsDevToolsOpen(false)}
                          className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-[#faf6ed] transition-colors cursor-pointer"
                        >
                          <Users className="w-4 h-4 text-slate-400" />
                          End User Dashboard
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

             <div className="h-8 w-px bg-slate-200 mx-2"></div>
             <div className="flex items-center gap-3 select-none">
                <span className="text-2xl font-black text-slate-800 leading-none tracking-[0.15em]" style={{ fontFamily: "'Sofia Soft Pro', 'Sofia Pro', sans-serif" }}>INSiGHT</span>
                <Link href="/" className="flex items-center justify-center w-9 h-9 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-sm" title="Exit Dashboard">
                  <LogOut className="h-4 w-4" />
                </Link>
             </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-hidden px-4 pb-4 md:px-10 md:pb-10 flex flex-col relative w-full min-h-0 focus:outline-none" tabIndex={-1}>
          {children}
        </main>
      </div>

      {/* Persistent Floating Video Player — persists across all dashboard pages */}
      <WalkthroughPlayer />

      {/* Welcome Walkthrough Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in duration-300">
          <div className="bg-[#fefcf6]/90 border border-slate-200/80 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row min-h-[520px] relative">
            {/* Close / X button */}
            <button onClick={handleSkipWalkthrough} className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer" title="Skip for now">
              <X className="w-4 h-4" />
            </button>
            
            {/* Left Side: Brand Panel */}
            <div className="md:w-1/3 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 p-8 flex flex-col justify-between text-white border-r border-indigo-900/30">
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black tracking-[0.2em] text-indigo-400">INSiGHT</span>
                </div>
                <div className="pt-8 space-y-2">
                  <h3 className="text-lg font-bold text-slate-100 leading-tight">
                    {wtLanguage === "en" ? WT_LANG.en.step1Title : WT_LANG.es.step1Title}
                  </h3>
                  <p className="text-xs text-indigo-200/80">
                    {wtLanguage === "en" ? WT_LANG.en.step1Tagline : WT_LANG.es.step1Tagline}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 rounded-full transition-all duration-300 ${walkthroughStep === 1 ? "w-6 bg-indigo-400" : "w-1.5 bg-indigo-950"}`} />
                  <span className={`h-1.5 rounded-full transition-all duration-300 ${walkthroughStep === 2 ? "w-6 bg-indigo-400" : "w-1.5 bg-indigo-950"}`} />
                </div>
                <p className="text-[10px] text-indigo-300/60 font-semibold uppercase tracking-wider">
                  {wtLanguage === "en" ? `Step ${walkthroughStep} of 2` : `Paso ${walkthroughStep} de 2`}
                </p>
              </div>
            </div>

            {/* Right Side: Setup Wizard Content */}
            <div className="flex-1 p-8 flex flex-col justify-between bg-white text-slate-800">
              {walkthroughStep === 1 ? (
                /* Step 1: Welcome Overview */
                <div className="space-y-6 my-auto">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                      {wtLanguage === "en" ? WT_LANG.en.welcomeTitle : WT_LANG.es.welcomeTitle}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {wtLanguage === "en" ? WT_LANG.en.welcomeSubtitle : WT_LANG.es.welcomeSubtitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    {/* Item 1 */}
                    <div className="flex gap-3 p-3.5 rounded-2xl bg-[#faf6ed]/40 border border-slate-100 hover:border-slate-200/80 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {wtLanguage === "en" ? WT_LANG.en.accountsTitle : WT_LANG.es.accountsTitle}
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          {wtLanguage === "en" ? WT_LANG.en.accountsDesc : WT_LANG.es.accountsDesc}
                        </p>
                      </div>
                    </div>

                    {/* Item 2 */}
                    <div className="flex gap-3 p-3.5 rounded-2xl bg-[#faf6ed]/40 border border-slate-100 hover:border-slate-200/80 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                        <Settings className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {wtLanguage === "en" ? WT_LANG.en.prefTitle : WT_LANG.es.prefTitle}
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          {wtLanguage === "en" ? WT_LANG.en.prefDesc : WT_LANG.es.prefDesc}
                        </p>
                      </div>
                    </div>

                    {/* Item 3 */}
                    <div className="flex gap-3 p-3.5 rounded-2xl bg-[#faf6ed]/40 border border-slate-100 hover:border-slate-200/80 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <LayoutDashboard className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {wtLanguage === "en" ? WT_LANG.en.homeTitle : WT_LANG.es.homeTitle}
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          {wtLanguage === "en" ? WT_LANG.en.homeDesc : WT_LANG.es.homeDesc}
                        </p>
                      </div>
                    </div>

                    {/* Item 4 */}
                    <div className="flex gap-3 p-3.5 rounded-2xl bg-[#faf6ed]/40 border border-slate-100 hover:border-slate-200/80 transition-colors">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div className="space-y-0.5">
                        <h4 className="text-xs font-bold text-slate-900">
                          {wtLanguage === "en" ? WT_LANG.en.langTitle : WT_LANG.es.langTitle}
                        </h4>
                        <p className="text-[10px] text-slate-500 leading-normal">
                          {wtLanguage === "en" ? WT_LANG.en.langDesc : WT_LANG.es.langDesc}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Step 2: Preferences Gathering */
                <div className="space-y-5 my-auto">
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {wtLanguage === "en" ? WT_LANG.en.step2Title : WT_LANG.es.step2Title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {wtLanguage === "en" ? WT_LANG.en.step2Desc : WT_LANG.es.step2Desc}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Display Name Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.displayName : WT_LANG.es.displayName}
                      </label>
                      <input
                        type="text"
                        value={wtDisplayName}
                        onChange={e => setWtDisplayName(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed]/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 font-semibold"
                      />
                    </div>

                    {/* Location Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.location : WT_LANG.es.location}
                      </label>
                      <input
                        type="text"
                        value={wtLocation}
                        onChange={e => setWtLocation(e.target.value)}
                        placeholder={wtLanguage === "en" ? WT_LANG.en.locationPlaceholder : WT_LANG.es.locationPlaceholder}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed]/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400"
                      />
                    </div>

                    {/* Language Preference */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.interfaceLanguage : WT_LANG.es.interfaceLanguage}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => selectLanguage("en")}
                          className={`py-2 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            wtLanguage === "en"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm ring-1 ring-indigo-300/40"
                              : "bg-[#faf6ed]/30 hover:bg-[#faf6ed]/80 border-slate-200 text-slate-600"
                          }`}
                        >
                          🇺🇸 English
                          {wtLanguage === "en" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => selectLanguage("es")}
                          className={`py-2 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            wtLanguage === "es"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm ring-1 ring-indigo-300/40"
                              : "bg-[#faf6ed]/30 hover:bg-[#faf6ed]/80 border-slate-200 text-slate-600"
                          }`}
                        >
                          🇪🇸 Español
                          {wtLanguage === "es" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      </div>
                    </div>

                    {/* Theme Preference Placeholder */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.theme : WT_LANG.es.theme}
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWtTheme("light")}
                          className={`py-2 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            wtTheme === "light"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm ring-1 ring-indigo-300/40"
                              : "bg-[#faf6ed]/30 hover:bg-[#faf6ed]/80 border-slate-200 text-slate-600"
                          }`}
                        >
                          <Sun className="w-3.5 h-3.5" />
                          {wtLanguage === "en" ? WT_LANG.en.light : WT_LANG.es.light}
                          {wtTheme === "light" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => setWtTheme("dark")}
                          className={`py-2 px-4 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                            wtTheme === "dark"
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm ring-1 ring-indigo-300/40"
                              : "bg-[#faf6ed]/30 hover:bg-[#faf6ed]/80 border-slate-200 text-slate-600"
                          }`}
                        >
                          <Moon className="w-3.5 h-3.5" />
                          {wtLanguage === "en" ? WT_LANG.en.dark : WT_LANG.es.dark}
                          {wtTheme === "dark" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Buttons */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-4">
                {walkthroughStep === 1 ? (
                  <button type="button" onClick={handleSkipWalkthrough}
                    className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                    {wtLanguage === "en" ? "Skip for now" : "Omitir por ahora"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setWalkthroughStep(1)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    {wtLanguage === "en" ? WT_LANG.en.back : WT_LANG.es.back}
                  </button>
                )}

                <div className="flex items-center gap-3">
                  {walkthroughStep === 2 && (
                    <button type="button" onClick={handleSkipWalkthrough}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                      {wtLanguage === "en" ? "Skip for now" : "Omitir por ahora"}
                    </button>
                  )}
                  {walkthroughStep === 1 ? (
                    <button
                      type="button"
                      onClick={() => setWalkthroughStep(2)}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-slate-900 text-white hover:bg-slate-800 font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.97]"
                    >
                      {wtLanguage === "en" ? WT_LANG.en.next : WT_LANG.es.next}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCompleteWalkthrough}
                      disabled={isSavingWt || !wtDisplayName.trim()}
                      className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.97] min-w-[120px] justify-center"
                    >
                      {isSavingWt ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                          {wtLanguage === "en" ? WT_LANG.en.saving : WT_LANG.es.saving}
                        </>
                      ) : (
                        <>
                          {wtLanguage === "en" ? WT_LANG.en.finish : WT_LANG.es.finish}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
