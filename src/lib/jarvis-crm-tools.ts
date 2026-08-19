/**
 * @file jarvis-crm-tools.ts
 * @description Shared CRM tool definitions and execution functions for Jarvis AI agent.
 *
 * This module provides:
 * 1. OpenAI-compatible tool definitions for CRM operations
 * 2. Natural-language → field ID mapping for 77 preset CRM fields
 * 3. Firebase Admin SDK execution functions for CRUD operations
 * 4. Contact book name resolution (fuzzy matching)
 *
 * Used by both `/api/chat` (text) and `/api/voice-chat-tts` (voice) routes.
 */

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/* ─────────────── TYPES ─────────────── */

export interface CrmInstance {
  id: string;
  name: string;
}

/* ─────────────── FIELD MAPPING ─────────────── */

/**
 * Maps common natural-language terms (lowercased) to their CRM field IDs.
 * The LLM uses this to correctly route user-provided data to Firestore fields.
 * Only covers the 77 preset system fields — custom fields are excluded by design.
 */
export const FIELD_ALIAS_MAP: Record<string, string> = {
  // ── Contact ──
  "first name": "firstName",
  "firstname": "firstName",
  "first": "firstName",
  "last name": "lastName",
  "lastname": "lastName",
  "last": "lastName",
  "name": "firstName", // will be split into firstName + lastName
  "full name": "firstName",
  "email": "email",
  "email address": "email",
  "primary email": "email",
  "email 1": "email",
  "secondary email": "secondaryEmail",
  "email 2": "secondaryEmail",
  "alternate email": "secondaryEmail",
  "tertiary email": "tertiaryEmail",
  "email 3": "tertiaryEmail",
  "phone": "phone",
  "phone number": "phone",
  "primary phone": "phone",
  "phone 1": "phone",
  "cell": "mobilePhone",
  "cell phone": "mobilePhone",
  "mobile": "mobilePhone",
  "mobile phone": "mobilePhone",
  "phone 2": "mobilePhone",
  "work phone": "workPhone",
  "office phone": "workPhone",
  "business phone": "workPhone",
  "phone 3": "workPhone",
  "prefix": "prefix",
  "title prefix": "prefix",
  "mr": "prefix",
  "mrs": "prefix",
  "ms": "prefix",
  "dr": "prefix",
  "suffix": "suffix",
  "middle name": "middleName",
  "nickname": "nickname",
  "alias": "nickname",
  "gender": "gender",
  "pronouns": "pronouns",
  "language": "language",
  "timezone": "timezone",
  "time zone": "timezone",
  "contact owner": "contactOwner",
  "owner": "contactOwner",

  // ── Company & Work ──
  "company": "company",
  "organization": "company",
  "employer": "company",
  "works at": "company",
  "business": "company",
  "job title": "jobTitle",
  "title": "jobTitle",
  "position": "jobTitle",
  "department": "department",
  "dept": "department",
  "industry": "industry",
  "sector": "industry",
  "company size": "companySize",
  "annual revenue": "annualRevenue",
  "company website": "companyWebsite",
  "company url": "companyWebsite",
  "work address": "workAddress",
  "office address": "workAddress",
  "manager": "managerName",
  "reports to": "managerName",
  "employee id": "employeeId",
  "role": "role",
  "service": "service",
  "years at company": "yearsAtCompany",
  "tenure": "yearsAtCompany",

  // ── General Info ──
  "address": "location",
  "location": "location",
  "street address": "streetAddress",
  "street": "streetAddress",
  "city": "city",
  "state": "state",
  "province": "state",
  "zip": "zipCode",
  "zip code": "zipCode",
  "postal code": "zipCode",
  "country": "country",
  "birthday": "birthday",
  "date of birth": "birthday",
  "dob": "birthday",
  "anniversary": "anniversary",
  "last contacted": "lastContactedDate",
  "last contacted date": "lastContactedDate",
  "tags": "tags",
  "tag": "tags",
  "notes": "notes",
  "note": "notes",
  "description": "description",
  "priority": "priority",
  "rating": "rating",
  "do not contact": "doNotContact",
  "dnc": "doNotContact",

  // ── Financial ──
  "revenue": "totalRevenue",
  "total revenue": "totalRevenue",
  "outstanding balance": "outstandingBalance",
  "balance": "outstandingBalance",
  "lifetime value": "lifetimeValue",
  "ltv": "lifetimeValue",
  "avg deal size": "avgDealSize",
  "average deal size": "avgDealSize",
  "last purchase date": "lastPurchaseDate",
  "last purchase": "lastPurchaseDate",
  "total purchases": "totalPurchases",
  "payment method": "paymentMethod",
  "currency": "currency",
  "credit limit": "creditLimit",
  "discount": "discount",
  "tax id": "taxId",
  "invoice number": "invoiceNumber",
  "subscription plan": "subscriptionPlan",
  "subscription status": "subscriptionStatus",
  "renewal date": "renewalDate",

  // ── Pipeline & Sales ──
  "lead status": "leadStatus",
  "pipeline stage": "leadStatus",
  "stage": "leadStatus",
  "status": "leadStatus",
  "ai notes": "aiNotes",
  "lead source": "leadSource",
  "source": "leadSource",
  "deal value": "dealValue",
  "deal amount": "dealValue",
  "close date": "dealCloseDate",
  "expected close date": "dealCloseDate",
  "win probability": "dealProbability",
  "probability": "dealProbability",
  "assigned to": "assignedTo",
  "next follow up": "nextFollowUp",
  "follow up": "nextFollowUp",
  "referred by": "referredBy",
  "referral": "referredBy",
  "lost reason": "lostReason",
  "competitor": "competitorName",
  "campaign source": "campaignSource",
  "campaign": "campaignSource",
  "conversion date": "conversionDate",
  "sales cycle": "salesCycle",
  "product interest": "productInterest",
  "engagement score": "engagementScore",

  // ── Social & Web ──
  "website": "website",
  "url": "website",
  "linkedin": "linkedinUrl",
  "linkedin url": "linkedinUrl",
  "twitter": "twitterHandle",
  "x": "twitterHandle",
  "facebook": "facebookUrl",
  "facebook url": "facebookUrl",
  "instagram": "instagramHandle",
  "youtube": "youtubeUrl",
  "youtube url": "youtubeUrl",
  "tiktok": "tiktokHandle",
  "github": "githubUrl",
  "github url": "githubUrl",
  "skype": "skypeId",
  "whatsapp": "whatsappNumber",
  "whatsapp number": "whatsappNumber",
  "telegram": "telegramHandle",
  "blog": "blogUrl",

  // ── Communication ──
  "preferred contact method": "preferredContact",
  "preferred contact": "preferredContact",
  "email opt in": "emailOptIn",
  "sms opt in": "smsOptIn",
  "newsletter": "newsletterSubscribed",
  "last email": "lastEmailDate",
  "last email date": "lastEmailDate",
  "last call": "lastCallDate",
  "last call date": "lastCallDate",
  "last meeting": "lastMeetingDate",
  "last meeting date": "lastMeetingDate",
  "total emails": "totalEmails",
  "total calls": "totalCalls",
  "total meetings": "totalMeetings",
  "communication notes": "communicationNotes",
};

/** All valid preset field IDs (for validation) */
export const VALID_FIELD_IDS = new Set([
  "firstName", "lastName", "email", "secondaryEmail", "tertiaryEmail",
  "phone", "mobilePhone", "workPhone", "prefix", "suffix", "middleName",
  "nickname", "gender", "pronouns", "language", "timezone", "contactOwner",
  "company", "jobTitle", "department", "industry", "companySize", "annualRevenue",
  "companyWebsite", "workAddress", "managerName", "employeeId", "role", "service",
  "yearsAtCompany",
  "location", "streetAddress", "city", "state", "zipCode", "country",
  "birthday", "anniversary", "lastContactedDate", "tags", "notes", "description",
  "priority", "rating", "doNotContact",
  "totalRevenue", "outstandingBalance", "lifetimeValue", "avgDealSize",
  "lastPurchaseDate", "totalPurchases", "paymentMethod", "currency", "creditLimit",
  "discount", "taxId", "invoiceNumber", "subscriptionPlan", "subscriptionStatus",
  "renewalDate",
  "leadStatus", "aiNotes", "leadSource", "dealValue", "dealCloseDate",
  "dealProbability", "assignedTo", "nextFollowUp", "referredBy", "lostReason",
  "competitorName", "campaignSource", "conversionDate", "salesCycle",
  "productInterest", "engagementScore",
  "website", "linkedinUrl", "twitterHandle", "facebookUrl", "instagramHandle",
  "youtubeUrl", "tiktokHandle", "githubUrl", "skypeId", "whatsappNumber",
  "telegramHandle", "blogUrl",
  "preferredContact", "emailOptIn", "smsOptIn", "newsletterSubscribed",
  "lastEmailDate", "lastCallDate", "lastMeetingDate", "totalEmails",
  "totalCalls", "totalMeetings", "communicationNotes",
]);

/* ─────────────── TOOL DEFINITIONS ─────────────── */

/**
 * OpenAI-compatible tool definitions for CRM operations.
 * These are appended to the `tools` array in the chat/voice routes.
 */
