"use client";

import { logActivity } from '@/lib/activity-logger';
import { useParams } from 'next/navigation';
import { useOrgId } from "@/contexts/OrgContext";
import { getOrgLabel } from "@/lib/org-config";
import { useTheme } from '@/components/ThemeProvider';
import { getAuthHeaders } from "@/lib/api-auth-client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { TIMEZONE_OPTIONS, useTranslation } from "@/lib/i18n";
import { ArrowLeft, Bell, Lock, User, Globe, Mail, RefreshCw, Loader2, Key, Smartphone, ShieldCheck, Settings, MessageCircle, Wifi, WifiOff, ChevronRight, HardDrive, Eye, EyeOff, Phone, MapPin, Plus, X, Shield, Users as UsersIcon, Code, Clock, Copy, Check, Camera, Monitor } from "lucide-react";
import { useUser, useFirestore, useAuth, useStorage } from "@/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { updateProfile, sendPasswordResetEmail } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";
import { useCrmPermissions } from "@/hooks/useCrmPermissions";
import OrgRBACPanel from "@/components/settings/OrgRBACPanel";
import AuditLogPanel from "@/components/settings/AuditLogPanel";
import TwoFactorSetup from "@/components/settings/TwoFactorSetup";
import { isDeveloper, isOracle, DEVELOPER_COLORS, ORACLE_COLORS, ROLE_COLORS, ROLE_LABELS, ORG_LABELS, OrgRole } from "@/lib/rbac";

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
    gmailConnected: "✓ Google Account Connected Successfully",
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
    spanish: "Español (ES)",
    changePhoto: "Change Photo"
  },
  es: {
    settings: "Configuración",
    profile: "Perfil",
    notifications: "Notificaciones",
    security: "Seguridad",
    regionLanguage: "Región e Idioma",
    publicProfile: "Perfil Público",
    personalizeInfo: "Personaliza cómo te presentas ante tu organización y los agentes de IA.",
    displayName: "Nombre para Mostrar",
    accountEmail: "Correo de la Cuenta (Solo Lectura)",
    location: "Ubicación / Zona Horaria",
    bio: "Biografía y Contexto",
    bioPlaceholder: "Escribe una breve biografía. Los agentes de IA internos pueden usar esto para entender tu contexto.",
    cancel: "Cancelar",
    saveChanges: "Guardar Cambios",
    saving: "Guardando...",
    integrations: "Integraciones",
    gmailConnection: "Conexión de Google",
    gmailDesc: "Conecta tu cuenta de Google para permitir que el agente de IA lea y responda tus correos entrantes automáticamente.",
    gmailConnected: "✓ Google Conectado Exitosamente",
    connectGmail: "Conectar Google",
    connected: "Conectado",
    syncInbox: "Sincronizar Bandeja",
    syncing: "Sincronizando...",
    dailyDigest: "Resumen Diario",
    dailyDigestDesc: "Recibe un resumen diario de las métricas de tu organización.",
    systemAlerts: "Alertas del Sistema",
    systemAlertsDesc: "Notificaciones críticas sobre actualizaciones de la plataforma.",
    smsAlerts: "Alertas SMS",
    smsAlertsDesc: "Recibe mensajes de texto para eventos urgentes de seguridad.",
    passwordReset: "Restablecer Contraseña",
    passwordResetDesc: "Actualiza la contraseña de tu cuenta de forma segura.",
    sendResetLink: "Enviar Enlace",
    twoFactor: "Autenticación de Dos Factores",
    twoFactorDesc: "Añade una capa extra de seguridad a tu cuenta.",
    enable2fa: "Activar 2FA",
    activeSessions: "Sesiones Activas",
    activeSessionsDesc: "Gestiona los dispositivos con sesión iniciada en tu cuenta.",
    logoutAll: "Cerrar Todas las Sesiones",
    languageSelect: "Seleccionar Idioma de la Interfaz",
    languageSelectDesc: "Elige tu idioma preferido para toda la interfaz de la plataforma.",
    english: "Inglés (US)",
    spanish: "Español (ES)",
    changePhoto: "Cambiar Foto"
  }
};

type Lang = 'en' | 'es';
type Tab = 'general' | 'profile';
type SubPage = null | 'personal-info' | 'sign-in-security' | 'integrations' | 'org-rbac' | 'audit-log' | 'payment-shipping' | 'subscriptions' | 'cloud-storage' | 'signed-in-devices';

