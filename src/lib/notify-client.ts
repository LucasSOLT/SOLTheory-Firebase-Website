"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

export type NotificationEvent =
  | "action_board_assigned"
  | "timesheet_entry"
  | "grant_found"
  | "onboarding_task_completed";

/**
 * Tell the server that something happened which should notify other people.
 * Fire-and-forget: never awaited by callers' critical path, never throws.
 * The server re-reads the record and decides recipients/text (see /api/notifications/events).
 */
export function reportNotificationEvent(event: NotificationEvent, orgId: string, refId: string): void {
  if (!orgId || !refId) return;
  (async () => {
    try {
      const headers = await getAuthHeaders();
      await fetch("/api/notifications/events", {
        method: "POST",
        headers: { ...(headers as Record<string, string>), "Content-Type": "application/json" },
        body: JSON.stringify({ event, orgId, refId }),
      });
    } catch (e) {
      console.warn(`[notify] ${event} report failed (non-blocking):`, e);
    }
  })();
}
