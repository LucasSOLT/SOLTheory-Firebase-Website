"use client";

import { useEffect, useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Users, ChevronDown, Shield, ShieldAlert, Eye, Settings } from "lucide-react";
import { isAdmin, ADMIN_EMAILS } from "@/lib/admin";
import { ACCESS_LEVELS, ACCESS_LEVEL_INFO, type AccessLevel } from "@/lib/rbac";
import { logActivity } from '@/lib/activity-logger';
import { isOracle } from "@/lib/org-config";
import { useOrgRole } from "@/hooks/useOrgRole";
import { useParams } from "next/navigation";

/** Access levels that admins can currently assign. */
const ASSIGNABLE_LEVELS: AccessLevel[] = ["Read Only", "User-Level", "Admin-Level"];

interface UserProfile {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  accessLevel: AccessLevel;
}

export default function EndUserDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const params = useParams();
  const orgId = params?.orgId as string;
  
  const { role: effectiveRole, trueRole, isOracleUser, setEffectiveRole } = useOrgRole(orgId);

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const currentUserIsOracle = isOracle(user?.email);
  const currentUserIsAdmin = isAdmin(user?.email);
  const hasAccess = currentUserIsOracle || currentUserIsAdmin;

  useEffect(() => {
    if (!hasAccess) return;

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(firestore, "users"));
        const rawList: (UserProfile & { lastLogin?: any })[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const email = (data.email || "").toLowerCase();

          // Determine correct access level — admins are always Admin-Level
          let accessLevel: AccessLevel = data.accessLevel || "User-Level";
          if (isOracle(email)) {
            accessLevel = "Oracle";
          } else if (ADMIN_EMAILS.includes(email as any)) {
            accessLevel = "Admin-Level";
          }

          rawList.push({
            uid: d.id,
            email,
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            accessLevel,
            lastLogin: data.lastLogin,
          });
        });

        // Deduplicate by email — keep the most recently active entry
        const byEmail = new Map<string, typeof rawList[number]>();
        for (const u of rawList) {
          const existing = byEmail.get(u.email);
          if (!existing) {
            byEmail.set(u.email, u);
          } else {
            // Keep the one with the most recent lastLogin
            const existingTime = existing.lastLogin?.toMillis?.() || 0;
            const newTime = u.lastLogin?.toMillis?.() || 0;
            if (newTime > existingTime) {
              byEmail.set(u.email, u);
            }
          }
        }

        const deduped = Array.from(byEmail.values()) as UserProfile[];

        // Sort alphabetically by last name then first name
        deduped.sort((a, b) => {
          const last = a.lastName.localeCompare(b.lastName);
          return last !== 0 ? last : a.firstName.localeCompare(b.firstName);
        });

        setUsers(deduped);
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [firestore, hasAccess]);

  /** Update a user's access level in Firestore and local state. */
  const handleAccessLevelChange = async (targetUser: UserProfile, newLevel: AccessLevel) => {
    const isOracleEmail = isOracle(targetUser.email);
    const isProtectedAdmin = ADMIN_EMAILS.includes(targetUser.email as any) && !isOracleEmail;
    
    // Prevent changing admin emails away from Admin-Level
    if (isProtectedAdmin && newLevel !== "Admin-Level") {
      return;
    }
    // Prevent changing Oracle emails
    if (isOracleEmail) return;

    try {
      const userRef = doc(firestore, "users", targetUser.uid);
      await updateDoc(userRef, { accessLevel: newLevel });
      logActivity(firestore, 'settings_changed', { email: user?.email || '', displayName: user?.displayName }, `Changed access level for ${targetUser.email} to ${newLevel}`);
      setUsers((prev) =>
        prev.map((u) => (u.uid === targetUser.uid ? { ...u, accessLevel: newLevel } : u))
      );
    } catch (err) {
      console.error("Failed to update access level:", err);
    }
    setOpenDropdown(null);
  };

  if (!hasAccess) {
    return (
      <div className={`flex items-center justify-center h-full ${isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]"}`}>
        <p className={`${isDarkMode ? "text-slate-400" : "text-slate-500"} text-sm font-medium`}>Access denied. Admin or Oracle privileges required.</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full overflow-auto ${isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]"}`}>
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>End User Dashboard</h1>
        </div>
        <p className={`text-sm mt-1 ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>All registered users and their access levels.</p>
      </div>

      <div className="flex-1 px-4 sm:px-8 pb-8 flex flex-col gap-6 min-h-0">
        {/* Oracle self-management card */}
        {currentUserIsOracle && (
          <div className={`p-4 sm:p-6 border rounded-lg shadow-sm ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-[#faf6ed] border-slate-900"}`}>
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-5 h-5 text-amber-500" />
              <h2 className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-slate-900"}`}>Oracle Mode</h2>
              <div className="ml-auto flex items-center gap-2">
                <span className={`text-xs font-semibold ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>Effective Role:</span>
                <span className="px-2 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-300">
                  {effectiveRole}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setEffectiveRole("read-only")}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "read-only" ? "bg-orange-100 text-orange-700 border-orange-300 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
              >
                <Eye className="w-4 h-4" />
                Read-Only
              </button>
              <button
                onClick={() => setEffectiveRole("user")}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "user" ? "bg-blue-100 text-blue-700 border-blue-300 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
              >
                <Users className="w-4 h-4" />
                User
              </button>
              <button
                onClick={() => setEffectiveRole("admin")}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "admin" ? "bg-slate-800 text-white border-slate-900 border" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
              >
                <Settings className="w-4 h-4" />
                Admin
              </button>
              <button
                onClick={() => setEffectiveRole("oracle")}
                className={`flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-colors ${effectiveRole === "oracle" ? "bg-amber-100 text-amber-800 border border-amber-300" : isDarkMode ? "bg-slate-700 text-slate-300 hover:bg-slate-600 border border-transparent" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent"}`}
              >
                <Shield className="w-4 h-4" />
                Oracle (Restore)
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-6 min-h-0 flex-1">
          {/* User List Table */}
          <div className="flex-1 min-w-0">
            <div className={`border rounded-lg overflow-hidden ${isDarkMode ? "border-slate-700" : "border-slate-900"}`}>
              {/* Table Header */}
              <div className="grid grid-cols-4 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                <div className={`px-4 py-3 border-r ${isDarkMode ? "border-slate-700" : "border-slate-700"}`}>First Name</div>
                <div className={`px-4 py-3 border-r ${isDarkMode ? "border-slate-700" : "border-slate-700"}`}>Last Name</div>
                <div className={`px-4 py-3 border-r ${isDarkMode ? "border-slate-700" : "border-slate-700"}`}>Email</div>
                <div className="px-4 py-3">Access Level</div>
              </div>

              {/* Table Body */}
              {loading ? (
                <div className={`px-4 py-8 text-center text-sm ${isDarkMode ? "text-slate-400 bg-slate-900" : "text-slate-400 bg-[#faf6ed]"}`}>Loading users...</div>
              ) : users.length === 0 ? (
                <div className={`px-4 py-8 text-center text-sm ${isDarkMode ? "text-slate-400 bg-slate-900" : "text-slate-400 bg-[#faf6ed]"}`}>No users found. Users appear here after they log in.</div>
              ) : (
                users.map((u, idx) => {
                  const isOracleEmail = isOracle(u.email);
                  const isProtectedAdmin = ADMIN_EMAILS.includes(u.email as any) && !isOracleEmail;
                  const isProtected = isOracleEmail || isProtectedAdmin;
                  const isDropdownOpen = openDropdown === u.uid;

                  return (
                    <div
                      key={u.uid}
                      className={`grid grid-cols-4 text-sm border-t ${isDarkMode ? "border-slate-700" : "border-slate-900"} ${idx % 2 === 0 ? (isDarkMode ? "bg-slate-900" : "bg-[#faf6ed]") : (isDarkMode ? "bg-slate-800/50" : "bg-[#f5f0e1]")}`}
                    >
                      <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800"}`}>{u.firstName || "—"}</div>
                      <div className={`px-4 py-3 border-r font-medium truncate ${isDarkMode ? "border-slate-700 text-slate-200" : "border-slate-200 text-slate-800"}`}>{u.lastName || "—"}</div>
                      <div className={`px-4 py-3 border-r truncate ${isDarkMode ? "border-slate-700 text-slate-400" : "border-slate-200 text-slate-600"}`}>{u.email}</div>
                      <div className="px-4 py-3 relative">
                        {/* Access Level Badge / Dropdown Trigger */}
                        <button
                          title={isOracleEmail ? "Oracle role cannot be changed from the UI" : undefined}
                          onClick={() => {
                            if (isProtected) return; // Can't change admin or oracle roles
                            setOpenDropdown(isDropdownOpen ? null : u.uid);
                          }}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                            isOracleEmail || u.accessLevel === "Oracle"
                              ? "bg-amber-100 text-amber-800 border border-amber-300"
                              : u.accessLevel === "Admin-Level"
                              ? "bg-slate-800 text-white"
                              : u.accessLevel === "Read Only"
                              ? "bg-orange-100 text-orange-700 border border-orange-300"
                              : "bg-slate-100 text-slate-600"
                          } ${isProtected ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                        >
                          {isOracleEmail ? "Oracle" : u.accessLevel}
                          {!isProtected && <ChevronDown className="w-3 h-3 opacity-50" />}
                        </button>

                        {/* Dropdown for assigning roles */}
                        {isDropdownOpen && !isProtected && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                            <div className={`absolute left-4 top-full mt-1 w-40 border rounded-lg shadow-lg z-40 py-1 animate-in fade-in slide-in-from-top-1 duration-100 ${isDarkMode ? "bg-slate-800 border-slate-700" : "bg-[#faf8f3] border-slate-200"}`}>
                              {ASSIGNABLE_LEVELS.map((level) => (
                                <button
                                  key={level}
                                  onClick={() => handleAccessLevelChange(u, level)}
                                  className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                    u.accessLevel === level
                                      ? (isDarkMode ? "bg-slate-700 text-white font-bold" : "bg-slate-100 text-slate-900 font-bold")
                                      : (isDarkMode ? "text-slate-300 hover:bg-slate-700 hover:text-white" : "text-slate-600 hover:bg-[#f2ece0] hover:text-slate-900")
                                  }`}
                                >
                                  {level}
                                  {u.accessLevel === level && <span className="ml-1 text-green-600">✓</span>}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RBAC Reference Panel */}
          <div className="w-72 shrink-0 hidden lg:block">
            <div className={`border rounded-lg overflow-hidden sticky top-6 ${isDarkMode ? "border-slate-700" : "border-slate-900"}`}>
              <div className="bg-slate-800 text-white px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wider">Access Levels</h3>
              </div>
              <div className={`divide-y ${isDarkMode ? "divide-slate-700" : "divide-slate-300"}`}>
                {ACCESS_LEVELS.map((level) => {
                  const info = ACCESS_LEVEL_INFO[level];
                  return (
                    <div key={level} className={`px-4 py-3 ${isDarkMode ? "bg-slate-800" : "bg-[#faf6ed]"}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${
                          level === "Admin-Level"
                            ? (isDarkMode ? "text-slate-200" : "text-slate-900")
                            : level === "Oracle"
                            ? "text-amber-500"
                            : (isDarkMode ? "text-slate-400" : "text-slate-600")
                        }`}>{level}</span>
                        {info.functional && (
                          <span className="text-[9px] font-bold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Active</span>
                        )}
                      </div>
                      <p className={`text-[11px] leading-relaxed ${isDarkMode ? "text-slate-400" : "text-slate-500"}`}>{info.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
