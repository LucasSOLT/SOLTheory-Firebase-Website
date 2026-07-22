"use client";

import { logActivity } from '@/lib/activity-logger';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { TIMEZONE_OPTIONS, useTranslation } from "@/lib/i18n";
import { ArrowLeft, Bell, Lock, User, Globe, Mail, RefreshCw, Loader2, Key, Smartphone, ShieldCheck, Settings, MessageCircle, Wifi, WifiOff, ChevronRight, HardDrive, Eye, EyeOff, Phone, MapPin, Plus, X, Shield } from "lucide-react";
import { useUser, useFirestore, useAuth } from "@/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { isDeveloper, DEVELOPER_COLORS, ROLE_COLORS, ROLE_LABELS, ORG_LABELS, OrgRole } from "@/lib/rbac";

// Translation Dictionary
const localDict = {
  en: {
    settings: "Settings",
    profile: "Profile",
    notifications: "Notifications",
    security: "Security",
    regionLanguage: "Region & Language",
    publicProfile: "Public Profile",
    personalizeInfo: "Personalize how you appear to your organization and AI agents.",
    displayName: "Display Name",
    accountEmail: "Account Email (Read Only)",
    location: "Location / Timezone",
    bio: "Bio & Context",
    bioPlaceholder: "Write a short bio. Internal AI agents can use this to understand your context.",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    saving: "Saving...",
    integrations: "Integrations",
    gmailConnection: "Google Account Connection",
    gmailDesc: "Connect your Google account to let the AI agent read and reply to your inbound emails automatically.",
    gmailConnected: "âœ“ Google Account Connected Successfully",
    connectGmail: "Connect Google Account",
    connected: "Connected",
    syncInbox: "Refresh Account",
    syncing: "Syncing...",
    dailyDigest: "Daily Digest",
    dailyDigestDesc: "Receive a daily summary of organization metrics.",
    systemAlerts: "System Alerts",
    systemAlertsDesc: "Critical notifications about platform updates.",
    smsAlerts: "SMS Alerts",
    smsAlertsDesc: "Receive text messages for urgent security events.",
    passwordReset: "Password Reset",
    passwordResetDesc: "Update your account password securely.",
    sendResetLink: "Send Reset Link",
    twoFactor: "Two-Factor Authentication",
    twoFactorDesc: "Add an extra layer of security to your account.",
    enable2fa: "Enable 2FA",
    activeSessions: "Active Sessions",
    activeSessionsDesc: "Manage devices logged into your account.",
    logoutAll: "Logout All Devices",
    languageSelect: "Select Interface Language",
    languageSelectDesc: "Choose your preferred language for the entire platform interface.",
    english: "English (US)",
    spanish: "EspaÃ±ol (ES)"
  },
  es: {
    settings: "ConfiguraciÃ³n",
    profile: "Perfil",
    notifications: "Notificaciones",
    security: "Seguridad",
    regionLanguage: "RegiÃ³n e Idioma",
    publicProfile: "Perfil PÃºblico",
    personalizeInfo: "Personaliza cÃ³mo te presentas ante tu organizaciÃ³n y los agentes de IA.",
    displayName: "Nombre para Mostrar",
    accountEmail: "Correo de la Cuenta (Solo Lectura)",
    location: "UbicaciÃ³n / Zona Horaria",
    bio: "BiografÃ­a y Contexto",
    bioPlaceholder: "Escribe una breve biografÃ­a. Los agentes de IA internos pueden usar esto para entender tu contexto.",
    cancel: "Cancelar",
    saveChanges: "Guardar Cambios",
    saving: "Guardando...",
    integrations: "Integraciones",
    gmailConnection: "ConexiÃ³n de Google",
    gmailDesc: "Conecta tu cuenta de Google para permitir que el agente de IA lea y responda tus correos entrantes automÃ¡ticamente.",
    gmailConnected: "âœ“ Google Conectado Exitosamente",
    connectGmail: "Conectar Google",
    connected: "Conectado",
    syncInbox: "Sincronizar Bandeja",
    syncing: "Sincronizando...",
    dailyDigest: "Resumen Diario",
    dailyDigestDesc: "Recibe un resumen diario de las mÃ©tricas de tu organizaciÃ³n.",
    systemAlerts: "Alertas del Sistema",
    systemAlertsDesc: "Notificaciones crÃ­ticas sobre actualizaciones de la plataforma.",
    smsAlerts: "Alertas SMS",
    smsAlertsDesc: "Recibe mensajes de texto para eventos urgentes de seguridad.",
    passwordReset: "Restablecer ContraseÃ±a",
    passwordResetDesc: "Actualiza la contraseÃ±a de tu cuenta de forma segura.",
    sendResetLink: "Enviar Enlace",
    twoFactor: "AutenticaciÃ³n de Dos Factores",
    twoFactorDesc: "AÃ±ade una capa extra de seguridad a tu cuenta.",
    enable2fa: "Activar 2FA",
    activeSessions: "Sesiones Activas",
    activeSessionsDesc: "Gestiona los dispositivos con sesiÃ³n iniciada en tu cuenta.",
    logoutAll: "Cerrar Todas las Sesiones",
    languageSelect: "Seleccionar Idioma de la Interfaz",
    languageSelectDesc: "Elige tu idioma preferido para toda la interfaz de la plataforma.",
    english: "InglÃ©s (US)",
    spanish: "EspaÃ±ol (ES)"
  }
};

