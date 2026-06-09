'use client';

import { Firestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Activity event types tracked across the platform.
 * Covers core user actions for security, transparency, and audit trail.
 */
export type ActivityType =
  // Auth
  | 'login'
  | 'logout'
  // Grants
  | 'grant_agent_created'
  | 'grant_agent_deleted'
  | 'grant_agent_started'
  | 'grant_agent_stopped'
  | 'grant_status_changed'
  // Support
  | 'support_ticket_created'
  | 'support_ticket_replied'
  // Tasks / Action Board
  | 'action_board_created'
  | 'action_board_updated'
  | 'action_board_deleted'
  | 'action_board_completed'
  // CRM
  | 'crm_entry_created'
  | 'crm_entry_updated'
  | 'crm_entry_deleted'
  // Timesheets
  | 'timesheet_entry_created'
  | 'timesheet_entry_updated'
  | 'timesheet_entry_deleted'
  | 'timesheet_customer_created'
  | 'timesheet_service_created'
  // AI / Chat
  | 'ai_chat_sent'
  | 'ai_agent_config_changed'
  // Settings
  | 'settings_changed'
  | 'profile_updated'
  // File / Upload
  | 'file_uploaded'
  | 'file_deleted'
  // Navigation
  | 'page_visited'
  // General
  | 'item_created'
  | 'item_updated'
  | 'item_deleted';

/**
 * Labels and categories for each activity type.
 */
export const ACTIVITY_META: Record<ActivityType, { label: string; category: string; icon?: string }> = {
  // Auth
  login: { label: 'logged in', category: 'auth', icon: '→' },
  logout: { label: 'logged out', category: 'auth', icon: '←' },
  // Grants
  grant_agent_created: { label: 'created a grant agent', category: 'grants', icon: '🤖' },
  grant_agent_deleted: { label: 'deleted a grant agent', category: 'grants', icon: '🗑' },
  grant_agent_started: { label: 'started a grant agent', category: 'grants', icon: '▶' },
  grant_agent_stopped: { label: 'stopped a grant agent', category: 'grants', icon: '⏹' },
  grant_status_changed: { label: 'changed grant status', category: 'grants', icon: '📋' },
  // Support
  support_ticket_created: { label: 'created a support ticket', category: 'support', icon: '🎫' },
  support_ticket_replied: { label: 'replied to a support ticket', category: 'support', icon: '💬' },
  // Tasks
  action_board_created: { label: 'created an action board task', category: 'tasks', icon: '✅' },
  action_board_updated: { label: 'updated an action board task', category: 'tasks', icon: '✏️' },
  action_board_deleted: { label: 'deleted an action board task', category: 'tasks', icon: '🗑' },
  action_board_completed: { label: 'completed an action board task', category: 'tasks', icon: '🎉' },
  // CRM
  crm_entry_created: { label: 'created a CRM entry', category: 'crm', icon: '👤' },
  crm_entry_updated: { label: 'updated a CRM entry', category: 'crm', icon: '✏️' },
  crm_entry_deleted: { label: 'deleted a CRM entry', category: 'crm', icon: '🗑' },
  // Timesheets
  timesheet_entry_created: { label: 'logged timesheet entry', category: 'timesheets', icon: '⏱' },
  timesheet_entry_updated: { label: 'updated timesheet entry', category: 'timesheets', icon: '✏️' },
  timesheet_entry_deleted: { label: 'deleted timesheet entry', category: 'timesheets', icon: '🗑' },
  timesheet_customer_created: { label: 'added timesheet customer', category: 'timesheets', icon: '👥' },
  timesheet_service_created: { label: 'added timesheet service', category: 'timesheets', icon: '🔧' },
  // AI
  ai_chat_sent: { label: 'sent an AI chat message', category: 'ai', icon: '💬' },
  ai_agent_config_changed: { label: 'changed AI agent configuration', category: 'ai', icon: '⚙️' },
  // Settings
  settings_changed: { label: 'changed settings', category: 'settings', icon: '⚙️' },
  profile_updated: { label: 'updated profile', category: 'settings', icon: '👤' },
  // Files
  file_uploaded: { label: 'uploaded a file', category: 'files', icon: '📁' },
  file_deleted: { label: 'deleted a file', category: 'files', icon: '🗑' },
  // Navigation
  page_visited: { label: 'visited a page', category: 'navigation', icon: '🔗' },
  // General
  item_created: { label: 'created an item', category: 'general', icon: '➕' },
  item_updated: { label: 'updated an item', category: 'general', icon: '✏️' },
  item_deleted: { label: 'deleted an item', category: 'general', icon: '🗑' },
};

export interface ActivityEvent {
  type: ActivityType;
  userEmail: string;
  userName: string;
  orgDomain: string;
  description: string;
  category: string;
  timestamp: ReturnType<typeof serverTimestamp>;
  metadata?: Record<string, any>;
}

/**
 * Log a user activity event to Firestore.
 * Call this from anywhere an action occurs (login, creation, deletion, etc.)
 *
 * @param firestore - Firestore instance
 * @param type - The activity type
 * @param user - The user performing the action
 * @param details - Human-readable description (optional, auto-generated if omitted)
 * @param metadata - Optional structured metadata for filtering/searching
 */
export async function logActivity(
  firestore: Firestore,
  type: ActivityType,
  user: { email: string; displayName?: string | null },
  details?: string,
  metadata?: Record<string, any>,
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
      ...(metadata ? { metadata } : {}),
    });
  } catch (err) {
    // Silently fail — activity logging should never block the user
    console.warn('[Activity] Failed to log event:', err);
  }
}
