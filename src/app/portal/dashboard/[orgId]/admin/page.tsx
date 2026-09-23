"use client";

import React, { useState } from "react";
import { useUser } from "@/firebase";
import { useTheme } from "@/components/ThemeProvider";
import { useParams } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import { isOracle, getOrgLabel } from "@/lib/org-config";
import { useOrgRole } from "@/hooks/useOrgRole";
import { ShieldCheck, Users, Clock, Loader2, ShieldAlert } from "lucide-react";
import OrgRBACPanel from "@/components/settings/OrgRBACPanel";
import AuditLogPanel from "@/components/settings/AuditLogPanel";

export default function AdminDashboardPage() {
  const { user, isUserLoading } = useUser();
  const { isDarkMode } = useTheme();
  const params = useParams();
  const orgId = (params?.orgId as string) || "";

  // Dynamic Org Role from Firestore
  const { role: currentOrgRole, isLoading: isRoleLoading } = useOrgRole(orgId);

  // Tab State: 'members' | 'audit'
  const [activeTab, setActiveTab] = useState<"members" | "audit">("members");

  // Access check: Oracle, Global Admin, or Org-specific Admin/Oracle role
  const hasAccess =
    user?.email &&
    (isOracle(user.email) ||
      isAdmin(user.email) ||
      currentOrgRole === "admin" ||
      currentOrgRole === "oracle");

  if (isUserLoading || isRoleLoading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-6">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
          <ShieldAlert className="w-7 h-7" />
        </div>
        <h2 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Admin Access Required
        </h2>
        <p className={`text-sm max-w-md ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
          You do not have administrative privileges for {getOrgLabel(orgId)}. Please contact an organization administrator if you need access.
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-y-auto ${isDarkMode ? 'bg-slate-950 text-slate-200' : 'bg-[#faf6ed] text-slate-800'}`}>
      <main className="flex-grow py-8 px-4 md:px-8 max-w-[1200px] mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/60 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                Admin Dashboard
              </h1>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {getOrgLabel(orgId)} &middot; Access Control &amp; Security Audits
              </p>
            </div>
          </div>

          {/* Tab Selector */}
          <div className={`flex items-center gap-1 p-1 rounded-xl border ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
            <button
              onClick={() => setActiveTab("members")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "members"
                  ? isDarkMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-900 text-white shadow-sm"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Members &amp; Roles
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? isDarkMode
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-slate-900 text-white shadow-sm"
                  : isDarkMode
                  ? "text-slate-400 hover:text-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              Audit Log
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="pt-2">
          {activeTab === "members" && (
            <div className="animate-in fade-in duration-200">
              <OrgRBACPanel orgId={orgId} />
            </div>
          )}

          {activeTab === "audit" && (
            <div className="animate-in fade-in duration-200">
              <AuditLogPanel />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
