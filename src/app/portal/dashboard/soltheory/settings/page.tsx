"use client";


import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { ArrowLeft, Bell, Lock, User, Globe, Mail, RefreshCw, Loader2, Key, Smartphone, ShieldCheck } from "lucide-react";
import { useUser, useFirestore, useAuth } from "@/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { signInAnonymously, updateProfile } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

// Translation Dictionary
const t = {
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
    gmailConnection: "Gmail Connection",
    gmailDesc: "Connect your Gmail to let the AI agent read and reply to your inbound emails automatically.",
    gmailConnected: "✓ Gmail Connected Successfully",
    connectGmail: "Connect Gmail",
    connected: "Connected",
    syncInbox: "Sync Inbox",
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
    spanish: "Español (ES)"
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
    gmailConnection: "Conexión de Gmail",
    gmailDesc: "Conecta tu Gmail para permitir que el agente de IA lea y responda tus correos entrantes automáticamente.",
    gmailConnected: "✓ Gmail Conectado Exitosamente",
    connectGmail: "Conectar Gmail",
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
    spanish: "Español (ES)"
  }
};

type Lang = 'en' | 'es';
type Tab = 'profile' | 'notifications' | 'security' | 'language';

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const { user, isUserLoading } = useUser();
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
  const [lang, setLang] = useState<Lang>('en');

  useEffect(() => {
    // Load local language
    const savedLang = localStorage.getItem('agent_language') as Lang;
    if (savedLang === 'en' || savedLang === 'es') setLang(savedLang);
  }, []);

  const changeLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem('agent_language', l);
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      if (firestore) {
        getDoc(doc(firestore, "users", user.uid)).then(docSnap => {
          if (docSnap.exists()) {
            setBio(docSnap.data().bio || "");
            setLocation(docSnap.data().location || "");
          }
        });
      }
    }
  }, [user, firestore]);

  useEffect(() => {
    if (isUserLoading) return;

    const rt = searchParams.get("rt");
    const isConnectedParam = searchParams.get("gmail_connected") === "true";
    const errorParam = searchParams.get("error");
    const agent = searchParams.get("agent") || "inbound-email";

    if (rt && user?.uid && firestore) {
      setDoc(doc(firestore, "users", user.uid), {
        id: user.uid,
        [`gmailOAuth_${agent}`]: { refreshToken: rt, connectedAt: new Date().toISOString() }
      }, { merge: true }).then(() => {
        window.history.replaceState({}, document.title, window.location.pathname + `?gmail_connected=true&agent=${agent}`);
        setGmailConnected(true);
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

  const handleSaveProfile = async () => {
    if (!auth || !auth.currentUser || !firestore || !user) return;
    setIsSavingProfile(true);
    setProfileMessage("");
    try {
      await updateProfile(auth.currentUser, { displayName });
      await setDoc(doc(firestore, "users", user.uid), { bio, location }, { merge: true });
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
    let uid = user?.uid;
    if (!uid && auth) {
      try {
        const cred = await signInAnonymously(auth);
        uid = cred.user.uid;
      } catch (err: any) {
        setOauthError("Failed to initialize session. Please try again.");
        return;
      }
    }
    if (!uid) return;
    window.location.href = `/api/auth/google?uid=${uid}`;
  };

  const handleSyncInbox = async () => {
    if (!user?.uid || !firestore) return;
    setIsSyncing(true);
    setSyncMessage("");
    try {
      const userDoc = await getDoc(doc(firestore, "users", user.uid));
      const agent = searchParams.get("agent") || "inbound-email";
      const docData = userDoc.data();
      const refreshToken = docData?.[`gmailOAuth_${agent}`]?.refreshToken || 
                           docData?.gmailOAuth_morpheus?.refreshToken ||
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

  const dict = t[lang];

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-slate-50 text-slate-800">
      <main className="flex-grow py-8 px-4 md:px-8 relative">
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <div className="flex items-center gap-4 relative z-20">
            <Link href="/portal/dashboard/soltheory/ai-agents/morpheus" className="p-2 bg-white/50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 shadow-sm backdrop-blur-md relative z-20">
              <ArrowLeft className="w-5 h-5 text-slate-700" />
            </Link>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">{dict.settings}</h1>
          </div>

          <div className="flex flex-col md:flex-row gap-8 pt-4">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 space-y-2 shrink-0">
              <button 
                onClick={() => setActiveTab('profile')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'profile' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent'}`}
              >
                <User className="w-5 h-5" /> {dict.profile}
              </button>
              <button 
                onClick={() => setActiveTab('notifications')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'notifications' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent'}`}
              >
                <Bell className="w-5 h-5" /> {dict.notifications}
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'security' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent'}`}
              >
                <Lock className="w-5 h-5" /> {dict.security}
              </button>
              <button 
                onClick={() => setActiveTab('language')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${activeTab === 'language' ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20 text-slate-900' : 'text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent'}`}
              >
                <Globe className="w-5 h-5" /> {dict.regionLanguage}
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 space-y-6">
              
              {activeTab === 'profile' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-white border-slate-200 overflow-hidden shadow-2xl relative">
                    <div className="h-32 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                      <div className="absolute -bottom-10 left-6">
                        <div className="w-20 h-20 rounded-full border-4 border-slate-900 bg-slate-100 flex items-center justify-center text-3xl font-bold text-slate-900 shadow-lg overflow-hidden">
                          {user?.photoURL ? <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" /> : (displayName?.[0] || user?.email?.[0] || 'U').toUpperCase()}
                        </div>
                      </div>
                    </div>
                    
                    <CardContent className="pt-14 pb-8 px-8 space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-slate-900">{dict.publicProfile}</h2>
                        <p className="text-sm text-slate-500">{dict.personalizeInfo}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label htmlFor="name" className="text-slate-700">{dict.displayName}</Label>
                          <Input id="name" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="e.g. Jane Doe" className="bg-slate-50/50 border-slate-300/50 focus-visible:ring-indigo-500 h-11 text-slate-800" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-slate-700">{dict.accountEmail}</Label>
                          <Input id="email" type="email" value={user?.email || ""} readOnly className="bg-slate-50/50 border-slate-200 text-slate-500 cursor-not-allowed h-11" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="location" className="text-slate-700">{dict.location}</Label>
                          <Input id="location" value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. New York, NY (EST)" className="bg-slate-50/50 border-slate-300/50 focus-visible:ring-indigo-500 h-11 text-slate-800" />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label htmlFor="bio" className="text-slate-700">{dict.bio}</Label>
                          <textarea id="bio" value={bio} onChange={e => setBio(e.target.value)} placeholder={dict.bioPlaceholder} className="w-full h-28 p-3 rounded-xl bg-slate-50/50 border border-slate-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-slate-800 resize-none placeholder:text-slate-600 transition-all" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white border-slate-200 shadow-xl">
                    <CardHeader className="px-8 pt-8">
                      <CardTitle className="text-xl text-slate-900">{dict.integrations}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-6">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-1.5 max-w-sm">
                          <Label className="text-base text-slate-800">{dict.gmailConnection}</Label>
                          <p className="text-sm text-slate-500 leading-relaxed">{dict.gmailDesc}</p>
                          {gmailConnected && <p className="text-sm text-emerald-400 font-medium mt-2">{dict.gmailConnected}</p>}
                          {oauthError && <p className="text-sm text-red-400 font-medium mt-2">✗ {oauthError}</p>}
                          {syncMessage && <p className={`text-sm font-medium mt-2 ${syncMessage.includes('Error') ? 'text-red-400' : 'text-blue-400'}`}>ℹ️ {syncMessage === 'OK' ? dict.syncInbox + ' OK' : syncMessage}</p>}
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button 
                            variant={gmailConnected ? "outline" : "default"} 
                            className={gmailConnected ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 h-11" : "bg-indigo-600 hover:bg-indigo-700 h-11"}
                            onClick={handleConnectGmail}
                            disabled={isUserLoading}
                          >
                            <Mail className="w-4 h-4 mr-2" />
                            {gmailConnected ? dict.connected : dict.connectGmail}
                          </Button>

                          {gmailConnected && (
                            <Button 
                              variant="secondary" 
                              onClick={handleSyncInbox}
                              disabled={isSyncing || !user}
                              className="bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/30 h-11"
                            >
                              {isSyncing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                              {isSyncing ? dict.syncing : dict.syncInbox}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-end gap-4 pt-4 pb-8">
                    {profileMessage && <span className={`text-sm font-medium px-4 py-2 rounded-lg ${profileMessage.includes('Error') ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{profileMessage === 'OK' ? 'Saved' : profileMessage}</span>}
                    <Button variant="ghost" className="text-slate-500 hover:text-slate-800 hover:bg-slate-100">{dict.cancel}</Button>
                    <Button onClick={handleSaveProfile} disabled={isSavingProfile} className="bg-indigo-600 hover:bg-indigo-700 text-slate-900 min-w-[140px] h-11 rounded-lg shadow-lg shadow-indigo-500/20">
                      {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                      {isSavingProfile ? dict.saving : dict.saveChanges}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-white border-slate-200 shadow-xl">
                    <CardHeader className="px-8 pt-8">
                      <CardTitle className="text-xl text-slate-900">{dict.notifications}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800">{dict.dailyDigest}</Label>
                          <p className="text-sm text-slate-500">{dict.dailyDigestDesc}</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="w-full h-px bg-slate-100/50" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800">{dict.systemAlerts}</Label>
                          <p className="text-sm text-slate-500">{dict.systemAlertsDesc}</p>
                        </div>
                        <Switch defaultChecked />
                      </div>
                      <div className="w-full h-px bg-slate-100/50" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800">{dict.smsAlerts}</Label>
                          <p className="text-sm text-slate-500">{dict.smsAlertsDesc}</p>
                        </div>
                        <Switch />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-white border-slate-200 shadow-xl">
                    <CardHeader className="px-8 pt-8">
                      <CardTitle className="text-xl text-slate-900">{dict.security}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800 flex items-center gap-2"><Key className="w-4 h-4" /> {dict.passwordReset}</Label>
                          <p className="text-sm text-slate-500">{dict.passwordResetDesc}</p>
                        </div>
                        <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-100">{dict.sendResetLink}</Button>
                      </div>
                      <div className="w-full h-px bg-slate-100/50" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800 flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> {dict.twoFactor}</Label>
                          <p className="text-sm text-slate-500">{dict.twoFactorDesc}</p>
                        </div>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-slate-900">{dict.enable2fa}</Button>
                      </div>
                      <div className="w-full h-px bg-slate-100/50" />
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800 flex items-center gap-2"><Smartphone className="w-4 h-4" /> {dict.activeSessions}</Label>
                          <p className="text-sm text-slate-500">{dict.activeSessionsDesc}</p>
                        </div>
                        <Button variant="destructive" className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0">{dict.logoutAll}</Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeTab === 'language' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <Card className="bg-white border-slate-200 shadow-xl">
                    <CardHeader className="px-8 pt-8">
                      <CardTitle className="text-xl text-slate-900">{dict.regionLanguage}</CardTitle>
                    </CardHeader>
                    <CardContent className="px-8 pb-8 space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <Label className="text-base text-slate-800">{dict.languageSelect}</Label>
                          <p className="text-sm text-slate-500">{dict.languageSelectDesc}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-4 pt-2">
                           <button onClick={() => changeLang('en')} className={`px-6 py-4 rounded-xl border flex-1 text-left transition-all relative overflow-hidden ${lang === 'en' ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-100'}`}>
                             <div className="font-semibold text-slate-900">{dict.english}</div>
                             <div className="text-xs text-slate-500 mt-1">Default UI</div>
                             {lang === 'en' && <div className="absolute top-4 right-4 text-indigo-400">✓</div>}
                           </button>
                           <button onClick={() => changeLang('es')} className={`px-6 py-4 rounded-xl border flex-1 text-left transition-all relative overflow-hidden ${lang === 'es' ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-100'}`}>
                             <div className="font-semibold text-slate-900">{dict.spanish}</div>
                             <div className="text-xs text-slate-500 mt-1">Traducción oficial</div>
                             {lang === 'es' && <div className="absolute top-4 right-4 text-indigo-400">✓</div>}
                           </button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
