"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";
import { useOrgId } from "@/contexts/OrgContext";

interface UserKnowledgeContext {
  knowledgeBaseText: string;
  pactText: string;
  orgBrainText: string;
  personalBrainText: string;
  isLoading: boolean;
}

/**
 * Hook to load the user's Knowledge Base documents, P.A.C.T. facts, and Org Brain.
 * Caches results and only re-fetches when uid changes.
 * 
 * Usage:
 *   const { knowledgeBaseText, pactText, orgBrainText } = useKnowledgeBase("soltheory");
 */
export function useKnowledgeBase(orgPrefix?: string): UserKnowledgeContext {
  const contextOrgId = useOrgId();
  const effectiveOrgPrefix = orgPrefix || contextOrgId;

  const { user } = useUser();
  const firestore = useFirestore();
  const [knowledgeBaseText, setKnowledgeBaseText] = useState("");
  const [pactText, setPactText] = useState("");
  const [orgBrainText, setOrgBrainText] = useState("");
  const [personalBrainText, setPersonalBrainText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!user?.uid || !firestore || fetchedRef.current) return;
    fetchedRef.current = true;

    const loadAll = async () => {
      setIsLoading(true);
      try {
        // 1. Load Knowledge Base documents
        const kbTexts: string[] = [];
        const agentIds = ["jarvis", `${effectiveOrgPrefix}_jarvis`, "email", `${effectiveOrgPrefix}_email`];

        for (const agentId of agentIds) {
          try {
            const docsSnap = await getDocs(
              collection(firestore, "users", user.uid, "agents", agentId, "knowledge_docs")
            );
            docsSnap.forEach(d => {
              const data = d.data();
              if (data.content && typeof data.content === "string") kbTexts.push(data.content);
            });

            // Legacy support
            const chunksSnap = await getDocs(
              collection(firestore, "users", user.uid, "agents", agentId, "knowledge_chunks")
            );
            chunksSnap.forEach(d => {
              const data = d.data();
              if (data.text && typeof data.text === "string") kbTexts.push(data.text);
            });
          } catch {
            // ignore missing collections
          }
        }
        setKnowledgeBaseText(kbTexts.join("\n\n"));

        // 2. Load P.A.C.T. facts from Supabase API (defaults to user scope for backward compat)
        try {
          const { getAuthHeaders } = await import("@/lib/api-auth-client");
          const headers = await getAuthHeaders();
          const pactRes = await fetch(`/api/pact/memories?scope=user&orgId=${effectiveOrgPrefix}`, { headers });
          if (pactRes.ok) {
            const entries: any[] = await pactRes.json();
            const activeFacts = (entries || [])
              .filter((e: any) => !e.marked_for_deletion)
              .map((e: any) => `Q: ${e.question}\nA: ${e.answer}`)
              .join("\n\n");
            setPactText(activeFacts);
          }
        } catch {
          // ignore
        }

        // 3. Load Org Brain
        try {
          const orgDoc = await getDoc(doc(firestore, "organizations", effectiveOrgPrefix));
          setOrgBrainText(orgDoc.data()?.orgBrain || "");
        } catch {
          // ignore
        }

        // 4. Load Personal AI Brain Profile (compiled briefing)
        try {
          const userDoc = await getDoc(doc(firestore, "users", user.uid));
          const profile = userDoc.data()?.aiBrainProfile;
          if (profile?.compiledBriefing) {
            setPersonalBrainText(profile.compiledBriefing);
          }
        } catch {
          // ignore
        }
      } catch (err) {
        console.error("useKnowledgeBase: error loading context", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadAll();
  }, [user?.uid, firestore, effectiveOrgPrefix]);

  return { knowledgeBaseText, pactText, orgBrainText, personalBrainText, isLoading };
}
