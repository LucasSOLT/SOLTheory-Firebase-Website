"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, onSnapshot, query, where } from "firebase/firestore";

/* ─── Schema matching grant_suggestions documents ─── */
export interface GrantRecord {
  id: string;
  title: string;
  description: string;
  agency: string;
  amount: number | null;
  status: "unapplied" | "applied" | "approved" | "denied";
  dateSuggested: string | null;
  location_state: string;
  location_city: string;
  url: string;
  eligibility: string;
  fundingInstrument: string;
  activityCategories: string[];
  grantStructures: string[];
  agencyLevels: string[];
  appliedAt: string | null;
  completedAt: string | null;
  deniedAt: string | null;
  createdAt: string | null;
  // Multi-source pipeline fields (Round 1)
  sources: string[];
  sourceWebsite: string;
  relevanceScore: number | null;
  relevanceExplanation: string;
  grantScope: string;
  opportunityNumber: string;
  closeDate: string | null;
  // Multi-session fields
  sessionId: string | null;
  agentId: string | null;
}

interface UseGrantsDataResult {
  grants: GrantRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Shared hook for grant data.
 *
 * Uses Firestore onSnapshot for real-time updates (so agent worker writes
 * are immediately visible). All three Tile 5 widgets consume this so
 * we make exactly ONE listener instead of three.
 */
export function useGrantsData(orgId: string = "soltheory", sessionId?: string | null): UseGrantsDataResult {
  const { user } = useUser();
  const firestore = useFirestore();

  const [grants, setGrants] = useState<GrantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If Firestore or user aren't ready, show empty set
    if (!firestore || !user?.uid) {
      setGrants([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    let unsub: (() => void) | undefined;
    try {
      const grantsRef = collection(firestore, "grant_suggestions");
      // Query by orgId only — sessionId filtering is done client-side
      // to avoid requiring a composite Firestore index
      const q = query(grantsRef, where("orgId", "==", orgId));

      unsub = onSnapshot(
        q,
        (snap) => {
          const fetched: GrantRecord[] = snap.docs.map((d) => {
            const data = d.data();

            // Convert Firestore Timestamps to ISO strings
            const toISO = (ts: any): string | null => {
              if (!ts) return null;
              try {
                const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
                return isNaN(date.getTime()) ? null : date.toISOString();
              } catch {
                return null;
              }
            };

            return {
              id: d.id,
              title: data.title || "Untitled Grant",
              description: data.description || "",
              agency: data.agency || "Unknown Agency",
              amount: data.amount ?? null,
              status: (data.status as GrantRecord["status"]) || "unapplied",
              dateSuggested: toISO(data.dateSuggested || data.createdAt),
              location_state: data.location_state || "",
              location_city: data.location_city || "",
              url: data.url || "",
              eligibility: data.eligibility || "",
              fundingInstrument: data.fundingInstrument || "",
              activityCategories: data.activityCategories || [],
              grantStructures: data.grantStructures || [],
              agencyLevels: data.agencyLevels || [],
              appliedAt: toISO(data.appliedAt),
              completedAt: toISO(data.completedAt),
              deniedAt: toISO(data.deniedAt),
              createdAt: toISO(data.createdAt),
              // Multi-source pipeline fields
              sources: data.sources || (data.sourceWebsite ? [data.sourceWebsite] : []),
              sourceWebsite: data.sourceWebsite || "",
              relevanceScore: data.relevanceScore ?? null,
              relevanceExplanation: data.relevanceExplanation || data.relevanceExplantion || "",
              grantScope: data.grantScope || "",
              opportunityNumber: data.opportunityNumber || "",
              closeDate: toISO(data.closeDate),
              sessionId: data.sessionId || null,
              agentId: data.agentId || null,
            };
          });

          // Sort: most recently suggested first
          fetched.sort((a, b) => {
            const aMs = a.dateSuggested ? new Date(a.dateSuggested).getTime() : 0;
            const bMs = b.dateSuggested ? new Date(b.dateSuggested).getTime() : 0;
            return bMs - aMs;
          });

          // Client-side sessionId filtering (avoids composite index)
          const filtered = sessionId
            ? fetched.filter((g) => g.sessionId === sessionId)
            : fetched;

          setGrants(filtered);
          setError(null);
          setLoading(false);
        },
        (err) => {
          console.error("useGrantsData snapshot error:", err);
          // Degrade gracefully: empty array, no blocking error
          setGrants([]);
          setError(null);
          setLoading(false);
        }
      );
    } catch (err) {
      console.error("useGrantsData setup error:", err);
      setGrants([]);
      setLoading(false);
    }

    return () => unsub?.();
  }, [firestore, user?.uid, orgId, sessionId]);

  const refetch = useCallback(() => {
    // onSnapshot is real-time, so this is a no-op
    // Kept for API compatibility
  }, []);

  return { grants, loading, error, refetch };
}
