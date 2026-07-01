/**
 * @file contactFieldTypes.ts
 * @description Core types and default catalog for the dynamic contact field system.
 * 
 * This module defines the field definition interface, default field catalog organized
 * by category, and utility functions for field management. Both the CRM Database page
 * and ContactsView use this as their shared field foundation.
 */

/* ─────────────── FIELD TYPES ─────────────── */

export type FieldType = "text" | "number" | "date" | "email" | "phone" | "url" | "select" | "boolean" | "tags" | "currency";

export type FieldCategory = "contact" | "company" | "general" | "financial" | "pipeline" | "social" | "communication" | "custom";

export interface ContactFieldDef {
  /** Unique field key — matches the Firestore document property name (e.g. "firstName", "custom_xyz") */
  id: string;
  /** Human-readable display label */
  label: string;
  /** Data type for rendering & validation */
  type: FieldType;
  /** Category grouping in the Manage Fields sidebar */
  category: FieldCategory;
  /** If true, field can't be removed from the visible table (e.g. firstName) */
  required?: boolean;
  /** If true, field is a system field and can't be deleted entirely */
  locked?: boolean;
  /** Dropdown options for "select" type fields */
  options?: string[];
  /** Suggested column width CSS class */
  width?: string;
  /** Icon name hint for the sidebar (lucide icon key) */
  icon?: string;
}

export interface FieldConfig {
  /** Ordered list of field IDs currently visible in the table */
  visibleFields: string[];
  /** Full catalog of all available fields (system + custom) */
  allFields: ContactFieldDef[];
}

/* ─────────────── DEFAULT CRM FIELD CATALOG ─────────────── */

