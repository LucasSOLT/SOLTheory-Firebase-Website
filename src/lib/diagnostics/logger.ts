import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";

export interface DiagnosticLog {
  id?: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  status: "healthy" | "degraded" | "error" | "warning";
  endpoint?: string;
  latencyMs?: number;
  message: string;
  errorDetails?: string;
  metadata?: Record<string, any>;
}

/**
 * Record a diagnostic log entry to Firestore (`agent_health_logs`)
 */
export async function logDiagnosticEvent(log: Omit<DiagnosticLog, "timestamp">): Promise<void> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const entry: DiagnosticLog = {
      ...log,
      timestamp: new Date().toISOString(),
    };

    await db.collection("agent_health_logs").add(entry);
  } catch (err: any) {
    console.error("[DiagnosticLogger] Failed to write health log to Firestore:", err?.message || err);
  }
}

/**
 * Fetch recent diagnostic logs from Firestore
 */
export async function getRecentDiagnosticLogs(limitCount: number = 50): Promise<DiagnosticLog[]> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const snapshot = await db.collection("agent_health_logs")
      .orderBy("timestamp", "desc")
      .limit(limitCount)
      .get();

    const logs: DiagnosticLog[] = [];
    snapshot.forEach(doc => {
      logs.push({
        id: doc.id,
        ...(doc.data() as Omit<DiagnosticLog, "id">),
      });
    });

    return logs;
  } catch (err: any) {
    console.error("[DiagnosticLogger] Failed to fetch diagnostic logs:", err?.message || err);
    return [];
  }
}
