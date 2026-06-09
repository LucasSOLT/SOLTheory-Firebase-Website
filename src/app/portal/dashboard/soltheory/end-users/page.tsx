"use client";

import { useEffect, useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { Users, ChevronDown } from "lucide-react";
import { isAdmin, ADMIN_EMAILS } from "@/lib/admin";
import { ACCESS_LEVELS, ACCESS_LEVEL_INFO, type AccessLevel } from "@/lib/rbac";
import { logActivity } from '@/lib/activity-logger';

/** Hardcoded name overrides for known accounts. */
const KNOWN_USERS: Record<string, { firstName: string; lastName: string }> = {
  "lucas@soltheory.com": { firstName: "Lucas", lastName: "Huff" },
  "steve@soltheory.com": { firstName: "Steven", lastName: "Huff" },
  "nxtchapter@nxtchapter.org": { firstName: "Josie", lastName: "Burton" },
};

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
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const currentUserIsAdmin = isAdmin(user?.email);

  useEffect(() => {
    if (!currentUserIsAdmin) return;

    const fetchUsers = async () => {
      try {
        const snap = await getDocs(collection(firestore, "users"));
        const rawList: (UserProfile & { lastLogin?: any })[] = [];

        snap.forEach((d) => {
          const data = d.data();
          const email = (data.email || "").toLowerCase();
          const known = KNOWN_USERS[email];

          // Determine correct access level — admins are always Admin-Level
          let accessLevel: AccessLevel = data.accessLevel || "User-Level";
          if (ADMIN_EMAILS.includes(email as any)) {
            accessLevel = "Admin-Level";
          }

          rawList.push({
            uid: d.id,
            email,
            firstName: known?.firstName || data.firstName || "",
            lastName: known?.lastName || data.lastName || "",
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
  }, [firestore, currentUserIsAdmin]);

  /** Update a user's access level in Firestore and local state. */
  const handleAccessLevelChange = async (targetUser: UserProfile, newLevel: AccessLevel) => {
    // Prevent changing admin emails away from Admin-Level
    if (ADMIN_EMAILS.includes(targetUser.email as any) && newLevel !== "Admin-Level") {
      return;
    }
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

  if (!currentUserIsAdmin) {
    return (
      <div className="flex items-center justify-center h-full bg-[#faf6ed]">
        <p className="text-slate-500 text-sm font-medium">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#faf6ed] overflow-auto">
      {/* Header */}
      <div className="shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
            <Users className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">End User Dashboard</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">All registered users and their access levels.</p>
      </div>

      {/* Content — two columns: user list + RBAC reference */}
      <div className="flex-1 px-4 sm:px-8 pb-8 flex gap-6 min-h-0">
        {/* User List Table */}
        <div className="flex-1 min-w-0">
          <div className="border border-slate-900 rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-4 bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
              <div className="px-4 py-3 border-r border-slate-700">First Name</div>
              <div className="px-4 py-3 border-r border-slate-700">Last Name</div>
              <div className="px-4 py-3 border-r border-slate-700">Email</div>
              <div className="px-4 py-3">Access Level</div>
            </div>

            {/* Table Body */}
            {loading ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">No users found. Users appear here after they log in.</div>
            ) : (
              users.map((u, idx) => {
                const isProtectedAdmin = ADMIN_EMAILS.includes(u.email as any);
                const isDropdownOpen = openDropdown === u.uid;

                return (
                  <div
                    key={u.uid}
                    className={`grid grid-cols-4 text-sm border-t border-slate-900 ${idx % 2 === 0 ? "bg-[#faf6ed]" : "bg-[#f5f0e1]"}`}
                  >
                    <div className="px-4 py-3 border-r border-slate-200 text-slate-800 font-medium truncate">{u.firstName || "—"}</div>
                    <div className="px-4 py-3 border-r border-slate-200 text-slate-800 font-medium truncate">{u.lastName || "—"}</div>
                    <div className="px-4 py-3 border-r border-slate-200 text-slate-600 truncate">{u.email}</div>
                    <div className="px-4 py-3 relative">
                      {/* Access Level Badge / Dropdown Trigger */}
                      <button
                        onClick={() => {
                          if (isProtectedAdmin) return; // Can't change admin roles
                          setOpenDropdown(isDropdownOpen ? null : u.uid);
                        }}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold transition-colors ${
                          u.accessLevel === "Admin-Level"
                            ? "bg-slate-800 text-white"
                            : u.accessLevel === "Oracle"
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : u.accessLevel === "Read Only"
                            ? "bg-orange-100 text-orange-700 border border-orange-300"
                            : "bg-slate-100 text-slate-600"
                        } ${isProtectedAdmin ? "cursor-default" : "cursor-pointer hover:opacity-80"}`}
                      >
                        {u.accessLevel}
                        {!isProtectedAdmin && <ChevronDown className="w-3 h-3 opacity-50" />}
                      </button>

                      {/* Dropdown for assigning roles */}
                      {isDropdownOpen && !isProtectedAdmin && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setOpenDropdown(null)} />
                          <div className="absolute left-4 top-full mt-1 w-40 bg-[#fefcf6] border border-slate-200 rounded-lg shadow-lg z-40 py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                            {ASSIGNABLE_LEVELS.map((level) => (
                              <button
                                key={level}
                                onClick={() => handleAccessLevelChange(u, level)}
                                className={`w-full text-left px-3 py-2 text-xs font-medium transition-colors ${
                                  u.accessLevel === level
                                    ? "bg-slate-100 text-slate-900 font-bold"
                                    : "text-slate-600 hover:bg-[#faf6ed] hover:text-slate-900"
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
          <div className="border border-slate-900 rounded-lg overflow-hidden sticky top-6">
            <div className="bg-slate-800 text-white px-4 py-3">
              <h3 className="text-xs font-bold uppercase tracking-wider">Access Levels</h3>
            </div>
            <div className="divide-y divide-slate-300">
              {ACCESS_LEVELS.map((level) => {
                const info = ACCESS_LEVEL_INFO[level];
                return (
                  <div key={level} className="px-4 py-3 bg-[#faf6ed]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold ${
                        level === "Admin-Level"
                          ? "text-slate-900"
                          : level === "Oracle"
                          ? "text-amber-700"
                          : "text-slate-600"
                      }`}>{level}</span>
                      {info.functional && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Active</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{info.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
