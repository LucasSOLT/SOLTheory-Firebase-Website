"use client";

/**
 * @file useOrgRole.ts
 * @description React hook that reads the current user's organizational role from Firestore.
 * Listens in real-time to /orgs/{orgId}/members/{uid}.
 * If the user is Admin or Oracle, also fetches all org members for the RBAC management panel.
 *
 * ORACLE: The Oracle (lucas@soltheory.com) always has true role "oracle" regardless of
 * what Firestore says. Oracle can "fake demote" themselves by setting an effectiveRole
 * to test other roles' restrictions. The Oracle badge is always visible.
 *
 * PROTECTED ADMINS: Admin emails from ORG_REGISTRY are forced to at least "admin" role.
 * They cannot be demoted below admin from the dashboard UI.
 */

import { useState, useEffect, useCallback } from "react";
import { useUser, useFirestore } from "@/firebase";
import { doc, collection, onSnapshot, query, setDoc, getDoc, deleteDoc, Timestamp } from "firebase/firestore";
import type { OrgRole, OrgMember } from "@/lib/rbac";
import { hasPermission, ROLE_HIERARCHY } from "@/lib/rbac";
import { ADMIN_EMAILS } from "@/lib/admin";
import { ORG_REGISTRY, isOracle as checkIsOracle, getOrgByEmailDomain } from "@/lib/org-config";
import { useOrgId } from "@/contexts/OrgContext";

/* ─── Protected Admins ──────────────────────────────────────────────────────
 * These users are PERMANENTLY admin in their org. They cannot be demoted from any UI.
 * To change org admin list, edit ORG_REGISTRY in org-config.ts.
 * Key = orgId, Value = array of email addresses (lowercase).
 * ────────────────────────────────────────────────────────────────────────── */
const PROTECTED_ADMINS: Record<string, string[]> = Object.fromEntries(
  Object.entries(ORG_REGISTRY).map(([id, cfg]) => [id, cfg.adminEmails])
);

/** Check if a given email is a protected admin for an org */
function isProtectedAdmin(orgId: string, email: string): boolean {
  const admins = PROTECTED_ADMINS[orgId] || [];
  return admins.includes(email.toLowerCase());
}

interface UseOrgRoleReturn {
  /** The current user's effective role (respects Oracle fake-demote). */
  role: OrgRole;
  /** The user's true underlying role (always "oracle" for Oracle, ignores fake-demote). */
  trueRole: OrgRole;
  /** True if the user is the Oracle, regardless of current effective role. */
  isOracleUser: boolean;
  /** True while the role is being fetched from Firestore. */
  isLoading: boolean;
  /** All members of the org. Only populated for Admin/Oracle roles. */
  members: OrgMember[];
  /** Update a member's role. Only Admins/Oracle can call this. */
  setMemberRole: (targetUid: string, newRole: OrgRole) => Promise<void>;
  /**
   * Oracle-only: Set the effective role for testing. Pass "oracle" to restore full permissions.
   * Non-Oracle users calling this will throw an error.
   */
  setEffectiveRole: (newEffectiveRole: OrgRole) => Promise<void>;
}

