"use client";

import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { MessageSquare, Hash, Smartphone, Users, Bell, Sparkles } from "lucide-react";
import { DMChat } from "@/components/communications/DMChat";
import { OrgThread } from "@/components/communications/OrgThread";
import { ContactsView } from "@/components/communications/ContactsView";
import IMessagePage from "@/app/portal/dashboard/[orgId]/communications/imessage/page";
import { PushNotificationPrompt } from "@/components/notifications/PushNotificationPrompt";
import { useCommsStore, type CommsTab } from "@/stores/comms-store";

export default function CommunicationsHubPage() {
  const params = useParams<{ orgId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const orgId = params?.orgId || "soltheory";

  const { activeTab, setActiveTab } = useCommsStore();

  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const check = () => setIsDarkMode(localStorage.getItem("insight_theme") === "dark");
    check();
    const interval = setInterval(check, 500);
    window.addEventListener("storage", check);
    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", check);
    };
  }, []);

  // Sync tab with URL search parameter if present (?tab=sms, ?tab=dm, etc.)
  useEffect(() => {
    const tabParam = searchParams.get("tab") as CommsTab | null;
    if (tabParam && ["dm", "channels", "sms", "contacts"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams, setActiveTab]);

  const handleTabChange = (tab: CommsTab) => {
    setActiveTab(tab);
    router.replace(`/portal/dashboard/${orgId}/communications?tab=${tab}`);
  };

  const tabs: { id: CommsTab; label: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: "dm",
      label: "Direct Messages",
      icon: <MessageSquare className="w-4 h-4" />,
    },
    {
      id: "channels",
      label: "Team Channels",
      icon: <Hash className="w-4 h-4" />,
    },
    {
      id: "sms",
      label: "SMS Messages",
      icon: <Smartphone className="w-4 h-4" />,
      badge: "Twilio",
    },
    {
      id: "contacts",
      label: "Contact Book",
      icon: <Users className="w-4 h-4" />,
    },
  ];

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden space-y-3">
      {/* Push Notification Bar */}
      <PushNotificationPrompt variant="banner" />

      {/* Communications Header & WhatsApp-Grade Navigation Bar */}
      <div
        className={`px-4 py-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-sm ${
          isDarkMode
            ? "bg-slate-900/80 border-slate-800"
            : "bg-[#faf8f3] border-slate-200"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-500 flex items-center justify-center text-white shadow-sm">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm font-black tracking-tight ${isDarkMode ? "text-white" : "text-slate-900"}`}>
              Communications Hub
            </h1>
            <p className="text-[11px] text-slate-400 font-medium">
              Real-time messaging, channels, and live SMS
            </p>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className={`p-1 rounded-xl flex items-center gap-1 border ${isDarkMode ? "bg-slate-950/60 border-slate-800" : "bg-slate-100/80 border-slate-200"}`}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  isActive
                    ? isDarkMode
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-white text-indigo-900 shadow-sm"
                    : isDarkMode
                    ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge && (
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded-full font-black uppercase tracking-wider ${
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-emerald-500/15 text-emerald-600"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === "dm" && <DMChat />}
        {activeTab === "channels" && <OrgThread />}
        {activeTab === "sms" && <IMessagePage />}
        {activeTab === "contacts" && <ContactsView />}
      </div>
    </div>
  );
}
