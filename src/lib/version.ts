/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SOLTheory.com — Platform Version Registry
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This file serves as the canonical version reference for the SOLTheory
 * platform. It documents each version's exact system state so that any
 * future developer or AI agent can understand what was deployed at any
 * given milestone.
 * 
 * DO NOT DELETE OR MODIFY PAST VERSION ENTRIES.
 * Only append new versions below the latest entry.
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const PLATFORM_VERSION = "2.7.0";

/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  v2.7.0 — "JARVIS Hardened" Release                                   │
 * │  Date: August 9, 2026                                                  │
 * │  Commit: 3c0e570+ (main branch)                                        │
 * └─────────────────────────────────────────────────────────────────────────┘
 * 
 * ── JARVIS AI SYSTEM STATE ──────────────────────────────────────────────
 * 
 * PERSONA:
 *   - Identity: J.A.R.V.I.S. (Just A Rather Very Intelligent System)
 *   - Modeled after the AI from Iron Man
 *   - Always speaks in first person — never third person
 *   - Personality: Chief of staff poise, dry British wit, confident, direct
 *   - Purpose: "Understand what the user is trying to accomplish, then be
 *     as useful, accurate, and honest as you can in helping them accomplish it"
 *   - Knows what model it's running on (injected via soul context)
 * 
 * PERSONA ARCHITECTURE:
 *   - Position 1 (Primacy): Full Iron Man persona with identity, purpose,
 *     absolute rules, formatting rules, org identity, and local time
 *   - Position 2: Soul context (model identity + user email)
 *   - Position 3: PACT user memory (currently empty — purged Aug 9, 2026)
 *   - Position 4: CRM database (if user has CRM data)
 *   - Position 5: CRM tools context (if CRM domain active)
 *   - Position 6: Knowledge Base semantic excerpts (if relevant docs found)
 *   - Position 7: Conversation history (user/assistant turns)
 *   - Position 8 (Recency): Persona bookend reminder with formatting rules
 * 
 * FORMATTING RULES:
 *   - ## headers to organize responses with 2+ topics
 *   - 1-3 sentence paragraphs (never walls of text)
 *   - Bullet lists with **bold lead-ins** — explanation style
 *   - Liberal use of **bold** for names/dates/facts, *italic* for emphasis
 *   - Follow-up questions at end of longer responses
 * 
 * TIMEZONE:
 *   - Browser sends Intl.DateTimeFormat().resolvedOptions().timeZone
 *   - Server formats date in user's local time (e.g., "Saturday, August 9, 2026, 8:53 PM MDT")
 *   - Fallback: America/Denver
 * 
 * TOOLS (26 total — LOCKED):
 *   Gmail (5):
 *     1. search_emails
 *     2. delete_email
 *     3. create_folder
 *     4. block_sender
 *     5. draft_outbound_email
 * 
 *   Calendar (4):
 *     6. list_calendar_events
 *     7. create_calendar_event
 *     8. delete_calendar_event
 *     9. update_calendar_event
 * 
 *   Google Docs (2):
 *     10. create_google_document
 *     11. update_google_document
 * 
 *   Google Sheets (2):
 *     12. create_google_sheet
 *     13. update_google_sheet
 * 
 *   Google Drive (2):
 *     14. search_google_drive
 *     15. read_drive_document
 * 
 *   CRM (9):
 *     16. crm_create_contact
 *     17. crm_update_contact
 *     18. crm_delete_contact
 *     19. crm_search_contacts
 *     20. crm_list_contact_books
 *     21. crm_get_analytics
 *     22. crm_resolve_contact
 *     23. crm_evaluate_contacts
 *     24. crm_batch_update
 * 
 *   Core (2):
 *     25. web_search
 *     26. search_past_conversations
 * 
 * REMOVED TOOLS (do NOT re-add without explicit approval):
 *   - draft_youtube_video (removed v2.7.0)
 *   - create_google_slide_deck (removed v2.7.0)
 *   - create_and_send_survey (removed v2.7.0)
 *   - send_imessage (removed v2.7.0)
 *   - read_imessages (removed v2.7.0)
 *   - search_imessages (removed v2.7.0)
 *   - get_imessage_conversations (removed v2.7.0)
 *   - reply_to_imessage (removed v2.7.0)
 *   - launch_grant_scout (removed v2.7.0)
 *   - get_grant_status (removed v2.7.0)
 *   - cancel_grant_search (removed v2.7.0)
 * 
 * DOMAIN ROUTING:
 *   - EMAIL → 9 tools (Gmail + CRM resolve + web_search + search_past)
 *   - CALENDAR → 7 tools
 *   - CRM → 11 tools
 *   - WORKSPACE → 10 tools (Docs + Sheets + Drive + CRM resolve + core)
 *   - GENERAL → 2 tools (web_search + search_past_conversations)
 *   - MULTI → ALL 26 tools (fallback for multi-domain queries)
 * 
 * TOKEN BUDGET (system prompt):
 *   - Base persona: ~350 tokens
 *   - Soul context (model + user): ~100 tokens
 *   - Tool summary: ~45 tokens
 *   - Persona bookend: ~40 tokens
 *   - PACT memory: 0 (purged, will grow)
 *   - CRM/KB: variable (0-4,000 tokens depending on data)
 *   - Tool schemas: 150-2,200 tokens (domain-dependent)
 *   - TOTAL RANGE: ~650 (simple chat) to ~7,000 (full multi-domain)
 * 
 * REMOVED SYSTEMS (do NOT re-enable without explicit approval):
 *   - Heart/Soul/Heartbeat section
 *   - Organization context (buildOrgContext, solTheoryKnowledge, nxtChapterKnowledge)
 *   - 13 verbose conversation rules (replaced with 4 absolute rules)
 *   - COMMS domain + pattern matching
 *   - GRANTS domain + pattern matching
 *   - Structured reasoning engine (removed for speed)
 * 
 * PACT STATE:
 *   - All entries purged across all users on Aug 9, 2026
 *   - 17 users, 0 entries total
 *   - Fresh start for memory accumulation
 * 
 * ── DASHBOARD STATE ─────────────────────────────────────────────────────
 * 
 * ACTIVE FEATURES:
 *   - AI Agents (JARVIS, YouTube Director, Drive Assistant, Calendar)
 *   - CRM with contact books, pipelines, analytics
 *   - Action Board (Kanban task management with Pomodoro timer)
 *   - Knowledge Base (document upload + semantic retrieval)
 *   - Google Suite integration (Gmail, Calendar, Docs, Sheets, Drive)
 *   - Activity logging and org-wide activity feed
 *   - Survey creation and distribution
 *   - SMS notifications (Twilio)
 *   - Instagram Creative Assistant (FROZEN — see AGENTS.md)
 *   - Dark mode / light mode theming
 *   - i18n (English + Spanish)
 *   - Guided tour / onboarding
 * 
 * TECH STACK:
 *   - Next.js 15.5.9 (App Router)
 *   - Firebase (Firestore + Auth + Storage + Admin SDK)
 *   - Groq (primary LLM provider — Llama 3.3 70B default)
 *   - OpenRouter (premium models — Claude Opus 5, GPT-5.6, Gemini 3.5 Flash)
 *   - Google APIs (Gmail, Calendar, Docs, Sheets, Slides, Drive, YouTube)
 *   - Tavily (web search)
 *   - SendGrid (email notifications)
 *   - Twilio (SMS)
 *   - Vercel (hosting + deployment)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */
