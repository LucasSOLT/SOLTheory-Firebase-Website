'use client';

import { Firestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Activity event types tracked across the platform.
 */
export type ActivityType =
  | 'login'
  | 'grant_agent_created'
  | 'grant_agent_deleted'
  | 'support_ticket_created'
  | 'action_board_created'
  | 'crm_entry_created';

/**
 * Labels and categories for each activity type.
 */
export const ACTIVITY_META: Record<ActivityType, { label: string; category: string }> = {
  login: { label: 'logged in', category: 'auth' },
  grant_agent_created: { label: 'created a grant agent', category: 'grants' },
  grant_agent_deleted: { label: 'deleted a grant agent', category: 'grants' },
  support_ticket_created: { label: 'created a support ticket', category: 'support' },
  action_board_created: { label: 'created an action board task', category: 'tasks' },
  crm_entry_created: { label: 'created a CRM entry', category: 'crm' },
};

export interface ActivityEvent {
  type: ActivityType;
  userEmail: string;
  userName: string;
  orgDomain: string;
  description: string;
  category: string;
  timestamp: ReturnType<typeof serverTimestamp>;
}

/**
 * Log a user activity event to Firestore.
 * Call this from anywhere an action occurs (login, creation, deletion, etc.)
 */
export async function logActivity(
  firestore: Firestore,
  type: ActivityType,
  user: { email: string; displayName?: string | null },
  details?: string,
) {
  try {
    const meta = ACTIVITY_META[type];
    const userName = user.displayName || user.email.split('@')[0];
    const orgDomain = user.email.split('@')[1] || 'unknown';
    const description = details || `${userName} ${meta.label}`;

    await addDoc(collection(firestore, 'activity_log'), {
      type,
      userEmail: user.email,
      userName,
      orgDomain,
      description,
      category: meta.category,
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    // Silently fail — activity logging should never block the user
    console.warn('[Activity] Failed to log event:', err);
  }
}
