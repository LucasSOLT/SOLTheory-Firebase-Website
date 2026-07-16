"use client";

import { useState, useEffect } from "react";

/**
 * Hook that polls window.__lastGrantScanMessage and __lastGrantScanStatus
 * to provide real-time feedback on what the grant scanning agent is doing.
 */
export function useGrantScanStatus(pollIntervalMs: number = 800) {
  const [status, setStatus] = useState<"found" | "no_new" | "searching" | "idle">("idle");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    function poll() {
      if (typeof window === "undefined") return;
      const s = window.__lastGrantScanStatus || "idle";
      const m = window.__lastGrantScanMessage || "";
      setStatus(s);
      setMessage(m);
    }

    poll(); // immediate
    const id = setInterval(poll, pollIntervalMs);
    return () => clearInterval(id);
  }, [pollIntervalMs]);

  return { status, message, isScanning: status === "searching" };
}
