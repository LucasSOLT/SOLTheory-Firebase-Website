"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser, useFirestore } from "@/firebase/provider";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

export default function DeleteAllCampaignsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [log, setLog] = useState<string[]>(["Waiting for auth..."]);
  const [done, setDone] = useState(false);
  const [running, setRunning] = useState(false);

  const runDelete = useCallback(async () => {
    if (!user || !firestore || running) return;
    setRunning(true);
    setDone(false);
    const lines: string[] = [`Authenticated as ${user.email} (${user.uid})`, ""];
    setLog([...lines]);

    // Check EVERY possible campaign location
    const paths = [
      "orgs/soltheory/campaigns",
      "orgs/nxtchapter/campaigns",
      "organizations/soltheory/campaigning",
      "organizations/nxtchapter/campaigning",
      `users/${user.uid}/campaigns`,
    ];

    let totalDeleted = 0;

    for (const path of paths) {
      lines.push(`Scanning: ${path}`);
      setLog([...lines]);
      try {
        const snapshot = await getDocs(collection(firestore, path));
        lines.push(`  Found ${snapshot.size} documents`);
        setLog([...lines]);
        for (const d of snapshot.docs) {
          const data = d.data();
          lines.push(`  ❌ Deleting: ${d.id} — "${data.name || "unnamed"}" (${data.status || "?"})`);
          setLog([...lines]);
          await deleteDoc(doc(firestore, path, d.id));
          totalDeleted++;
        }
      } catch (err: any) {
        lines.push(`  (skipped: ${err.message})`);
        setLog([...lines]);
      }
      lines.push("");
    }

    lines.push(`✅ DONE — Deleted ${totalDeleted} campaigns total across all paths.`);
    if (totalDeleted === 0) {
      lines.push("No campaigns found anywhere. They're all gone!");
    }
    setLog([...lines]);
    setDone(true);
    setRunning(false);
  }, [user, firestore, running]);

  // Auto-run on load
  useEffect(() => {
    if (user && firestore && !running && !done) {
      runDelete();
    }
  }, [user, firestore]);

  return (
    <div style={{ background: "#111", color: "#0f0", fontFamily: "monospace", padding: 40, minHeight: "100vh" }}>
      <h1 style={{ color: "#ff4444", marginBottom: 20, fontSize: 28 }}>🗑️ DELETE ALL CAMPAIGNS</h1>
      <pre style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, marginBottom: 20 }}>{log.join("\n")}</pre>
      {done && (
        <div>
          <p style={{ color: "#00ff00", fontSize: 24, marginBottom: 20 }}>✅ ALL CAMPAIGNS DELETED</p>
          <button 
            onClick={runDelete}
            style={{ background: "#ff4444", color: "white", padding: "12px 24px", border: "none", borderRadius: 8, fontSize: 16, cursor: "pointer", fontWeight: "bold" }}
          >
            🔄 Run Again (Double Check)
          </button>
        </div>
      )}
    </div>
  );
}
