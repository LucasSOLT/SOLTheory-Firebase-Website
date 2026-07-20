"use client";

/**
 * @file useOrgRole.ts
 * @description React hook that reads the current user's organizational role from Firestore.
 * Listens in real-time to /orgs/{orgId}/members/{uid}.
 * If the user is Admin or Owner, also fetches all org members for the RBAC management panel.
 *
 * PROTECTED OWNERS: These emails are ALWAYS forced to "owner" role regardless of
 * what Firestore says. This is the source of truth for ownership — change it only
 * in this file (the IDE), never from the dashboard UI.
 */

import { useState, useEffect } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, collection, onSnapshot, query, setDoc, Timestamp } from "firebase/firestore";
import type { OrgRole, OrgMember } from "@/lib/rbac";
import { hasPermission, ROLE_HIERARCHY } from "@/lib/rbac";
import { ADMIN_EMAILS } from "@/lib/admin";

/* ─── Protected Owners ──────────────────────────────────────────────────────
 * These users are PERMANENTLY owner. They cannot be demoted from any UI.
 * To change org ownership, edit this map directly in the IDE.
 * Key = orgId, Value = array of email addresses (lowercase).
 * ────────────────────────────────────────────────────────────────────────── */
const PROTECTED_OWNERS: Record<string, string[]> = {
  soltheory: ["lucas@soltheory.com", "lucas.huff@soltheory.com"],
  // nxtchapter: ["owner@nxtchapter.com"],
  // lnu: ["owner@lifenavigationu.com"],
};

/** Check if a given email is a protected owner for an org */
function isProtectedOwner(orgId: string, email: string): boolean {
  const owners = PROTECTED_OWNERS[orgId] || [];
  return owners.includes(email.toLowerCase());
}

interface UseOrgRoleReturn {
  /** The current user's role in this org. Defaults to 'user' while loading. */
  role: OrgRole;
  /** True while the role is being fetched from Firestore. */
  isLoading: boolean;
  /** All members of the org. Only populated for Admin/Owner roles. */
  members: OrgMember[];
  /** Update a member's role. Only Admins/Owners can call this. */
  setMemberRole: (targetUid: string, newRole: OrgRole) => Promise<void>;
}

export function useOrgRole(orgId: string = "soltheory"): UseOrgRoleReturn {
  const { user } = useUser();
  const firestore = useFirestore();
  const [role, setRole] = useState<OrgRole>("user");
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);

  // Listen to the current user's membership doc
  useEffect(() => {
    if (!firestore || !user?.uid) {
      setIsLoading(false);
      return;
    }

    const email = (user.email || "").toLowerCase();
    const memberDocRef = doc(firestore, `orgs/${orgId}/members`, user.uid);

    const unsub = onSnapshot(
      memberDocRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const firestoreRole = (data.role as OrgRole) || "user";

          // ── PROTECTED OWNER ENFORCEMENT ──
          // If this user is a protected owner but their Firestore doc says otherwise,
          // auto-correct it back to "owner" immediately.
          if (isProtectedOwner(orgId, email) && firestoreRole !== "owner") {
            console.warn(`[useOrgRole] Protected owner ${email} had role "${firestoreRole}" — auto-correcting to "owner"`);
            try {
              await setDoc(memberDocRef, { role: "owner" }, { merge: true });
            } catch (err) {
              console.error("[useOrgRole] Failed to auto-correct owner role:", err);
            }
            setRole("owner");
          } else {
            setRole(firestoreRole);
          }
        } else {
          // Auto-seed: determine role based on email
          let defaultRole: OrgRole = "user";

          // Protected owners always get owner
          if (isProtectedOwner(orgId, email)) {
            defaultRole = "owner";
          } else if (email === "steve@soltheory.com" || email === "gerard@soltheory.com") {
            defaultRole = "admin";
          } else if (ADMIN_EMAILS.some(ae => ae.toLowerCase() === email)) {
            defaultRole = "admin";
          }

          try {
            await setDoc(memberDocRef, {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "",
              role: defaultRole,
              joinedAt: new Date().toISOString(),
            });
            setRole(defaultRole);
          } catch (err) {
            console.error("[useOrgRole] Failed to auto-seed member doc:", err);
            setRole("user");
          }
        }
        setIsLoading(false);
      },
      (error) => {
        console.error("[useOrgRole] Snapshot error:", error);
        setIsLoading(false);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid, user?.email, user?.displayName, orgId]);

  // If user is Admin/Owner, listen to ALL members
  useEffect(() => {
    if (!firestore || !user?.uid || !hasPermission(role, "admin")) {
      setMembers([]);
      return;
    }

    const membersRef = collection(firestore, `orgs/${orgId}/members`);
    const unsub = onSnapshot(
      query(membersRef),
      (snapshot) => {
        const allMembers: OrgMember[] = snapshot.docs.map((d) => {
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
        setMembers(allMembers);
      },
      (error) => {
        console.error("[useOrgRole] Members snapshot error:", error);
      }
    );

    return () => unsub();
  }, [firestore, user?.uid, role, orgId]);

  // Function to update a member's role
  const setMemberRole = async (targetUid: string, newRole: OrgRole) => {
    if (!firestore || !user?.uid) return;

    // ── PROTECTED OWNER GUARD ──
    // Find the target member's email and block demotion of protected owners
    const targetMember = members.find(m => m.uid === targetUid);
    if (targetMember && isProtectedOwner(orgId, targetMember.email)) {
      console.warn(`[useOrgRole] Blocked attempt to change protected owner ${targetMember.email}'s role`);
      throw new Error("Cannot change the role of a protected owner. This can only be changed in the source code.");
    }

    const memberDocRef = doc(firestore, `orgs/${orgId}/members`, targetUid);
    try {
      await setDoc(
        memberDocRef,
        {
          role: newRole,
          promotedBy: user.uid,
          promotedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("[useOrgRole] Failed to update member role:", error);
      throw error;
    }
  };

  return { role, isLoading, members, setMemberRole };
}

/** Export for use in other components (e.g., OrgRBACPanel shows a lock icon) */
export { isProtectedOwner, PROTECTED_OWNERS };