export function useOrgRole(orgId?: string): UseOrgRoleReturn {
  const contextOrgId = useOrgId();
  const effectiveOrgId = orgId || contextOrgId;

  const { user } = useUser();
  const firestore = useFirestore();
  const [trueRole, setTrueRole] = useState<OrgRole>("user");
  const [effectiveRole, setEffectiveRoleState] = useState<OrgRole>("user");
  const [isLoading, setIsLoading] = useState(true);
  const [members, setMembers] = useState<OrgMember[]>([]);

  const email = (user?.email || "").toLowerCase();
  const isOracleUser = checkIsOracle(email);

  // Listen to the current user's membership doc
  useEffect(() => {
    if (!firestore || !user?.uid) {
      setIsLoading(false);
      return;
    }

    // ── ORACLE ENFORCEMENT ──
    // The Oracle (lucas@soltheory.com) ALWAYS has trueRole = "oracle" across ALL orgs!
    // But Oracle belongs EXCLUSIVELY to "soltheory".
    if (isOracleUser) {
      setTrueRole("oracle");
      setEffectiveRoleState("oracle");
      setIsLoading(false);

      if (effectiveOrgId === "soltheory") {
        const memberDocRef = doc(firestore, `orgs/soltheory/members`, user.uid);
        getDoc(memberDocRef).then((snap) => {
          if (!snap.exists()) {
            setDoc(memberDocRef, {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "",
              role: "oracle",
              joinedAt: new Date().toISOString(),
            }).catch(console.error);
          } else if (snap.data()?.role !== "oracle") {
            setDoc(memberDocRef, { role: "oracle" }, { merge: true }).catch(console.error);
          }
        });
      } else {
        // Oracle is visiting a secondary org (e.g. nxtchapter, lnu).
        // Oracle must NOT be a member of this org. Clean up any accidental member doc!
        const memberDocRef = doc(firestore, `orgs/${effectiveOrgId}/members`, user.uid);
        getDoc(memberDocRef).then((snap) => {
          if (snap.exists()) {
            deleteDoc(memberDocRef).catch(console.error);
          }
        });
      }
      return;
    }

    // ── NON-ORACLE USERS: SINGLE-ORGANIZATION LISTENER & AUTO-SEED ──
    const memberDocRef = doc(firestore, `orgs/${effectiveOrgId}/members`, user.uid);

    const unsub = onSnapshot(
      memberDocRef,
      async (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          const firestoreRole = (data.role as OrgRole) || "user";
          const firestoreEffectiveRole = data.effectiveRole as OrgRole | undefined;

          if (isProtectedAdmin(effectiveOrgId, email) && firestoreRole !== "admin" && firestoreRole !== "oracle") {
            console.warn(`[useOrgRole] Protected admin ${email} had role "${firestoreRole}" — auto-correcting to "admin"`);
            try {
              await setDoc(memberDocRef, { role: "admin" }, { merge: true });
            } catch (err) {
              console.error("[useOrgRole] Failed to auto-correct admin role:", err);
            }
            setTrueRole("admin");
            setEffectiveRoleState("admin");
          } else {
            setTrueRole(firestoreRole);
            setEffectiveRoleState(firestoreRole);
          }
        } else {
          // Document does not exist.
          // SINGLE-ORG ENFORCEMENT: Only auto-seed if this org matches the user's single organization!
          const domainOrg = getOrgByEmailDomain(email);
          if (domainOrg && domainOrg.id !== effectiveOrgId) {
            // User belongs to another organization by domain!
            setTrueRole("read-only");
            setEffectiveRoleState("read-only");
            setIsLoading(false);
            return;
          }

          // Check user document in /users/{uid}
          try {
            const userRef = doc(firestore, "users", user.uid);
            const userSnap = await getDoc(userRef);
            const userData = userSnap.data();

            if (userData?.organization && userData.organization !== effectiveOrgId) {
              // User is already registered with another organization!
              setTrueRole("read-only");
              setEffectiveRoleState("read-only");
              setIsLoading(false);
              return;
            }

            // Determine role within their designated org
            let defaultRole: OrgRole = "user";
            if (isProtectedAdmin(effectiveOrgId, email)) {
              defaultRole = "admin";
            } else if (ORG_REGISTRY[effectiveOrgId]?.adminEmails.includes(email)) {
              defaultRole = "admin";
            }

            await setDoc(memberDocRef, {
              uid: user.uid,
              email: user.email || "",
              displayName: user.displayName || "",
              role: defaultRole,
              joinedAt: new Date().toISOString(),
            });

            // Lock /users/{uid} to this single organization
            await setDoc(userRef, {
              organization: effectiveOrgId,
              allowedOrgs: [effectiveOrgId],
            }, { merge: true });

            setTrueRole(defaultRole);
            setEffectiveRoleState(defaultRole);
          } catch (err) {
            console.error("[useOrgRole] Failed to check/auto-seed member doc:", err);
            setTrueRole("user");
            setEffectiveRoleState("user");
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
  }, [firestore, user?.uid, user?.email, user?.displayName, effectiveOrgId, email, isOracleUser]);

  // If user is Admin/Oracle, listen to ALL members
  useEffect(() => {
    if (!firestore || !user?.uid || !hasPermission(trueRole, "admin")) {
      setMembers([]);
      return;
    }

    const membersRef = collection(firestore, `orgs/${effectiveOrgId}/members`);
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
            effectiveRole: data.effectiveRole as OrgRole | undefined,
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
  }, [firestore, user?.uid, trueRole, effectiveOrgId]);

  // Function to update a member's role
  const setMemberRole = useCallback(async (targetUid: string, newRole: OrgRole) => {
    if (!firestore || !user?.uid) return;

    // ── ORACLE PROTECTION ──
    // Nobody can change Oracle's role via UI
    const targetMember = members.find(m => m.uid === targetUid);
    if (targetMember && checkIsOracle(targetMember.email)) {
      console.warn(`[useOrgRole] Blocked attempt to change Oracle ${targetMember.email}'s role`);
      throw new Error("Cannot change the Oracle's role. This can only be changed manually in Firebase Console.");
    }

    // ── PROTECTED ADMIN GUARD ──
    // Block demotion of protected admins below admin (Oracle can manage anyone)
    if (!isOracleUser && targetMember && isProtectedAdmin(effectiveOrgId, targetMember.email) && ROLE_HIERARCHY[newRole] < ROLE_HIERARCHY["admin"]) {
      console.warn(`[useOrgRole] Blocked attempt to demote protected admin ${targetMember.email}`);
      throw new Error("Cannot demote a protected admin below admin level. This can only be changed in the source code.");
    }

    const memberDocRef = doc(firestore, `orgs/${effectiveOrgId}/members`, targetUid);
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
  }, [firestore, user?.uid, members, effectiveOrgId]);

  // Oracle-only: Set effective role for testing
  const setEffectiveRole = useCallback(async (newEffectiveRole: OrgRole) => {
    if (!firestore || !user?.uid) return;

    if (!isOracleUser) {
      throw new Error("Only the Oracle can set an effective role for testing.");
    }

    const memberDocRef = doc(firestore, `orgs/${effectiveOrgId}/members`, user.uid);
    try {
      if (newEffectiveRole === "oracle") {
        // Restoring to oracle — remove the effectiveRole field
        await setDoc(
          memberDocRef,
          {
            effectiveRole: null,  // Remove the field by setting null (Firestore will delete it)
          },
          { merge: true }
        );
      } else {
        await setDoc(
          memberDocRef,
          {
            effectiveRole: newEffectiveRole,
          },
          { merge: true }
        );
      }
      setEffectiveRoleState(newEffectiveRole);
    } catch (error) {
      console.error("[useOrgRole] Failed to set effective role:", error);
      throw error;
    }
  }, [firestore, user?.uid, isOracleUser, effectiveOrgId]);

  return {
    role: effectiveRole,     // Components use this for permission checks
    trueRole,                // Components use this for badge display / Oracle detection
    isOracleUser,            // Convenience boolean
    isLoading,
    members,
    setMemberRole,
    setEffectiveRole,
  };
}

/** @deprecated Use isProtectedAdmin instead. Kept for backward compatibility. */
function isProtectedOwner(orgId: string, email: string): boolean {
  return isProtectedAdmin(orgId, email);
}

/** @deprecated Use PROTECTED_ADMINS instead. Kept for backward compatibility. */
const PROTECTED_OWNERS = PROTECTED_ADMINS;

/** Export for use in other components (e.g., OrgRBACPanel shows a lock icon) */
export { isProtectedOwner, PROTECTED_OWNERS, isProtectedAdmin, PROTECTED_ADMINS };
