/**
 * jarvis-agents.ts — Domain Agent Configurations
 * 
 * Defines which tools belong to each domain and provides focused
 * system prompt supplements. Used by the chat route to selectively
 * load tools based on the router's classification.
 * 
 * Architecture: The master tools array stays in chat/route.ts.
 * This module maps domain → tool names, and the route filters
 * the master array to include only relevant tools.
 */

import type { JarvisDomain } from "./jarvis-router";

// ── Tool Name → Domain Mapping ──

/**
 * Maps each domain to the tool function names it should have access to.
 * The chat route filters its master tools array using these lists.
 */
export const DOMAIN_TOOLS: Record<JarvisDomain, string[]> = {
  EMAIL: [
    "search_emails",
    "delete_email",
    "create_folder",
    "block_sender",
    "draft_outbound_email",
    // Shared: resolve contact names to emails
    "crm_resolve_contact",
    "crm_search_contacts",
    // Always available
    "web_search",
    "search_past_conversations",
  ],

  CALENDAR: [
    "list_calendar_events",
    "create_calendar_event",
    "delete_calendar_event",
    "update_calendar_event",
    // Shared: resolve contact names for meeting invites
    "crm_resolve_contact",
    // Always available
    "web_search",
    "search_past_conversations",
  ],

  CRM: [
    "crm_create_contact",
    "crm_update_contact",
    "crm_delete_contact",
    "crm_search_contacts",
    "crm_list_contact_books",
    "crm_get_analytics",
    "crm_resolve_contact",
    "crm_evaluate_contacts",
    "crm_batch_update",
    // Always available
    "web_search",
    "search_past_conversations",
  ],


  WORKSPACE: [
    "create_google_document",
    "update_google_document",
    "create_google_slide_deck",
    "create_google_sheet",
    "search_google_drive",
    "read_drive_document",
    "draft_youtube_video",
    "create_and_send_survey",
    // Shared: resolve contact names for survey recipients
    "crm_resolve_contact",
    // Always available
    "web_search",
    "search_past_conversations",
  ],


  GENERAL: [
    "web_search",
    "search_past_conversations",
  ],

  // MULTI loads all tools (same as current behavior)
  MULTI: [], // empty = signal to load ALL tools
};

/**
 * Returns the set of tool function names for a given domain.
 * Returns null for MULTI domain (meaning: load ALL tools).
 */
export function getToolNamesForDomain(domain: JarvisDomain): Set<string> | null {
  if (domain === "MULTI") return null; // null = load everything
  
  const names = DOMAIN_TOOLS[domain];
  if (!names || names.length === 0) return null;
  
  return new Set(names);
}

/**
 * Filters a master tools array to only include tools matching the domain.
 * If domain is MULTI or unknown, returns the full array (safe fallback).
 * 
 * @param masterTools - The full tools array from chat/route.ts
 * @param domain - The classified domain from the router
 * @returns Filtered tools array
 */
export function filterToolsForDomain(masterTools: any[], domain: JarvisDomain): any[] {
  const allowedNames = getToolNamesForDomain(domain);
  
  // null means load everything (MULTI domain or fallback)
  if (!allowedNames) return masterTools;
  
  return masterTools.filter((tool: any) => {
    const name = tool?.function?.name;
    return name && allowedNames.has(name);
  });
}

// ── Domain-Specific System Prompt Supplements ──
// These are SHORT, focused instructions appended to the base system prompt.
// They tell the model what domain it's operating in, reducing confusion.

export const DOMAIN_PROMPTS: Record<JarvisDomain, string> = {
  EMAIL: `[ACTIVE DOMAIN: Email Management]
You are currently focused on email operations. Use your Gmail tools to search, draft, delete, block, and organize emails. If the user references a contact by name, use crm_resolve_contact to look up their email address first.`,

  CALENDAR: `[ACTIVE DOMAIN: Calendar & Scheduling]
You are currently focused on calendar operations. Use your Google Calendar tools to list events, create meetings, reschedule, or cancel events. When creating virtual meetings, set addGoogleMeetLink to true. If no duration is specified, assume 1 hour.`,

  CRM: `[ACTIVE DOMAIN: Contact Management]
You are currently focused on CRM operations. Use your contact management tools to add, edit, search, delete, and analyze contacts. When the user says "add someone", use crm_create_contact. For bulk operations, use crm_batch_update with the confirmation step.`,


  WORKSPACE: `[ACTIVE DOMAIN: Document Creation]
You are currently focused on Google Workspace operations. Use your document creation tools to make Google Docs, Slides, Sheets, YouTube video drafts, and surveys. Create rich, detailed content — full paragraphs for docs, multiple slides for presentations, populated rows for sheets. When populating an existing Google Doc with content, use update_google_document with the document ID from the creation step. IMPORTANT: Always write substantial, detailed content — never use placeholder text like "content goes here".`,


  GENERAL: `[ACTIVE DOMAIN: General Assistant]
You are in general conversation mode. Use web_search for real-time information and search_past_conversations to recall prior discussions. Provide rich, expert-level responses.

CRITICAL: If the user asks about YOUR capabilities, who you are, what you can do, or wants to see something cool — answer from YOUR OWN system knowledge in the [SELF-IDENTITY] section above. Do NOT search the web for "JARVIS" or "AI capabilities". You ARE JARVIS — describe what YOU can do with specific examples and offer to demonstrate live. Be enthusiastic and proactive, not passive.`,

  MULTI: `[ACTIVE DOMAIN: Multi-Step Task]
The user has requested a complex, multi-step task. You have access to all tools. Break the task into logical steps and execute them in order. Explain your plan briefly before starting.`,
};

/**
 * Gets the domain-specific system prompt supplement.
 */
export function getDomainPrompt(domain: JarvisDomain): string {
  return DOMAIN_PROMPTS[domain] || DOMAIN_PROMPTS.GENERAL;
}
