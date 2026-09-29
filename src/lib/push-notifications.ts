"use client";

import { getAuthHeaders } from "@/lib/api-auth-client";

export type PushPermissionState = "granted" | "denied" | "default" | "unsupported";

/**
 * Checks if the current browser environment supports Push Notifications and Service Workers.
 */
export function isPushNotificationSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Gets the current Notification permission state.
 */
export function getPushPermissionState(): PushPermissionState {
  if (!isPushNotificationSupported()) return "unsupported";
  return Notification.permission as PushPermissionState;
}

/**
 * Registers the background Firebase Cloud Messaging service worker.
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", {
      scope: "/",
    });
    return registration;
  } catch (err: any) {
    console.warn("[Push] Service worker registration failed:", err?.message || err);
    return null;
  }
}

/**
 * Prompts user for push notification permission, retrieves FCM token, and registers it with the backend.
 */
export async function enablePushNotifications(): Promise<{
  success: boolean;
  token?: string;
  error?: string;
}> {
  if (!isPushNotificationSupported()) {
    return { success: false, error: "Push notifications are not supported on this browser/device." };
  }

  try {
    // 1. Request browser permission
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, error: "Notification permission was not granted." };
    }

    // 2. Ensure Service Worker is registered and active
    const swRegistration = await registerPushServiceWorker();
    if (!swRegistration) {
      return { success: false, error: "Failed to register background notification service worker." };
    }

    // 3. Dynamically import firebase/messaging to ensure code-splitting
    const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) {
      return { success: false, error: "Firebase Cloud Messaging is not supported on this platform." };
    }

    const { initializeFirebase } = await import("@/firebase/init");
    const { firebaseApp } = initializeFirebase();
    const messaging = getMessaging(firebaseApp);

    // Optional custom public VAPID key (if configured in Firebase Console)
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || undefined;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: swRegistration,
      vapidKey,
    });

    if (!token) {
      return { success: false, error: "Failed to generate FCM device token." };
    }

    // 4. Send token to backend API
    const authHeaders = await getAuthHeaders();
    const res = await fetch("/api/notifications/push-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        token,
        platform: /mobile|iphone|android|ipad/i.test(navigator.userAgent) ? "mobile" : "desktop",
        userAgent: navigator.userAgent,
      }),
    });

    if (!res.ok) {
      console.warn("[Push] Failed to save push token to server:", res.status);
    } else {
      localStorage.setItem("sol_fcm_token", token);
      localStorage.setItem("sol_push_enabled", "true");
    }

    return { success: true, token };
  } catch (err: any) {
    console.error("[Push] Error enabling push notifications:", err);
    return { success: false, error: err?.message || "An unexpected error occurred." };
  }
}

/**
 * Disables push notifications for this device and revokes the token from the backend.
 */
export async function disablePushNotifications(): Promise<boolean> {
  const token = localStorage.getItem("sol_fcm_token");
  localStorage.removeItem("sol_push_enabled");
  localStorage.removeItem("sol_fcm_token");

  if (!token) return true;

  try {
    const authHeaders = await getAuthHeaders();
    await fetch("/api/notifications/push-token", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({ token }),
    });
    return true;
  } catch (err) {
    console.warn("[Push] Failed to revoke push token from server:", err);
    return false;
  }
}

/**
 * Attaches a foreground message handler so notifications received while tab is open can be handled in UI.
 */
export async function setupForegroundPushListener(
  onMessageReceived: (payload: any) => void
): Promise<(() => void) | null> {
  if (!isPushNotificationSupported()) return null;

  try {
    const { getMessaging, onMessage, isSupported } = await import("firebase/messaging");
    const supported = await isSupported();
    if (!supported) return null;

    const { initializeFirebase } = await import("@/firebase/init");
    const { firebaseApp } = initializeFirebase();
    const messaging = getMessaging(firebaseApp);

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log("[Push Foreground] Message received:", payload);
      onMessageReceived(payload);
    });

    return unsubscribe;
  } catch (err) {
    console.warn("[Push] Could not attach foreground listener:", err);
    return null;
  }
}