export const DEFAULT_CRM_FIELDS: ContactFieldDef[] = [
  // ── Contact ──
  { id: "firstName",          label: "First Name",             type: "text",     category: "contact",   required: true, locked: true, width: "w-[110px]" },
  { id: "lastName",           label: "Last Name",              type: "text",     category: "contact",   required: true, locked: true, width: "w-[110px]" },
  { id: "email",              label: "Email",                  type: "email",    category: "contact",   locked: true,  width: "w-[180px]" },
  { id: "phone",              label: "Phone",                  type: "phone",    category: "contact",   locked: true,  width: "w-[130px]" },
  { id: "mobilePhone",        label: "Mobile Phone",           type: "phone",    category: "contact",   locked: true,  width: "w-[130px]" },
  { id: "workPhone",          label: "Work Phone",             type: "phone",    category: "contact",   locked: true,  width: "w-[130px]" },
  { id: "secondaryEmail",     label: "Secondary Email",        type: "email",    category: "contact",   locked: true,  width: "w-[180px]" },
  { id: "prefix",             label: "Prefix",                 type: "select",   category: "contact",   locked: true,  width: "w-[90px]",  options: ["Mr.", "Mrs.", "Ms.", "Dr.", "Prof."] },
  { id: "suffix",             label: "Suffix",                 type: "text",     category: "contact",   locked: true,  width: "w-[90px]" },
  { id: "middleName",         label: "Middle Name",            type: "text",     category: "contact",   locked: true,  width: "w-[110px]" },
  { id: "nickname",           label: "Nickname",               type: "text",     category: "contact",   locked: true,  width: "w-[110px]" },
  { id: "gender",             label: "Gender",                 type: "select",   category: "contact",   locked: true,  width: "w-[100px]", options: ["Male", "Female", "Non-Binary", "Other", "Prefer not to say"] },
  { id: "pronouns",           label: "Pronouns",               type: "text",     category: "contact",   locked: true,  width: "w-[100px]" },
  { id: "language",           label: "Language",               type: "text",     category: "contact",   locked: true,  width: "w-[110px]" },
  { id: "timezone",           label: "Time Zone",              type: "text",     category: "contact",   locked: true,  width: "w-[130px]" },
  { id: "contactOwner",       label: "Contact Owner",          type: "text",     category: "contact",   locked: true,  width: "w-[130px]" },

  // ── Company & Work ──
  { id: "company",            label: "Company",                type: "text",     category: "company",   locked: true,  width: "w-[130px]" },
  { id: "jobTitle",           label: "Job Title",              type: "text",     category: "company",   locked: true,  width: "w-[140px]" },
  { id: "department",         label: "Department",             type: "text",     category: "company",   locked: true,  width: "w-[130px]" },
  { id: "industry",           label: "Industry",               type: "text",     category: "company",   locked: true,  width: "w-[130px]" },
  { id: "companySize",        label: "Company Size",           type: "select",   category: "company",   locked: true,  width: "w-[120px]", options: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"] },
  { id: "annualRevenue",      label: "Annual Revenue",         type: "currency", category: "company",   locked: true,  width: "w-[130px]" },
  { id: "companyWebsite",     label: "Company Website",        type: "url",      category: "company",   locked: true,  width: "w-[160px]" },
  { id: "workAddress",        label: "Work Address",           type: "text",     category: "company",   locked: true,  width: "w-[160px]" },
  { id: "managerName",        label: "Manager / Reports To",   type: "text",     category: "company",   locked: true,  width: "w-[140px]" },
  { id: "employeeId",         label: "Employee ID",            type: "text",     category: "company",   locked: true,  width: "w-[110px]" },
  { id: "role",               label: "Role",                   type: "text",     category: "company",   locked: true,  width: "w-[120px]" },
  { id: "yearsAtCompany",     label: "Years at Company",       type: "number",   category: "company",   locked: true,  width: "w-[110px]" },

  // ── General Info ──
  { id: "location",           label: "Location",               type: "text",     category: "general",   locked: true,  width: "w-[130px]" },
  { id: "streetAddress",      label: "Street Address",         type: "text",     category: "general",   locked: true,  width: "w-[160px]" },
  { id: "city",               label: "City",                   type: "text",     category: "general",   locked: true,  width: "w-[110px]" },
  { id: "state",              label: "State / Province",       type: "text",     category: "general",   locked: true,  width: "w-[120px]" },
  { id: "zipCode",            label: "ZIP / Postal Code",      type: "text",     category: "general",   locked: true,  width: "w-[110px]" },
  { id: "country",            label: "Country",                type: "text",     category: "general",   locked: true,  width: "w-[110px]" },
  { id: "birthday",           label: "Birthday",               type: "date",     category: "general",   locked: true,  width: "w-[120px]" },
  { id: "anniversary",        label: "Anniversary",            type: "date",     category: "general",   locked: true,  width: "w-[120px]" },
  { id: "lastContactedDate",  label: "Last Contacted",         type: "date",     category: "general",   locked: true,  width: "w-[130px]" },
  { id: "dateCreated",        label: "Date Created",           type: "date",     category: "general",   locked: true,  width: "w-[120px]" },
  { id: "dateModified",       label: "Date Modified",          type: "date",     category: "general",   locked: true,  width: "w-[120px]" },
  { id: "tags",               label: "Tags",                   type: "tags",     category: "general",   locked: true,  width: "w-[140px]" },
  { id: "notes",              label: "Notes",                  type: "text",     category: "general",   locked: true,  width: "w-[180px]" },
  { id: "description",        label: "Description",            type: "text",     category: "general",   locked: true,  width: "w-[180px]" },
  { id: "priority",           label: "Priority",               type: "select",   category: "general",   locked: true,  width: "w-[110px]", options: ["Low", "Medium", "High", "Urgent"] },
  { id: "rating",             label: "Rating",                 type: "number",   category: "general",   locked: true,  width: "w-[100px]" },
  { id: "doNotContact",       label: "Do Not Contact",         type: "boolean",  category: "general",   locked: true,  width: "w-[120px]" },

  // ── Financial ──
  { id: "totalRevenue",       label: "Revenue",                type: "currency", category: "financial", locked: true,  width: "w-[110px]" },
  { id: "outstandingBalance", label: "Outstanding Balance",    type: "currency", category: "financial", locked: true,  width: "w-[130px]" },
  { id: "lifetimeValue",      label: "Lifetime Value (LTV)",   type: "currency", category: "financial", locked: true,  width: "w-[130px]" },
  { id: "avgDealSize",        label: "Avg Deal Size",          type: "currency", category: "financial", locked: true,  width: "w-[120px]" },
  { id: "lastPurchaseDate",   label: "Last Purchase Date",     type: "date",     category: "financial", locked: true,  width: "w-[130px]" },
  { id: "totalPurchases",     label: "Total Purchases",        type: "number",   category: "financial", locked: true,  width: "w-[120px]" },
  { id: "paymentMethod",      label: "Payment Method",         type: "text",     category: "financial", locked: true,  width: "w-[130px]" },
  { id: "currency",           label: "Currency",               type: "text",     category: "financial", locked: true,  width: "w-[100px]" },
  { id: "creditLimit",        label: "Credit Limit",           type: "currency", category: "financial", locked: true,  width: "w-[120px]" },
  { id: "discount",           label: "Discount %",             type: "number",   category: "financial", locked: true,  width: "w-[100px]" },
  { id: "taxId",              label: "Tax ID",                 type: "text",     category: "financial", locked: true,  width: "w-[120px]" },
  { id: "invoiceNumber",      label: "Invoice Number",         type: "text",     category: "financial", locked: true,  width: "w-[120px]" },
  { id: "subscriptionPlan",   label: "Subscription Plan",      type: "text",     category: "financial", locked: true,  width: "w-[130px]" },
  { id: "subscriptionStatus", label: "Subscription Status",    type: "select",   category: "financial", locked: true,  width: "w-[130px]", options: ["Active", "Trialing", "Past Due", "Cancelled", "None"] },
  { id: "renewalDate",        label: "Renewal Date",           type: "date",     category: "financial", locked: true,  width: "w-[120px]" },

  // ── Pipeline & Sales ──
  { id: "leadStatus",         label: "Pipeline Stage",         type: "select",   category: "pipeline",  locked: true,  width: "w-[140px]",
    options: ["Cold Lead", "Warm Lead", "Interested", "Sale Completed"] },
  { id: "aiNotes",            label: "AI Notes",               type: "text",     category: "pipeline",  locked: true,  width: "w-[160px]" },
  { id: "leadSource",         label: "Lead Source",            type: "select",   category: "pipeline",  locked: true,  width: "w-[130px]",
    options: ["Website", "Referral", "Social Media", "Cold Call", "Event", "Ad Campaign", "Email", "Partner", "Other"] },
  { id: "dealValue",          label: "Deal Value",             type: "currency", category: "pipeline",  locked: true,  width: "w-[120px]" },
  { id: "dealCloseDate",      label: "Expected Close Date",    type: "date",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "dealProbability",    label: "Win Probability %",      type: "number",   category: "pipeline",  locked: true,  width: "w-[120px]" },
  { id: "assignedTo",         label: "Assigned To",            type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "nextFollowUp",       label: "Next Follow-Up",         type: "date",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "referredBy",         label: "Referred By",            type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "lostReason",         label: "Lost Reason",            type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "competitorName",     label: "Competitor",             type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "campaignSource",     label: "Campaign Source",        type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "conversionDate",     label: "Conversion Date",        type: "date",     category: "pipeline",  locked: true,  width: "w-[120px]" },
  { id: "salesCycle",         label: "Sales Cycle (days)",     type: "number",   category: "pipeline",  locked: true,  width: "w-[120px]" },
  { id: "productInterest",    label: "Product Interest",       type: "text",     category: "pipeline",  locked: true,  width: "w-[130px]" },
  { id: "engagementScore",    label: "Engagement Score",       type: "number",   category: "pipeline",  locked: true,  width: "w-[120px]" },

  // ── Social & Web ──
  { id: "website",            label: "Website",                type: "url",      category: "social",    locked: true,  width: "w-[160px]" },
  { id: "linkedinUrl",        label: "LinkedIn",               type: "url",      category: "social",    locked: true,  width: "w-[160px]" },
  { id: "twitterHandle",      label: "Twitter / X",            type: "text",     category: "social",    locked: true,  width: "w-[130px]" },
  { id: "facebookUrl",        label: "Facebook",               type: "url",      category: "social",    locked: true,  width: "w-[160px]" },
  { id: "instagramHandle",    label: "Instagram",              type: "text",     category: "social",    locked: true,  width: "w-[130px]" },
  { id: "youtubeUrl",         label: "YouTube",                type: "url",      category: "social",    locked: true,  width: "w-[160px]" },
  { id: "tiktokHandle",       label: "TikTok",                 type: "text",     category: "social",    locked: true,  width: "w-[130px]" },
  { id: "githubUrl",          label: "GitHub",                 type: "url",      category: "social",    locked: true,  width: "w-[160px]" },
  { id: "skypeId",            label: "Skype",                  type: "text",     category: "social",    locked: true,  width: "w-[130px]" },
  { id: "whatsappNumber",     label: "WhatsApp",               type: "phone",    category: "social",    locked: true,  width: "w-[130px]" },
  { id: "telegramHandle",     label: "Telegram",               type: "text",     category: "social",    locked: true,  width: "w-[130px]" },
  { id: "blogUrl",            label: "Blog",                   type: "url",      category: "social",    locked: true,  width: "w-[160px]" },

  // ── Communication ──
  { id: "preferredContact",   label: "Preferred Contact Method", type: "select", category: "communication", locked: true, width: "w-[150px]",
    options: ["Email", "Phone", "Text", "WhatsApp", "LinkedIn", "In Person"] },
  { id: "emailOptIn",         label: "Email Opt-In",           type: "boolean",  category: "communication", locked: true, width: "w-[110px]" },
  { id: "smsOptIn",           label: "SMS Opt-In",             type: "boolean",  category: "communication", locked: true, width: "w-[110px]" },
  { id: "newsletterSubscribed", label: "Newsletter",           type: "boolean",  category: "communication", locked: true, width: "w-[110px]" },
  { id: "lastEmailDate",      label: "Last Email Sent",        type: "date",     category: "communication", locked: true, width: "w-[130px]" },
  { id: "lastCallDate",       label: "Last Call",              type: "date",     category: "communication", locked: true, width: "w-[120px]" },
  { id: "lastMeetingDate",    label: "Last Meeting",           type: "date",     category: "communication", locked: true, width: "w-[120px]" },
  { id: "totalEmails",        label: "Total Emails",           type: "number",   category: "communication", locked: true, width: "w-[110px]" },
  { id: "totalCalls",         label: "Total Calls",            type: "number",   category: "communication", locked: true, width: "w-[110px]" },
  { id: "totalMeetings",      label: "Total Meetings",         type: "number",   category: "communication", locked: true, width: "w-[110px]" },
  { id: "communicationNotes", label: "Communication Notes",    type: "text",     category: "communication", locked: true, width: "w-[180px]" },
];

/** Default visible fields for CRM (matches current hardcoded columns minus 'id') */
export const DEFAULT_CRM_VISIBLE_FIELDS: string[] = [
  "firstName", "lastName", "company", "email", "phone",
  "leadStatus", "totalRevenue", "tags", "location", "lastContactedDate",
];

/* ─────────────── DEFAULT CONTACTS BOOK FIELD CATALOG ─────────────── */

export const DEFAULT_CONTACTS_FIELDS: ContactFieldDef[] = [
  { id: "name",     label: "Name",    type: "text",    category: "contact", required: true, locked: true, width: "w-[160px]" },
  { id: "email",    label: "Email",   type: "email",   category: "contact", required: true, locked: true, width: "w-[200px]" },
  { id: "aliases",  label: "Aliases", type: "text",    category: "contact", locked: true,  width: "w-[180px]" },
  { id: "phone",    label: "Phone",   type: "phone",   category: "contact", locked: true,  width: "w-[140px]" },
  { id: "company",  label: "Company", type: "text",    category: "contact", locked: true,  width: "w-[140px]" },
  { id: "location", label: "Location",type: "text",    category: "general", locked: true,  width: "w-[140px]" },
  { id: "notes",    label: "Notes",   type: "text",    category: "general", locked: true,  width: "w-[180px]" },
];

export const DEFAULT_CONTACTS_VISIBLE_FIELDS: string[] = [
  "name", "email", "aliases",
];

/* ─────────────── CATEGORY METADATA ─────────────── */

export const FIELD_CATEGORIES: { id: FieldCategory; label: string; icon: string }[] = [
  { id: "contact",        label: "Contact",           icon: "User" },
  { id: "company",        label: "Company & Work",    icon: "Building2" },
  { id: "general",        label: "General Info",       icon: "Info" },
  { id: "financial",      label: "Financial",          icon: "DollarSign" },
  { id: "pipeline",       label: "Pipeline & Sales",   icon: "GitBranch" },
  { id: "social",         label: "Social & Web",       icon: "Globe" },
  { id: "communication",  label: "Communication",      icon: "MessageCircle" },
  { id: "custom",         label: "Custom Fields",      icon: "Sparkles" },
];

/* ─────────────── UTILITY FUNCTIONS ─────────────── */

/** Create a new custom field definition */
export function createCustomField(
  name: string,
  type: FieldType = "text",
  options?: string[]
): ContactFieldDef {
  const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    id,
    label: name,
    type,
    category: "custom",
    locked: false,
    required: false,
    width: "w-[130px]",
    icon: "Sparkles",
    ...(options && options.length > 0 ? { options } : {}),
  };
}