export const CRM_TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "crm_create_contact",
      description: "Create a new contact in the user's CRM contacts database. Use this when the user asks to add, create, or save a new contact AND has provided at least a name. CRITICAL: If the user says something vague like 'add a contact' without providing ANY contact details (no name, no email, no phone), you MUST NOT call this tool. Instead, respond by asking: 'Sure! What is the contact\'s name? And do you have their email, phone number, or company info?' NEVER invent, fabricate, or hallucinate contact details. Only pass information the user explicitly provided. After creating, always tell the user the contact name AND which contact book it was placed in.",
      parameters: {
        type: "object",
        properties: {
          firstName: { type: "string", description: "Contact's first name (required)" },
          lastName: { type: "string", description: "Contact's last name" },
          email: { type: "string", description: "Primary email address" },
          secondaryEmail: { type: "string", description: "Secondary email address" },
          phone: { type: "string", description: "Primary phone number" },
          mobilePhone: { type: "string", description: "Mobile/cell phone number" },
          workPhone: { type: "string", description: "Work/office phone number" },
          company: { type: "string", description: "Company or organization name" },
          jobTitle: { type: "string", description: "Job title or position" },
          department: { type: "string", description: "Department" },
          industry: { type: "string", description: "Industry or sector" },
          location: { type: "string", description: "Address or location" },
          city: { type: "string", description: "City" },
          state: { type: "string", description: "State or province" },
          zipCode: { type: "string", description: "ZIP or postal code" },
          country: { type: "string", description: "Country" },
          birthday: { type: "string", description: "Birthday (YYYY-MM-DD format)" },
          tags: { type: "array", items: { type: "string" }, description: "Tags to apply to the contact" },
          notes: { type: "string", description: "Notes about the contact" },
          leadStatus: { type: "string", enum: ["Cold Lead", "Warm Lead", "Interested", "Sale Completed"], description: "Pipeline stage / lead status" },
          leadSource: { type: "string", enum: ["Website", "Referral", "Social Media", "Cold Call", "Event", "Ad Campaign", "Email", "Partner", "Other"], description: "How the lead was acquired" },
          website: { type: "string", description: "Personal website URL" },
          linkedinUrl: { type: "string", description: "LinkedIn profile URL" },
          twitterHandle: { type: "string", description: "Twitter/X handle" },
          instagramHandle: { type: "string", description: "Instagram handle" },
          preferredContact: { type: "string", enum: ["Email", "Phone", "Text", "WhatsApp", "LinkedIn", "In Person"], description: "Preferred contact method" },
          contactBookName: { type: "string", description: "Name of the contact book to create in. If not specified, uses the currently active contact book. Use this when the user explicitly says to put it in a specific contact book (e.g. 'put that in my Personal Contacts book')." },
        },
        required: ["firstName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_update_contact",
      description: "Update one or more fields on an existing contact. Search by name or email to find the contact, then provide the fields to update. If multiple contacts match, return them all and ask the user to clarify. CRITICAL: If the user says something vague like 'edit contact book' or 'update my contacts' without specifying which contact to update or what fields to change, you MUST NOT call this tool. Instead, ask: 'Which contact would you like to update, and what information should I change?' NEVER guess which contact the user means.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name or email to find the contact to update" },
          updates: {
            type: "object",
            description: "Key-value pairs of field IDs and their new values. Use exact field IDs like 'firstName', 'email', 'company', 'phone', 'jobTitle', 'leadStatus', etc.",
            additionalProperties: true,
          },
          contactBookName: { type: "string", description: "Optional: which contact book to search in. Defaults to the active contact book." },
        },
        required: ["searchQuery", "updates"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_delete_contact",
      description: "Delete a contact from the CRM. You MUST first call this with confirmed=false to search for the contact and get confirmation from the user. Only call with confirmed=true after the user explicitly confirms they want to delete.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name or email of the contact to delete" },
          confirmed: { type: "boolean", description: "Set to false for initial search/confirmation, true only after user confirms deletion" },
          contactId: { type: "string", description: "The exact contact document ID — only provide this after the initial search returned it" },
          contactBookName: { type: "string", description: "Optional: which contact book to search in" },
        },
        required: ["searchQuery", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_search_contacts",
      description: "Search for contacts in the CRM by name, email, phone, company, tags, lead status, or any other field. Use this to look up contact information, answer questions like 'what is John's email?', find contacts by company, filter by status, etc. Set searchAllBooks=true to search across ALL contact books at once.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Free-text search query — will match against name, email, phone, company, and other fields" },
          contactBookName: { type: "string", description: "Optional: which specific contact book to search in" },
          searchAllBooks: { type: "boolean", description: "If true, searches ALL contact books instead of just the active one. Use when the user says 'across all books', 'in all my contacts', doesn't specify a book, or when you need to find someone and aren't sure which book they're in." },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_list_contact_books",
      description: "List all available contact book versions/databases. Use this when the user asks 'what contact books do I have?', 'show me my contact books', or when you need to find which contact book to write to.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  // ── CRM Analytics ──
  {
    type: "function",
    function: {
      name: "crm_get_analytics",
      description: "Get analytics and aggregate statistics about the user's CRM contacts. Use when the user asks 'how many contacts do I have?', 'what's my total revenue?', 'how many warm leads?', 'give me a CRM summary', 'which companies have the most contacts?', 'show me a breakdown', etc. Can analyze a single contact book or all books combined.",
      parameters: {
        type: "object",
        properties: {
          contactBookName: { type: "string", description: "Optional: specific contact book to analyze. If omitted, analyzes ALL books combined." },
          metrics: {
            type: "array",
            items: { type: "string", enum: ["summary", "lead_breakdown", "revenue", "top_companies", "top_tags", "recent_contacts"] },
            description: "Which metrics to compute. Options: 'summary' (total counts per book), 'lead_breakdown' (count per lead status), 'revenue' (sum of totalRevenue, outstandingBalance, lifetimeValue, dealValue), 'top_companies' (top 10 companies by contact count), 'top_tags' (top 15 tags), 'recent_contacts' (10 most recently contacted/created). Use multiple for a comprehensive report.",
          },
        },
        required: ["metrics"],
      },
    },
  },
  // ── CRM Contact Resolution (for action-chaining with email/text tools) ──
  {
    type: "function",
    function: {
      name: "crm_resolve_contact",
      description: "Quickly look up a contact's email address and/or phone number from the CRM, searching ALL contact books. Use this BEFORE drafting an email (draft_outbound_email) or sending a text (send_imessage) when the user refers to someone by name and you don't have their email/phone from the Contact Glossary. Returns the best match with email, phone, company, and which book they're in. If multiple matches are found, returns all so you can ask which one.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "The contact name to look up (e.g. 'John Smith', 'Jane', 'Dr. Roberts')" },
          preferredField: { type: "string", enum: ["email", "phone"], description: "Which field you primarily need — 'email' for drafting emails, 'phone' for texting" },
        },
        required: ["name"],
      },
    },
  },
  // ── CRM Contact Evaluation & Lead Scoring ──
  {
    type: "function",
    function: {
      name: "crm_evaluate_contacts",
      description: "Evaluate CRM contact health and generate prioritized action lists. Use when the user asks for contact quality reports, stale lead alerts, missing field audits, high-value deal lists, or priority follow-ups. Also use proactively after CRM interactions to surface insights. Evaluates across all books by default.",
      parameters: {
        type: "object",
        properties: {
          contactBookName: { type: "string", description: "Optional: specific contact book to evaluate. Omit to evaluate ALL books." },
          evaluationType: {
            type: "string",
            enum: ["health_score", "stale_leads", "missing_fields", "high_value", "full_audit"],
            description: "Type of evaluation: 'health_score' (score contacts 0-100 on completeness/recency/value), 'stale_leads' (warm/interested leads not contacted in 14+ days), 'missing_fields' (contacts missing critical info like email/phone), 'high_value' (top open deals sorted by value), 'full_audit' (all of the above combined)",
          },
        },
        required: ["evaluationType"],
      },
    },
  },
  // ── CRM Batch Update ──
  {
    type: "function",
    function: {
      name: "crm_batch_update",
      description: "Apply bulk changes to multiple contacts matching filter criteria. ALWAYS call with confirmed=false FIRST to preview how many contacts will be affected, then call again with confirmed=true after the user approves. Use for bulk tagging, status changes, and field updates across many contacts.",
      parameters: {
        type: "object",
        properties: {
          filter: {
            type: "object",
            description: "Criteria to match contacts. All specified filters are AND-combined.",
            properties: {
              company: { type: "string", description: "Match contacts at this company (case-insensitive substring)" },
              leadStatus: { type: "string", description: "Match contacts with this lead status" },
              tags: { type: "array", items: { type: "string" }, description: "Match contacts that have ANY of these tags" },
              missingField: { type: "string", description: "Match contacts where this field is empty/missing (e.g. 'email', 'phone', 'company')" },
              olderThan: { type: "number", description: "Match contacts not contacted in more than N days (based on lastContactedDate)" },
              contactBookName: { type: "string", description: "Specific contact book to target. Omit for active book." },
            },
          },
          action: {
            type: "object",
            description: "The change to apply to all matching contacts.",
            properties: {
              type: { type: "string", enum: ["set_field", "add_tags", "remove_tags", "set_status"], description: "Type of update" },
              field: { type: "string", description: "For set_field: which field to update" },
              value: { type: "string", description: "For set_field: the value to set" },
              tags: { type: "array", items: { type: "string" }, description: "For add_tags/remove_tags: tag strings" },
              status: { type: "string", description: "For set_status: new lead status value" },
            },
          },
          confirmed: { type: "boolean", description: "false = preview only (show match count), true = execute the batch update. ALWAYS preview first." },
        },
        required: ["filter", "action", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_merge_contacts",
      description: "Merge two duplicate contacts into one. Searches for both contacts, previews the merge, and on confirmation combines data from the secondary into the primary contact and deletes the secondary. ALWAYS call with confirmed=false FIRST to preview, then with confirmed=true after user approves.",
      parameters: {
        type: "object",
        properties: {
          primaryQuery: { type: "string", description: "Name or email of the contact to KEEP as the primary record" },
          secondaryQuery: { type: "string", description: "Name or email of the duplicate contact to merge INTO the primary" },
          fieldsToKeepFromPrimary: { type: "array", items: { type: "string" }, description: "Specific field names to always keep from the primary, even if secondary has data (e.g. ['email', 'phone'])" },
          confirmed: { type: "boolean", description: "false = preview merge, true = execute merge" },
          contactBookName: { type: "string", description: "Which contact book to search in" },
        },
        required: ["primaryQuery", "secondaryQuery", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_add_activity",
      description: "Log an activity entry (note, call, meeting, email, task, status change) to a contact's activity timeline. Use when the user says 'log a note', 'add a note', 'record that I called', etc.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name or email of the contact to add the activity to" },
          type: { type: "string", enum: ["note", "call", "meeting", "email", "task", "status_change", "insight"], description: "Type of activity" },
          content: { type: "string", description: "The activity content/description" },
          contactBookName: { type: "string" },
        },
        required: ["searchQuery", "type", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_create_contact_book",
      description: "Create a new contact book (database). Use when user says 'create a new contact book' or 'make a new database called X'.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Name for the new contact book" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_rename_contact_book",
      description: "Rename an existing contact book. Use when user says 'rename my contact book' or 'change the name of X to Y'.",
      parameters: {
        type: "object",
        properties: {
          currentName: { type: "string", description: "Current name of the contact book to rename" },
          newName: { type: "string", description: "New name for the contact book" },
        },
        required: ["currentName", "newName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_delete_contact_book",
      description: "Delete a contact book. Cannot delete the default book. ALWAYS ask for confirmation before executing.",
      parameters: {
        type: "object",
        properties: {
          bookName: { type: "string", description: "Name of the contact book to delete" },
          confirmed: { type: "boolean", description: "false = show warning, true = delete" },
        },
        required: ["bookName", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_move_contact",
      description: "Move a contact from one contact book to another. Copies all data to the target book and deletes from the source. ALWAYS preview first (confirmed=false).",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name or email of the contact to move" },
          targetBookName: { type: "string", description: "Name of the destination contact book" },
          confirmed: { type: "boolean" },
          contactBookName: { type: "string", description: "Source book (defaults to active)" },
        },
        required: ["searchQuery", "targetBookName", "confirmed"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_schedule_followup",
      description: "Schedule a follow-up task for a contact. Creates a task with type, due date, priority, and notes. Also logs the task creation to the contact's activity timeline.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name or email of the contact" },
          taskType: { type: "string", enum: ["Call", "Email", "Meeting", "Send Proposal", "Check-in", "Message", "Onboard"], description: "Type of follow-up" },
          title: { type: "string", description: "Task title/description" },
          dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
          priority: { type: "string", enum: ["Low", "Normal", "High", "Urgent"], description: "Priority level" },
          notes: { type: "string" },
          contactBookName: { type: "string" },
        },
        required: ["searchQuery", "taskType", "title", "dueDate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crm_complete_task",
      description: "Mark a follow-up task as complete or delete it. Searches for the task by contact name and title. Logs completion to the contact's activity timeline.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string", description: "Name of the contact the task is for" },
          taskTitle: { type: "string", description: "Title of the task to complete (if multiple tasks exist for this contact)" },
          action: { type: "string", enum: ["complete", "delete"], description: "Whether to mark as complete or delete" },
          contactBookName: { type: "string" },
        },
        required: ["searchQuery", "action"],
      },
    },
  },
];

/* ─────────────── SYSTEM PROMPT SNIPPET ─────────────── */

/**
 * Builds the CRM context string to inject into Jarvis's system prompt.
 * Tells Jarvis about the active contact book, available books, and field mapping rules.
 */
export function buildCrmSystemPrompt(
  activeInstanceId: string,
  instances: CrmInstance[]
): string {
  const activeName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";
  const bookList = instances.map(i => `  - "${i.name}" (ID: ${i.id})${i.id === activeInstanceId ? " ← ACTIVE" : ""}`).join("\n");

  return `\n\n[CRM MANAGEMENT TOOLS]
You have FULL CRM management capabilities. You can create, update, delete, search, and analyze contacts in the user's CRM database across ALL contact books.

ACTIVE CONTACT BOOK: "${activeName}" (ID: ${activeInstanceId})
AVAILABLE CONTACT BOOKS:
${bookList}

WRITE RULES:
0. NEVER FABRICATE CONTACT DATA: If the user asks to "add a contact" or "create a contact" without providing specific details (name, email, phone, etc.), you MUST ask the user for the contact's information BEFORE calling crm_create_contact. NEVER hallucinate, guess, or invent names, emails, phone numbers, or any other contact fields. Only use data the user explicitly provides in their message.
1. Always write to the ACTIVE contact book ("${activeName}") unless the user explicitly specifies a different one.
2. When the user names a different book (e.g. "put it in General" or "add to Personal Contacts"), set the contactBookName parameter to match.
3. After EVERY CRM action, confirm what you did AND specify which contact book it was placed in. Example: "Done! I've added John Smith to your '${activeName}' contact book."
4. For updates, search for the contact first. If multiple matches exist, list them and ask the user to clarify.
5. For deletions, ALWAYS ask the user to confirm before executing. Call crm_delete_contact with confirmed=false first.
6. Do NOT attempt to write to custom fields — only use the preset system fields.
7. When the user provides a full name (e.g. "John Smith"), split it into firstName ("John") and lastName ("Smith") automatically.
8. Map information to the correct fields:
   - Phone/cell/mobile → phone (primary), mobilePhone (secondary), workPhone (work)
   - Email → email (primary), secondaryEmail, tertiaryEmail
   - Company/organization/employer/works at → company
   - Title/position/job title → jobTitle
   - Address/location → location
   - City, state, zip, country → city, state, zipCode, country
   - Status/stage → leadStatus (options: Cold Lead, Warm Lead, Interested, Sale Completed)
   - Tags → tags (as an array of strings)

⚠️ MANDATORY CONTACT RESOLUTION FOR ACTIONS (email, text, call) — NEVER SKIP THIS:
When the user asks you to email, text, or call someone BY NAME:
1. You MUST ALWAYS call crm_resolve_contact FIRST to look up their REAL email/phone from the CRM. There are NO exceptions.
2. NEVER guess, fabricate, or construct an email address from a person's name (e.g. do NOT create "firstname.lastname@domain.com" patterns). The ONLY email addresses you may use are:
   a) Ones returned by crm_resolve_contact
   b) Ones the user explicitly typed out in their message
3. If crm_resolve_contact returns exactly ONE match → use THAT contact's exact email/phone. Mention which book they came from.
4. If crm_resolve_contact returns MULTIPLE matches → you MUST NUMBER each match (1, 2, 3...) and list them showing name, email, company, and which book they're in. Then ask: "Which one did you mean? (just reply with the number)" — this lets the user reply with just "1" or "2" instead of copy-pasting. Example format:\n   1. **Steve Huff** — steve@soltheory.com — All Contacts\n   2. **Steve Huff** — steve@thrivecoaching.ai — Self Improvement — All Contacts\n   Do NOT pick one yourself.
5. If crm_resolve_contact returns NO match → tell the user: "I couldn't find [name] in any of your contact books. Could you provide their email directly?"
6. EVEN IF the Contact Glossary above contains info about the person, you MUST still call crm_resolve_contact to get the VERIFIED email from the CRM database. The glossary may be stale or incomplete.
7. Example flow: User says "email Steve Huff" → call crm_resolve_contact(name: "Steve Huff") → get back email: steve@soltheory.com → use EXACTLY that email for draft_outbound_email.

CRM ANALYTICS:
You can analyze CRM data when users ask questions like:
- "How many contacts do I have?" → use crm_get_analytics with metrics: ['summary']
- "How many warm leads?" → use crm_get_analytics with metrics: ['lead_breakdown']
- "What's my total revenue?" → use crm_get_analytics with metrics: ['revenue']
- "Which companies appear most?" → use crm_get_analytics with metrics: ['top_companies']
- "Give me a full CRM report" → use crm_get_analytics with metrics: ['summary', 'lead_breakdown', 'revenue', 'top_companies', 'top_tags']
You can analyze a SINGLE book (pass contactBookName) or ALL books combined (omit it).
When presenting analytics, format numbers nicely ($185,000 not 185000), break down by contact book, and use percentages where helpful.

CRM HEALTH & BATCH TOOLS:
- Use crm_evaluate_contacts to audit contact quality, find stale leads, surface priority follow-ups, or identify contacts missing critical info.
- Use crm_batch_update to make bulk changes (tag groups, change statuses, update fields for many contacts at once).
- For batch updates, ALWAYS preview first (confirmed=false) to show the user how many contacts will be affected, then ask for confirmation before executing (confirmed=true).

PROACTIVE CRM INSIGHTS:
After completing any CRM-related task (analytics, search, create, update), you MAY organically suggest ONE relevant insight if it would be genuinely helpful. Examples:
- After analytics: "By the way, I noticed 8 warm leads haven't been contacted in over 2 weeks — want me to pull up a priority list?"
- After creating a contact: "I see 15 other contacts at [same company] — want me to tag them all as a group?"
- After searching: "3 of the contacts I found are missing email addresses — want me to flag all contacts with missing emails?"
Do NOT suggest insights on every single message — only when it's natural and genuinely useful. Never more than once per conversation turn. If the user ignores or declines a suggestion, don't repeat it.

MERGE CONTACTS:
- Use crm_merge_contacts when user wants to combine duplicates or merge records
- ALWAYS preview first (confirmed=false), then confirm before executing
- Default: keep primary's fields, fill gaps with secondary's data. Merge tags. Sum revenues.
- If user specifies which fields to keep (e.g. "keep the soltheory email"), pass those in fieldsToKeepFromPrimary

CONTACT BOOK MANAGEMENT:
- crm_create_contact_book: Create new contact databases
- crm_rename_contact_book: Rename existing books
- crm_delete_contact_book: Delete books (cannot delete default, always confirm first)
- crm_move_contact: Move a contact between books (preview first)

ACTIVITY LOGGING:
- Use crm_add_activity to log notes, calls, meetings, emails, or tasks to a contact's timeline
- Types: note, call, meeting, email, task, status_change, insight

FOLLOW-UP TASKS:
- crm_schedule_followup: Create follow-up tasks with type, due date, priority
- crm_complete_task: Mark tasks as complete or delete them
- Task types: Call, Email, Meeting, Send Proposal, Check-in, Message, Onboard
- Priorities: Low, Normal, High, Urgent`;
}

/**
 * Condensed CRM context for voice (shorter token budget).
 */
export function buildCrmVoicePrompt(
  activeInstanceId: string,
  instances: CrmInstance[]
): string {
  const activeName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";
  const bookNames = instances.map(i => i.name).join(", ");

  return `\n\n[CRM TOOLS]
You can create, update, delete, search, and analyze contacts across all books. Active book: "${activeName}". Available books: ${bookNames}.
After every CRM action, confirm what you did and which contact book. Split full names into firstName + lastName. Map phone/email/company to correct fields.
MANDATORY: When asked to email/text someone by name, you MUST ALWAYS call crm_resolve_contact first. NEVER guess or fabricate email addresses. Only use the exact email returned by crm_resolve_contact or explicitly provided by the user. If multiple matches found, NUMBER them (1, 2, 3...) and ask which one — do NOT pick yourself.
For analytics questions (how many contacts, revenue totals, lead breakdown), use crm_get_analytics.
Use crm_evaluate_contacts for CRM health audits, stale lead alerts, and priority lists. Use crm_batch_update for bulk tagging/status changes (always preview first).
After CRM tasks, you may suggest one relevant insight if genuinely helpful (e.g. stale leads, missing fields). Don't over-suggest.
Merge duplicates with crm_merge_contacts (preview first). Manage contact books with create/rename/delete tools. Log notes with crm_add_activity. Schedule follow-ups with crm_schedule_followup.`;
}

/* ─────────────── HELPER FUNCTIONS ─────────────── */

/**
 * Resolves a contact book name to its instance ID using fuzzy matching.
 * Returns the matching instanceId or null if not found.
 */
export function resolveContactBookByName(
  nameQuery: string,
  instances: CrmInstance[]
): string | null {
  if (!nameQuery || instances.length === 0) return null;

  const q = nameQuery.toLowerCase().trim();

  // Exact match first
  const exact = instances.find(i => i.name.toLowerCase() === q);
  if (exact) return exact.id;

  // Exact match on ID
  const byId = instances.find(i => i.id.toLowerCase() === q);
  if (byId) return byId.id;

  // Substring match (e.g. "general" matches "General Contacts")
  const sub = instances.find(i => i.name.toLowerCase().includes(q) || q.includes(i.name.toLowerCase()));
  if (sub) return sub.id;

  // Word-level fuzzy match (e.g. "personal" matches "Personal Contacts")
  const words = q.split(/\s+/);
  const fuzzy = instances.find(i => {
    const iWords = i.name.toLowerCase().split(/\s+/);
    return words.some(w => iWords.some(iw => iw.startsWith(w) || w.startsWith(iw)));
  });
  if (fuzzy) return fuzzy.id;

  return null;
}

/**
 * Searches contacts in Firestore by matching query against name, email, phone, and company fields.
 */
async function searchContactsInFirestore(
  orgId: string,
  instanceId: string,
  query: string
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  await initAdmin();
  const db = getAdminFirestore();
  const contactsRef = db.collection(`orgs/${orgId}/crm-instances/${instanceId}/contacts`);
  const snap = await contactsRef.get();

  if (snap.empty) return [];

  const q = query.toLowerCase().trim();
  const results: Array<{ id: string; data: Record<string, any> }> = [];

  snap.docs.forEach(doc => {
    const d = doc.data();
    const searchableFields = [
      d.firstName, d.lastName, `${d.firstName || ""} ${d.lastName || ""}`.trim(),
      d.email, d.secondaryEmail, d.tertiaryEmail,
      d.phone, d.mobilePhone, d.workPhone,
      d.company, d.jobTitle, d.department, d.industry,
      d.location, d.city, d.state, d.nickname,
      ...(Array.isArray(d.tags) ? d.tags : []),
    ].filter(Boolean).map(v => String(v).toLowerCase());

    if (searchableFields.some(field => field.includes(q))) {
      results.push({ id: doc.id, data: d });
    }
  });

  return results;
}

/**
 * Searches contacts across ALL contact book instances.
 * Results are tagged with which book they came from.
 * ALWAYS reads fresh instance list from Firestore registry to catch newly created books.
 */
async function searchContactsAllBooks(
  orgId: string,
  instances: CrmInstance[],
  query: string
): Promise<Array<{ id: string; data: Record<string, any>; bookId: string; bookName: string }>> {
  const allResults: Array<{ id: string; data: Record<string, any>; bookId: string; bookName: string }> = [];

  // ALWAYS fetch fresh instance list from Firestore registry to catch newly created books
  let bookList: CrmInstance[] = [];
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const registrySnap = await db.collection(`orgs/${orgId}/crm-instances-meta`).doc("registry").get();
    const regData = registrySnap.exists ? registrySnap.data() : null;
    bookList = regData?.instances || [];
  } catch {
    // Fallback to client-passed instances if registry read fails
    bookList = [];
  }

  // Merge: use registry as source of truth, but fall back to client-passed if registry is empty
  if (bookList.length === 0) {
    bookList = instances.length > 0 ? instances : [{ id: "default", name: "All Contacts" }];
  }

  // Search each book in parallel
  const searchPromises = bookList.map(async (inst) => {
    const results = await searchContactsInFirestore(orgId, inst.id, query);
    return results.map(r => ({ ...r, bookId: inst.id, bookName: inst.name }));
  });

  const batchResults = await Promise.all(searchPromises);
  batchResults.forEach(batch => allResults.push(...batch));

  return allResults;
}

/**
 * Loads ALL contacts from a single instance (for analytics).
 */
async function loadAllContactsFromInstance(
  orgId: string,
  instanceId: string
): Promise<Array<Record<string, any>>> {
  await initAdmin();
  const db = getAdminFirestore();
  const snap = await db.collection(`orgs/${orgId}/crm-instances/${instanceId}/contacts`).get();
  return snap.docs.map(doc => ({ ...doc.data(), _docId: doc.id }));
}

/**
 * Formats a contact document into a readable summary string.
 */
function formatContactSummary(data: Record<string, any>, contactId: string): string {
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || "Unnamed";
  const parts = [`Name: ${name}`, `ID: ${contactId}`];
  if (data.email) parts.push(`Email: ${data.email}`);
  if (data.secondaryEmail) parts.push(`Email 2: ${data.secondaryEmail}`);
  if (data.phone) parts.push(`Phone: ${data.phone}`);
  if (data.mobilePhone) parts.push(`Mobile: ${data.mobilePhone}`);
  if (data.workPhone) parts.push(`Work Phone: ${data.workPhone}`);
  if (data.company) parts.push(`Company: ${data.company}`);
  if (data.jobTitle) parts.push(`Title: ${data.jobTitle}`);
  if (data.department) parts.push(`Dept: ${data.department}`);
  if (data.industry) parts.push(`Industry: ${data.industry}`);
  if (data.location) parts.push(`Location: ${data.location}`);
  if (data.city) parts.push(`City: ${data.city}`);
  if (data.state) parts.push(`State: ${data.state}`);
  if (data.leadStatus && data.leadStatus !== "Cold Lead") parts.push(`Status: ${data.leadStatus}`);
  if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) parts.push(`Tags: [${data.tags.join(", ")}]`);
  if (data.notes) parts.push(`Notes: ${data.notes}`);
  if (data.website) parts.push(`Website: ${data.website}`);
  if (data.linkedinUrl) parts.push(`LinkedIn: ${data.linkedinUrl}`);
  return parts.join(" | ");
}

/* ─────────────── EXECUTION FUNCTIONS ─────────────── */

/**
 * Creates a new contact in Firestore.
 */
export async function executeCrmCreateContact(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();

    // Resolve target contact book
    let targetInstanceId = activeInstanceId;
    let targetBookName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";

    if (args.contactBookName) {
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        targetInstanceId = resolved;
        targetBookName = instances.find(i => i.id === resolved)?.name || args.contactBookName;
      } else {
        return JSON.stringify({
          success: false,
          error: `Contact book "${args.contactBookName}" was not found. Available books: ${instances.map(i => `"${i.name}"`).join(", ")}. Please try again with an exact name.`,
        });
      }
    }

    // Check for duplicate by email
    if (args.email) {
      const existing = await searchContactsInFirestore(orgId, targetInstanceId, args.email);
      const emailMatch = existing.find(c => c.data.email?.toLowerCase() === args.email.toLowerCase());
      if (emailMatch) {
        const name = [emailMatch.data.firstName, emailMatch.data.lastName].filter(Boolean).join(" ");
        return JSON.stringify({
          success: false,
          duplicate: true,
          error: `A contact with email "${args.email}" already exists: ${name}. Would you like to update the existing contact instead, or create a duplicate?`,
          existingContactId: emailMatch.id,
          existingContact: formatContactSummary(emailMatch.data, emailMatch.id),
        });
      }
    }

    // Generate document ID
    const contactId = `jarvis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Build the contact document — only include fields that are provided and valid
    const contactDoc: Record<string, any> = {
      firstName: args.firstName || "",
      lastName: args.lastName || "",
      email: args.email || "",
      phone: args.phone || "",
      leadStatus: args.leadStatus || "Cold Lead",
      tags: Array.isArray(args.tags) ? args.tags : [],
      totalRevenue: 0,
      aiNotes: "",
      transactions: [],
      outstandingBalance: 0,
      company: args.company || "",
      location: args.location || "",
      lastContactedDate: "",
      birthday: args.birthday || "",
      createdAt: FieldValue.serverTimestamp(),
    };

    // Add all other provided preset fields
    const additionalFields = [
      "secondaryEmail", "tertiaryEmail", "mobilePhone", "workPhone",
      "prefix", "suffix", "middleName", "nickname", "gender", "pronouns",
      "language", "timezone", "contactOwner",
      "jobTitle", "department", "industry", "companySize", "annualRevenue",
      "companyWebsite", "workAddress", "managerName", "employeeId", "role",
      "service", "yearsAtCompany",
      "streetAddress", "city", "state", "zipCode", "country",
      "anniversary", "notes", "description", "priority", "rating", "doNotContact",
      "lifetimeValue", "avgDealSize", "lastPurchaseDate", "totalPurchases",
      "paymentMethod", "currency", "creditLimit", "discount", "taxId",
      "invoiceNumber", "subscriptionPlan", "subscriptionStatus", "renewalDate",
      "leadSource", "dealValue", "dealCloseDate", "dealProbability",
      "assignedTo", "nextFollowUp", "referredBy", "lostReason",
      "competitorName", "campaignSource", "conversionDate", "salesCycle",
      "productInterest", "engagementScore",
      "website", "linkedinUrl", "twitterHandle", "facebookUrl", "instagramHandle",
      "youtubeUrl", "tiktokHandle", "githubUrl", "skypeId", "whatsappNumber",
      "telegramHandle", "blogUrl",
      "preferredContact", "emailOptIn", "smsOptIn", "newsletterSubscribed",
      "lastEmailDate", "lastCallDate", "lastMeetingDate", "totalEmails",
      "totalCalls", "totalMeetings", "communicationNotes",
    ];

    for (const field of additionalFields) {
      if (args[field] !== undefined && args[field] !== null && args[field] !== "") {
        contactDoc[field] = args[field];
      }
    }

    // Write to Firestore
    const docRef = db.collection(`orgs/${orgId}/crm-instances/${targetInstanceId}/contacts`).doc(contactId);
    await docRef.set(contactDoc);

    const fullName = [args.firstName, args.lastName].filter(Boolean).join(" ");
    const fieldsSummary = Object.entries(contactDoc)
      .filter(([k, v]) => v && k !== "createdAt" && k !== "transactions" && k !== "aiNotes" && v !== 0 && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join(", ");

    return JSON.stringify({
      success: true,
      contactId,
      contactBookName: targetBookName,
      contactBookId: targetInstanceId,
      message: `Successfully created contact "${fullName}" in the "${targetBookName}" contact book.`,
      fields: fieldsSummary,
    });
  } catch (error: any) {
    console.error("[CRM] Create contact error:", error);
    return JSON.stringify({ success: false, error: `Failed to create contact: ${error.message}` });
  }
}

/**
 * Updates an existing contact in Firestore.
 */
export async function executeCrmUpdateContact(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();

    // Resolve target contact book
    let targetInstanceId = activeInstanceId;
    let targetBookName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";

    if (args.contactBookName) {
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        targetInstanceId = resolved;
        targetBookName = instances.find(i => i.id === resolved)?.name || args.contactBookName;
      }
    }

    // Search for the contact
    const results = await searchContactsInFirestore(orgId, targetInstanceId, args.searchQuery);

    if (results.length === 0) {
      return JSON.stringify({
        success: false,
        error: `No contact found matching "${args.searchQuery}" in the "${targetBookName}" contact book.`,
      });
    }

    if (results.length > 1) {
      const matches = results.slice(0, 5).map(r => formatContactSummary(r.data, r.id));
      return JSON.stringify({
        success: false,
        multipleMatches: true,
        error: `Multiple contacts match "${args.searchQuery}". Please clarify which one:`,
        matches,
      });
    }

    const contact = results[0];
    const updates: Record<string, any> = {};

    // Filter to only valid preset fields
    if (args.updates && typeof args.updates === "object") {
      for (const [key, value] of Object.entries(args.updates)) {
        if (VALID_FIELD_IDS.has(key)) {
          updates[key] = value;
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return JSON.stringify({ success: false, error: "No valid fields to update." });
    }

    // Write updates to Firestore
    const docRef = db.collection(`orgs/${orgId}/crm-instances/${targetInstanceId}/contacts`).doc(contact.id);
    await docRef.update(updates);

    const fullName = [contact.data.firstName, contact.data.lastName].filter(Boolean).join(" ");
    const updatedFields = Object.entries(updates).map(([k, v]) => `${k} → ${v}`).join(", ");

    return JSON.stringify({
      success: true,
      contactId: contact.id,
      contactBookName: targetBookName,
      message: `Successfully updated "${fullName}" in the "${targetBookName}" contact book. Updated: ${updatedFields}`,
    });
  } catch (error: any) {
    console.error("[CRM] Update contact error:", error);
    return JSON.stringify({ success: false, error: `Failed to update contact: ${error.message}` });
  }
}

/**
 * Deletes a contact from Firestore (with confirmation flow).
 */
export async function executeCrmDeleteContact(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();

    // Resolve target contact book
    let targetInstanceId = activeInstanceId;
    let targetBookName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";

    if (args.contactBookName) {
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        targetInstanceId = resolved;
        targetBookName = instances.find(i => i.id === resolved)?.name || args.contactBookName;
      }
    }

    if (!args.confirmed) {
      // Step 1: Search and ask for confirmation
      const results = await searchContactsInFirestore(orgId, targetInstanceId, args.searchQuery);

      if (results.length === 0) {
        return JSON.stringify({
          success: false,
          error: `No contact found matching "${args.searchQuery}" in the "${targetBookName}" contact book.`,
        });
      }

      if (results.length > 1) {
        const matches = results.slice(0, 5).map(r => formatContactSummary(r.data, r.id));
        return JSON.stringify({
          success: false,
          multipleMatches: true,
          error: `Multiple contacts match "${args.searchQuery}". Please clarify which one to delete:`,
          matches,
        });
      }

      const contact = results[0];
      const fullName = [contact.data.firstName, contact.data.lastName].filter(Boolean).join(" ");
      return JSON.stringify({
        success: false,
        needsConfirmation: true,
        contactId: contact.id,
        contactName: fullName,
        contactBookName: targetBookName,
        message: `Found "${fullName}" in the "${targetBookName}" contact book. Are you sure you want to permanently delete this contact?`,
        summary: formatContactSummary(contact.data, contact.id),
      });
    }

    // Step 2: Confirmed deletion
    const contactId = args.contactId;
    if (!contactId) {
      return JSON.stringify({ success: false, error: "Missing contactId for confirmed deletion." });
    }

    const docRef = db.collection(`orgs/${orgId}/crm-instances/${targetInstanceId}/contacts`).doc(contactId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return JSON.stringify({ success: false, error: "Contact no longer exists." });
    }

    const data = docSnap.data() || {};
    const fullName = [data.firstName, data.lastName].filter(Boolean).join(" ");
    await docRef.delete();

    return JSON.stringify({
      success: true,
      message: `Successfully deleted "${fullName}" from the "${targetBookName}" contact book.`,
    });
  } catch (error: any) {
    console.error("[CRM] Delete contact error:", error);
    return JSON.stringify({ success: false, error: `Failed to delete contact: ${error.message}` });
  }
}

/**
 * Searches contacts in the CRM and returns formatted results.
 */
export async function executeCrmSearchContacts(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    // Cross-book search mode
    if (args.searchAllBooks) {
      const allResults = await searchContactsAllBooks(orgId, instances, args.query);

      if (allResults.length === 0) {
        return JSON.stringify({
          success: true,
          count: 0,
          searchedAllBooks: true,
          message: `No contacts found matching "${args.query}" across any of your contact books.`,
        });
      }

      // Group results by book for clear reporting
      const byBook: Record<string, Array<{ id: string; data: Record<string, any> }>> = {};
      allResults.forEach(r => {
        if (!byBook[r.bookName]) byBook[r.bookName] = [];
        byBook[r.bookName].push(r);
      });

      const formatted = allResults.slice(0, 15).map(r =>
        `[${r.bookName}] ${formatContactSummary(r.data, r.id)}`
      );

      const bookBreakdown = Object.entries(byBook)
        .map(([book, contacts]) => `${book}: ${contacts.length}`)
        .join(", ");

      return JSON.stringify({
        success: true,
        count: allResults.length,
        searchedAllBooks: true,
        bookBreakdown,
        contacts: formatted,
        message: `Found ${allResults.length} contact(s) matching "${args.query}" across all books (${bookBreakdown}).`,
      });
    }

    // Single-book search mode
    let targetInstanceId = activeInstanceId;
    let targetBookName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";

    if (args.contactBookName) {
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        targetInstanceId = resolved;
        targetBookName = instances.find(i => i.id === resolved)?.name || args.contactBookName;
      }
    }

    const results = await searchContactsInFirestore(orgId, targetInstanceId, args.query);

    if (results.length === 0) {
      return JSON.stringify({
        success: true,
        count: 0,
        contactBookName: targetBookName,
        message: `No contacts found matching "${args.query}" in the "${targetBookName}" contact book.`,
      });
    }

    const formatted = results.slice(0, 10).map(r => formatContactSummary(r.data, r.id));

    return JSON.stringify({
      success: true,
      count: results.length,
      contactBookName: targetBookName,
      contacts: formatted,
      message: `Found ${results.length} contact(s) matching "${args.query}" in the "${targetBookName}" contact book.`,
    });
  } catch (error: any) {
    console.error("[CRM] Search contacts error:", error);
    return JSON.stringify({ success: false, error: `Failed to search contacts: ${error.message}` });
  }
}

/**
 * Computes analytics and aggregate statistics across CRM contact books.
 */
export async function executeCrmGetAnalytics(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    const metrics: string[] = Array.isArray(args.metrics) ? args.metrics : ["summary"];

    // Determine which books to analyze — ALWAYS fetch fresh from Firestore to catch newly created books
    let booksToAnalyze: CrmInstance[] = [];

    if (args.contactBookName) {
      // Analyzing a specific book — resolve from client-passed or fresh registry
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        const bookName = instances.find(i => i.id === resolved)?.name || args.contactBookName;
        booksToAnalyze = [{ id: resolved, name: bookName }];
      } else {
        booksToAnalyze = instances.length > 0 ? instances : [{ id: "default", name: "All Contacts" }];
      }
    } else {
      // Analyzing ALL books — fetch fresh list from Firestore registry
      try {
        await initAdmin();
        const db = getAdminFirestore();
        const registrySnap = await db.collection(`orgs/${orgId}/crm-instances-meta`).doc("registry").get();
        const regData = registrySnap.exists ? registrySnap.data() : null;
        booksToAnalyze = regData?.instances || [];
      } catch {
        // Fallback to client-passed instances
        booksToAnalyze = [];
      }
      // Fallback if registry read returned empty
      if (booksToAnalyze.length === 0) {
        booksToAnalyze = instances.length > 0 ? instances : [{ id: "default", name: "All Contacts" }];
      }
    }

    // Load all contacts from target books in parallel
    const loadPromises = booksToAnalyze.map(async (inst) => {
      const contacts = await loadAllContactsFromInstance(orgId, inst.id);
      return { bookId: inst.id, bookName: inst.name, contacts };
    });
    const bookData = await Promise.all(loadPromises);

    const result: Record<string, any> = { success: true };
    const allContacts = bookData.flatMap(b => b.contacts);

    // ── Summary ──
    if (metrics.includes("summary")) {
      result.summary = {
        totalContacts: allContacts.length,
        bookBreakdown: bookData.map(b => ({ name: b.bookName, count: b.contacts.length })),
      };
    }

    // ── Lead Breakdown ──
    if (metrics.includes("lead_breakdown")) {
      const leadCounts: Record<string, number> = { "Cold Lead": 0, "Warm Lead": 0, "Interested": 0, "Sale Completed": 0, "Unset": 0 };
      allContacts.forEach(c => {
        const status = c.leadStatus || "Unset";
        leadCounts[status] = (leadCounts[status] || 0) + 1;
      });
      // Per-book breakdown
      const perBook = bookData.map(b => {
        const bLeads: Record<string, number> = { "Cold Lead": 0, "Warm Lead": 0, "Interested": 0, "Sale Completed": 0, "Unset": 0 };
        b.contacts.forEach(c => {
          const s = c.leadStatus || "Unset";
          bLeads[s] = (bLeads[s] || 0) + 1;
        });
        return { bookName: b.bookName, ...bLeads };
      });
      result.leadBreakdown = { combined: leadCounts, perBook };
    }

    // ── Revenue ──
    if (metrics.includes("revenue")) {
      const sumField = (field: string) => allContacts.reduce((sum, c) => sum + (parseFloat(c[field]) || 0), 0);
      result.revenue = {
        totalRevenue: sumField("totalRevenue"),
        outstandingBalance: sumField("outstandingBalance"),
        lifetimeValue: sumField("lifetimeValue"),
        dealValue: sumField("dealValue"),
        avgDealSize: (() => {
          const withDeals = allContacts.filter(c => parseFloat(c.avgDealSize) > 0);
          return withDeals.length > 0 ? withDeals.reduce((sum, c) => sum + parseFloat(c.avgDealSize), 0) / withDeals.length : 0;
        })(),
        totalPurchases: allContacts.reduce((sum, c) => sum + (parseInt(c.totalPurchases) || 0), 0),
      };
      // Per-book revenue
      result.revenue.perBook = bookData.map(b => ({
        bookName: b.bookName,
        totalRevenue: b.contacts.reduce((sum, c) => sum + (parseFloat(c.totalRevenue) || 0), 0),
        outstandingBalance: b.contacts.reduce((sum, c) => sum + (parseFloat(c.outstandingBalance) || 0), 0),
      }));
    }

    // ── Top Companies ──
    if (metrics.includes("top_companies")) {
      const companyCounts: Record<string, number> = {};
      allContacts.forEach(c => {
        if (c.company && typeof c.company === "string" && c.company.trim()) {
          const key = c.company.trim();
          companyCounts[key] = (companyCounts[key] || 0) + 1;
        }
      });
      result.topCompanies = Object.entries(companyCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));
    }

    // ── Top Tags ──
    if (metrics.includes("top_tags")) {
      const tagCounts: Record<string, number> = {};
      allContacts.forEach(c => {
        if (Array.isArray(c.tags)) {
          c.tags.forEach((t: string) => {
            if (t && typeof t === "string") tagCounts[t] = (tagCounts[t] || 0) + 1;
          });
        }
      });
      result.topTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([tag, count]) => ({ tag, count }));
    }

    // ── Recent Contacts ──
    if (metrics.includes("recent_contacts")) {
      // Helper to normalize various date formats to a sortable ISO string
      const toSortableDate = (dateVal: any): string => {
        if (!dateVal) return "";
        // Firebase Admin SDK Timestamp object (has .seconds property)
        if (dateVal && typeof dateVal === "object" && typeof dateVal.seconds === "number") {
          return new Date(dateVal.seconds * 1000).toISOString();
        }
        // Also handle serialized format (._seconds from client SDK)
        if (dateVal && typeof dateVal === "object" && typeof dateVal._seconds === "number") {
          return new Date(dateVal._seconds * 1000).toISOString();
        }
        // String date — try parsing to normalize
        if (typeof dateVal === "string" && dateVal.trim()) {
          const parsed = new Date(dateVal);
          return isNaN(parsed.getTime()) ? dateVal : parsed.toISOString();
        }
        return "";
      };

      const withDates = allContacts
        .filter(c => c.lastContactedDate || c.createdAt)
        .map(c => {
          const sortDate = toSortableDate(c.lastContactedDate) || toSortableDate(c.createdAt);
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
          return { name, email: c.email || "", company: c.company || "", date: sortDate };
        })
        .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      result.recentContacts = withDates.slice(0, 10);
    }

    result.analyzedBooks = booksToAnalyze.map(b => b.name).join(", ");
    console.log(`[CRM ANALYTICS] Analyzed ${allContacts.length} contacts across ${booksToAnalyze.length} book(s)`);

    return JSON.stringify(result);
  } catch (error: any) {
    console.error("[CRM] Analytics error:", error);
    return JSON.stringify({ success: false, error: `Failed to compute CRM analytics: ${error.message}` });
  }
}

/**
 * Resolves a contact by name across ALL contact books.
 * Optimized for action-chaining (email/text) — returns streamlined contact info.
 */
export async function executeCrmResolveContact(
  orgId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    const nameQuery = args.name;
    if (!nameQuery) {
      return JSON.stringify({ found: false, error: "No name provided to look up." });
    }

    const allResults = await searchContactsAllBooks(orgId, instances, nameQuery);

    if (allResults.length === 0) {
      return JSON.stringify({
        found: false,
        count: 0,
        message: `No contact found matching "${nameQuery}" in any of your contact books.`,
      });
    }

    if (allResults.length === 1) {
      const r = allResults[0];
      const name = [r.data.firstName, r.data.lastName].filter(Boolean).join(" ");
      return JSON.stringify({
        found: true,
        count: 1,
        name,
        email: r.data.email || null,
        secondaryEmail: r.data.secondaryEmail || null,
        phone: r.data.phone || null,
        mobilePhone: r.data.mobilePhone || null,
        company: r.data.company || null,
        jobTitle: r.data.jobTitle || null,
        book: r.bookName,
        contactId: r.id,
      });
    }

    // Multiple matches — return all for disambiguation
    const matches = allResults.slice(0, 8).map(r => {
      const name = [r.data.firstName, r.data.lastName].filter(Boolean).join(" ");
      return {
        name,
        email: r.data.email || null,
        phone: r.data.phone || null,
        company: r.data.company || null,
        jobTitle: r.data.jobTitle || null,
        book: r.bookName,
        contactId: r.id,
      };
    });

    return JSON.stringify({
      found: true,
      count: allResults.length,
      matches,
      message: `Multiple contacts match "${nameQuery}". Please clarify which one.`,
    });
  } catch (error: any) {
    console.error("[CRM] Resolve contact error:", error);
    return JSON.stringify({ found: false, error: `Failed to resolve contact: ${error.message}` });
  }
}

/**
 * Lists all available contact book instances.
 */
export async function executeCrmListContactBooks(
  orgId: string,
  activeInstanceId: string,
  instances: CrmInstance[]
): Promise<string> {
  try {
    // If instances were passed from client, use those
    if (instances && instances.length > 0) {
      return JSON.stringify({
        success: true,
        activeInstanceId,
        activeName: instances.find(i => i.id === activeInstanceId)?.name || "All Contacts",
        books: instances.map(i => ({
          id: i.id,
          name: i.name,
          isActive: i.id === activeInstanceId,
        })),
      });
    }

    // Fallback: read from Firestore
    await initAdmin();
    const db = getAdminFirestore();
    const registryRef = db.collection(`orgs/${orgId}/crm-instances-meta`).doc("registry");
    const snap = await registryRef.get();

    const data = snap.exists ? snap.data() : null;
    const bookInstances: CrmInstance[] = data?.instances || [{ id: "default", name: "All Contacts" }];

    return JSON.stringify({
      success: true,
      activeInstanceId,
      activeName: bookInstances.find(i => i.id === activeInstanceId)?.name || "All Contacts",
      books: bookInstances.map(i => ({
        id: i.id,
        name: i.name,
        isActive: i.id === activeInstanceId,
      })),
    });
  } catch (error: any) {
    console.error("[CRM] List contact books error:", error);
    return JSON.stringify({ success: false, error: `Failed to list contact books: ${error.message}` });
  }
}

/* ─────────────── CRM EVALUATE CONTACTS ─────────────── */

/**
 * Computes a health score (0-100) for a single contact.
 * Field completeness (40), recency (30), deal value (15), status progression (15).
 */
function computeHealthScore(contact: Record<string, any>): number {
  let score = 0;

  // Field completeness — 10 key fields, 4 pts each = 40 max
  const keyFields = ["firstName", "lastName", "email", "phone", "company", "jobTitle", "leadStatus", "tags", "notes", "location"];
  keyFields.forEach(f => {
    const val = contact[f];
    if (val && (typeof val === "string" ? val.trim() : Array.isArray(val) ? val.length > 0 : true)) {
      score += 4;
    }
  });

  // Recency — based on lastContactedDate, max 30 pts
  const lastContacted = contact.lastContactedDate;
  if (lastContacted) {
    const lastDate = typeof lastContacted === "string" ? new Date(lastContacted) :
      (lastContacted?.seconds ? new Date(lastContacted.seconds * 1000) :
        (lastContacted?._seconds ? new Date(lastContacted._seconds * 1000) : null));
    if (lastDate && !isNaN(lastDate.getTime())) {
      const daysSince = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince <= 7) score += 30;
      else if (daysSince <= 14) score += 20;
      else if (daysSince <= 30) score += 10;
      else if (daysSince <= 90) score += 5;
    }
  }

  // Deal value presence — max 15 pts
  if (parseFloat(contact.dealValue) > 0) score += 15;
  else if (parseFloat(contact.lifetimeValue) > 0) score += 10;
  else if (parseFloat(contact.totalRevenue) > 0) score += 5;

  // Status progression — max 15 pts
  const statusScores: Record<string, number> = { "Sale Completed": 15, "Interested": 10, "Warm Lead": 5, "Cold Lead": 2 };
  score += statusScores[contact.leadStatus] || 0;

  return Math.min(100, score);
}

/**
 * Parses a date field from various Firebase formats into a Date object.
 */
function parseContactDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  if (typeof dateVal === "object" && typeof dateVal.seconds === "number") {
    return new Date(dateVal.seconds * 1000);
  }
  if (typeof dateVal === "object" && typeof dateVal._seconds === "number") {
    return new Date(dateVal._seconds * 1000);
  }
  if (typeof dateVal === "string" && dateVal.trim()) {
    const parsed = new Date(dateVal);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Evaluates CRM contact health and generates prioritized action lists.
 */
export async function executeCrmEvaluateContacts(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    const evaluationType: string = args.evaluationType || "full_audit";

    // Determine which books to evaluate — fetch fresh from registry
    let booksToEval: CrmInstance[] = [];
    if (args.contactBookName) {
      const resolved = resolveContactBookByName(args.contactBookName, instances);
      if (resolved) {
        booksToEval = [{ id: resolved, name: instances.find(i => i.id === resolved)?.name || args.contactBookName }];
      }
    }
    if (booksToEval.length === 0) {
      try {
        await initAdmin();
        const db = getAdminFirestore();
        const regSnap = await db.collection(`orgs/${orgId}/crm-instances-meta`).doc("registry").get();
        booksToEval = regSnap.exists ? (regSnap.data()?.instances || []) : [];
      } catch { /* fallback below */ }
      if (booksToEval.length === 0) {
        booksToEval = instances.length > 0 ? instances : [{ id: "default", name: "All Contacts" }];
      }
    }

    // Load all contacts
    const loadPromises = booksToEval.map(async (inst) => {
      const contacts = await loadAllContactsFromInstance(orgId, inst.id);
      return { bookName: inst.name, contacts: contacts.map(c => ({ ...c, _bookName: inst.name }) as Record<string, any>) };
    });
    const bookData = await Promise.all(loadPromises);
    const allContacts = bookData.flatMap(b => b.contacts);

    const result: Record<string, any> = { success: true, evaluationType, totalContactsEvaluated: allContacts.length };

    // ── Health Score ──
    if (evaluationType === "health_score" || evaluationType === "full_audit") {
      const scored = allContacts.map(c => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
        return { name, email: c.email || "", company: c.company || "", book: c._bookName, score: computeHealthScore(c) };
      }).sort((a, b) => a.score - b.score);

      const avgScore = scored.length > 0 ? Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length) : 0;

      result.healthScores = {
        averageScore: avgScore,
        lowestScoring: scored.slice(0, 10),
        highestScoring: scored.slice(-5).reverse(),
        distribution: {
          critical: scored.filter(c => c.score < 20).length,
          poor: scored.filter(c => c.score >= 20 && c.score < 40).length,
          fair: scored.filter(c => c.score >= 40 && c.score < 60).length,
          good: scored.filter(c => c.score >= 60 && c.score < 80).length,
          excellent: scored.filter(c => c.score >= 80).length,
        },
      };
    }

    // ── Stale Leads ──
    if (evaluationType === "stale_leads" || evaluationType === "full_audit") {
      const now = Date.now();
      const fourteenDays = 14 * 24 * 60 * 60 * 1000;
      const staleContacts = allContacts.filter(c => {
        const status = c.leadStatus;
        if (status !== "Warm Lead" && status !== "Interested") return false;
        const lastDate = parseContactDate(c.lastContactedDate);
        if (!lastDate) return true; // Never contacted = stale
        return (now - lastDate.getTime()) > fourteenDays;
      }).map(c => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
        const lastDate = parseContactDate(c.lastContactedDate);
        const daysSince = lastDate ? Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : "never";
        return {
          name, email: c.email || "", company: c.company || "",
          leadStatus: c.leadStatus, daysSinceContact: daysSince,
          dealValue: c.dealValue || "0", book: c._bookName,
        };
      }).sort((a, b) => {
        const aDays = typeof a.daysSinceContact === "number" ? a.daysSinceContact : 9999;
        const bDays = typeof b.daysSinceContact === "number" ? b.daysSinceContact : 9999;
        return bDays - aDays;
      });

      result.staleLeads = {
        count: staleContacts.length,
        contacts: staleContacts.slice(0, 15),
        message: staleContacts.length > 0
          ? `Found ${staleContacts.length} warm/interested leads that haven't been contacted in 14+ days.`
          : "No stale leads found — your follow-ups are up to date!",
      };
    }

    // ── Missing Fields ──
    if (evaluationType === "missing_fields" || evaluationType === "full_audit") {
      const criticalFields = ["email", "phone", "company", "leadStatus", "jobTitle"];
      const fieldCounts: Record<string, number> = {};
      criticalFields.forEach(f => { fieldCounts[f] = 0; });

      allContacts.forEach(c => {
        criticalFields.forEach(f => {
          const val = c[f];
          if (!val || (typeof val === "string" && !val.trim())) {
            fieldCounts[f]++;
          }
        });
      });

      // Sample contacts missing the most critical field (email)
      const missingEmail = allContacts.filter(c => !c.email || !c.email.trim()).slice(0, 5).map(c => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
        return { name, company: c.company || "", book: c._bookName };
      });

      result.missingFields = {
        breakdown: criticalFields.map(f => ({ field: f, missingCount: fieldCounts[f], percentage: allContacts.length > 0 ? Math.round((fieldCounts[f] / allContacts.length) * 100) : 0 })),
        sampleMissingEmail: missingEmail,
      };
    }

    // ── High Value ──
    if (evaluationType === "high_value" || evaluationType === "full_audit") {
      const openDeals = allContacts
        .filter(c => parseFloat(c.dealValue) > 0 && c.leadStatus !== "Sale Completed")
        .map(c => {
          const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || "Unnamed";
          return {
            name, email: c.email || "", company: c.company || "",
            dealValue: parseFloat(c.dealValue), leadStatus: c.leadStatus || "Unset",
            book: c._bookName,
          };
        })
        .sort((a, b) => b.dealValue - a.dealValue);

      const totalPipelineValue = openDeals.reduce((sum, c) => sum + c.dealValue, 0);

      result.highValueDeals = {
        count: openDeals.length,
        totalPipelineValue,
        topDeals: openDeals.slice(0, 10),
      };
    }

    result.analyzedBooks = booksToEval.map(b => b.name).join(", ");
    console.log(`[CRM EVALUATE] ${evaluationType} on ${allContacts.length} contacts across ${booksToEval.length} book(s)`);

    return JSON.stringify(result);
  } catch (error: any) {
    console.error("[CRM] Evaluate contacts error:", error);
    return JSON.stringify({ success: false, error: `Failed to evaluate contacts: ${error.message}` });
  }
}

