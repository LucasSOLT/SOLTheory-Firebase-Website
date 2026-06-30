"use client";

import { useState, useEffect, useRef } from "react";
import { useUser, useFirestore } from "@/firebase";
import { collection, getDocs, getDoc, doc } from "firebase/firestore";

interface UserKnowledgeContext {
  knowledgeBaseText: string;
  pactText: string;
  orgBrainText: string;
  isLoading: boolean;
}

/**
 * Hook to load the user's Knowledge Base documents, P.A.C.T. facts, and Org Brain.
 * Caches results and only re-fetches when uid changes.
 * 
 * Usage:
 *   const { knowledgeBaseText, pactText, orgBrainText } = useKnowledgeBase("soltheory");
 */
export function useKnowledgeBase(orgPrefix: string = "soltheory"): UserKnowledgeContext {
  const { user } = useUser();
  const firestore = useFirestore();
  const [knowledgeBaseText, setKnowledgeBaseText] = useState("");
  const [pactText, setPactText] = useState("");
  const [orgBrainText, setOrgBrainText] = useState("");
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
        const agentIds = ["jarvis", `${orgPrefix}_jarvis`, "email", `${orgPrefix}_email`];

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

        // 2. Load P.A.C.T. facts
        try {
          const userDoc = await getDoc(doc(firestore, "users", user.uid));
          const pactField = `pact_entries_${orgPrefix}`;
          const entries: any[] = userDoc.data()?.[pactField] || [];
          const activeFacts = entries
            .filter((e: any) => !e.markedForDeletion)
            .map((e: any) => `Q: ${e.question}\nA: ${e.answer}`)
            .join("\n\n");
          setPactText(activeFacts);
        } catch {
          // ignore
        }

        // 3. Load Org Brain
        try {
          const orgDoc = await getDoc(doc(firestore, "organizations", orgPrefix));
          setOrgBrainText(orgDoc.data()?.orgBrain || "");
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
  }, [user?.uid, firestore, orgPrefix]);

  return { knowledgeBaseText, pactText, orgBrainText, isLoading };
}