/** Human-readable label for a field type */
export function getFieldTypeLabel(type: FieldType): string {
  switch (type) {
    case "text":     return "Text";
    case "number":   return "Number";
    case "date":     return "Date";
    case "email":    return "Email";
    case "phone":    return "Phone";
    case "url":      return "URL";
    case "select":   return "Dropdown";
    case "boolean":  return "Toggle";
    case "tags":     return "Tags";
    case "currency": return "Currency";
    default:         return "Text";
  }
}

/** All available field types for the custom field creator */
export const AVAILABLE_FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "text",     label: "Text" },
  { value: "number",   label: "Number" },
  { value: "date",     label: "Date" },
  { value: "email",    label: "Email" },
  { value: "phone",    label: "Phone" },
  { value: "url",      label: "URL" },
  { value: "select",   label: "Dropdown" },
  { value: "boolean",  label: "Toggle" },
  { value: "currency", label: "Currency" },
];

/* ─────────────── CSV FIELD MATCHING ─────────────── */

/** Common synonyms for fuzzy CSV header matching */
const FIELD_SYNONYMS: Record<string, string[]> = {
  firstName:          ["first_name", "first name", "firstname", "fname", "given name", "givenname"],
  lastName:           ["last_name", "last name", "lastname", "lname", "surname", "family name", "familyname"],
  email:              ["e-mail", "email address", "emailaddress", "email_address", "mail"],
  phone:              ["phone number", "phonenumber", "phone_number", "telephone", "tel", "mobile", "cell", "cellphone"],
  company:            ["business", "organization", "organisation", "org", "company name", "companyname", "business name", "organization name", "organisation name"],
  streetAddress:      ["address", "street address", "street_address", "mailing address", "home address"],
  location:           ["city", "region", "state", "area", "locale"],
  birthday:           ["birth date", "birthdate", "birth_date", "dob", "date of birth"],
  tags:               ["labels", "categories", "groups", "tag"],
  totalRevenue:       ["revenue", "total revenue", "total_revenue", "lifetime value", "ltv", "income"],
  outstandingBalance: ["balance", "outstanding", "outstanding_balance", "owed", "debt", "amount due"],
  leadStatus:         ["status", "pipeline stage", "pipelinestage", "pipeline_stage", "stage", "lead status", "lead_status"],
  lastContactedDate:  ["last contacted", "lastcontacted", "last_contacted", "last contact", "last_contact_date", "last contacted date"],
  aiNotes:            ["notes", "ai notes", "ai_notes", "comments", "memo"],
  name:               ["full name", "fullname", "full_name", "contact name", "contactname"],
  aliases:            ["alias", "aka", "also known as", "nicknames", "nickname"],
  jobTitle:           ["title", "job title", "job_title", "position", "designation", "organization title", "organisation title"],
  role:               ["role", "roles", "participant role", "contact role"],
  department:         ["dept", "division", "team", "unit", "service", "services", "program", "program type"],
  industry:           ["sector", "vertical", "market"],
  website:            ["web", "url", "site", "webpage", "homepage"],
  linkedinUrl:        ["linkedin", "linkedin url", "linkedin_url", "linked in"],
  twitterHandle:      ["twitter", "x", "twitter handle", "twitter_handle"],
  instagramHandle:    ["instagram", "ig", "instagram_handle", "insta"],
  facebookUrl:        ["facebook", "fb", "facebook url", "facebook_url"],
  leadSource:         ["source", "lead source", "lead_source", "acquisition", "channel"],
  dealValue:          ["deal", "opportunity", "deal value", "deal_value", "opp value"],
  assignedTo:         ["owner", "rep", "salesperson", "sales rep", "assigned", "assigned to"],
  referredBy:         ["referral", "referred by", "referred_by", "referrer"],
  mobilePhone:        ["mobile", "mobile phone", "mobile_phone", "cell phone", "cell_phone"],
  workPhone:          ["work phone", "work_phone", "office phone", "office_phone", "business phone"],
  secondaryEmail:     ["secondary email", "secondary_email", "alternate email", "alt email", "other email"],
  whatsappNumber:     ["whatsapp", "whats app", "wa number"],
  companyWebsite:     ["company website", "company_website", "company url", "business website"],
  annualRevenue:      ["annual revenue", "annual_revenue", "yearly revenue", "company revenue"],
  companySize:        ["company size", "company_size", "employees", "headcount", "team size"],
};

