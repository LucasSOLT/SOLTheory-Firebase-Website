"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { useUser, useFirestore, useAuth } from "@/firebase";
import { collection, query, where, onSnapshot, doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";
import { Search, Bell, MessageSquare, ChevronDown, ChevronRight, Hash, UserSquare, Ticket, LogOut, FileText, Presentation, Table, Settings, Video, Youtube, Megaphone, MapPin, Globe, HardDrive, Sparkles, Activity, Lightbulb, ClipboardList, BookUser, Home, Users, HelpCircle, Instagram, Facebook, X, Bot, Mail, CalendarDays, ShieldCheck, Smartphone, MessageCircle, GraduationCap, BarChart3, Database, Factory, LayoutDashboard, Check, AlertTriangle, Monitor, RefreshCw, Moon, Sun, Send, Brain, Compass } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation, TIMEZONE_OPTIONS } from "@/lib/i18n";
import { logDigestEntry } from "@/components/portal/DailyDigest";
import { isAdmin } from "@/lib/admin";
import { isDeveloper } from "@/lib/rbac";
import { useContentManagerStore } from "@/stores/content-manager-store";
import { WalkthroughPlayer } from "@/components/portal/WalkthroughPlayer";


export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { t, lang } = useTranslation();
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push("/portal/login");
    }
  }, [user, isUserLoading, router]);

  // Welcome Walkthrough States
  const [showWelcome, setShowWelcome] = useState(false);
  const [walkthroughStep, setWalkthroughStep] = useState(1);
  const [wtDisplayName, setWtDisplayName] = useState("");
  const [wtLanguage, setWtLanguage] = useState<"en" | "es">("en");
  const [wtTheme, setWtTheme] = useState<"light" | "dark">("light");
  const [wtLocation, setWtLocation] = useState("");
  const [isSavingWt, setIsSavingWt] = useState(false);
  // Step 3: Profile fields
  const [wtOrganization, setWtOrganization] = useState("");
  const [wtJobTitle, setWtJobTitle] = useState("");
  const [wtDepartment, setWtDepartment] = useState("");
  const [wtIndustry, setWtIndustry] = useState("");
  const [wtExperience, setWtExperience] = useState("");
  // Step 4: Tour
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  // Per-step interaction tracking (for greyed-out Next buttons)
  const [stepInteracted, setStepInteracted] = useState<Record<number, boolean>>({ 1: false, 2: false, 3: false, 4: false });

  const pathname = usePathname();
  const [isMessagesOpen, setIsMessagesOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const sidebarResizeRef = React.useRef(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const firestore = useFirestore();
  const [notifications, setNotifications] = useState<any[]>([]);

  // Org Guard States
  const [userProfileData, setUserProfileData] = useState<any>(null);
  const [isCheckingOrg, setIsCheckingOrg] = useState(true);
  const [isFrozen, setIsFrozen] = useState(false);
  const [noAccess, setNoAccess] = useState(false);

  useEffect(() => {
    if (isUserLoading) return;
    if (!user) {
      setIsCheckingOrg(false);
      return;
    }

    const checkOrgAccess = async () => {
      try {
        const userRef = doc(firestore, "users", user.uid);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          const data = snap.data();
          setUserProfileData(data);
          
          if (user.email && isDeveloper(user.email)) {
            setIsCheckingOrg(false);
            return;
          }

          if (data.frozenAt) {
            setIsFrozen(true);
            setIsCheckingOrg(false);
            return;
          }

          const currentOrgUrl = pathname.includes('/nxtchapter') ? 'nxtchapter' : 'soltheory';
          
          let allowed: string[] = [];
          if (data.allowedOrgs && Array.isArray(data.allowedOrgs)) {
            allowed = data.allowedOrgs;
          } else if (data.allowedOrgs && typeof data.allowedOrgs === 'string') {
            // Handle manually-created user docs where allowedOrgs is a string instead of array
            allowed = [data.allowedOrgs];
          } else if (data.organization) {
            const orgVal = data.organization.toLowerCase().replace(/\s+/g, '');
            if (orgVal.includes('nxt')) allowed.push('nxtchapter');
            else allowed.push('soltheory');
          }

          if (allowed.length === 0) {
            setNoAccess(true);
            setIsCheckingOrg(false);
            return;
          }

          if (!allowed.includes(currentOrgUrl)) {
            router.push(`/portal/dashboard/${allowed[0]}`);
            return;
          }
        } else {
          if (!user.email || !isDeveloper(user.email)) {
            setNoAccess(true);
          }
        }
      } catch (err) {
        console.error("Org check error", err);
      }
      setIsCheckingOrg(false);
    };

    checkOrgAccess();
  }, [user, isUserLoading, pathname, firestore, router]);


  const { isDarkMode, setTheme: setAppTheme } = useTheme();
  const [currentTime, setCurrentTime] = useState('');
  const [userTimezone, setUserTimezone] = useState('');

  // Load user timezone from localStorage / Firestore
  useEffect(() => {
    const savedTz = localStorage.getItem('user_timezone');
    if (savedTz) {
      setUserTimezone(savedTz);
    } else if (firestore && user?.uid) {
      getDoc(doc(firestore, 'users', user.uid)).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          const tz = data.timezone || data.location || '';
          if (tz) {
            setUserTimezone(tz);
            localStorage.setItem('user_timezone', tz);
          }
        }
      }).catch(() => {});
    }
  }, [firestore, user?.uid]);

  // Live clock that updates every second
  useEffect(() => {
    const updateClock = () => {
      try {
        const opts: Intl.DateTimeFormatOptions = {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
          ...(userTimezone ? { timeZone: userTimezone } : {}),
        };
        const formatted = new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-US', opts).format(new Date());
        setCurrentTime(formatted);
      } catch {
        setCurrentTime(new Date().toLocaleString());
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [userTimezone, lang]);

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
  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>([]);
  const [latestNotifId, setLatestNotifId] = useState<string | null>(null);
  const [isOrgSwitcherOpen, setIsOrgSwitcherOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [showLeaveCube, setShowLeaveCube] = useState(false);
  const orgSwitcherRef = useRef<HTMLDivElement>(null);
  const orgSwitcherMobileRef = useRef<HTMLDivElement>(null);
  const noAccessRedirectingRef = useRef(false);

  // ── Navigation Cube: shows a 3-second spinning cube + "Loading" text on every page navigation ──
  const [navCubeVisible, setNavCubeVisible] = useState(false);
  const [navFadeIn, setNavFadeIn] = useState(false);
  const prevPathRef = useRef<string>(pathname);
  const navCubeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    // Skip the very first render (initial page load is handled by the dashboard page's own overlay)
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevPathRef.current = pathname;
      return;
    }

    // Only trigger on actual pathname changes (not query param changes)
    if (pathname === prevPathRef.current) return;
    prevPathRef.current = pathname;

    // Show the cube overlay
    setNavCubeVisible(true);
    setNavFadeIn(false);

    // Clear any existing timer
    if (navCubeTimerRef.current) clearTimeout(navCubeTimerRef.current);

    // After 3 seconds: hide cube, start fade-in on the content
    navCubeTimerRef.current = setTimeout(() => {
      setNavCubeVisible(false);
      setNavFadeIn(true);
      navCubeTimerRef.current = null;
      // Remove the fade-in class after the animation completes
      setTimeout(() => setNavFadeIn(false), 600);
    }, 3000);

    return () => {
      if (navCubeTimerRef.current) clearTimeout(navCubeTimerRef.current);
    };
  }, [pathname]);

  const DUAL_ORG_EMAILS = ['lucas@soltheory.com', 'steve@soltheory.com', 'gerard@soltheory.com'];
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
      location: "Timezone",
      locationPlaceholder: "Select your timezone",
      interfaceLanguage: "Interface Language",
      theme: "Interface Theme",
      light: "Light Mode",
      dark: "Dark Mode",
      step3Title: "Set Up Your Profile",
      step3Desc: "Help your team know who you are. All fields are optional.",
      organization: "Organization / Company",
      jobTitle: "Job Title",
      department: "Department",
      industry: "Industry",
      experience: "Years of Experience",
      step4Title: "Ready to Explore?",
      step4Desc: "Take a quick guided tour of your dashboard, or jump right in.",
      takeTour: "Take the Tour",
      takeTourDesc: "A quick walkthrough of key features",
      jumpIn: "Jump Right In",
      jumpInDesc: "Start using the dashboard immediately",
      skip: "Skip",
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
      location: "Zona Horaria",
      locationPlaceholder: "Selecciona tu zona horaria",
      interfaceLanguage: "Idioma de Interfaz",
      theme: "Tema de la Interfaz",
      light: "Modo Claro",
      dark: "Modo Oscuro",
      step3Title: "Configura tu Perfil",
      step3Desc: "Ayuda a tu equipo a conocerte. Todos los campos son opcionales.",
      organization: "Organización / Empresa",
      jobTitle: "Cargo",
      department: "Departamento",
      industry: "Industria",
      experience: "Años de Experiencia",
      step4Title: "¿Listo para Explorar?",
      step4Desc: "Haz un recorrido rápido de tu panel, o comienza directamente.",
      takeTour: "Hacer el Recorrido",
      takeTourDesc: "Un recorrido rápido de las funciones clave",
      jumpIn: "Comenzar Directamente",
      jumpInDesc: "Empieza a usar el panel de inmediato",
      skip: "Omitir",
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
            // Sync timezone to localStorage if available
            if (data.timezone) {
              localStorage.setItem('user_timezone', data.timezone);
            } else if (data.location) {
              localStorage.setItem('user_timezone', data.location);
            }
            return;
          }
          // Pre-populate timezone for walkthrough
          if (data.timezone) {
            setWtLocation(data.timezone);
          } else if (data.location) {
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

  // Allow child pages to re-open the welcome walkthrough via custom event
  useEffect(() => {
    const handleOpenWalkthrough = () => {
      setWalkthroughStep(1);
      setWtDisplayName(user?.displayName || "");
      const savedLang = localStorage.getItem('agent_language') as "en" | "es";
      if (savedLang === "en" || savedLang === "es") {
        setWtLanguage(savedLang);
      }
      setShowWelcome(true);
    };
    window.addEventListener('open-welcome-walkthrough', handleOpenWalkthrough);
    return () => window.removeEventListener('open-welcome-walkthrough', handleOpenWalkthrough);
  }, [user?.displayName]);

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
        timezone: wtLocation,
        preferredLanguage: wtLanguage,
        preferredTheme: wtTheme,
        organization: wtOrganization || '',
        jobTitle: wtJobTitle || '',
        department: wtDepartment || '',
        industry: wtIndustry || '',
        yearsOfExperience: wtExperience || '',
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      // Bridge org data to the unified org profile
      if (wtOrganization) {
        const orgId = pathname.includes("/nxtchapter/") ? "nxtchapter" : "soltheory";
        const orgRef = doc(firestore, "org_profiles", orgId);
        await setDoc(orgRef, {
          orgName: wtOrganization,
          updatedAt: new Date().toISOString(),
          updatedBy: user.uid,
        }, { merge: true });
      }

      // Sync local storage for language, theme, and timezone
      localStorage.setItem('agent_language', wtLanguage);
      setAppTheme(wtTheme);
      localStorage.setItem('user_timezone', wtLocation);

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
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
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

  // All admin/dual-org users have full access to both orgs — no guest mode
  const isGuestMode = false;
  const rawDisplayName = user?.displayName || 'User';
  const guestDisplayName = rawDisplayName.replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke');
  const guestEmail = user?.email || '';
  const guestInitials = guestDisplayName.split(' ').map((n: string) => n.charAt(0)).join('') || 'U';
  const guestAvatar = user?.photoURL || '';

  // ThemeProvider manages the dark class on <html> — no need to manipulate it here

  // Track window resize for mobile detection and initialize client states safely
  React.useEffect(() => {
    const mobile = window.innerWidth < 768;
    setIsMobile(mobile);
    setIsSidebarCollapsed(mobile);

    try {
      const storedDel = localStorage.getItem('st_deleted_notifications');
      if (storedDel) {
        setDeletedNotifIds(JSON.parse(storedDel));
      }
    } catch (e) {}

    try {
      const storedCollapsed = localStorage.getItem('sidebar_collapsed');
      if (storedCollapsed) {
        setCollapsedSections(JSON.parse(storedCollapsed));
      }
    } catch (e) {}

    const handleResize = () => {
      const isMob = window.innerWidth < 768;
      setIsMobile(isMob);
      if (!isMob) setIsMobileMenuOpen(false);
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
  }, [user?.uid, deletedNotifIds]);

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
      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f2efe6] transition-colors cursor-pointer mb-2">
        <div className="w-5 h-5 rounded-md bg-slate-200"></div>
        <div className="h-2.5 w-24 rounded-full bg-slate-200"></div>
      </div>
    ));
  };

  const getSidebarLinkClass = (isActive: boolean) => {
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold ${
      isActive 
        ? (isDarkMode ? 'bg-slate-200 text-black shadow-sm' : 'bg-[#f0ede4] text-black shadow-sm') 
        : (isDarkMode ? 'hover:bg-slate-800 text-slate-300 hover:text-white' : 'hover:bg-[#f2efe8] text-slate-700 hover:text-stone-900')
    }`;
  };

  const getSidebarIconClass = (isActive: boolean) => {
    return `w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
      isActive 
        ? (isDarkMode ? 'bg-black text-white' : 'bg-stone-800 text-white')
        : (isDarkMode ? 'bg-transparent text-slate-400 group-hover:text-slate-200' : 'bg-transparent text-slate-500 group-hover:text-stone-800')
    }`;
  };

  const getSidebarSubLinkClass = (isActive: boolean) => {
    return `flex items-center gap-2 py-2 px-2 cursor-pointer rounded-lg transition-colors ${
      isActive 
        ? (isDarkMode ? 'bg-slate-200 text-black font-semibold shadow-sm' : 'bg-[#f0ede4] text-black font-semibold shadow-sm') 
        : (isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-[#f2efe8] text-slate-600 hover:text-slate-900')
    }`;
  };

  if (isCheckingOrg) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (isFrozen) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950 p-4">
        <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Account Frozen</h1>
            <p className="text-slate-500 dark:text-slate-400">Your account has been frozen. Contact your administrator at lucas@soltheory.com</p>
          </div>
          <button 
            onClick={() => {
              auth?.signOut().then(() => { window.location.href = "/"; }).catch(() => { window.location.href = "/"; });
            }}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }



  if (noAccess) {
    // User lost org access (revoked mid-session or never had it)
    // Sign them out and kick them back to the website homepage
    if (!noAccessRedirectingRef.current) {
      noAccessRedirectingRef.current = true;
      if (auth) {
        auth.signOut().then(() => {
          window.location.href = "/";
        }).catch(() => {
          window.location.href = "/";
        });
      } else {
        window.location.href = "/";
      }
    }
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-slate-950 p-4">
        <div className="max-w-md w-full flex flex-col items-center text-center space-y-6">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Redirecting...</h1>
            <p className="text-slate-500 dark:text-slate-400">You do not have access to this organization. Returning to homepage.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#f5f1e8] text-slate-900'}`}>

      {/* ========== MOBILE TOP BAR ========== */}
      {isMobile && (
        <div className={`fixed top-0 left-0 right-0 h-14 border-b flex items-center justify-between px-4 z-[60] shadow-sm ${isDarkMode ? 'bg-slate-900 border-slate-700/80' : 'bg-[#f0e8d0] border-slate-200/80'}`}>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className={`w-11 h-11 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200 active:bg-slate-700' : 'bg-[#faf8f3] border-slate-200 text-slate-600 active:bg-slate-100'}`}
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
              <span className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>NXT Chapter</span>
            ) : (
              <span className={`font-bold text-lg tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SOL Theory</span>
            )}
          </Link>
          <button
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
            className={`w-11 h-11 rounded-xl border shadow-sm flex items-center justify-center cursor-pointer relative ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200 active:bg-slate-700' : 'bg-[#faf8f3] border-slate-200 text-slate-600 active:bg-slate-100'}`}
          >
            <Bell className="w-4.5 h-4.5" />
            {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900"></span>
            )}
          </button>
        </div>
      )}

      {/* ========== MOBILE FULLSCREEN MENU OVERLAY ========== */}
      {isMobile && isMobileMenuOpen && (
        <div className={`fixed inset-0 z-[55] pt-14 overflow-y-auto ${isDarkMode ? 'bg-slate-950' : 'bg-[#faf6ed]'}`}>
          <aside className="w-full flex flex-col h-full">
            <div className="w-full flex flex-col h-full">
              {isDualOrgUser ? (
                <div ref={orgSwitcherMobileRef} className="relative p-4 pt-4 pb-4">
                  <button
                    onClick={() => setIsOrgSwitcherOpen(!isOrgSwitcherOpen)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl shadow-sm transition-colors cursor-pointer ${isDarkMode ? 'border border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border border-slate-200 bg-[#faf8f3] hover:bg-[#f2ece0]'}`}
                  >
                    {isNxtChapter ? (
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                    ) : (
                      <div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                      </div>
                    )}
                    <span className={`font-bold text-lg tracking-tight flex-1 text-left ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOrgSwitcherOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isOrgSwitcherOpen && (
                    <div className={`absolute left-4 right-4 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-slate-200'}`}>
                      {/* SOL Theory option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${!isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2ece0]')}`}
                      >
                        <div className="bg-[#8b7355] p-1 rounded-lg flex items-center justify-center">
                          <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-6 h-6 object-contain" />
                        </div>
                        <span className={`text-sm font-semibold flex-1 text-left ${!isNxtChapter ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>SOL Theory</span>
                        {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                      {/* NXT Chapter option */}
                      <button
                        onClick={() => {
                          setIsOrgSwitcherOpen(false);
                          setIsMobileMenuOpen(false);
                          if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-100'} ${isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-indigo-50') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2ece0]')}`}
                      >
                        <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-8 h-8 object-contain rounded-lg" />
                        <span className={`text-sm font-semibold flex-1 text-left ${isNxtChapter ? (isDarkMode ? 'text-white' : 'text-indigo-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>NXT Chapter</span>
                        {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <Link href={dashboardHome} className={`p-6 pt-6 pb-6 flex flex-col items-start gap-3 transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2ece0]'}`} onClick={() => setIsMobileMenuOpen(false)}>
                  {isNxtChapter ? (
                    <>
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-32 h-auto object-contain object-left" />
                      <span className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>NXT Chapter</span>
                    </>
                  ) : (
                    <>
                      <div className="bg-[#8b7355] p-2 rounded-2xl flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-12 h-12 object-contain" />
                      </div>
                      <span className={`font-bold text-xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SOL Theory</span>
                    </>
                  )}
                </Link>
              )}

              <div className="flex-grow overflow-y-auto px-4 space-y-3 pb-8">
                {/* Core — always visible */}
                <div className="space-y-0.5">
                  <Link href={`${dashboardHome}`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname === dashboardHome ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                    <Home className="w-5 h-5" />
                    <span>{t.homepage}</span>
                  </Link>
                  <Link href={`${dashboardHome}/ai-agents/jarvis`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/ai-agents') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                    <Users className="w-5 h-5" />
                    <span>{t.agentManager}</span>
                  </Link>
                  <Link href={`${dashboardHome}/ai-knowledge-base`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/ai-knowledge-base') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                    <Brain className="w-5 h-5" />
                    <span>{t.aiKnowledgeBase}</span>
                  </Link>
                  <Link href={`${dashboardHome}/walkthroughs`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/walkthroughs') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                    <Lightbulb className="w-5 h-5" />
                    <span>{t.insightWalkthroughs}</span>
                  </Link>
                </div>

                {/* Flagship Tools — collapsible */}
                <div className={`pt-3 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <button onClick={() => toggleSection('mob_tools')} className="flex items-center justify-between w-full px-4 py-1">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{t.flagshipTools}</span>
                    {collapsedSections['mob_tools'] ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {!collapsedSections['mob_tools'] && (
                  <div className="space-y-0.5 mt-1">
                    <Link href={`${dashboardHome}/crm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/crm') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Users className="w-5 h-5 text-slate-500" />
                      <span>{t.crm}</span>
                    </Link>
                    <Link href={`${dashboardHome}/gmail`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/gmail') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Mail className="w-5 h-5 text-slate-500" />
                      <span>{t.email}</span>
                    </Link>
                    <Link href={`${dashboardHome}/action-board`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/action-board') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <LayoutDashboard className="w-5 h-5 text-slate-500" />
                      <span>{t.actionBoard}</span>
                    </Link>
                    <Link href={`${dashboardHome}/timesheets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/timesheets') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <CalendarDays className="w-5 h-5 text-slate-500" />
                      <span>{t.timesheets}</span>
                    </Link>
                    <Link href={`${dashboardHome}/media-library`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/media-library') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <HardDrive className="w-5 h-5 text-slate-500" />
                      <span>{t.mediaLibrary}</span>
                    </Link>
                    <Link href={`${dashboardHome}/agentic-campaigning`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/agentic-campaigning') ? (isDarkMode ? 'bg-amber-900/30 text-amber-300 shadow-sm' : 'bg-amber-50 text-amber-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Send className="w-5 h-5 text-slate-500" />
                      <span>{t.agenticCampaigning}</span>
                    </Link>
                    <Link href={`${dashboardHome}/agentic-prospecting`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/agentic-prospecting') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Compass className="w-5 h-5 text-slate-500" />
                      <span>{t.agenticProspecting || 'Agentic Prospecting'}</span>
                    </Link>
                    {user?.email === 'lucas@soltheory.com' && (
                    <Link href={`${dashboardHome}/system-health`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.includes('/system-health') ? (isDarkMode ? 'bg-amber-900/30 text-amber-300 shadow-sm' : 'bg-amber-50 text-amber-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Activity className="w-5 h-5 text-amber-500" />
                      <span>System Health</span>
                    </Link>
                    )}
                  </div>
                  )}
                </div>

                {/* Reports — collapsible */}
                <div className={`pt-3 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <button onClick={() => toggleSection('mob_reports')} className="flex items-center justify-between w-full px-4 py-1">
                    <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">{t.reports}</span>
                    {collapsedSections['mob_reports'] ? <ChevronRight className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>
                  {!collapsedSections['mob_reports'] && (
                  <div className="space-y-0.5 mt-1">
                    <Link href={`${dashboardHome}/support-tickets`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/support-tickets') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Ticket className="w-5 h-5" />
                      <span>{t.supportTickets}</span>
                    </Link>
                    <Link href={`${dashboardHome}/surveys`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-colors cursor-pointer font-semibold text-[15px] ${pathname.endsWith('/surveys') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <ClipboardList className="w-5 h-5" />
                      <span>{t.surveys}</span>
                    </Link>
                  </div>
                  )}
                </div>


                {/* Settings */}
                <div className={`pt-3 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <Link href={`${dashboardHome}/settings`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.includes('/settings') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                    <Settings className="w-5 h-5" />
                    <span>{t.settingsLabel}</span>
                  </Link>
                </div>

                {/* Messages — was missing from mobile! */}
                <div className={`pt-3 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase px-4">{t.messages || 'Messages'}</span>
                  <div className="space-y-1 mt-2">
                    <Link href={`${dashboardHome}/communications/dm`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/dm') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <UserSquare className="w-5 h-5 text-slate-500" />
                      <span>{t.directMessages || 'Direct Messages'}</span>
                    </Link>
                    <Link href={`${dashboardHome}/communications/org-thread`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${pathname.endsWith('/communications/org-thread') ? (isDarkMode ? 'bg-indigo-900/30 text-indigo-300 shadow-sm' : 'bg-indigo-50 text-indigo-900 shadow-sm') : (isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700')}`}>
                      <Hash className="w-5 h-5 text-slate-500" />
                      <span>{t.orgThread || 'Org Thread'}</span>
                    </Link>
                  </div>
                </div>

                {/* Help & Logout — was missing from mobile! */}
                <div className={`pt-3 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <Link href={`${dashboardHome}/faq`} onClick={() => setIsMobileMenuOpen(false)} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-pointer font-semibold text-base ${isDarkMode ? 'hover:bg-slate-800 text-slate-200' : 'hover:bg-[#f2ece0] text-slate-700'}`}>
                    <HelpCircle className="w-5 h-5 text-slate-500" />
                    <span>Help & FAQ</span>
                  </Link>
                </div>

                {/* User info + Logout at bottom */}
                <div className={`pt-4 mt-4 ${isDarkMode ? 'border-t border-slate-700' : 'border-t border-slate-200'}`}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <Avatar className={`h-10 w-10 ring-2 ${isDarkMode ? 'ring-slate-700' : 'ring-slate-200'}`}>
                      <AvatarImage src={guestAvatar || undefined} />
                      <AvatarFallback className={`font-bold text-sm ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>{guestInitials?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1">
                      <span className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{guestDisplayName}</span>
                      <span className={`text-xs truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{guestEmail}</span>
                    </div>
                  </div>
                  <Link
                    href="/"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 mx-4 mt-2 mb-2 px-4 py-3 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors font-semibold text-base"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>{t.exitDashboard || 'Log Out'}</span>
                  </Link>
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

        <aside className={`w-full flex flex-col h-full relative overflow-x-hidden transition-colors duration-500 ${isDarkMode ? 'bg-slate-900 shadow-[4px_0_24px_rgba(0,0,0,0.15)]' : 'bg-[#f0e8d0] shadow-[4px_0_24px_rgba(0,0,0,0.02)]'}`}>
          <div style={{ width: sidebarWidth, minWidth: 230 }} className="flex flex-col h-full"> {/* Inner container matches outer width */}
            {isDualOrgUser ? (
              <div ref={orgSwitcherRef} className="relative p-5 pt-7 pb-5">
                <button
                  onClick={() => setIsOrgSwitcherOpen(!isOrgSwitcherOpen)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl shadow-sm transition-colors cursor-pointer ${isDarkMode ? 'border border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border border-[#e0ddd4] bg-[#f2efe8] hover:bg-[#f0ede4]'}`}
                >
                  {isNxtChapter ? (
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                  ) : (
                    <div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                    </div>
                  )}
                  <span className={`font-bold text-lg tracking-tight flex-1 text-left ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{isNxtChapter ? 'NXT Chapter' : 'SOL Theory'}</span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOrgSwitcherOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOrgSwitcherOpen && (
                  <div className={`absolute left-5 right-5 top-full mt-1 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 ${isDarkMode ? 'bg-slate-800 border border-slate-700' : 'bg-[#faf8f3] border border-[#e0ddd4]'}`}>
                    {/* SOL Theory option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (isNxtChapter) router.push('/portal/dashboard/soltheory');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer ${!isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-[#f0ede4]') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2efe8]')}`}
                    >
                      <div className="bg-[#8b7355] p-1.5 rounded-xl flex items-center justify-center">
                        <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-7 h-7 object-contain" />
                      </div>
                      <span className={`text-sm font-semibold flex-1 text-left ${!isNxtChapter ? (isDarkMode ? 'text-white' : 'text-stone-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>SOL Theory</span>
                      {!isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                    {/* NXT Chapter option */}
                    <button
                      onClick={() => {
                        setIsOrgSwitcherOpen(false);
                        if (!isNxtChapter) router.push('/portal/dashboard/nxtchapter');
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 transition-colors cursor-pointer border-t ${isDarkMode ? 'border-slate-700' : 'border-slate-100'} ${isNxtChapter ? (isDarkMode ? 'bg-slate-700' : 'bg-[#f0ede4]') : (isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-[#f2efe8]')}`}
                    >
                      <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-10 h-10 object-contain rounded-lg" />
                      <span className={`text-sm font-semibold flex-1 text-left ${isNxtChapter ? (isDarkMode ? 'text-white' : 'text-stone-900') : (isDarkMode ? 'text-slate-300' : 'text-slate-700')}`}>NXT Chapter</span>
                      {isNxtChapter && <Check className="w-4 h-4 text-indigo-600" />}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href={dashboardHome} className={`p-6 pt-8 pb-8 flex flex-col items-start gap-3 transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2efe8]'}`}>
                {isNxtChapter ? (
                  <>
                    <img src="/nxt_logo.png" alt="NXT Chapter Logo" className="w-40 h-auto object-contain object-left" />
                    <span className={`font-bold text-2xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>NXT Chapter</span>
                  </>
                ) : (
                  <>
                    <div className="bg-[#8b7355] p-2 rounded-2xl flex items-center justify-center">
                      <img src="https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440" alt="SOL Theory Logo" className="w-16 h-16 object-contain" />
                    </div>
                    <span className={`font-bold text-2xl tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SOL Theory</span>
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
              <Link href={`${dashboardHome}`} className={getSidebarLinkClass(pathname === dashboardHome)}>
                <div className={getSidebarIconClass(pathname === dashboardHome)}>
                  <Home className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{t.homepage}</span>
              </Link>
              <Link href={`${dashboardHome}/ai-agents/jarvis`} className={getSidebarLinkClass(pathname.includes('/ai-agents'))}>
                <div className={getSidebarIconClass(pathname.includes('/ai-agents'))}>
                  <Users className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{t.agentManager}</span>
              </Link>
              <Link href={`${dashboardHome}/ai-knowledge-base`} className={getSidebarLinkClass(pathname.includes('/ai-knowledge-base'))}>
                <div className={getSidebarIconClass(pathname.includes('/ai-knowledge-base'))}>
                  <Brain className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{t.aiKnowledgeBase}</span>
              </Link>
              <Link href={`${dashboardHome}/walkthroughs`} className={getSidebarLinkClass(pathname.includes('/walkthroughs'))}>
                <div className={getSidebarIconClass(pathname.includes('/walkthroughs'))}>
                  <Lightbulb className="w-4 h-4" />
                </div>
                <span className="text-sm font-medium">{t.insightWalkthroughs}</span>
              </Link>
            </div>
            
            {/* @Messages Collapsible */}
            <div className="mt-2">
              <button 
                onClick={() => setIsMessagesOpen(!isMessagesOpen)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer mb-1 group ${isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-[#f2efe8]'}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                    isDarkMode 
                      ? 'bg-transparent text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200' 
                      : 'bg-[#f0ede4] text-stone-700 group-hover:bg-stone-800 group-hover:text-white'
                  }`}>
                    <MessageSquare className="w-3.5 h-3.5" />
                  </div>
                  <span className={`text-sm font-semibold transition-colors ${
                    isDarkMode 
                      ? 'text-slate-300 group-hover:text-white' 
                      : 'text-slate-700 group-hover:text-stone-900'
                  }`}>{t.messages}</span>
                </div>
                {isMessagesOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
              </button>
              
              {isMessagesOpen && (
                <div className="pl-12 pr-3 py-1 space-y-1 animate-in slide-in-from-top-1 fade-in duration-200">
                  <Link href={`${dashboardHome}/communications/dm`} className={getSidebarSubLinkClass(pathname.endsWith('/communications/dm'))}>
                    <UserSquare className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/dm') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.dm}</span>
                  </Link>
                  <Link href={`${dashboardHome}/communications/org-thread`} className={getSidebarSubLinkClass(pathname.endsWith('/communications/org-thread'))}>
                    <Hash className={`w-3.5 h-3.5 ${pathname.endsWith('/communications/org-thread') ? 'text-indigo-600' : ''}`} />
                    <span className="text-xs font-medium">{t.orgThread}</span>
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
                <Link href={`${dashboardHome}/crm`} className={getSidebarLinkClass(pathname.endsWith('/crm'))}>
                  <div className={getSidebarIconClass(pathname.endsWith('/crm'))}>
                    <Users className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.crm}</span>
                </Link>

                <Link href={`${dashboardHome}/gmail`} className={getSidebarLinkClass(pathname.endsWith('/gmail'))}>
                  <div className={getSidebarIconClass(pathname.endsWith('/gmail'))}>
                    <Mail className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.email}</span>
                </Link>

                <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 cursor-not-allowed font-semibold">
                  <div className="w-6 h-6 rounded-md bg-transparent flex items-center justify-center">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.businessIntelligence}</span>
                </div>

                <Link href={`${dashboardHome}/action-board`} className={getSidebarLinkClass(pathname.endsWith('/action-board'))}>
                  <div className={getSidebarIconClass(pathname.endsWith('/action-board'))}>
                    <LayoutDashboard className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.actionBoard}</span>
                </Link>
                <Link href={`${dashboardHome}/timesheets`} className={getSidebarLinkClass(pathname.includes('/timesheets'))}>
                  <div className={getSidebarIconClass(pathname.includes('/timesheets'))}>
                    <CalendarDays className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.timesheets}</span>
                </Link>



                <Link href={`${dashboardHome}/media-library`} className={getSidebarLinkClass(pathname.endsWith('/media-library'))}>
                  <div className={getSidebarIconClass(pathname.endsWith('/media-library'))}>
                    <HardDrive className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.mediaLibrary}</span>
                </Link>

                <Link href={`${dashboardHome}/agentic-campaigning`} className={getSidebarLinkClass(pathname.endsWith('/agentic-campaigning'))}>
                  <div className={getSidebarIconClass(pathname.endsWith('/agentic-campaigning'))}>
                    <Send className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.agenticCampaigning}</span>
                </Link>

                <Link href={`${dashboardHome}/agentic-prospecting`} className={getSidebarLinkClass(pathname.includes('/agentic-prospecting'))}>
                  <div className={getSidebarIconClass(pathname.includes('/agentic-prospecting'))}>
                    <Compass className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium">{t.agenticProspecting || 'Agentic Prospecting'}</span>
                </Link>

                {user?.email === 'lucas@soltheory.com' && (
                <Link href={`${dashboardHome}/system-health`} className={getSidebarLinkClass(pathname.includes('/system-health'))}>
                  <div className={getSidebarIconClass(pathname.includes('/system-health'))}>
                    <Activity className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-sm font-medium">System Health</span>
                </Link>
                )}
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

              <Link href={`${dashboardHome}/support-tickets`} className={getSidebarLinkClass(pathname.endsWith('/support-tickets'))}>
                <div className={getSidebarIconClass(pathname.endsWith('/support-tickets'))}>
                  <Ticket className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">{t.submitTicket}</span>
              </Link>

              <Link href={`${dashboardHome}/surveys`} className={getSidebarLinkClass(pathname.endsWith('/surveys'))}>
                <div className={getSidebarIconClass(pathname.endsWith('/surveys'))}>
                  <ClipboardList className="w-4 h-4 ml-1" />
                </div>
                <span className="text-sm font-medium">{t.surveys}</span>
              </Link>
            </div>}
          </div>



        </div>

        {/* User Footer Profile */}
        <div className="p-4 mt-auto mb-4 flex items-center gap-2">
          <Link href={`${dashboardHome}/settings?tab=general`} className={`p-2.5 rounded-xl transition-colors shrink-0 shadow-sm ${isDarkMode ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700' : 'hover:bg-[#f0ede4] text-slate-400 hover:text-slate-900 bg-[#f2efe8] border border-[#e0ddd4]'}`}>
             <Settings className="w-5 h-5" />
          </Link>
          <Link href={`${dashboardHome}/settings?tab=profile`} className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-xl shadow-sm overflow-hidden transition-colors cursor-pointer group ${isDarkMode ? 'border border-slate-700 bg-slate-800 hover:bg-slate-700' : 'border border-[#e0ddd4] bg-[#f2efe8] hover:bg-[#f0ede4]'}`}>
            <Avatar className="h-8 w-8 shrink-0 group-hover:scale-105 transition-transform">
              <AvatarImage src={guestAvatar} />
              <AvatarFallback className={`font-bold text-sm ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-600'}`}>{guestInitials?.[0] || 'G'}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className={`text-sm font-bold truncate transition-colors ${isDarkMode ? 'text-white group-hover:text-indigo-400' : 'text-slate-900 group-hover:text-indigo-600'}`}>{guestDisplayName}</span>
              <span className={`text-[10px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{guestEmail}</span>
            </div>
          </Link>
        </div>
          </div>
        </aside>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col overflow-hidden w-full relative z-10 min-h-0 ${isMobile ? 'pt-14' : ''}`}>
        {/* Top Navbar — hidden on mobile */}
        <header className={`h-[72px] items-center justify-between px-4 md:px-10 shrink-0 hidden md:flex ${isDarkMode ? 'bg-slate-900' : 'bg-[#f0e8d0]'}`}>
          <div className="flex-grow max-w-[480px]"></div>
          <div className="flex items-center gap-3">
              {/* Live Clock */}
              {currentTime && (
                <span className={`text-[11px] font-semibold mr-2 tracking-wide shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {currentTime}
                </span>
              )}
              {/* User Profile Dropdown */}
              <div className="relative" ref={(el) => { if (el) (el as any)._profileDropdown = true; }}>
                <button
                  onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-colors cursor-pointer border border-transparent ${isDarkMode ? 'hover:bg-slate-800 hover:border-slate-700 text-white' : 'hover:bg-[#f2ece0] hover:border-slate-100'}`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={guestAvatar} />
                    <AvatarFallback className={`font-bold text-sm ${isDarkMode ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>{guestInitials || 'G'}</AvatarFallback>
                  </Avatar>
                  <span className={`text-sm font-semibold hidden lg:inline ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{guestDisplayName}</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown */}
                {isProfileDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsProfileDropdownOpen(false)} />
                    <div className={`absolute right-0 top-full mt-2 w-52 border rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
                      <div className={`px-4 py-2.5 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <p className={`text-sm font-semibold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{guestDisplayName}</p>
                        <p className={`text-[11px] truncate ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>{guestEmail}</p>
                      </div>
                      <Link
                        href={`${dashboardHome}/settings?tab=profile`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                      >
                        <UserSquare className="w-4 h-4 text-slate-400" />
                        {t.profile}
                      </Link>
                      <Link
                        href={`${dashboardHome}/settings?tab=general`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                      >
                        <Settings className="w-4 h-4 text-slate-400" />
                        {t.settingsLabel}
                      </Link>
                      <Link
                        href={`${dashboardHome}/faq`}
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                      >
                        <HelpCircle className="w-4 h-4 text-slate-400" />
                        {t.help}
                      </Link>
                    </div>
                  </>
                )}
              </div>

              {/* Notifications Bell */}
              <div className="relative">
                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className={`p-2.5 text-slate-400 transition-colors shadow-sm border rounded-full flex items-center justify-center relative ${isDarkMode ? 'hover:text-white hover:bg-slate-800 bg-slate-800 border-slate-700' : 'hover:text-slate-700 hover:bg-[#faf8f3] bg-[#faf8f3] border-slate-100'}`}>
                  <Bell className="h-4 w-4" />
                  {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
                    <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {/* Notifications Popup */}
                {isNotificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                    <div className={`fixed md:absolute inset-x-0 bottom-0 md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 w-full md:w-[380px] max-w-full rounded-t-2xl md:rounded-2xl border shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 md:slide-in-from-top-2 duration-200 max-h-[70vh] md:max-h-[unset] ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
                      <div className={`flex items-center justify-between px-5 py-4 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                        <div className="flex items-center gap-2">
                          <h3 className={`text-sm font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{t.notifications}</h3>
                          {notifications.filter(n => !readNotifIds.includes(n.id)).length > 0 && (
                            <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.filter(n => !readNotifIds.includes(n.id)).length} {t.newBadge}</span>
                          )}
                        </div>
                        <button onClick={() => setIsNotificationsOpen(false)} className={`p-1 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="max-h-[400px] overflow-y-auto">
                        <div className="px-4 py-2">
                          {notifications.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm font-medium">{t.noNewNotifications}</div>
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
                                className={`flex items-start gap-3 p-3 rounded-xl transition-colors mb-1.5 cursor-pointer border border-transparent group/notif ${isDarkMode ? 'hover:bg-slate-800 hover:border-slate-700' : 'hover:bg-[#f2ece0] hover:border-slate-100'}`}
                              >
                                <div className={`w-8 h-8 rounded-lg ${n.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                                  {n.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{n.title}</p>
                                  <p className={`text-[11px] mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{n.desc}</p>
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
                                    className="p-1 rounded-md opacity-30 md:opacity-0 group-hover/notif:opacity-100 hover:bg-red-50 text-slate-300 hover:text-red-400 transition-all"
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

                      <div className={`px-5 py-3 border-t ${isDarkMode ? 'border-slate-700 bg-slate-800/80' : 'border-slate-100 bg-[#faf6ed]/50'}`}>
                        <button onClick={() => { setIsNotificationsOpen(false); router.push(`${dashboardHome}/notifications`); }} className="w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors py-1">
                          {t.viewAllNotifications}
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
                    className={`p-2.5 text-slate-400 transition-colors shadow-sm border rounded-full flex items-center justify-center relative group ${isDarkMode ? 'hover:text-white hover:bg-slate-800 bg-slate-800 border-slate-700' : 'hover:text-slate-700 hover:bg-[#faf8f3] bg-[#faf8f3] border-slate-100'}`}
                    title={t.devTools}
                  >
                    <Monitor className="h-4 w-4" />
                    {/* Tooltip */}
                    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[10px] font-medium rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">{t.devTools}</span>
                  </button>

                  {/* Dev Tools Dropdown */}
                  {isDevToolsOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setIsDevToolsOpen(false)} />
                      <div className={`absolute right-0 top-full mt-2 w-52 border rounded-xl shadow-xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#faf8f3] border-slate-200'}`}>
                        <div className={`px-4 py-2 border-b ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.developerTools}</p>
                        </div>
                        <button
                          onClick={() => {
                            setContentManagerActive(!contentManagerActive);
                            setIsDevToolsOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                        >
                          <ShieldCheck className={`w-4 h-4 ${contentManagerActive ? 'text-green-600' : 'text-slate-400'}`} />
                          <span>{t.contentManager}</span>
                          {contentManagerActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500" />}
                        </button>
                        <Link
                          href={`${dashboardHome}/activity-log`}
                          onClick={() => setIsDevToolsOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                        >
                          <Activity className="w-4 h-4 text-slate-400" />
                          {t.sessionAuditor}
                        </Link>
                        <Link
                          href={`${dashboardHome}/end-users`}
                          onClick={() => setIsDevToolsOpen(false)}
                          className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${isDarkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-[#f2ece0]'}`}
                        >
                          <Users className="w-4 h-4 text-slate-400" />
                          {t.endUserDashboard}
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}

             <div className={`h-8 w-px mx-2 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
             <div className="flex items-center gap-3 select-none">
                <span className={`text-2xl font-black leading-none tracking-[0.15em] ${isDarkMode ? 'text-white' : 'text-slate-800'}`} style={{ fontFamily: "'Sofia Soft Pro', 'Sofia Pro', sans-serif" }}>INSiGHT</span>
                <button onClick={() => { setShowLeaveCube(true); setTimeout(() => { window.location.href = '/'; }, 2000); }} className="flex items-center justify-center w-9 h-9 bg-rose-500 hover:bg-rose-600 text-white rounded-xl transition-colors shadow-sm cursor-pointer" title={t.exitDashboard}>
                  <LogOut className="h-4 w-4" />
                </button>
             </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className={`flex-1 overflow-hidden px-4 pb-4 md:px-10 md:pb-10 flex flex-col relative w-full min-h-0 focus:outline-none${navFadeIn ? ' navContentFadeIn' : ''}`} tabIndex={-1}>
          {children}

          {/* ── Navigation Cube Overlay ── */}
          {/* Shows a 3-second spinning cube + "Loading" text, then fades into the content. */}
          {navCubeVisible && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: isDarkMode ? '#020617' : '#ffffff',
              }}
            >
              <p style={{
                fontSize: 13, fontWeight: 500, letterSpacing: '0.15em',
                textTransform: 'uppercase' as const, marginBottom: 28,
                color: 'rgba(79,70,229,0.6)',
                animation: 'navCubeTextPulse 2s ease-in-out infinite',
              }}>Loading</p>
              <div style={{ width: 56, height: 56, perspective: 400 }}>
                <div style={{
                  width: '100%', height: '100%', position: 'relative',
                  transformStyle: 'preserve-3d' as const,
                  animation: 'navCubeRotate 6s ease-in-out infinite',
                }}>
                  {['translateZ(28px)', 'rotateY(180deg) translateZ(28px)', 'rotateY(90deg) translateZ(28px)', 'rotateY(-90deg) translateZ(28px)', 'rotateX(90deg) translateZ(28px)', 'rotateX(-90deg) translateZ(28px)'].map((t, i) => (
                    <div key={i} style={{
                      position: 'absolute', width: 56, height: 56, borderRadius: 10,
                      border: '1.5px solid rgba(129,140,248,0.3)',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.1) 50%, rgba(167,139,250,0.15) 100%)',
                      boxShadow: 'inset 0 0 20px rgba(99,102,241,0.06), 0 0 15px rgba(99,102,241,0.05)',
                      transform: t,
                    }} />
                  ))}
                </div>
              </div>
              <style>{`
                @keyframes navCubeTextPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
                @keyframes navCubeRotate {
                  0%, 10%   { transform: rotateX(-25deg) rotateY(0deg); }
                  15%, 25%  { transform: rotateX(-25deg) rotateY(90deg); }
                  30%, 40%  { transform: rotateX(-25deg) rotateY(180deg); }
                  45%, 55%  { transform: rotateX(-25deg) rotateY(270deg); }
                  60%, 70%  { transform: rotateX(-25deg) rotateY(360deg) rotateZ(5deg); }
                  75%, 85%  { transform: rotateX(-25deg) rotateY(450deg) rotateZ(0deg); }
                  90%, 100% { transform: rotateX(-25deg) rotateY(540deg); }
                }
              `}</style>
            </div>
          )}
          {/* Persistent style for nav fade-in — must stay in DOM after cube unmounts */}
          <style>{`
            @keyframes navContentFadeIn { from { opacity: 0; } to { opacity: 1; } }
            .navContentFadeIn { animation: navContentFadeIn 0.5s ease-out forwards; }
          `}</style>
        </main>
      </div>

      {/* Persistent Floating Video Player — persists across all dashboard pages */}
      <WalkthroughPlayer />

      {/* Welcome Walkthrough Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-xl p-4 animate-in fade-in duration-300">
          <div className="bg-[#faf8f3]/90 border border-slate-200/80 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row min-h-0 md:min-h-[520px] max-h-[95vh] overflow-y-auto relative">
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
                {/* Progress bar */}
                <div className="w-full h-1 bg-indigo-950 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-400 rounded-full transition-all duration-500" style={{ width: `${(walkthroughStep / 4) * 100}%` }} />
                </div>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4].map(s => (
                    <span key={s} className={`h-1.5 rounded-full transition-all duration-300 ${walkthroughStep === s ? "w-6 bg-indigo-400" : walkthroughStep > s ? "w-3 bg-indigo-400/40" : "w-1.5 bg-indigo-950"}`} />
                  ))}
                </div>
                <p className="text-[10px] text-indigo-300/60 font-semibold uppercase tracking-wider">
                  {wtLanguage === "en" ? `Step ${walkthroughStep} of 4` : `Paso ${walkthroughStep} de 4`}
                </p>
              </div>
            </div>

            {/* Right Side: Setup Wizard Content */}
            <div className="flex-1 p-8 md:p-10 flex flex-col justify-between bg-white text-slate-800">
              {walkthroughStep === 1 && (
                /* Step 1: Welcome Overview */
                <div className="space-y-8 my-auto" onMouseMove={() => setStepInteracted(p => ({...p, 1: true}))}>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-indigo-500 animate-pulse" />
                      {wtLanguage === "en" ? WT_LANG.en.welcomeTitle : WT_LANG.es.welcomeTitle}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {wtLanguage === "en" ? WT_LANG.en.welcomeSubtitle : WT_LANG.es.welcomeSubtitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
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
              )}
              {walkthroughStep === 2 && (
                /* Step 2: Preferences Gathering */
                <div className="space-y-6 my-auto" onMouseMove={() => setStepInteracted(p => ({...p, 2: true}))}>
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {wtLanguage === "en" ? WT_LANG.en.step2Title : WT_LANG.es.step2Title}
                    </h2>
                    <p className="text-xs text-slate-400">
                      {wtLanguage === "en" ? WT_LANG.en.step2Desc : WT_LANG.es.step2Desc}
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Display Name Input */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.displayName : WT_LANG.es.displayName}
                      </label>
                      <input
                        type="text"
                        value={wtDisplayName}
                        onChange={e => { setWtDisplayName(e.target.value); setStepInteracted(p => ({...p, 2: true})); }}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed]/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 placeholder:text-slate-400 font-semibold"
                      />
                    </div>

                    {/* Timezone Select */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {wtLanguage === "en" ? WT_LANG.en.location : WT_LANG.es.location}
                      </label>
                      <select
                        value={wtLocation}
                        onChange={e => setWtLocation(e.target.value)}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#faf6ed]/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 outline-none transition-all text-sm text-slate-800 font-medium appearance-none cursor-pointer"
                      >
                        <option value="" disabled>
                          {wtLanguage === "en" ? WT_LANG.en.locationPlaceholder : WT_LANG.es.locationPlaceholder}
                        </option>
                        {TIMEZONE_OPTIONS.map(tz => (
                          <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                      </select>
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
                              : "bg-[#faf6ed]/30 hover:bg-[#f2ece0]/80 border-slate-200 text-slate-600"
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
                              : "bg-[#faf6ed]/30 hover:bg-[#f2ece0]/80 border-slate-200 text-slate-600"
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
                              : "bg-[#faf6ed]/30 hover:bg-[#f2ece0]/80 border-slate-200 text-slate-600"
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
                              : "bg-[#faf6ed]/30 hover:bg-[#f2ece0]/80 border-slate-200 text-slate-600"
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

              {/* Step 3: Profile Setup */}
              {walkthroughStep === 3 && (
                <div className="space-y-6 my-auto" onMouseMove={() => setStepInteracted(p => ({...p, 3: true}))}>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                      {wtLanguage === "en" ? WT_LANG.en.step3Title : WT_LANG.es.step3Title}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {wtLanguage === "en" ? WT_LANG.en.step3Desc : WT_LANG.es.step3Desc}
                    </p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{wtLanguage === "en" ? WT_LANG.en.organization : WT_LANG.es.organization}</label>
                      <input type="text" value={wtOrganization} onChange={(e) => { setWtOrganization(e.target.value); setStepInteracted(p => ({...p, 3: true})); }}
                        placeholder="e.g., NXT Chapter" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-300 transition-all" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{wtLanguage === "en" ? WT_LANG.en.jobTitle : WT_LANG.es.jobTitle}</label>
                        <input type="text" value={wtJobTitle} onChange={(e) => { setWtJobTitle(e.target.value); setStepInteracted(p => ({...p, 3: true})); }}
                          placeholder="e.g., Program Director" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-300 transition-all" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{wtLanguage === "en" ? WT_LANG.en.department : WT_LANG.es.department}</label>
                        <input type="text" value={wtDepartment} onChange={(e) => { setWtDepartment(e.target.value); setStepInteracted(p => ({...p, 3: true})); }}
                          placeholder="e.g., Operations" className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-300 transition-all" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{wtLanguage === "en" ? WT_LANG.en.industry : WT_LANG.es.industry}</label>
                        <select value={wtIndustry} onChange={(e) => { setWtIndustry(e.target.value); setStepInteracted(p => ({...p, 3: true})); }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all bg-white">
                          <option value="">Select...</option>
                          <option value="nonprofit">Nonprofit</option>
                          <option value="technology">Technology</option>
                          <option value="healthcare">Healthcare</option>
                          <option value="education">Education</option>
                          <option value="finance">Finance</option>
                          <option value="government">Government</option>
                          <option value="consulting">Consulting</option>
                          <option value="marketing">Marketing & Media</option>
                          <option value="real-estate">Real Estate</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{wtLanguage === "en" ? WT_LANG.en.experience : WT_LANG.es.experience}</label>
                        <select value={wtExperience} onChange={(e) => { setWtExperience(e.target.value); setStepInteracted(p => ({...p, 3: true})); }}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all bg-white">
                          <option value="">Select...</option>
                          <option value="< 1 year">&lt; 1 year</option>
                          <option value="1-3 years">1–3 years</option>
                          <option value="3-5 years">3–5 years</option>
                          <option value="5-10 years">5–10 years</option>
                          <option value="10+ years">10+ years</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 4: Tour Offer */}
              {walkthroughStep === 4 && (
                <div className="space-y-6 my-auto">
                  <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-extrabold text-slate-950 tracking-tight">
                      {wtLanguage === "en" ? WT_LANG.en.step4Title : WT_LANG.es.step4Title}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      {wtLanguage === "en" ? WT_LANG.en.step4Desc : WT_LANG.es.step4Desc}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={async () => { await handleCompleteWalkthrough(); setShowGuidedTour(true); }}
                      className="group p-6 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 hover:border-indigo-400 hover:bg-indigo-50 transition-all text-left cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{wtLanguage === "en" ? WT_LANG.en.takeTour : WT_LANG.es.takeTour}</p>
                      <p className="text-xs text-slate-500 mt-1">{wtLanguage === "en" ? WT_LANG.en.takeTourDesc : WT_LANG.es.takeTourDesc}</p>
                    </button>
                    <button
                      type="button"
                      onClick={handleCompleteWalkthrough}
                      className="group p-6 rounded-2xl border-2 border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <ChevronRight className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-bold text-slate-800">{wtLanguage === "en" ? WT_LANG.en.jumpIn : WT_LANG.es.jumpIn}</p>
                      <p className="text-xs text-slate-500 mt-1">{wtLanguage === "en" ? WT_LANG.en.jumpInDesc : WT_LANG.es.jumpInDesc}</p>
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Buttons (Steps 1-3 only, Step 4 has its own buttons) */}
              {walkthroughStep < 4 && (
                <div className="flex items-center justify-between pt-8 border-t border-slate-100 mt-4">
                  {walkthroughStep === 1 ? (
                    <div />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setWalkthroughStep(walkthroughStep - 1)}
                      className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                      {wtLanguage === "en" ? WT_LANG.en.back : WT_LANG.es.back}
                    </button>
                  )}

                  <div className="flex items-center gap-3">
                    <button type="button" onClick={handleSkipWalkthrough}
                      className="text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer">
                      {wtLanguage === "en" ? WT_LANG.en.skip : WT_LANG.es.skip}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStepInteracted(p => ({...p, [walkthroughStep]: true})); setWalkthroughStep(walkthroughStep + 1); }}
                      className={`flex items-center gap-1.5 px-5 py-2.5 font-bold text-xs rounded-xl shadow-md transition-all active:scale-[0.97] ${
                        stepInteracted[walkthroughStep]
                          ? "bg-indigo-600 text-white hover:bg-indigo-700"
                          : "bg-slate-300 text-slate-500 hover:bg-slate-400 hover:text-white"
                      }`}
                    >
                      {wtLanguage === "en" ? WT_LANG.en.next : WT_LANG.es.next}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}
      {/* Leave Cube Transition Overlay */}
      {showLeaveCube && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#ffffff', animation: 'leaveFadeIn 0.3s ease-out' }}>
          <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase' as const, marginBottom: 28, color: 'rgba(79,70,229,0.6)', animation: 'leavePulse 2s ease-in-out infinite' }}>Loading</p>
          <div style={{ width: 64, height: 64, perspective: 400 }}>
            <div style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' as const, animation: 'leaveCubeRotate 6s ease-in-out infinite' }}>
              {['translateZ(32px)', 'rotateY(180deg) translateZ(32px)', 'rotateY(90deg) translateZ(32px)', 'rotateY(-90deg) translateZ(32px)', 'rotateX(90deg) translateZ(32px)', 'rotateX(-90deg) translateZ(32px)'].map((t, i) => (
                <div key={i} style={{ position: 'absolute', width: 64, height: 64, borderRadius: 10, border: '1.5px solid rgba(129,140,248,0.3)', background: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.1) 50%, rgba(167,139,250,0.15) 100%)', boxShadow: 'inset 0 0 20px rgba(99,102,241,0.06), 0 0 15px rgba(99,102,241,0.05)', transform: t }} />
              ))}
            </div>
          </div>
          <div style={{ marginTop: 32, width: 200, height: 3, borderRadius: 2, overflow: 'hidden', background: 'rgba(99,102,241,0.1)' }}>
            <div style={{ height: '100%', borderRadius: 2, background: 'linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)', animation: 'leaveProgress 2s linear forwards', width: 0 }} />
          </div>
          <style>{`
            @keyframes leaveFadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes leavePulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
            @keyframes leaveProgress { 0% { width: 0%; } 100% { width: 100%; } }
            @keyframes leaveCubeRotate {
              0%, 10%   { transform: rotateX(-25deg) rotateY(0deg); }
              15%, 25%  { transform: rotateX(-25deg) rotateY(90deg); }
              30%, 40%  { transform: rotateX(-25deg) rotateY(180deg); }
              45%, 55%  { transform: rotateX(-25deg) rotateY(270deg); }
              60%, 70%  { transform: rotateX(-25deg) rotateY(360deg) rotateZ(5deg); }
              75%, 85%  { transform: rotateX(-25deg) rotateY(450deg) rotateZ(0deg); }
              90%, 100% { transform: rotateX(-25deg) rotateY(540deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
}
