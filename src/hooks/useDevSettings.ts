"use client";

/**
 * @file useDevSettings.ts
 * @description Cross-org developer hook for lucas@soltheory.com only.
 * Provides visibility into ALL organizations, ALL users, and ALL member assignments.
 * Reads from /users (global) and /orgs/{orgId}/members/ (per-org) collections.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, doc, query, onSnapshot, setDoc, deleteDoc, getDocs } from "firebase/firestore";
import { ALL_ORGS, type OrgId } from "@/lib/admin";
import type { OrgRole, OrgMember } from "@/lib/rbac";

/* ─── Types ─────────────────────────────────────────────────────────────────── */

export interface GlobalUser {
  uid: string;
  email: string;
  displayName: string;
  organization?: string;
  jobTitle?: string;
  department?: string;
  walkthroughCompleted?: boolean;
  updatedAt?: string;
}

export interface OrgInfo {
  id: string;
  name: string;
  icon: string;
  color: string;
  memberCount: number;
}

/** Email domains → org ID mapping for auto-assignment. */
const DOMAIN_TO_ORG: Record<string, OrgId> = {
  "soltheory.com": "soltheory",
  "nxtchapter.com": "nxtchapter",
  "nxtchapter.org": "nxtchapter",
  "lifenavigationu.com": "lnu",
};

/** Developer email addresses that have access to this panel. */
const DEV_EMAILS = ["lucas@soltheory.com", "lucas.huff@soltheory.com"];

/* ─── Hook ──────────────────────────────────────────────────────────────────── */

export function useDevSettings() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [allUsers, setAllUsers] = useState<GlobalUser[]>([]);
  const [orgMembers, setOrgMembers] = useState<Record<string, OrgMember[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  const isDeveloper = useMemo(() => {
    return !!user?.email && DEV_EMAILS.includes(user.email.toLowerCase());
  }, [user?.email]);

  const allOrgs: OrgInfo[] = useMemo(() => {
    return ALL_ORGS.map(org => ({
      ...org,
      memberCount: orgMembers[org.id]?.length ?? 0,
    }));
  }, [orgMembers]);

  // Listen to ALL users in /users collection
  useEffect(() => {
    if (!firestore || !isDeveloper) {
      setIsLoading(false);
      return;
    }

    const usersRef = collection(firestore, "users");
    const unsub = onSnapshot(
      query(usersRef),
      (snapshot) => {
        const users: GlobalUser[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            uid: d.id,
            email: data.email || data.id || "",
            displayName: data.displayName || "",
            organization: data.organization || "",
            jobTitle: data.jobTitle || "",
            department: data.department || "",
            walkthroughCompleted: data.walkthroughCompleted || false,
            updatedAt: data.updatedAt || "",
          };
        });
        setAllUsers(users);
        setIsLoading(false);
      },
      (error) => {
        console.error("[useDevSettings] Users snapshot error:", error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, isDeveloper]);

  // Listen to members for ALL orgs
  useEffect(() => {
    if (!firestore || !isDeveloper) return;

    const unsubscribers: (() => void)[] = [];

    for (const org of ALL_ORGS) {
      const membersRef = collection(firestore, `orgs/${org.id}/members`);
      const unsub = onSnapshot(
        query(membersRef),
        (snapshot) => {
          const members: OrgMember[] = snapshot.docs.map(d => {
            const data = d.data();
            return {
              uid: d.id,
              email: data.email || "",
              displayName: data.displayName || "",
              role: (data.role as OrgRole) || "user",
              joinedAt: data.joinedAt || "",
              promotedBy: data.promotedBy,
              promotedAt: data.promotedAt,
            };
          });
          setOrgMembers(prev => ({ ...prev, [org.id]: members }));
        },
        (error) => {
          console.error(`[useDevSettings] Members snapshot error for ${org.id}:`, error);
        }
      );
      unsubscribers.push(unsub);
    }

    return () => unsubscribers.forEach(u => u());
  }, [firestore, isDeveloper]);

  // Assign a user to an org with a specific role
  const assignUserToOrg = useCallback(async (uid: string, orgId: string, role: OrgRole) => {
    if (!firestore) return;
    const globalUser = allUsers.find(u => u.uid === uid);
    const memberDocRef = doc(firestore, `orgs/${orgId}/members`, uid);
    await setDoc(memberDocRef, {
      uid,
      email: globalUser?.email || "",
      displayName: globalUser?.displayName || "",
      role,
      joinedAt: new Date().toISOString(),
      promotedBy: user?.uid || "",
      promotedAt: new Date().toISOString(),
    });
  }, [firestore, allUsers, user?.uid]);

  // Remove a user from an org
  const removeUserFromOrg = useCallback(async (uid: string, orgId: string) => {
    if (!firestore) return;
    const memberDocRef = doc(firestore, `orgs/${orgId}/members`, uid);
    await deleteDoc(memberDocRef);
  }, [firestore]);

  // Update a user's role in an org
  const updateUserRole = useCallback(async (uid: string, orgId: string, role: OrgRole) => {
    if (!firestore) return;
    const memberDocRef = doc(firestore, `orgs/${orgId}/members`, uid);
    await setDoc(memberDocRef, {
      role,
      promotedBy: user?.uid || "",
      promotedAt: new Date().toISOString(),
    }, { merge: true });
  }, [firestore, user?.uid]);

  // Batch auto-assign: scan all users, match by email domain, create member docs
  const syncAllUsersToOrgs = useCallback(async () => {
    if (!firestore) return { assigned: 0 };
    let assignedCount = 0;

    for (const globalUser of allUsers) {
      if (!globalUser.email) continue;
      const domain = globalUser.email.split("@")[1]?.toLowerCase();
      if (!domain) continue;

      const orgId = DOMAIN_TO_ORG[domain];
      if (!orgId) continue;

      // Check if already a member
      const existingMembers = orgMembers[orgId] || [];
      if (existingMembers.some(m => m.uid === globalUser.uid)) continue;

      // Auto-assign as 'user' role
      await assignUserToOrg(globalUser.uid, orgId, "user");
      assignedCount++;
    }

    return { assigned: assignedCount };
  }, [firestore, allUsers, orgMembers, assignUserToOrg]);

  return {
    isDeveloper,
    isLoading,
    allOrgs,
    allUsers,
    orgMembers,
    assignUserToOrg,
    removeUserFromOrg,
    updateUserRole,
    syncAllUsersToOrgs,
  };
}