/* ─────────────── CRM BATCH UPDATE ─────────────── */

/**
 * Applies bulk changes to contacts matching filter criteria.
 * Two-step flow: preview (confirmed=false) then execute (confirmed=true).
 */
export async function executeCrmBatchUpdate(
  orgId: string,
  activeInstanceId: string,
  args: Record<string, any>,
  instances: CrmInstance[]
): Promise<string> {
  try {
    const filter = args.filter || {};
    const action = args.action || {};
    const confirmed = args.confirmed === true;

    // Resolve target book
    let targetInstanceId = activeInstanceId;
    let targetBookName = instances.find(i => i.id === activeInstanceId)?.name || "All Contacts";

    if (filter.contactBookName) {
      const resolved = resolveContactBookByName(filter.contactBookName, instances);
      if (resolved) {
        targetInstanceId = resolved;
        targetBookName = instances.find(i => i.id === resolved)?.name || filter.contactBookName;
      }
    }

    // Load all contacts from target book
    await initAdmin();
    const db = getAdminFirestore();
    const contactsRef = db.collection(`orgs/${orgId}/crm-instances/${targetInstanceId}/contacts`);
    const snap = await contactsRef.get();

    if (snap.empty) {
      return JSON.stringify({ success: true, matchCount: 0, message: `No contacts found in the "${targetBookName}" book.` });
    }

    // Apply filters
    const now = Date.now();
    const matchingDocs: Array<{ id: string; data: Record<string, any> }> = [];

    snap.docs.forEach(doc => {
      const d = doc.data();
      let matches = true;

      // Company filter (case-insensitive substring)
      if (filter.company && matches) {
        const contactCompany = (d.company || "").toLowerCase();
        matches = contactCompany.includes(filter.company.toLowerCase());
      }

      // Lead status filter (exact match)
      if (filter.leadStatus && matches) {
        matches = (d.leadStatus || "Unset") === filter.leadStatus;
      }

      // Tags filter (contact has ANY of the specified tags)
      if (filter.tags && Array.isArray(filter.tags) && filter.tags.length > 0 && matches) {
        const contactTags = Array.isArray(d.tags) ? d.tags.map((t: string) => t.toLowerCase()) : [];
        matches = filter.tags.some((ft: string) => contactTags.includes(ft.toLowerCase()));
      }

      // Missing field filter
      if (filter.missingField && matches) {
        const val = d[filter.missingField];
        matches = !val || (typeof val === "string" && !val.trim()) || (Array.isArray(val) && val.length === 0);
      }

      // Older than N days filter
      if (filter.olderThan && typeof filter.olderThan === "number" && matches) {
        const lastDate = parseContactDate(d.lastContactedDate);
        if (!lastDate) {
          matches = true; // Never contacted = matches
        } else {
          const daysSince = Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24));
          matches = daysSince > filter.olderThan;
        }
      }

      if (matches) {
        matchingDocs.push({ id: doc.id, data: d });
      }
    });

    // Build human-readable action description
    let actionDesc = "";
    if (action.type === "add_tags") actionDesc = `Add tag(s) [${(action.tags || []).join(", ")}]`;
    else if (action.type === "remove_tags") actionDesc = `Remove tag(s) [${(action.tags || []).join(", ")}]`;
    else if (action.type === "set_status") actionDesc = `Set lead status to "${action.status}"`;
    else if (action.type === "set_field") actionDesc = `Set ${action.field} to "${action.value}"`;

    // Preview mode
    if (!confirmed) {
      const sampleNames = matchingDocs.slice(0, 5).map(m => {
        const name = [m.data.firstName, m.data.lastName].filter(Boolean).join(" ") || "Unnamed";
        return name;
      });

      return JSON.stringify({
        preview: true,
        matchCount: matchingDocs.length,
        contactBookName: targetBookName,
        sampleContacts: sampleNames,
        actionDescription: `${actionDesc} for ${matchingDocs.length} contact(s) in "${targetBookName}"`,
        message: matchingDocs.length > 0
          ? `Found ${matchingDocs.length} contact(s) matching your criteria in "${targetBookName}". Sample: ${sampleNames.join(", ")}${matchingDocs.length > 5 ? `, and ${matchingDocs.length - 5} more` : ""}. Action: ${actionDesc}. Should I proceed?`
          : `No contacts matched your filter criteria in "${targetBookName}".`,
      });
    }

    // Execute mode
    if (matchingDocs.length === 0) {
      return JSON.stringify({ success: true, updatedCount: 0, message: "No contacts matched the filter criteria." });
    }

    // Batch write in groups of 500 (Firestore limit)
    const batchSize = 500;
    let updatedCount = 0;

    for (let i = 0; i < matchingDocs.length; i += batchSize) {
      const batch = db.batch();
      const chunk = matchingDocs.slice(i, i + batchSize);

      chunk.forEach(m => {
        const docRef = contactsRef.doc(m.id);
        let updateData: Record<string, any> = {};

        if (action.type === "set_field" && action.field && VALID_FIELD_IDS.has(action.field)) {
          updateData[action.field] = action.value;
        } else if (action.type === "add_tags" && Array.isArray(action.tags)) {
          const existingTags = Array.isArray(m.data.tags) ? m.data.tags : [];
          const newTags = Array.from(new Set([...existingTags, ...action.tags]));
          updateData.tags = newTags;
        } else if (action.type === "remove_tags" && Array.isArray(action.tags)) {
          const existingTags = Array.isArray(m.data.tags) ? m.data.tags : [];
          const removeLower = action.tags.map((t: string) => t.toLowerCase());
          updateData.tags = existingTags.filter((t: string) => !removeLower.includes(t.toLowerCase()));
        } else if (action.type === "set_status" && action.status) {
          updateData.leadStatus = action.status;
        }

        if (Object.keys(updateData).length > 0) {
          batch.update(docRef, updateData);
          updatedCount++;
        }
      });

      await batch.commit();
    }

    console.log(`[CRM BATCH] Updated ${updatedCount} contacts in "${targetBookName}": ${actionDesc}`);

    return JSON.stringify({
      success: true,
      updatedCount,
      contactBookName: targetBookName,
      actionDescription: actionDesc,
      message: `Successfully updated ${updatedCount} contact(s) in "${targetBookName}". Action: ${actionDesc}.`,
    });
  } catch (error: any) {
    console.error("[CRM] Batch update error:", error);
    return JSON.stringify({ success: false, error: `Failed to batch update contacts: ${error.message}` });
  }
}

