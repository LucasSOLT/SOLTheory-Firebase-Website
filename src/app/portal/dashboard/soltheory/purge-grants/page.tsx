"use client";

import { useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, getDocs, deleteDoc, doc, query, where, setDoc } from "firebase/firestore";
import { Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Emergency page to delete ALL grant suggestions from Firestore.
 * Uses the user's existing auth session so Firestore rules allow the delete.
 * 
 * Visit: /portal/dashboard/soltheory/purge-grants
 */
export default function PurgeGrantsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [status, setStatus] = useState<"idle" | "deleting" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  async function handlePurge() {
    if (!firestore || !user) return;
    
    const confirmed = window.confirm(
      "This will permanently delete ALL grant suggestions. Are you sure?"
    );
    if (!confirmed) return;

    setStatus("deleting");
    setCount(0);
    setError("");

    try {
      const grantsRef = collection(firestore, "grant_suggestions");
      const q = query(grantsRef, where("orgId", "==", "soltheory"));
      const snapshot = await getDocs(q);

      let deleted = 0;
      for (const document of snapshot.docs) {
        await deleteDoc(doc(firestore, "grant_suggestions", document.id));
        deleted++;
        setCount(deleted);
      }

      // Also reset the scan timing gate so the next scan fires immediately
      try {
        const configRef = doc(firestore, "grant_agent_config", "soltheory");
        await setDoc(configRef, { lastScanTimes: {} }, { merge: true });
        console.log("Reset scan timing gate");
      } catch {
        console.warn("Could not reset timing gate");
      }

      setStatus("done");
      setCount(deleted);
    } catch (err: any) {
      console.error("Purge failed:", err);
      setError(err.message || "Unknown error");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-[#faf6ed] flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-[#fefcf6] rounded-2xl border border-slate-200 shadow-lg p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-8 h-8 text-red-500" />
        </div>

        <h1 className="text-xl font-extrabold text-slate-900 mb-2">
          Purge All Grants
        </h1>
        <p className="text-sm text-slate-500 mb-8">
          This will permanently delete every grant suggestion in the database.
          This action cannot be undone.
        </p>

        {status === "idle" && (
          <button
            onClick={handlePurge}
            disabled={!firestore || !user}
            className="w-full px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Delete All Grant Suggestions
          </button>
        )}

        {status === "deleting" && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm font-bold text-slate-700">
              Deleting... {count} removed
            </p>
          </div>
        )}

        {status === "done" && (
          <div className="flex flex-col items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            <p className="text-sm font-bold text-emerald-700">
              Done! Deleted {count} grants.
            </p>
            <a
              href="/portal/dashboard/soltheory"
              className="mt-4 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all"
            >
              Back to Dashboard
            </a>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <p className="text-sm font-bold text-red-700">
              Error: {error}
            </p>
            <button
              onClick={() => setStatus("idle")}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {!user && (
          <p className="mt-4 text-xs text-red-500 font-semibold">
            You must be signed in to purge grants.
          </p>
        )}
      </div>
    </div>
  );
}
