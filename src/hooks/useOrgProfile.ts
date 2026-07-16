"use client";

import { useState, useEffect, useCallback } from "react";
import { useFirestore, useUser } from "@/firebase";
import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";

/* ─── Org Profile Shape ─────────────────────────────────────────────────────── */

export interface OrgProfileData {
  orgName: string;
  companyDescription: string;
  missionStatement: string;
  orgBudget: number | null;
  orgStaffSize: number | null;
  orgEin: string;
  orgSamUei: string;
  orgYearFounded: number | null;
  locationState: string;
  locationCity: string;
  eligibilityTypes: string[];
  serviceAreas: string[];
  populationsServed: string[];
  website: string;
  phoneNumber: string;
  senderEmail: string;
  senderName: string;
}

const EMPTY_PROFILE: OrgProfileData = {
  orgName: "",
  companyDescription: "",
  missionStatement: "",
  orgBudget: null,
  orgStaffSize: null,
  orgEin: "",
  orgSamUei: "",
  orgYearFounded: null,
  locationState: "",
  locationCity: "",
  eligibilityTypes: [],
  serviceAreas: [],
  populationsServed: [],
  website: "",
  phoneNumber: "",
  senderEmail: "",
  senderName: "",
};

/* ─── Hook ──────────────────────────────────────────────────────────────────── */

export function useOrgProfile(orgId: string = "soltheory") {
  const firestore = useFirestore();
  const { user } = useUser();
  const [orgProfile, setOrgProfile] = useState<OrgProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load org profile from Firestore
  useEffect(() => {
    if (!firestore) return;

    async function load() {
      try {
        const docRef = doc(firestore!, "org_profiles", orgId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setOrgProfile({
            orgName: data.orgName || "",
            companyDescription: data.companyDescription || "",
            missionStatement: data.missionStatement || "",
            orgBudget: data.orgBudget ?? null,
            orgStaffSize: data.orgStaffSize ?? null,
            orgEin: data.orgEin || "",
            orgSamUei: data.orgSamUei || "",
            orgYearFounded: data.orgYearFounded ?? null,
            locationState: data.locationState || "",
            locationCity: data.locationCity || "",
            eligibilityTypes: data.eligibilityTypes || [],
            serviceAreas: data.serviceAreas || [],
            populationsServed: data.populationsServed || [],
            website: data.website || "",
            phoneNumber: data.phoneNumber || "",
            senderEmail: data.senderEmail || "",
            senderName: data.senderName || "",
          });
        } else {
          // No profile yet — return empty
          setOrgProfile(null);
        }
      } catch (err) {
        console.error("[useOrgProfile] Failed to load org profile:", err);
        setOrgProfile(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [firestore, orgId]);

  // Save org profile to Firestore
  const saveOrgProfile = useCallback(
    async (profile: Partial<OrgProfileData>) => {
      if (!firestore) return;
      try {
        const docRef = doc(firestore, "org_profiles", orgId);
        await setDoc(
          docRef,
          {
            ...profile,
            updatedAt: Timestamp.now(),
            updatedBy: user?.uid || null,
          },
          { merge: true }
        );
        setOrgProfile(prev => prev ? { ...prev, ...profile } : { ...EMPTY_PROFILE, ...profile });
        console.log("[useOrgProfile] Saved org profile");
      } catch (err) {
        console.error("[useOrgProfile] Failed to save org profile:", err);
      }
    },
    [firestore, orgId, user?.uid]
  );

  return { orgProfile, loading, saveOrgProfile };
}