type Lang = 'en' | 'es';
type Tab = 'general' | 'profile';
type SubPage = null | 'personal-info' | 'sign-in-security' | 'integrations';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { user, isUserLoading } = useUser();
  const { t } = useTranslation();
  const auth = useAuth();
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  
  // States
  const [gmailConnected, setGmailConnected] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");
  
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [lang, setLang] = useState<Lang>('en');

  // Personal Info sub-page states
  const [accountName, setAccountName] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');
  const [userRole, setUserRole] = useState<string>('');

  // Sign-In & Security sub-page states
  const [showPassword, setShowPassword] = useState(false);
  const [passwordVerify, setPasswordVerify] = useState('');
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // QuickBooks states
  const [qbConnected, setQbConnected] = useState(false);
  const [qbError, setQbError] = useState("");
  const [qbConnecting, setQbConnecting] = useState(false);

  // iMessage / BlueBubbles states
  const [imServerUrl, setImServerUrl] = useState("");
  const [imPassword, setImPassword] = useState("");
  const [imConnected, setImConnected] = useState(false);
  const [imTesting, setImTesting] = useState(false);
  const [imSaving, setImSaving] = useState(false);
  const [imMessage, setImMessage] = useState("");
  const [imShowPassword, setImShowPassword] = useState(false);

  useEffect(() => {
    // Load local language
    const savedLang = localStorage.getItem('agent_language') as Lang;
    if (savedLang === 'en' || savedLang === 'es') setLang(savedLang);
    
    // Read tab from query params
    const tabParam = searchParams.get('tab') as Tab;
    if (tabParam && ['general', 'profile'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('agent_language', l);
    if (firestore) logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Changed language to ' + l);
  };

  useEffect(() => {
    if (user) {
      const rawName = user.displayName || "";
      const translatedName = rawName.replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke');
      setDisplayName(translatedName);
      setEmails(user.email ? [user.email] : []);
      setAccountName(translatedName);
      if (firestore) {
        getDoc(doc(firestore, "users", user.uid)).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setBio(data.bio || "");
            setLocation(data.location || "");
            if (data.accountName) {
              const accName = data.accountName.replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke');
              setAccountName(accName);
            }
            if (data.additionalEmails) setEmails([user.email || '', ...data.additionalEmails]);
            if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
            if (data.address) setAddress(data.address);
            if (data.orgRoles && data.orgRoles['nxtchapter']) {
              setUserRole(data.orgRoles['nxtchapter']);
            } else {
              setUserRole(data.role || data.accessLevel || 'user');
            }
            // Load iMessage config
            if (data.imessageServerUrl) {
              setImServerUrl(data.imessageServerUrl);
              setImPassword(data.imessagePassword || "");
              setImConnected(true);
            }
            // Load Twilio messaging status
            if (data.twilioPhoneNumber) {
              setImConnected(true);
              setImServerUrl(data.twilioPhoneNumber);
            }
          }
        });
      }
    }
  }, [user, firestore, lang]);

  useEffect(() => {
    if (isUserLoading) return;

    const rt = searchParams.get("rt");
    const isConnectedParam = searchParams.get("gmail_connected") === "true";
    const errorParam = searchParams.get("error");
    const agent = searchParams.get("agent") || "jarvis";

    if (rt && user?.uid && firestore) {
      setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        [`gmailOAuth_${agent}`]: { refreshToken: rt, connectedAt: new Date().toISOString() }
      }, { merge: true }).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname + `?gmail_connected=true&agent=${agent}`);
        setGmailConnected(true);
        logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Connected Google account');
      }).catch(err => setOauthError("Failed to save credentials: " + err.message));
    } else if (isConnectedParam) {
      setGmailConnected(true);
    } else if (errorParam) {
      setOauthError(errorParam || "Failed to connect Gmail");
    } else if (user?.uid && firestore) {
      getDoc(doc(firestore, "users", user.uid)).then(userDoc => {
        if (userDoc.exists() && userDoc.data()?.[`gmailOAuth_${agent}`]?.refreshToken) {
          setGmailConnected(true);
        }
      }).catch(console.error);
    }
  }, [searchParams, user, firestore, isUserLoading]);

  // â”€â”€ QuickBooks OAuth callback handling â”€â”€
  useEffect(() => {
    if (isUserLoading) return;

    const qbConnectedParam = searchParams.get("qb_connected");
    const qbAccessToken = searchParams.get("qb_access_token");
    const qbRefreshToken = searchParams.get("qb_refresh_token");
    const qbRealmId = searchParams.get("qb_realm_id");
    const qbExpiresIn = searchParams.get("qb_expires_in");
    const qbErrorParam = searchParams.get("error");

    if (qbConnectedParam === "true" && qbRefreshToken && user?.uid && firestore) {
      setDoc(doc(firestore, "users", user.uid), {
        quickbooksOAuth: {
          accessToken: qbAccessToken,
          refreshToken: qbRefreshToken,
          realmId: qbRealmId,
          expiresIn: Number(qbExpiresIn) || 3600,
          connectedAt: new Date().toISOString(),
        }
      }, { merge: true }).then(() => {
        const cleanUrl = window.location.pathname + "?tab=profile&qb_connected=true";
        window.history.replaceState({}, document.title, cleanUrl);
        setQbConnected(true);
        logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Connected QuickBooks account');
      }).catch(err => {
        setQbError("Failed to save QuickBooks credentials: " + err.message);
      });
    } else if (qbConnectedParam === "true") {
      setQbConnected(true);
    } else if (qbConnectedParam === "false" && qbErrorParam) {
      setQbError(qbErrorParam);
    } else if (user?.uid && firestore) {
      getDoc(doc(firestore, "users", user.uid)).then(userDoc => {
        if (userDoc.exists() && userDoc.data()?.quickbooksOAuth?.refreshToken) {
          setQbConnected(true);
        }
      }).catch(console.error);
    }
  }, [searchParams, user, firestore, isUserLoading]);

  const handleSaveProfile = async () => {
    if (!auth || !auth.currentUser || !firestore || !user) return;
    setIsSavingProfile(true);
    setProfileMessage("");
    try {
      await updateProfile(auth.currentUser, { displayName });
      await setDoc(doc(firestore, "users", user.uid), { bio, location, timezone: location }, { merge: true });
      localStorage.setItem('user_timezone', location);
      logActivity(firestore, 'profile_updated', { email: user?.email || '', displayName }, 'Updated profile: display name, bio, timezone');
      setProfileMessage("OK");
    } catch (err: any) {
      console.error(err);
      setProfileMessage("Error");
    } finally {
      setIsSavingProfile(false);
      setTimeout(() => setProfileMessage(""), 3000);
    }
  };

  const handleConnectGmail = async () => {
    const uid = user?.uid;
    if (!uid) {
      setOauthError("You must be logged in to connect Gmail.");
      return;
    }
    window.location.href = `/api/auth/google?uid=${uid}&agentId=jarvis&origin=soltheory`;
  };

  const handleConnectQuickBooks = async () => {
    const uid = user?.uid;
    if (!uid) {
      setQbError("You must be logged in to connect QuickBooks.");
      return;
    }
    setQbConnecting(true);
    window.location.href = `/api/auth/quickbooks?uid=${uid}&origin=soltheory`;
  };

  const handleDisconnectQuickBooks = async () => {
    if (!user?.uid || !firestore) return;
    try {
      await setDoc(doc(firestore, "users", user.uid), { quickbooksOAuth: null }, { merge: true });
      logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Disconnected QuickBooks account');
      setQbConnected(false);
    } catch (err: any) {
      setQbError("Failed to disconnect: " + err.message);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user?.uid || !firestore) return;
    try {
      const agent = searchParams.get("agent") || "jarvis";
      await setDoc(doc(firestore, "users", user.uid), {
        [`gmailOAuth_${agent}`]: null,
        gmailOAuth_jarvis: null,
        gmailOAuth_morpheus: null,
        gmailOAuth_email: null,
        gmailOAuth: null,
      }, { merge: true });
      logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Disconnected Google account');
      setGmailConnected(false);
    } catch (err: any) {
      setOauthError("Failed to disconnect: " + err.message);
    }
  };

  // â”€â”€ iMessage / BlueBubbles handlers â”€â”€
  const handleTestImessage = async () => {
    if (!imServerUrl.trim() || !imPassword.trim()) {
      setImMessage("Please enter both server URL and password.");
      return;
    }
    setImTesting(true);
    setImMessage("");
    try {
      const res = await fetch(`/api/imessage/ping?serverUrl=${encodeURIComponent(imServerUrl.trim())}&password=${encodeURIComponent(imPassword.trim())}`);
      const data = await res.json();
      if (data.connected) {
        setImMessage("âœ“ Connection successful!");
      } else {
        setImMessage(`âœ— ${data.message || "Connection failed."}`);
      }
    } catch (err: any) {
      setImMessage(`âœ— ${err.message}`);
    } finally {
      setImTesting(false);
    }
  };

  const handleSaveImessage = async () => {
    if (!user?.uid || !firestore || !imServerUrl.trim() || !imPassword.trim()) return;
    setImSaving(true);
    setImMessage("");
    try {
      await setDoc(doc(firestore, "users", user.uid), {
        imessageServerUrl: imServerUrl.trim(),
        imessagePassword: imPassword.trim(),
      }, { merge: true });
      logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Saved iMessage connection');
      setImConnected(true);
      setImMessage("✓ iMessage connection saved!");
    } catch (err: any) {
      setImMessage(`✗ Failed to save: ${err.message}`);
    } finally {
      setImSaving(false);
      setTimeout(() => setImMessage(""), 4000);
    }
  };

  const handleDisconnectImessage = async () => {
    if (!user?.uid || !firestore) return;
    try {
      await setDoc(doc(firestore, "users", user.uid), {
        imessageServerUrl: null,
        imessagePassword: null,
      }, { merge: true });
      logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Disconnected iMessage');
      setImConnected(false);
      setImServerUrl("");
      setImPassword("");
      setImMessage("");
    } catch (err: any) {
      setImMessage(`âœ— Failed to disconnect: ${err.message}`);
    }
  };

  const handleSyncInbox = async () => {
    if (!user?.uid || !firestore) return;
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const agent = searchParams.get("agent") || "jarvis";
      const docData = userDoc.data();
      const refreshToken = docData?.[`gmailOAuth_${agent}`]?.refreshToken || 
                           (docData?.gmailOAuth_jarvis?.refreshToken || docData?.gmailOAuth_morpheus?.refreshToken) ||
                           docData?.gmailOAuth_email?.refreshToken ||
                           docData?.gmailOAuth?.refreshToken;
                           
      if (!refreshToken) throw new Error("Gmail not connected or token missing.");

      const res = await fetch("/api/webhooks/gmail/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uid: user.uid, refreshToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync");
      setSyncMessage("OK");
    } catch(err: any) {
      setSyncMessage("Error");
    } finally {
      setIsSyncing(false);
    }
  };

  const dict = localDict[lang];

  // Dark mode state for settings page
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('insight_theme');
    if (saved === 'dark') setIsDarkMode(true);
    const handler = (e: StorageEvent) => {
      if (e.key === 'insight_theme') setIsDarkMode(e.newValue === 'dark');
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  return (
    <div className={`flex flex-col h-full overflow-y-auto transition-colors duration-500 ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#faf6ed] text-slate-800'}`}>
      <main className="flex-grow py-8 px-4 md:px-8 relative">
        <div className="w-full max-w-[1200px] mx-auto space-y-6">
          <div className="flex items-center gap-4 relative z-20">
            <h1 className={`text-3xl font-extrabold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{dict.settings}</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-8 pt-4">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-56 flex flex-col gap-4 shrink-0">
              
              {/* User Profile Box */}
              <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200/80'} border rounded-2xl p-5 shadow-sm flex flex-col items-center text-center`}>
                <div className={`w-16 h-16 rounded-full ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-white'} border-4 shadow-lg overflow-hidden flex items-center justify-center text-xl font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} mb-2`}>
                  {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : (user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                </div>
                <h3 className={`font-bold text-base line-clamp-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{(user?.displayName || "User").replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke')}</h3>
                <p className={`text-[10px] font-medium uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{user?.email}</p>
              </div>

              {/* Profile Section */}
              <div className="space-y-1">
                <button 
                  onClick={() => { setActiveTab('profile'); setSubPage(null); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'profile' ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white') : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}
                >
                  <User className="w-4 h-4" /> {dict.profile}
                </button>
              </div>

              {/* Separator */}
              <div className={`h-px ${isDarkMode ? 'bg-slate-700/60' : 'bg-slate-200/80'}`} />

              {/* General Section */}
              <div className="space-y-1">
                <button 
                  onClick={() => setActiveTab('general')}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'general' ? (isDarkMode ? 'bg-slate-800 text-white' : 'bg-slate-900 text-white') : (isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100')}`}
                >
                  <Settings className="w-4 h-4" /> {t.general}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 space-y-6 min-w-0">
              
              {activeTab === 'general' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm`}>
                    <div className="px-8 pt-7 pb-2">
                      <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.general}</h2>
                      <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.managePlatformPrefs}</p>
                    </div>
                    <div className="px-8 pb-8 pt-4 space-y-0">
                      <div className={`flex items-center justify-between py-5 ${isDarkMode ? 'border-slate-700/40' : 'border-slate-100'} border-b`}>
                        <div className="space-y-0.5">
                          <span className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.darkMode}</span>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.darkModeDesc}</p>
                        </div>
                        <Switch 
                          checked={isDarkMode}
                          onCheckedChange={(checked) => {
                            localStorage.setItem('insight_theme', checked ? 'dark' : 'light');
                            window.dispatchEvent(new StorageEvent('storage', { key: 'insight_theme', newValue: checked ? 'dark' : 'light' }));
                            setIsDarkMode(checked);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">

                  {/* ====== SUB-PAGE: Personal Information ====== */}
                  {subPage === 'personal-info' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? "Volver al Perfil" : "Back to Profile"}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm`}>
                        <div className="px-8 pt-7 pb-2">
                          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.personalInfo}</h2>
                          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.personalInfoDesc}</p>
                        </div>
                        <div className="px-8 pb-8 pt-4 space-y-6">
                          {/* Account Name */}
                          <div className="space-y-1.5">
                            <Label className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.accountName}</Label>
                            <Input value={accountName} onChange={e => setAccountName(e.target.value)} placeholder={lang === 'es' ? "Tu nombre legal o de la cuenta" : "Your legal or account name"} className={`${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-10`} />
                            <p className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.accountNameNote}</p>
                            
                            {/* Role Badge */}
                            <div className="pt-1">
                              {isDeveloper(user?.email) ? (
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${DEVELOPER_COLORS.bg} ${DEVELOPER_COLORS.text} ${DEVELOPER_COLORS.border} ${isDarkMode ? `${DEVELOPER_COLORS.darkBg} ${DEVELOPER_COLORS.darkText} ${DEVELOPER_COLORS.darkBorder}` : ''}`}>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Developer &middot; {ORG_LABELS['nxtchapter']}
                                </div>
                              ) : userRole ? (
                                (() => {
                                  const normalizedRole = (Object.keys(ROLE_LABELS).includes(userRole.toLowerCase()) ? userRole.toLowerCase() : 'user') as OrgRole;
                                  const colors = ROLE_COLORS[normalizedRole] || ROLE_COLORS['user'];
                                  const label = ROLE_LABELS[normalizedRole] || userRole;
                                  return (
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${colors.bg} ${colors.text} ${colors.border} ${isDarkMode ? `${colors.darkBg} ${colors.darkText} ${colors.darkBorder}` : ''}`}>
                                      <Shield className="w-3.5 h-3.5" />
                                      {label} &middot; {ORG_LABELS['nxtchapter']}
                                    </div>
                                  );
                                })()
                              ) : null}
                            </div>
                          </div>

                          {/* Emails */}
                          <div className="space-y-3">
                            <Label className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.emailAddresses}</Label>
                            <div className="space-y-2">
                              {emails.map((email, i) => (
                                <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-slate-800/60 border-slate-700/40' : 'bg-slate-50 border-slate-100'} border`}>
                                  <Mail className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                                  <span className={`text-sm flex-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{email}</span>
                                  {i === 0 && <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-500'}`}>{t.primary}</span>}
                                  {i > 0 && <button onClick={() => setEmails(emails.filter((_, j) => j !== i))} className={`${isDarkMode ? 'text-slate-500 hover:text-red-400' : 'text-slate-300 hover:text-red-500'} transition-colors`}><X className="w-3.5 h-3.5" /></button>}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder={lang === 'es' ? "Agregar otro correo" : "Add another email"} className={`${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-9 text-sm`} />
                              <Button onClick={() => { if (newEmail.trim() && newEmail.includes('@')) { setEmails([...emails, newEmail.trim()]); setNewEmail(''); }}} variant="outline" className={`h-9 px-3 shrink-0 ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}><Plus className="w-3.5 h-3.5" /></Button>
                            </div>
                          </div>

                          {/* Phone */}
                          <div className="space-y-1.5">
                            <Label className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.phoneNumber}</Label>
                            <div className="relative">
                              <Phone className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                              <Input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+1 (555) 000-0000" className={`pl-10 ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-10`} />
                            </div>
                          </div>

                          {/* Address */}
                          <div className="space-y-1.5">
                            <Label className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.address}</Label>
                            <div className="relative">
                              <MapPin className={`absolute left-3 top-3 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                              <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main St, City, State ZIP" className={`w-full h-20 pl-10 p-3 rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400'} border focus:outline-none focus:ring-2 focus:ring-slate-400/30 text-sm resize-none`} />
                            </div>
                          </div>

                          <div className="flex justify-end pt-2">
                            <Button onClick={async () => { if (!user?.uid || !firestore) return; try { await setDoc(doc(firestore, 'users', user.uid), { accountName, additionalEmails: emails.slice(1), phoneNumber, address }, { merge: true }); setProfileMessage('OK'); } catch { setProfileMessage('Error'); } setTimeout(() => setProfileMessage(''), 3000); }} className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-5 rounded-lg shadow-sm">{t.saveChanges}</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Sign-In & Security ====== */}
                  {subPage === 'sign-in-security' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? "Volver al Perfil" : "Back to Profile"}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm`}>
                        <div className="px-8 pt-7 pb-2">
                          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.security}</h2>
                          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.securityDesc}</p>
                        </div>
                        <div className="px-8 pb-8 pt-4 space-y-6">

                          {/* Current Password */}
                          <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-slate-50 border-slate-100'} border space-y-3`}>
                            <div>
                              <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.currentPassword}</h3>
                              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.currentPasswordDesc}</p>
                            </div>

                            <div className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border`}>
                              <Key className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
                              <span className={`text-sm flex-1 ${passwordVerified && showPassword ? (isDarkMode ? 'text-slate-200' : 'text-slate-700') : 'tracking-[4px] ' + (isDarkMode ? 'text-slate-400' : 'text-slate-500')}`}>{passwordVerified && showPassword ? passwordVerify : '••••••••••••'}</span>
                              <button onClick={() => { if (passwordVerified) { setShowPassword(!showPassword); } else { setShowPasswordModal(true); }}} className={`${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors p-1 rounded-md ${isDarkMode ? 'hover:bg-slate-700/50' : 'hover:bg-slate-100/50'}`}>
                                {passwordVerified && showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>

                            <button onClick={() => setShowResetModal(true)} className="text-xs font-medium text-blue-500 hover:text-blue-600 hover:underline transition-colors">
                              {lang === 'es' ? "Restablecer mi contraseña" : "Reset my password"}
                            </button>
                          </div>

                          {/* Verify Password Modal Overlay */}
                          {showPasswordModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                              <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300`}>
                                <h3 className={`text-base font-semibold mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.verifyIdentity}</h3>
                                <p className={`text-xs mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{lang === 'es' ? "Ingresa tu contraseña actual para verla. Se ocultará automáticamente después de 30 segundos por seguridad." : "Enter your current password to reveal it. It will auto-hide after 30 seconds for security."}</p>
                                <Input type="password" value={passwordVerify} onChange={e => setPasswordVerify(e.target.value)} placeholder={lang === 'es' ? "Ingresa la contraseña actual" : "Enter current password"} autoFocus onKeyDown={e => { if (e.key === 'Enter' && passwordVerify.length >= 1) { setPasswordVerified(true); setShowPassword(true); setShowPasswordModal(false); setTimeout(() => { setShowPassword(false); setPasswordVerified(false); setPasswordVerify(''); }, 30000); }}} className={`${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-10 mb-4`} />
                                <div className="flex gap-2 justify-end">
                                  <Button variant="ghost" onClick={() => { setShowPasswordModal(false); setPasswordVerify(''); }} className={`h-9 text-sm ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>{t.cancel}</Button>
                                  <Button onClick={() => { if (passwordVerify.length >= 1) { setPasswordVerified(true); setShowPassword(true); setShowPasswordModal(false); setTimeout(() => { setShowPassword(false); setPasswordVerified(false); setPasswordVerify(''); }, 30000); }}} className="h-9 text-sm bg-slate-900 hover:bg-slate-800 text-white px-5 rounded-lg shadow-sm">{t.confirm}</Button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Reset Password Modal */}
                          {showResetModal && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                              <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'} border rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 animate-in zoom-in-95 slide-in-from-bottom-4 duration-300`}>
                                {!resetEmailSent ? (
                                  <>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                      <Mail className="w-6 h-6" />
                                    </div>
                                    <h3 className={`text-base font-semibold text-center mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.resetPassword}</h3>
                                    <p className={`text-xs text-center mb-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{lang === 'es' ? <>Enviaremos un enlace de restablecimiento de contraseña a tu correo electrónico <span className="font-semibold">{user?.email}</span>. Haz clic en el enlace para establecer una nueva contraseña.</> : <>We&apos;ll send a password reset link to your email address <span className="font-semibold">{user?.email}</span>. Click the link to set a new password.</>}</p>
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="ghost" onClick={() => setShowResetModal(false)} className={`h-9 text-sm ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>{t.cancel}</Button>
                                      <Button onClick={async () => { if (auth && user?.email) { try { await sendPasswordResetEmail(auth, user.email, { url: `${window.location.origin}/portal/dashboard/soltheory/settings?tab=profile&passwordReset=success`, handleCodeInApp: false }); setResetEmailSent(true); setPasswordVerified(false); setPasswordVerify(''); setShowPassword(false); if (firestore) logActivity(firestore, 'settings_changed', { email: user.email, displayName: user.displayName }, 'Password reset email sent'); } catch(e) { console.error(e); }}}} className="h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg shadow-sm">{t.sendResetEmail}</Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-emerald-500/10 text-emerald-500`}>
                                      <Mail className="w-6 h-6" />
                                    </div>
                                    <h3 className={`text-base font-semibold text-center mb-1 ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.checkEmail}</h3>
                                    <p className={`text-xs text-center mb-2 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{lang === 'es' ? <>Hemos enviado un enlace de restablecimiento a <span className="font-semibold">{user?.email}</span>. Haz clic en el enlace del correo para crear una nueva contraseña.</> : <>We&apos;ve sent a password reset link to <span className="font-semibold">{user?.email}</span>. Click the link in the email to create a new password.</>}</p>
                                    <p className={`text-xs text-center mb-5 ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600'}`}>{lang === 'es' ? <>💡 ¿No lo ves? Revisa tu <span className="font-semibold">carpeta de correo no deseado o spam</span>.</> : <>💡 Don&apos;t see it? Check your <span className="font-semibold">spam or junk folder</span>.</>}</p>
                                    <div className="flex justify-center">
                                      <Button onClick={() => { setShowResetModal(false); setResetEmailSent(false); setPasswordVerified(false); setPasswordVerify(''); setShowPassword(false); }} className={`h-9 text-sm px-6 rounded-lg shadow-sm ${isDarkMode ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>{t.doneBtnLabel}</Button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 2FA */}
                          <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-slate-50 border-slate-100'} border`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                                  <Shield className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.twoFactorAuth}</h3>
                                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.twoFactorDesc}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>{t.notEnabled}</span>
                                <Button variant="outline" className={`h-9 text-sm ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{lang === 'es' ? "Activar 2FA" : "Enable 2FA"}</Button>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Third-Party Integrations ====== */}
                  {subPage === 'integrations' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? "Volver al Perfil" : "Back to Profile"}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm`}>
                        <div className="px-8 pt-7 pb-2">
                          <h2 className={`text-lg font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.integrations}</h2>
                          <p className={`text-sm mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.integrationsDesc}</p>
                        </div>
                        <div className="px-8 pb-8 pt-4 space-y-0">

                          {/* SMS / Text Messaging */}
                          <div className={`flex items-center justify-between py-6 ${isDarkMode ? 'border-slate-700/40' : 'border-slate-100'} border-b`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                <MessageCircle className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.smsIntegration}</h3>
                                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.smsIntegrationDesc}</p>
                                {imConnected && imServerUrl && (
                                  <p className="text-xs text-emerald-500 font-medium mt-1 flex items-center gap-1"><Wifi className="w-3 h-3" /> Active · <span className="font-mono text-emerald-600">{imServerUrl}</span></p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {imConnected && imServerUrl ? (
                                <>
                                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{t.connected}</span>
                                  <Button variant="outline" onClick={handleDisconnectImessage} className={`h-8 px-3 text-xs ${isDarkMode ? 'border-slate-600 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>{t.disconnect}</Button>
                                </>
                              ) : (
                                <Button onClick={() => window.location.href = window.location.pathname.replace("/settings", "/communications/imessage")} className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-4 rounded-lg shadow-sm">{t.setUp}</Button>
                              )}
                            </div>
                          </div>

                          {/* Google Account */}
                          <div className={`flex items-center justify-between py-6 ${isDarkMode ? 'border-slate-700/40' : 'border-slate-100'} border-b`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                                <Mail className="w-5 h-5" />
                              </div>
                              <div>
                                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.googleAccount}</h3>
                                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.googleAccountDesc}</p>
                                {gmailConnected && <p className="text-xs text-emerald-500 font-medium mt-1">✓ Connected Successfully</p>}
                                {oauthError && <p className="text-xs text-red-400 font-medium mt-1">✗ {oauthError}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {gmailConnected ? (
                                <>
                                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{t.connected}</span>
                                  <Button variant="outline" onClick={handleSyncInbox} disabled={isSyncing} className={`h-8 px-3 text-xs ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    {isSyncing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Refresh
                                  </Button>
                                  <Button variant="outline" onClick={handleDisconnectGmail} className={`h-8 px-3 text-xs ${isDarkMode ? 'border-slate-600 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>{t.disconnect}</Button>
                                </>
                              ) : (
                                <Button onClick={handleConnectGmail} disabled={isUserLoading} className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-4 rounded-lg shadow-sm">
                                  <Mail className="w-3.5 h-3.5 mr-1.5" /> Connect
                                </Button>
                              )}
                            </div>
                          </div>

                          {/* QuickBooks */}
                          <div className={`flex items-center justify-between py-6`}>
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-600'}`}>
                                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6zm4 4h-2v-2h2v2zm0-4h-2V7h2v6z" /></svg>
                              </div>
                              <div>
                                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.quickbooksLabel}</h3>
                                <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.quickbooksDesc}</p>
                                {qbConnected && <p className="text-xs text-emerald-500 font-medium mt-1">✓ Connected Successfully</p>}
                                {qbError && <p className="text-xs text-red-400 font-medium mt-1">✗ {qbError}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {qbConnected ? (
                                <>
                                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{t.connected}</span>
                                  <Button variant="outline" onClick={handleDisconnectQuickBooks} className={`h-8 px-3 text-xs ${isDarkMode ? 'border-slate-600 text-red-400 hover:bg-red-500/10' : 'border-slate-200 text-red-500 hover:bg-red-50'}`}>{t.disconnect}</Button>
                                </>
                              ) : (
                                <Button onClick={handleConnectQuickBooks} disabled={isUserLoading || qbConnecting} className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-4 rounded-lg shadow-sm">
                                  {qbConnecting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null} Connect
                                </Button>
                              )}
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== MAIN PROFILE VIEW (when no subPage) ====== */}
                  {subPage === null && (
                    <>
                  {/* Public Profile Card */}
                  <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm overflow-hidden`}>
                    <div className={`h-24 w-full ${isDarkMode ? 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800' : 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900'} relative`}>
                      <div className="absolute -bottom-8 left-8">
                        <div className={`w-16 h-16 rounded-full border-4 ${isDarkMode ? 'border-slate-900 bg-slate-700' : 'border-white bg-slate-100'} flex items-center justify-center text-2xl font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-900'} shadow-lg overflow-hidden`}>
                          {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : (displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-12 pb-6 px-8 space-y-5">
                      <div>
                        <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{dict.publicProfile}</h2>
                        <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.personalizeInfo}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="name" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.displayName}</Label>
                          <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Jane Doe" className={`${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-10`} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="email" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.accountEmail}</Label>
                          <Input id="email" type="email" value={user?.email || ""} readOnly className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'} cursor-not-allowed h-10`} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="location" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.location}</Label>
                          <select id="location" value={location} onChange={e => setLocation(e.target.value)} className={`w-full px-3 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'} focus:outline-none focus:ring-2 focus:ring-slate-400/30 h-10 text-sm appearance-none cursor-pointer`}>
                            <option value="">{dict.location}...</option>
                            {TIMEZONE_OPTIONS.map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                          <Label htmlFor="bio" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.bio}</Label>
                          <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder={dict.bioPlaceholder} className={`w-full h-24 p-3 rounded-lg ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-600' : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder:text-slate-400'} border focus:outline-none focus:ring-2 focus:ring-slate-400/30 text-sm resize-none transition-all`} />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-2">
                        {profileMessage && <span className={`text-xs font-medium px-3 py-1.5 rounded-lg ${profileMessage.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{profileMessage === 'OK' ? 'Saved' : profileMessage}</span>}
                        <Button variant="ghost" className={`text-sm h-9 ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}`}>{dict.cancel}</Button>
                        <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="bg-slate-900 hover:bg-slate-800 text-white text-sm h-9 px-5 rounded-lg shadow-sm">
                          {isSavingProfile ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                          {isSavingProfile ? dict.saving : dict.saveChanges}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Account Menu - Section 1 */}
                  <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm overflow-hidden`}>
                    <div className={`divide-y ${isDarkMode ? 'divide-slate-700/40' : 'divide-slate-100'}`}>
                      {[
                        { icon: <User className="w-4 h-4" />, label: t.personalInfo, desc: t.personalInfoDescShort, action: () => setSubPage('personal-info') },
                        { icon: <Lock className="w-4 h-4" />, label: t.security, desc: t.securityDescShort, action: () => setSubPage('sign-in-security') },
                        { icon: <Smartphone className="w-4 h-4" />, label: t.paymentShipping, desc: t.paymentShippingDesc, action: undefined },
                        { icon: <Bell className="w-4 h-4" />, label: t.subscriptionsLabel, desc: t.subscriptionsDesc, action: undefined },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${item.action ? 'cursor-pointer' : 'cursor-default'} ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.label}</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Account Menu - Section 2 */}
                  <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl shadow-sm overflow-hidden`}>
                    <div className={`divide-y ${isDarkMode ? 'divide-slate-700/40' : 'divide-slate-100'}`}>
                      {[
                        { icon: <HardDrive className="w-4 h-4" />, label: t.cloudStorage, desc: t.cloudStorageDesc, action: undefined },
                        { icon: <Globe className="w-4 h-4" />, label: t.integrations, desc: t.integrationsDescShort, action: () => setSubPage('integrations') },
                        { icon: <Smartphone className="w-4 h-4" />, label: t.signedInDevices, desc: t.signedInDevicesDesc, action: undefined },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${item.action ? 'cursor-pointer' : 'cursor-default'} ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{item.label}</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

