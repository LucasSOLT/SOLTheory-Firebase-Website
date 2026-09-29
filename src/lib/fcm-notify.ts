import { initAdmin, getFirestore, getMessaging } from "@/firebase/admin";
import type { MulticastMessage } from "firebase-admin/messaging";

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  chatId?: string;
  type?: "sms" | "dm" | "channel" | "system";
}

const DEFAULT_ICON = "https://firebasestorage.googleapis.com/v0/b/studio-5711990008-7ac2c.firebasestorage.app/o/SOL%20Theory%20Logo.png?alt=media&token=530d35ea-c595-4e88-bf37-6ec856485440";

/**
 * Sends a background push notification to all active devices (phones & computers) registered to a user.
 * Automatically cleans up invalid/expired device tokens.
 */
export async function sendPushToUser(
  uid: string,
  payload: PushNotificationPayload
): Promise<{ successCount: number; failureCount: number }> {
  if (!uid) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    initAdmin();
    const db = getFirestore();
    const messaging = getMessaging();

    // Query all registered push tokens for this user
    const tokensSnapshot = await db
      .collection("users")
      .doc(uid)
      .collection("push_tokens")
      .get();

    if (tokensSnapshot.empty) {
      return { successCount: 0, failureCount: 0 };
    }

    const tokenDocs = tokensSnapshot.docs;
    const tokens = tokenDocs.map((d) => d.id).filter(Boolean);

    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    const targetUrl = payload.url || "/portal/dashboard";
    const iconUrl = payload.icon || DEFAULT_ICON;

    const multicastMessage: MulticastMessage = {
      tokens,
      notification: {
        title: payload.title,
        body: payload.body,
        imageUrl: iconUrl,
      },
      data: {
        title: payload.title,
        body: payload.body,
        url: targetUrl,
        icon: iconUrl,
        badge: payload.badge || iconUrl,
        chatId: payload.chatId || "",
        type: payload.type || "message",
        tag: payload.tag || payload.chatId || "sol-message",
      },
      webpush: {
        fcmOptions: {
          link: targetUrl,
        },
        notification: {
          title: payload.title,
          body: payload.body,
          icon: iconUrl,
          badge: payload.badge || iconUrl,
          tag: payload.tag || payload.chatId || "sol-message",
          renotify: true,
          requireInteraction: false,
          vibrate: [200, 100, 200, 100, 200],
        },
      },
    };

    const response = await messaging.sendEachForMulticast(multicastMessage);

    // Prune stale/expired tokens automatically
    const batch = db.batch();
    let hasStaleTokens = false;

    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        const errCode = resp.error.code;
        if (
          errCode === "messaging/registration-token-not-registered" ||
          errCode === "messaging/invalid-registration-token" ||
          errCode === "messaging/invalid-argument"
        ) {
          hasStaleTokens = true;
          const staleDocRef = tokenDocs[idx].ref;
          batch.delete(staleDocRef);
        }
      }
    });

    if (hasStaleTokens) {
      await batch.commit().catch((e) => {
        console.warn("[FCM] Failed to prune stale tokens:", e?.message);
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (err: any) {
    console.error(`[FCM] Error dispatching push to user ${uid}:`, err?.message || err);
    return { successCount: 0, failureCount: 0 };
  }
}

/**
 * Sends a background push notification to multiple users identified by their email addresses.
 */
export async function sendPushToEmails(
  emails: string[],
  payload: PushNotificationPayload
): Promise<void> {
  const uniqueEmails = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()))).filter(Boolean);
  if (uniqueEmails.length === 0) return;

  try {
    initAdmin();
    const db = getFirestore();

    // Firestore `in` queries are limited to 30 items
    const chunks: string[][] = [];
    for (let i = 0; i < uniqueEmails.length; i += 30) {
      chunks.push(uniqueEmails.slice(i, i + 30));
    }

    const uids: string[] = [];
    for (const chunk of chunks) {
      const snap = await db.collection("users").where("email", "in", chunk).get();
      snap.forEach((doc) => uids.push(doc.id));
    }

    if (uids.length === 0) return;

    await Promise.allSettled(uids.map((uid) => sendPushToUser(uid, payload)));
  } catch (err: any) {
    console.warn("[FCM] Error dispatching push to emails:", err?.message || err);
  }
}