export async function executeCrmMergeContacts(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { primaryQuery, secondaryQuery, fieldsToKeepFromPrimary = [], confirmed, contactBookName } = args;

    const targetBookId = contactBookName ? resolveContactBookByName(contactBookName, instances) : instanceId;
    if (!targetBookId) return JSON.stringify({ success: false, error: `Contact book '${contactBookName}' not found.` });

    const primaryResults = await searchContactsInFirestore(orgId, targetBookId, primaryQuery);
    if (primaryResults.length === 0) return JSON.stringify({ success: false, error: `Primary contact '${primaryQuery}' not found.` });
    const primary = primaryResults[0];

    const secondaryResults = await searchContactsInFirestore(orgId, targetBookId, secondaryQuery);
    if (secondaryResults.length === 0) return JSON.stringify({ success: false, error: `Secondary contact '${secondaryQuery}' not found.` });
    const secondary = secondaryResults[0];

    if (primary.id === secondary.id) {
      return JSON.stringify({ success: false, error: `Primary and secondary contacts are the same record.` });
    }

    const primaryData = primary.data;
    const secondaryData = secondary.data;
    const mergedData: any = { ...primaryData };
    const fieldsCopied: string[] = [];

    // Fields to copy from secondary if primary is empty (except fields to keep)
    for (const [key, value] of Object.entries(secondaryData)) {
      if (key === "id" || key === "createdAt" || key === "updatedAt") continue;
      
      // Handle tags — union merge
      if (key === "tags" && Array.isArray(value)) {
        mergedData.tags = Array.from(new Set([...(Array.isArray(primaryData.tags) ? primaryData.tags : []), ...value]));
        continue;
      }
      
      // Handle revenue — sum
      if (["totalRevenue", "outstandingBalance", "lifetimeValue", "dealValue"].includes(key)) {
        mergedData[key] = (Number(primaryData[key]) || 0) + (Number(value) || 0);
        continue;
      }

      // Copy if primary empty and not in keep list
      if (!fieldsToKeepFromPrimary.includes(key) && value !== undefined && value !== null && value !== "") {
        if (primaryData[key] === undefined || primaryData[key] === null || primaryData[key] === "") {
          mergedData[key] = value;
          fieldsCopied.push(key);
        }
      }
    }

    if (!confirmed) {
      return JSON.stringify({
        success: true,
        preview: true,
        message: "Merge preview. Call again with confirmed=true to execute.",
        primaryContact: { id: primary.id, name: (primaryData.firstName || "") + " " + (primaryData.lastName || ""), email: primaryData.email },
        secondaryContact: { id: secondary.id, name: (secondaryData.firstName || "") + " " + (secondaryData.lastName || ""), email: secondaryData.email },
        fieldsToBeCopied: fieldsCopied,
        mergedResultPreview: mergedData
      });
    }

    const batch = db.batch();
    const primaryRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/contacts`).doc(primary.id);
    const secondaryRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/contacts`).doc(secondary.id);

    mergedData.updatedAt = Date.now();
    batch.set(primaryRef, mergedData, { merge: true });
    batch.delete(secondaryRef);

    // Log activity
    const activityRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/activities`).doc();
    batch.set(activityRef, {
      id: activityRef.id,
      contactId: primary.id,
      type: "note",
      content: `Merged duplicate record for ${secondaryData.firstName || ''} ${secondaryData.lastName || ''} (${secondaryData.email || 'no email'}) into this contact.`,
      createdAt: Date.now(),
      source: "jarvis"
    });

    await batch.commit();

    return JSON.stringify({
      success: true,
      message: `Successfully merged contacts. Kept ${primaryData.firstName || ''} ${primaryData.lastName || ''} (${primaryData.email || primary.id}) as primary. Deleted duplicate.`,
      primaryContactId: primary.id,
      deletedContactId: secondary.id
    });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Merge failed: ${error.message}` });
  }
}