export default function SettingsPage() {
  const orgId = useOrgId();
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const orgId = useOrgId();
  const { user, isUserLoading } = useUser();
  const { t } = useTranslation();
  const auth = useAuth();
  const firestore = useFirestore();
  const storage = useStorage();
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
  const [copiedUid, setCopiedUid] = useState(false);

  // Avatar / Profile picture states & handlers
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !storage) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError(lang === 'es' ? 'Por favor selecciona un archivo de imagen válido.' : 'Please select a valid image file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(lang === 'es' ? 'La imagen no debe superar los 5MB.' : 'Image must be under 5MB.');
      return;
    }

    setIsUploadingAvatar(true);
    setAvatarError('');

    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const storageRef = ref(storage, `profile_pictures/${user.uid}/avatar.${ext}`);
      await uploadBytes(storageRef, file, { contentType: file.type });
      const downloadURL = await getDownloadURL(storageRef);

      // 1. Update Firebase Auth user
      if (auth?.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
      }

      // 2. Update Firestore user document
      if (firestore) {
        const userRef = doc(firestore, 'users', user.uid);
        await setDoc(userRef, { photoURL: downloadURL, updatedAt: new Date().toISOString() }, { merge: true });
        logActivity(firestore, 'settings_changed', { email: user.email || '', displayName: user.displayName || '' }, 'Updated profile picture');
      }

      setAvatarUrl(downloadURL);
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setAvatarError(lang === 'es' ? 'Error al subir la foto de perfil. Inténtalo de nuevo.' : 'Failed to upload profile picture. Please try again.');
    } finally {
      setIsUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };
  
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
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetError, setResetError] = useState('');
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

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

    // Support deep linking to subPages (e.g. ?subPage=org-rbac from /end-users redirect)
    const subPageParam = searchParams.get('subPage') as SubPage;
    if (subPageParam && ['personal-info', 'sign-in-security', 'integrations', 'org-rbac', 'dev-settings', 'audit-log'].includes(subPageParam)) {
      setSubPage(subPageParam);
    }
  }, [searchParams]);

  // Read 2FA status from Firestore user doc
  useEffect(() => {
    if (!firestore || !user?.uid) return;
    const userRef = doc(firestore, "users", user.uid);
    getDoc(userRef).then(docSnap => {
      if (docSnap.exists() && docSnap.data().twoFactorEnabled) {
        setIs2FAEnabled(true);
      }
    }).catch(err => console.error("[Settings] 2FA status check error:", err));
  }, [firestore, user?.uid]);

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('agent_language', l);
    if (firestore) logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Changed language to ' + l);
  };

  useEffect(() => {
    if (user) {
      if (user.photoURL) setAvatarUrl(user.photoURL);
      const rawName = user.displayName || "";
      const translatedName = rawName.replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke');
      setDisplayName(translatedName);
      setEmails(user.email ? [user.email] : []);
      setAccountName(translatedName);
      if (firestore) {
        getDoc(doc(firestore, "users", user.uid)).then(docSnap => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.photoURL) setAvatarUrl(data.photoURL);
            setBio(data.bio || "");
            setLocation(data.location || "");
            if (data.accountName) {
              const accName = data.accountName.replace(/\bLuke\b/g, lang === 'es' ? 'Lucas' : 'Luke');
              setAccountName(accName);
            }
            if (data.additionalEmails) setEmails([user.email || '', ...data.additionalEmails]);
            if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
            if (data.address) setAddress(data.address);
            if (data.orgRoles && data.orgRoles[orgId]) {
              setUserRole(data.orgRoles[orgId]);
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
      setSubPage('integrations');
      setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        [`gmailOAuth_${agent}`]: { refreshToken: rt, connectedAt: new Date().toISOString() }
      }, { merge: true }).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname + `?gmail_connected=true&agent=${agent}`);
        setGmailConnected(true);
        logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, 'Connected Google account');
      }).catch(err => setOauthError("Failed to save credentials: " + err.message));
    } else if (isConnectedParam) {
      setSubPage('integrations');
      setGmailConnected(true);
    } else if (errorParam) {
      setSubPage('integrations');
      setOauthError(decodeURIComponent(errorParam) || "Failed to connect Gmail");
    } else if (user?.uid && firestore) {
      getDoc(doc(firestore, "users", user.uid)).then(userDoc => {
        if (userDoc.exists() && userDoc.data()?.[`gmailOAuth_${agent}`]?.refreshToken) {
          setGmailConnected(true);
        }
      }).catch(console.error);
    }
  }, [searchParams, user, firestore, isUserLoading]);

  // ─── QuickBooks OAuth callback handling ───
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
    window.location.href = `/api/auth/google?uid=${uid}&agentId=jarvis&origin=${orgId}`;
  };

  const handleConnectQuickBooks = async () => {
    const uid = user?.uid;
    if (!uid) {
      setQbError("You must be logged in to connect QuickBooks.");
      return;
    }
    setQbConnecting(true);
    window.location.href = `/api/auth/quickbooks?uid=${uid}&origin=${orgId}`;
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

  // ─── iMessage / BlueBubbles handlers ───
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
        setImMessage("✓ Connection successful!");
      } else {
        setImMessage(`✗ ${data.message || "Connection failed."}`);
      }
    } catch (err: any) {
      setImMessage(`✗ ${err.message}`);
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
      setImMessage(`✗ Failed to disconnect: ${err.message}`);
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
        headers: await getAuthHeaders(),
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

  // Dark mode from centralized ThemeProvider
  const { isDarkMode, setTheme: setAppTheme } = useTheme();

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
                <div 
                  onClick={() => avatarInputRef.current?.click()}
                  className={`w-16 h-16 rounded-full ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-slate-100 border-white'} border-4 shadow-lg overflow-hidden flex items-center justify-center text-xl font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} mb-2 relative group cursor-pointer`}
                  title={dict.changePhoto || "Change Photo"}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                  ) : (avatarUrl || user?.photoURL) ? (
                    <img src={avatarUrl || user?.photoURL || undefined} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    (user?.displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-4 h-4" />
                  </div>
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
                            setAppTheme(checked ? 'dark' : 'light');
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
                              {isOracle(user?.email) ? (
                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isDarkMode ? `${ORACLE_COLORS.darkBg} ${ORACLE_COLORS.darkText} ${ORACLE_COLORS.darkBorder}` : `${ORACLE_COLORS.bg} ${ORACLE_COLORS.text} ${ORACLE_COLORS.border}`}`}>
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  Oracle &middot; {getOrgLabel(orgId)}
                                </div>
                              ) : userRole ? (
                                (() => {
                                  const normalizedRole = (Object.keys(ROLE_LABELS).includes(userRole.toLowerCase()) ? userRole.toLowerCase() : 'user') as OrgRole;
                                  const colors = ROLE_COLORS[normalizedRole] || ROLE_COLORS['user'];
                                  const label = ROLE_LABELS[normalizedRole] || userRole;
                                  return (
                                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isDarkMode ? `${colors.darkBg} ${colors.darkText} ${colors.darkBorder}` : `${colors.bg} ${colors.text} ${colors.border}`}`}>
                                      <Shield className="w-3.5 h-3.5" />
                                      {label} &middot; {getOrgLabel(orgId)}
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

                            <button onClick={() => { setShowResetModal(true); setResetEmailInput(user?.email || ''); setResetError(''); setResetEmailSent(false); }} className="text-xs font-medium text-blue-500 hover:text-blue-600 hover:underline transition-colors">
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
                                    <p className={`text-xs text-center mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                      {lang === 'es' ? 'Confirma tu correo electrónico para recibir el enlace de restablecimiento.' : 'Confirm your email address to receive the reset link.'}
                                    </p>
                                    <div className="mb-4">
                                      <label className={`block text-xs font-medium mb-1.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {lang === 'es' ? 'Tu correo electrónico' : 'Your email address'}
                                      </label>
                                      <input
                                        type="email"
                                        value={resetEmailInput}
                                        onChange={e => setResetEmailInput(e.target.value)}
                                        placeholder={user?.email || 'your@email.com'}
                                        autoFocus
                                        className={`w-full h-10 px-3 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-700 placeholder:text-slate-400'}`}
                                      />
                                      {resetEmailInput.trim() && resetEmailInput.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase() && (
                                        <p className="text-xs text-red-500 mt-1.5 font-medium">
                                          {lang === 'es' ? 'El correo no coincide con tu cuenta.' : "Email doesn't match your account."}
                                        </p>
                                      )}
                                      {resetEmailInput.trim() && resetEmailInput.trim().toLowerCase() === (user?.email || '').trim().toLowerCase() && (
                                        <p className="text-xs text-emerald-500 mt-1.5 font-medium">✓ {lang === 'es' ? 'Coincide' : 'Email matches'}</p>
                                      )}
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                      <Button variant="ghost" onClick={() => { setShowResetModal(false); setResetEmailInput(''); setResetError(''); }} className={`h-9 text-sm ${isDarkMode ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-800'}`}>{t.cancel}</Button>
                                      <Button
                                        disabled={!resetEmailInput.trim() || resetEmailInput.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase() || resetSending}
                                        onClick={async () => {
                                          const targetEmail = (user?.email || resetEmailInput).trim();
                                          if (auth && targetEmail) {
                                            setResetSending(true);
                                            setResetError('');
                                            try {
                                              await sendPasswordResetEmail(auth, targetEmail);
                                              setResetEmailSent(true);
                                              setPasswordVerified(false);
                                              setPasswordVerify('');
                                              setShowPassword(false);
                                              if (firestore) logActivity(firestore, 'settings_changed', { email: targetEmail, displayName: user?.displayName || '' }, 'Password reset email sent');
                                            } catch(e: any) {
                                              console.error('[Settings] Password reset error:', e);
                                              const msg = e?.code === 'auth/too-many-requests' ? (lang === 'es' ? 'Demasiados intentos. Inténtalo de nuevo más tarde.' : 'Too many attempts. Please try again later.') : e?.code === 'auth/network-request-failed' ? (lang === 'es' ? 'Error de red. Verifica tu conexión.' : 'Network error. Check your connection.') : (lang === 'es' ? 'No se pudo enviar el correo de restablecimiento. Inténtalo de nuevo.' : 'Failed to send reset email. Please try again.');
                                              setResetError(msg);
                                            } finally {
                                              setResetSending(false);
                                            }
                                          }
                                        }}
                                        className="h-9 text-sm bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                      >{resetSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{t.sendResetEmail}</Button>
                                    </div>
                                    {resetError && (
                                      <p className="text-xs text-red-500 font-medium mt-2 text-center">{resetError}</p>
                                    )}
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
                                {is2FAEnabled ? (
                                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>✅ {lang === 'es' ? 'Activa' : 'Enabled'}</span>
                                ) : (
                                  <>
                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>{t.notEnabled}</span>
                                    <Button variant="outline" onClick={() => setShow2FASetup(true)} className={`h-9 text-sm ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{lang === 'es' ? "Activar 2FA" : "Enable 2FA"}</Button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Organizational RBAC */}
                          <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-slate-50 border-slate-100'} border`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                                  <UsersIcon className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{lang === 'es' ? 'Control de Acceso Organizacional' : 'Organizational RBAC'}</h3>
                                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{lang === 'es' ? 'Gestiona roles y permisos de los miembros de tu organización.' : 'Manage roles and permissions for your organization members.'}</p>
                                </div>
                              </div>
                              <Button variant="outline" onClick={() => setSubPage('org-rbac')} className={`h-9 text-sm ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {lang === 'es' ? 'Gestionar' : 'Manage'}
                                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                              </Button>
                            </div>
                          </div>

                          {/* Audit Log */}
                          <div className={`p-5 rounded-xl ${isDarkMode ? 'bg-slate-800/50 border-slate-700/40' : 'bg-slate-50 border-slate-100'} border`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                  <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                  <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{lang === 'es' ? 'Registro de Auditoría' : 'Audit Log'}</h3>
                                  <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{lang === 'es' ? 'Ver eventos de seguridad y actividad de usuarios.' : 'View security events and user activity.'}</p>
                                </div>
                              </div>
                              <Button variant="outline" onClick={() => setSubPage('audit-log')} className={`h-9 text-sm ${isDarkMode ? 'border-slate-600 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                {lang === 'es' ? 'Ver' : 'View'}
                                <ChevronRight className="w-3.5 h-3.5 ml-1" />
                              </Button>
                            </div>
                          </div>

                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Organizational RBAC ====== */}
                  {subPage === 'org-rbac' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage('sign-in-security')} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver a Seguridad' : 'Back to Security'}
                      </button>
                      <OrgRBACPanel orgId={orgId} />
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Audit Log ====== */}
                  {subPage === 'audit-log' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage('sign-in-security')} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver a Seguridad' : 'Back to Security'}
                      </button>
                      <AuditLogPanel />
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

                  {/* ====== SUB-PAGE: Payment & Shipping ====== */}
                  {subPage === 'payment-shipping' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver al Perfil' : 'Back to Profile'}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl p-6 shadow-sm space-y-6`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                          <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.paymentShipping}</h2>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.paymentShippingDesc}</p>
                          </div>
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Add Payment Method
                          </Button>
                        </div>

                        {/* Payment Method Card */}
                        <div className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/50' : 'border-slate-200 bg-slate-50'}`}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-8 rounded-md bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-center font-bold text-xs tracking-wider shadow-sm">
                              VISA
                            </div>
                            <div>
                              <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Visa ending in 4242</p>
                              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Expires 08/29 • Default Method</p>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500">Active</span>
                        </div>

                        {/* Billing Address & Tax ID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Billing Address</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              1200 17th St, Suite 100<br />
                              Denver, CO 80202<br />
                              United States
                            </p>
                          </div>
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                            <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>Tax Status & Currency</h4>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              Tax ID: US-94-3829104<br />
                              Currency: USD ($)<br />
                              Status: 501(c)(3) Tax Exempt
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Subscriptions ====== */}
                  {subPage === 'subscriptions' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver al Perfil' : 'Back to Profile'}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl p-6 shadow-sm space-y-6`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                          <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.subscriptionsLabel}</h2>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.subscriptionsDesc}</p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                            Enterprise Tier
                          </span>
                        </div>

                        {/* Active Plan Overview */}
                        <div className={`p-5 rounded-2xl border ${isDarkMode ? 'border-slate-700 bg-gradient-to-br from-slate-800 to-indigo-950/30' : 'border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/50'}`}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <h3 className={`text-base font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>SOLTheory INSiGHT Platform</h3>
                              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Billed monthly • Renews Oct 15, 2026</p>
                            </div>
                            <div className="text-right">
                              <span className="text-2xl font-black text-indigo-500">$450</span>
                              <span className="text-xs text-slate-400 font-medium">/mo</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-200/20 text-xs">
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block font-medium">Agent Slots</span>
                              <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Unlimited Autonomous</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block font-medium">Dual-Scope Memory</span>
                              <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Active (Supabase + RAG)</span>
                            </div>
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block font-medium">Live SMS & Voice</span>
                              <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>Included (Twilio Multi-Line)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button variant="outline" size="sm" className="rounded-xl text-xs font-semibold">Change Billing Cycle</Button>
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold">Manage Enterprise Seats</Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Cloud Storage ====== */}
                  {subPage === 'cloud-storage' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver al Perfil' : 'Back to Profile'}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl p-6 shadow-sm space-y-6`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                          <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.cloudStorage}</h2>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.cloudStorageDesc}</p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Healthy (4.8% Used)
                          </span>
                        </div>

                        {/* Storage Meter */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className={`font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>2.4 GB of 50.0 GB Total Storage</span>
                            <span className="text-slate-400">47.6 GB Available</span>
                          </div>
                          <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full" style={{ width: '4.8%' }}></div>
                          </div>
                        </div>

                        {/* Storage Categories */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                            <span className="text-xs text-slate-400 font-medium">Direct Messages & Voice Notes</span>
                            <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>840 MB (Firebase Storage)</p>
                          </div>
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                            <span className="text-xs text-slate-400 font-medium">Channel Media & Attachments</span>
                            <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>620 MB (Firebase Storage)</p>
                          </div>
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                            <span className="text-xs text-slate-400 font-medium">AI Brain Embeddings & Docs</span>
                            <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>710 MB (PostgreSQL Vector + Docs)</p>
                          </div>
                          <div className={`p-4 rounded-xl border ${isDarkMode ? 'border-slate-700 bg-slate-800/40' : 'border-slate-200 bg-slate-50/60'}`}>
                            <span className="text-xs text-slate-400 font-medium">System Video Walkthroughs</span>
                            <p className={`text-sm font-bold mt-1 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>230 MB (CDN Stream)</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                          <Button variant="outline" size="sm" onClick={() => window.location.href = `/portal/dashboard/${orgId}/drive`} className="rounded-xl text-xs font-semibold">
                            Open DRiVE
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => window.location.href = `/portal/dashboard/${orgId}/media-library`} className="rounded-xl text-xs font-semibold">
                            Open Media Library
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ====== SUB-PAGE: Signed-In Devices ====== */}
                  {subPage === 'signed-in-devices' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                      <button onClick={() => setSubPage(null)} className={`flex items-center gap-2 text-sm font-medium transition-colors ${isDarkMode ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
                        <ArrowLeft className="w-4 h-4" /> {lang === 'es' ? 'Volver al Perfil' : 'Back to Profile'}
                      </button>

                      <div className={`${isDarkMode ? 'bg-slate-900 border-slate-700/60' : 'bg-white border-slate-200/60'} border rounded-2xl p-6 shadow-sm space-y-6`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b gap-3">
                          <div>
                            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{t.signedInDevices}</h2>
                            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.signedInDevicesDesc}</p>
                          </div>
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            3 Active Devices
                          </span>
                        </div>

                        {/* Devices List */}
                        <div className="space-y-3">
                          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/60' : 'border-slate-200 bg-slate-50'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                                <Monitor className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Windows PC • Chrome 130</p>
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400">Current Device</span>
                                </div>
                                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Denver, Colorado • Active now</p>
                              </div>
                            </div>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          </div>

                          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                                <Smartphone className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>iPhone 16 Pro • Mobile PWA</p>
                                  <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-indigo-500/10 text-indigo-400">Push Enabled</span>
                                </div>
                                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Denver, Colorado • Last active 2h ago</p>
                              </div>
                            </div>
                          </div>

                          <div className={`p-4 rounded-xl border flex items-center justify-between ${isDarkMode ? 'border-slate-700 bg-slate-800/30' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-slate-500/10 text-slate-400 flex items-center justify-center">
                                <Monitor className="w-5 h-5" />
                              </div>
                              <div>
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>Mac Studio • macOS Sonoma</p>
                                <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Denver, Colorado • Last active 3 days ago</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-2 flex justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => alert("Logged out of all other remote device sessions.")}
                            className="rounded-xl text-xs font-semibold text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900/50"
                          >
                            Sign Out All Other Sessions
                          </Button>
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
                        <div className="relative group">
                          <div 
                            onClick={() => avatarInputRef.current?.click()}
                            className={`w-16 h-16 rounded-full border-4 ${isDarkMode ? 'border-slate-900 bg-slate-700' : 'border-white bg-slate-100'} flex items-center justify-center text-2xl font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-900'} shadow-lg overflow-hidden cursor-pointer relative`}
                            title={dict.changePhoto || "Change Photo"}
                          >
                            {isUploadingAvatar ? (
                              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                            ) : (avatarUrl || user?.photoURL) ? (
                              <img src={avatarUrl || user?.photoURL || undefined} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              (displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()
                            )}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Camera className="w-4 h-4" />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className={`absolute bottom-0 right-0 p-1.5 rounded-full shadow-md transition-transform hover:scale-105 ${
                              isDarkMode ? 'bg-slate-800 border border-slate-600 text-slate-200 hover:bg-slate-700' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                            title={dict.changePhoto || "Change Photo"}
                          >
                            <Camera className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-12 pb-6 px-8 space-y-5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{dict.publicProfile}</h2>
                          <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.personalizeInfo}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            ref={avatarInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleAvatarUpload}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => avatarInputRef.current?.click()}
                            disabled={isUploadingAvatar}
                            className={`h-9 text-xs font-semibold gap-1.5 ${isDarkMode ? 'border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200' : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'}`}
                          >
                            {isUploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-blue-500" />}
                            {dict.changePhoto || (lang === 'es' ? "Cambiar Foto" : "Change Photo")}
                          </Button>
                        </div>
                      </div>
                      {avatarError && (
                        <p className="text-xs text-red-500 font-medium">{avatarError}</p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="name" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.displayName}</Label>
                          <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Jane Doe" className={`${isDarkMode ? 'bg-slate-800 border-slate-600 text-slate-200' : 'bg-slate-50 border-slate-200'} focus-visible:ring-slate-400 h-10`} />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="email" className={`text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>{dict.accountEmail}</Label>
                          <Input id="email" type="email" value={user?.email || ""} readOnly className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700 text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-400'} cursor-not-allowed h-10`} />
                          {/* User ID */}
                          <div className="mt-3">
                            <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>User ID</label>
                            <div className="flex items-center gap-2">
                              <code className={`text-[11px] font-mono px-2.5 py-1.5 rounded-lg select-all ${isDarkMode ? 'bg-slate-800/80 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                                {user?.uid}
                              </code>
                              <button
                                onClick={() => {
                                  if (user?.uid) {
                                    navigator.clipboard.writeText(user.uid);
                                    setCopiedUid(true);
                                    setTimeout(() => setCopiedUid(false), 2000);
                                  }
                                }}
                                className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}
                                title="Copy User ID"
                              >
                                {copiedUid ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
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
                        { icon: <User className="w-4 h-4" />, label: t.personalInfo, desc: t.personalInfoDescShort, action: () => setSubPage('personal-info'), comingSoon: false },
                        { icon: <Lock className="w-4 h-4" />, label: t.security, desc: t.securityDescShort, action: () => setSubPage('sign-in-security'), comingSoon: false },
                        { icon: <Smartphone className="w-4 h-4" />, label: t.paymentShipping, desc: t.paymentShippingDesc, action: () => setSubPage('payment-shipping'), comingSoon: false },
                        { icon: <Bell className="w-4 h-4" />, label: t.subscriptionsLabel, desc: t.subscriptionsDesc, action: () => setSubPage('subscriptions'), comingSoon: false },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} disabled={item.comingSoon} className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${item.comingSoon ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {item.label}
                              {item.comingSoon && <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{lang === 'es' ? 'Próximamente' : 'Coming Soon'}</span>}
                            </div>
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
                        { icon: <HardDrive className="w-4 h-4" />, label: t.cloudStorage, desc: t.cloudStorageDesc, action: () => setSubPage('cloud-storage'), comingSoon: false },
                        { icon: <Globe className="w-4 h-4" />, label: t.integrations, desc: t.integrationsDescShort, action: () => setSubPage('integrations'), comingSoon: false },
                        { icon: <Smartphone className="w-4 h-4" />, label: t.signedInDevices, desc: t.signedInDevicesDesc, action: () => setSubPage('signed-in-devices'), comingSoon: false },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action} disabled={item.comingSoon} className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors ${item.comingSoon ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-slate-50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium flex items-center gap-2 ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                              {item.label}
                              {item.comingSoon && <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${isDarkMode ? 'bg-slate-700 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{lang === 'es' ? 'Próximamente' : 'Coming Soon'}</span>}
                            </div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{item.desc}</div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
                        </button>
                      ))}
                      {/* Language Selector */}
                      <div className={`w-full flex items-center gap-4 px-6 py-4 ${isDarkMode ? '' : ''}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                          <Globe className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{t.languageLabel}</div>
                          <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.languageDesc}</div>
                        </div>
                        <select
                          value={lang}
                          onChange={(e) => changeLang(e.target.value as Lang)}
                          className={`text-sm font-medium rounded-lg border px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                        >
                          <option value="en">English</option>
                          <option value="es">Español</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Account Menu - Section 3: Developer Settings */}
                  {isOracle(user?.email) && (
                    <div className={`${isDarkMode ? 'bg-slate-900 border-indigo-500/20' : 'bg-white border-indigo-200/60'} border rounded-2xl shadow-sm overflow-hidden`}>
                      <div className={`divide-y ${isDarkMode ? 'divide-slate-700/40' : 'divide-slate-100'}`}>
                        <button onClick={() => setSubPage('org-rbac')} className={`w-full flex items-center gap-4 px-6 py-4 text-left transition-colors cursor-pointer ${isDarkMode ? 'hover:bg-slate-800/60' : 'hover:bg-indigo-50/50'}`}>
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                            <Code className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Developer Settings</div>
                            <div className={`text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Platform admin tools — cross-org management</div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isDarkMode ? 'text-indigo-500' : 'text-indigo-300'}`} />
                        </button>
                      </div>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 2FA Setup Modal */}
      {show2FASetup && (
        <TwoFactorSetup
          onClose={() => setShow2FASetup(false)}
          onEnabled={() => setIs2FAEnabled(true)}
        />
      )}
    </div>
  );
}