export type MatchResult = "exact" | "fuzzy" | "new";

export interface CSVFieldMatch {
  csvHeader: string;
  matchResult: MatchResult;
  matchedFieldId: string | null;
  matchedFieldLabel: string | null;
  confidence: number; // 0-1
}

/** Normalize a string for comparison */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[_\-\s]+/g, "").trim();
}

/** Simple Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Match a CSV header to the best field in the catalog.
 * Returns exact match, fuzzy match via synonyms, or "new".
 */
export function matchCSVHeader(
  csvHeader: string,
  fields: ContactFieldDef[]
): CSVFieldMatch {
  const headerNorm = normalize(csvHeader);

  // 1. Exact match by field ID
  const exactById = fields.find(f => normalize(f.id) === headerNorm);
  if (exactById) {
    return { csvHeader, matchResult: "exact", matchedFieldId: exactById.id, matchedFieldLabel: exactById.label, confidence: 1 };
  }

  // 2. Exact match by label
  const exactByLabel = fields.find(f => normalize(f.label) === headerNorm);
  if (exactByLabel) {
    return { csvHeader, matchResult: "exact", matchedFieldId: exactByLabel.id, matchedFieldLabel: exactByLabel.label, confidence: 1 };
  }

  // 3. Synonym match
  for (const [fieldId, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    for (const syn of synonyms) {
      if (normalize(syn) === headerNorm) {
        const field = fields.find(f => f.id === fieldId);
        if (field) {
          return { csvHeader, matchResult: "fuzzy", matchedFieldId: field.id, matchedFieldLabel: field.label, confidence: 0.9 };
        }
      }
    }
  }

  // 4. Levenshtein distance match (threshold: <= 2 edits for short names, <= 3 for longer)
  let bestMatch: ContactFieldDef | null = null;
  let bestDist = Infinity;
  for (const field of fields) {
    const dist = Math.min(
      levenshtein(headerNorm, normalize(field.id)),
      levenshtein(headerNorm, normalize(field.label))
    );
    const threshold = headerNorm.length <= 6 ? 2 : 3;
    if (dist <= threshold && dist < bestDist) {
      bestDist = dist;
      bestMatch = field;
    }
  }
  if (bestMatch) {
    const confidence = Math.max(0.5, 1 - bestDist / Math.max(headerNorm.length, 1));
    return { csvHeader, matchResult: "fuzzy", matchedFieldId: bestMatch.id, matchedFieldLabel: bestMatch.label, confidence };
  }

  // 5. No match — this is a new field
  return { csvHeader, matchResult: "new", matchedFieldId: null, matchedFieldLabel: null, confidence: 0 };
}

/**
 * Match all CSV headers against the field catalog.
 * Returns an array of match results.
 */
export function matchAllCSVHeaders(
  csvHeaders: string[],
  fields: ContactFieldDef[]
): CSVFieldMatch[] {
  return csvHeaders.map(h => matchCSVHeader(h, fields));
}

/** Check if any CSV headers need merge attention (not all exact matches) */
export function needsMergeDialog(matches: CSVFieldMatch[]): boolean {
  return matches.some(m => m.matchResult !== "exact");
}