export async function executeCrmAddActivity(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { searchQuery, type, content, contactBookName } = args;

    const targetBookId = contactBookName ? resolveContactBookByName(contactBookName, instances) : instanceId;
    if (!targetBookId) return JSON.stringify({ success: false, error: `Contact book '${contactBookName}' not found.` });

    const results = await searchContactsInFirestore(orgId, targetBookId, searchQuery);
    if (results.length === 0) return JSON.stringify({ success: false, error: `Contact not found.` });
    const contact = results[0];

    const activityRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/activities`).doc();
    await activityRef.set({
      id: activityRef.id,
      contactId: contact.id,
      type,
      content,
      createdAt: Date.now(),
      source: "jarvis"
    });

    return JSON.stringify({ success: true, message: `Activity logged to ${contact.data.firstName || 'contact'}.`, activityId: activityRef.id });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to add activity: ${error.message}` });
  }
}

export async function executeCrmCreateContactBook(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { name } = args;

    const newId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    
    if (instances.some(i => i.id === newId)) {
      return JSON.stringify({ success: false, error: `A contact book with ID ${newId} already exists.` });
    }

    const newInstance = { id: newId, name, icon: "Database" };
    
    const registryRef = db.doc(`orgs/${orgId}/crm-instances-meta/registry`);
    const doc = await registryRef.get();
    
    if (!doc.exists) {
      await registryRef.set({ instances: [newInstance] });
    } else {
      const data = doc.data() || { instances: [] };
      await registryRef.update({ instances: [...data.instances, newInstance] });
    }

    return JSON.stringify({ success: true, message: `Contact book '${name}' created.`, newBookId: newId });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to create book: ${error.message}` });
  }
}

export async function executeCrmRenameContactBook(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { currentName, newName } = args;

    const targetId = resolveContactBookByName(currentName, instances);
    if (!targetId) return JSON.stringify({ success: false, error: `Contact book '${currentName}' not found.` });

    const registryRef = db.doc(`orgs/${orgId}/crm-instances-meta/registry`);
    const doc = await registryRef.get();
    
    if (doc.exists) {
      const data = doc.data() || { instances: [] };
      const updated = data.instances.map((i: any) => i.id === targetId ? { ...i, name: newName } : i);
      await registryRef.update({ instances: updated });
    }

    return JSON.stringify({ success: true, message: `Contact book renamed to '${newName}'.` });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to rename book: ${error.message}` });
  }
}

export async function executeCrmDeleteContactBook(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { bookName, confirmed } = args;

    const targetId = resolveContactBookByName(bookName, instances);
    if (!targetId) return JSON.stringify({ success: false, error: `Contact book '${bookName}' not found.` });
    
    if (targetId === "default") return JSON.stringify({ success: false, error: `Cannot delete the default contact book.` });
    if (instances.length <= 1) return JSON.stringify({ success: false, error: `Cannot delete the only contact book.` });

    if (!confirmed) {
      return JSON.stringify({ success: true, preview: true, message: `WARNING: This will delete the book '${bookName}' and ALL its contacts. Call again with confirmed=true to execute.` });
    }

    const registryRef = db.doc(`orgs/${orgId}/crm-instances-meta/registry`);
    const doc = await registryRef.get();
    
    if (doc.exists) {
      const data = doc.data() || { instances: [] };
      const updated = data.instances.filter((i: any) => i.id !== targetId);
      await registryRef.update({ instances: updated });
    }

    return JSON.stringify({ success: true, message: `Contact book '${bookName}' deleted.` });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to delete book: ${error.message}` });
  }
}

export async function executeCrmMoveContact(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { searchQuery, targetBookName, confirmed, contactBookName } = args;

    const sourceBookId = contactBookName ? resolveContactBookByName(contactBookName, instances) : instanceId;
    if (!sourceBookId) return JSON.stringify({ success: false, error: `Source contact book not found.` });

    const targetBookId = resolveContactBookByName(targetBookName, instances);
    if (!targetBookId) return JSON.stringify({ success: false, error: `Target contact book '${targetBookName}' not found.` });

    if (sourceBookId === targetBookId) return JSON.stringify({ success: false, error: `Source and target books are the same.` });

    const results = await searchContactsInFirestore(orgId, sourceBookId, searchQuery);
    if (results.length === 0) return JSON.stringify({ success: false, error: `Contact not found.` });
    const contact = results[0];

    if (!confirmed) {
      return JSON.stringify({ success: true, preview: true, message: `Ready to move ${contact.data.firstName || 'contact'} to '${targetBookName}'. Call with confirmed=true.` });
    }

    const batch = db.batch();
    const targetRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/contacts`).doc(contact.id);
    const sourceRef = db.collection(`orgs/${orgId}/crm-instances/${sourceBookId}/contacts`).doc(contact.id);

    batch.set(targetRef, contact.data);
    batch.delete(sourceRef);

    await batch.commit();

    return JSON.stringify({ success: true, message: `Moved ${contact.data.firstName || 'contact'} to ${targetBookName}.` });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to move contact: ${error.message}` });
  }
}

export async function executeCrmScheduleFollowup(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { searchQuery, taskType, title, dueDate, priority = "Normal", notes, contactBookName } = args;

    const targetBookId = contactBookName ? resolveContactBookByName(contactBookName, instances) : instanceId;
    if (!targetBookId) return JSON.stringify({ success: false, error: `Contact book not found.` });

    const results = await searchContactsInFirestore(orgId, targetBookId, searchQuery);
    if (results.length === 0) return JSON.stringify({ success: false, error: `Contact not found.` });
    const contact = results[0];

    const taskRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/tasks`).doc();
    const taskData = {
      id: taskRef.id,
      contactId: contact.id,
      contactName: `${contact.data.firstName || ''} ${contact.data.lastName || ""}`.trim(),
      type: taskType,
      title,
      dueDate,
      priority,
      notes: notes || "",
      status: "open",
      createdAt: Date.now()
    };
    
    const batch = db.batch();
    batch.set(taskRef, taskData);

    const activityRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/activities`).doc();
    batch.set(activityRef, {
      id: activityRef.id,
      contactId: contact.id,
      type: "task",
      content: `Scheduled ${taskType} follow-up: ${title} (Due: ${dueDate})`,
      createdAt: Date.now(),
      source: "jarvis"
    });

    await batch.commit();

    return JSON.stringify({ success: true, message: `Scheduled follow-up for ${contact.data.firstName || 'contact'}.`, taskId: taskRef.id });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to schedule follow-up: ${error.message}` });
  }
}

export async function executeCrmCompleteTask(orgId: string, instanceId: string, args: any, instances: CrmInstance[]): Promise<string> {
  try {
    await initAdmin();
    const db = getAdminFirestore();
    const { searchQuery, taskTitle, action, contactBookName } = args;

    const targetBookId = contactBookName ? resolveContactBookByName(contactBookName, instances) : instanceId;
    if (!targetBookId) return JSON.stringify({ success: false, error: `Contact book not found.` });

    const results = await searchContactsInFirestore(orgId, targetBookId, searchQuery);
    if (results.length === 0) return JSON.stringify({ success: false, error: `Contact not found.` });
    const contact = results[0];

    const tasksSnapshot = await db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/tasks`)
      .where("contactId", "==", contact.id)
      .where("status", "==", "open")
      .get();

    if (tasksSnapshot.empty) return JSON.stringify({ success: false, error: `No open tasks found for this contact.` });

    let taskDoc = tasksSnapshot.docs[0];
    if (taskTitle) {
      const match = tasksSnapshot.docs.find(d => d.data().title.toLowerCase().includes(taskTitle.toLowerCase()));
      if (match) taskDoc = match;
    }

    const batch = db.batch();
    
    if (action === "complete") {
      batch.update(taskDoc.ref, { status: "completed", completedAt: Date.now() });
      
      const activityRef = db.collection(`orgs/${orgId}/crm-instances/${targetBookId}/activities`).doc();
      batch.set(activityRef, {
        id: activityRef.id,
        contactId: contact.id,
        type: "task",
        content: `Completed task: ${taskDoc.data().title}`,
        createdAt: Date.now(),
        source: "jarvis"
      });
    } else if (action === "delete") {
      batch.delete(taskDoc.ref);
    }

    await batch.commit();

    return JSON.stringify({ success: true, message: `Task ${action}d.` });
  } catch (error: any) {
    return JSON.stringify({ success: false, error: `Failed to ${args.action} task: ${error.message}` });
  }
}
