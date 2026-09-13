#!/usr/bin/env npx tsx
/**
 * migrate-firebase-to-supabase.ts — Bulletproof ETL Pipeline
 *
 * Transforms Firebase NoSQL backup into normalized Postgres tables in Supabase.
 * Supports idempotent re-runs via .upsert() with onConflict keys.
 *
 * Usage:
 *   npx tsx src/scripts/migrate-firebase-to-supabase.ts
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

// ── Configuration ──
const BACKUP_DIR = path.join(process.cwd(), "backups");
const FIRESTORE_FILE = path.join(BACKUP_DIR, "firebase_backup_raw.json");
const AUTH_FILE = path.join(BACKUP_DIR, "users_export.json");
const BATCH_SIZE = 500;

// ── Telemetry ──
interface MigrationStats {
  table: string;
  source: number;
  inserted: number;
  errors: number;
  duration: number;
}
const stats: MigrationStats[] = [];
const errors: { table: string; docId: string; error: string }[] = [];

// ── ID & Value Mappings (Firebase string IDs → Postgres UUIDs) ──
const orgSlugToId = new Map<string, string>();
const firebaseUidToId = new Map<string, string>();
const emailToUserId = new Map<string, string>();
const tsCustomerFirebaseToId = new Map<string, string>();
const tsCustomerNameToId = new Map<string, string>();
const tsServiceFirebaseToId = new Map<string, string>();
const tsServiceNameToId = new Map<string, string>();

let defaultAdminUserId: string | null = null;
let defaultOrgId: string | null = null;

// ── Helpers ──

function parseTimestamp(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    if (/^\d{10,13}$/.test(val)) {
      return new Date(parseInt(val)).toISOString();
    }
    return val;
  }
  if (val?._type === "timestamp" && val?.iso) return val.iso;
  if (val?.seconds) return new Date(val.seconds * 1000).toISOString();
  return null;
}

function parseDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val.slice(0, 10);
    return null;
  }
  if (val?._type === "timestamp" && val?.iso) {
    return val.iso.slice(0, 10);
  }
  return null;
}

function normalizeRole(role: string | undefined | null): string {
  const r = (role || "").toLowerCase().trim();
  if (r === "owner" || r === "admin") return "admin";
  if (r === "manager") return "manager";
  if (r === "viewer") return "viewer";
  return "member"; // maps 'user', 'member', etc.
}

function resolveOrgId(orgSlug: string | undefined | null): string | null {
  if (!orgSlug) return defaultOrgId;
  const clean = orgSlug.toLowerCase().trim().replace(/\.(com|org|net)$/, "");
  return orgSlugToId.get(clean) || orgSlugToId.get("soltheory") || defaultOrgId;
}

function resolveUserId(firebaseUid: string | undefined | null): string | null {
  if (!firebaseUid) return null;
  return firebaseUidToId.get(firebaseUid) || null;
}

async function batchUpsert(
  supabase: SupabaseClient,
  table: string,
  rows: any[],
  onConflict: string,
): Promise<{ inserted: number; errored: number }> {
  let inserted = 0;
  let errored = 0;

  if (rows.length === 0) {
    return { inserted: 0, errored: 0 };
  }

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    const { error } = await supabase
      .from(table)
      .upsert(batch, { onConflict, ignoreDuplicates: false });

    if (error) {
      // Try individual inserts to identify exact failing rows
      for (const row of batch) {
        const { error: rowErr } = await supabase
          .from(table)
          .upsert(row, { onConflict, ignoreDuplicates: false });
        if (rowErr) {
          errored++;
          const docId = row.firebase_doc_id || row.firebase_uid || row.id || "unknown";
          errors.push({ table, docId, error: rowErr.message });
        } else {
          inserted++;
        }
      }
    } else {
      inserted += batch.length;
    }

    process.stdout.write(
      `  ⏳ ${table}: batch ${batchNum}/${totalBatches} (${inserted} ok, ${errored} err)\r`
    );
  }

  process.stdout.write("\n");
  return { inserted, errored };
}

function trackStats(table: string, source: number, inserted: number, errored: number, startMs: number) {
  const stat: MigrationStats = {
    table,
    source,
    inserted,
    errors: errored,
    duration: Date.now() - startMs,
  };
  stats.push(stat);
  const icon = errored === 0 ? "✅" : "⚠️";
  console.log(
    `  ${icon} ${table}: ${inserted}/${source} rows (${errored} errors, ${stat.duration}ms)`
  );
}

// ── Main Migration ──

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Firebase → Supabase ETL Migration                      ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  if (!fs.existsSync(FIRESTORE_FILE) || !fs.existsSync(AUTH_FILE)) {
    console.error("❌ Backup files not found. Run the Firebase export first.");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Check if schema exists ──
  console.log("━━━ Step 0: Schema Check ━━━");
  const { error: schemaCheck } = await supabase.from("organizations").select("id").limit(1);
  if (schemaCheck?.code === "42P01") {
    console.error("❌ Tables do not exist yet! Run supabase-schema.sql in Supabase SQL editor first.");
    process.exit(1);
  }
  console.log("  ✅ Schema detected — tables exist\n");

  // ── Load source data ──
  console.log("━━━ Step 1: Loading Source Data ━━━");
  const firestore = JSON.parse(fs.readFileSync(FIRESTORE_FILE, "utf8"));
  const authExport = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const collections = firestore.collections;
  const authUsers: any[] = authExport.users || authExport;
  console.log(`  📦 Firestore: ${firestore._meta.totalDocuments} documents across ${firestore._meta.totalTopLevelCollections} collections`);
  console.log(`  👤 Auth: ${authUsers.length} user accounts\n`);

  const authByUid = new Map<string, any>();
  for (const u of authUsers) {
    authByUid.set(u.localId, u);
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Organizations
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 1: Organizations ━━━");
  let start = Date.now();

  const orgDocs = collections.org_profiles?._docs || {};
  const orgRows: any[] = [];

  for (const [docId, doc] of Object.entries(orgDocs) as [string, any][]) {
    const d = doc._data;
    orgRows.push({
      slug: docId.toLowerCase(),
      company_name: d.companyName || docId,
      email: d.email || null,
      phone: d.phone || null,
      address: d.address || null,
      website: d.website || null,
      branding: d.branding || {},
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }

  if (!orgRows.find((r) => r.slug === "soltheory")) {
    orgRows.push({
      slug: "soltheory",
      company_name: "SOL Theory",
      created_at: new Date().toISOString(),
    });
  }

  const { inserted: orgInserted, errored: orgErr } = await batchUpsert(supabase, "organizations", orgRows, "slug");
  trackStats("organizations", orgRows.length, orgInserted, orgErr, start);

  const { data: orgData } = await supabase.from("organizations").select("id, slug");
  for (const org of orgData || []) {
    orgSlugToId.set(org.slug.toLowerCase(), org.id);
  }
  defaultOrgId = orgSlugToId.get("soltheory") || (orgData?.[0]?.id ?? null);
  console.log(`  🗺️  Org map: ${orgSlugToId.size} entries (default: ${defaultOrgId})\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Users
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 2: Users ━━━");
  start = Date.now();

  const userDocs = collections.users?._docs || {};
  const userRows: any[] = [];

  for (const [docId, doc] of Object.entries(userDocs) as [string, any][]) {
    const d = doc._data;
    const authRecord = authByUid.get(docId);

    userRows.push({
      firebase_uid: docId,
      email: d.email || authRecord?.email || null,
      display_name: d.displayName || authRecord?.displayName || null,
      first_name: d.firstName || null,
      last_name: d.lastName || null,
      bio: d.bio || null,
      location: d.location || null,
      access_level: d.accesslevel || d.accessLevel || "User-Level",
      twilio_phone_number: d.twilioPhoneNumber || null,
      walkthrough_completed: d.walkthroughCompleted || false,
      email_verified: authRecord?.emailVerified || false,
      disabled: authRecord?.disabled || false,
      raw_firebase_auth: authRecord || null,
      raw_firebase_profile: d,
      last_login: parseTimestamp(d.lastLogin) ||
        (authRecord?.lastSignedInAt ? new Date(parseInt(authRecord.lastSignedInAt)).toISOString() : null),
      created_at: authRecord?.createdAt
        ? new Date(parseInt(authRecord.createdAt)).toISOString()
        : parseTimestamp(d.createdAt) || new Date().toISOString(),
      updated_at: parseTimestamp(d.updatedAt) || new Date().toISOString(),
    });
  }

  for (const au of authUsers) {
    if (!userDocs[au.localId]) {
      userRows.push({
        firebase_uid: au.localId,
        email: au.email,
        display_name: au.displayName || null,
        email_verified: au.emailVerified || false,
        disabled: au.disabled || false,
        raw_firebase_auth: au,
        created_at: au.createdAt ? new Date(parseInt(au.createdAt)).toISOString() : new Date().toISOString(),
      });
    }
  }

  const { inserted: userInserted, errored: userErr } = await batchUpsert(supabase, "users", userRows, "firebase_uid");
  trackStats("users", userRows.length, userInserted, userErr, start);

  const { data: userData } = await supabase.from("users").select("id, firebase_uid, email");
  for (const u of userData || []) {
    firebaseUidToId.set(u.firebase_uid, u.id);
    if (u.email) {
      emailToUserId.set(u.email.toLowerCase(), u.id);
      if (u.email.toLowerCase().includes("lucas") || u.email.toLowerCase().includes("soltheory")) {
        defaultAdminUserId = u.id;
      }
    }
  }
  if (!defaultAdminUserId && (userData?.length ?? 0) > 0) {
    defaultAdminUserId = userData![0].id;
  }
  console.log(`  🗺️  User map: ${firebaseUidToId.size} entries (admin: ${defaultAdminUserId})\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Org Members
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 3: Org Members ━━━");
  start = Date.now();

  const memberRows: any[] = [];
  for (const [docId, doc] of Object.entries(userDocs) as [string, any][]) {
    const d = doc._data;
    const userId = resolveUserId(docId);
    if (!userId) continue;

    const allowedOrgs: string[] = d.allowedOrgs || [];
    const orgRoles: Record<string, string> = d.orgRoles || {};

    const orgSlugs = new Set([...allowedOrgs, ...Object.keys(orgRoles)]);
    if (orgSlugs.size === 0 && d.organization) orgSlugs.add(d.organization);
    if (orgSlugs.size === 0) orgSlugs.add("soltheory");

    for (const slug of orgSlugs) {
      const orgId = resolveOrgId(slug);
      if (!orgId) continue;
      memberRows.push({
        user_id: userId,
        org_id: orgId,
        role: normalizeRole(orgRoles[slug] || (d.accesslevel?.includes("Admin") ? "admin" : "member")),
      });
    }
  }

  const memberKey = (r: any) => `${r.user_id}:${r.org_id}`;
  const seenMembers = new Set<string>();
  const dedupedMembers = memberRows.filter((r) => {
    const k = memberKey(r);
    if (seenMembers.has(k)) return false;
    seenMembers.add(k);
    return true;
  });

  const { inserted: memInserted, errored: memErr } = await batchUpsert(
    supabase, "org_members", dedupedMembers, "user_id,org_id"
  );
  trackStats("org_members", dedupedMembers.length, memInserted, memErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 4: Timesheets
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 4: Timesheets ━━━");

  // 4a. Customers
  start = Date.now();
  const tsCustDocs = collections.timesheet_customers?._docs || {};
  const tsCustRows: any[] = [];
  for (const [docId, doc] of Object.entries(tsCustDocs) as [string, any][]) {
    const d = doc._data;
    tsCustRows.push({
      firebase_doc_id: docId,
      org_id: resolveOrgId(d.orgDomain || d.organization),
      name: d.name || "Unknown",
      rate: d.rate || null,
      status: d.status || "active",
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }
  const { inserted: tcIns, errored: tcErr } = await batchUpsert(supabase, "timesheet_customers", tsCustRows, "firebase_doc_id");
  trackStats("timesheet_customers", tsCustRows.length, tcIns, tcErr, start);

  const { data: tcData } = await supabase.from("timesheet_customers").select("id, firebase_doc_id, name");
  for (const tc of tcData || []) {
    if (tc.firebase_doc_id) tsCustomerFirebaseToId.set(tc.firebase_doc_id, tc.id);
    if (tc.name) tsCustomerNameToId.set(tc.name.toLowerCase().trim(), tc.id);
  }

  // 4b. Services
  start = Date.now();
  const tsSvcDocs = collections.timesheet_services?._docs || {};
  const tsSvcRows: any[] = [];
  for (const [docId, doc] of Object.entries(tsSvcDocs) as [string, any][]) {
    const d = doc._data;
    tsSvcRows.push({
      firebase_doc_id: docId,
      org_id: resolveOrgId(d.orgDomain || d.organization),
      name: d.name || "Unknown",
      default_rate: d.defaultRate || null,
      active: d.active !== false,
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }
  const { inserted: tsIns, errored: tsErr } = await batchUpsert(supabase, "timesheet_services", tsSvcRows, "firebase_doc_id");
  trackStats("timesheet_services", tsSvcRows.length, tsIns, tsErr, start);

  const { data: tsData } = await supabase.from("timesheet_services").select("id, firebase_doc_id, name");
  for (const ts of tsData || []) {
    if (ts.firebase_doc_id) tsServiceFirebaseToId.set(ts.firebase_doc_id, ts.id);
    if (ts.name) tsServiceNameToId.set(ts.name.toLowerCase().trim(), ts.id);
  }

  // 4c. Entries
  start = Date.now();
  const tsEntryDocs = collections.timesheet_entries?._docs || {};
  const tsEntryRows: any[] = [];
  for (const [docId, doc] of Object.entries(tsEntryDocs) as [string, any][]) {
    const d = doc._data;
    const userId =
      resolveUserId(d.userId) ||
      (d.userEmail ? emailToUserId.get(d.userEmail.toLowerCase()) : null) ||
      (d.createdBy ? emailToUserId.get(d.createdBy.toLowerCase()) : null) ||
      defaultAdminUserId;

    if (!userId) continue;

    const customerId =
      (d.customerId ? tsCustomerFirebaseToId.get(d.customerId) : null) ||
      (d.customerName ? tsCustomerNameToId.get(d.customerName.toLowerCase().trim()) : null) ||
      null;

    const serviceId =
      (d.serviceId ? tsServiceFirebaseToId.get(d.serviceId) : null) ||
      (d.serviceName ? tsServiceNameToId.get(d.serviceName.toLowerCase().trim()) : null) ||
      null;

    const duration =
      d.durationHours != null
        ? Number(d.durationHours)
        : d.durationMinutes != null
        ? Number((d.durationMinutes / 60).toFixed(2))
        : 0;

    const dateVal =
      parseDate(d.date) ||
      parseDate(d.startDate) ||
      parseDate(d.createdAt) ||
      new Date().toISOString().slice(0, 10);

    tsEntryRows.push({
      firebase_doc_id: docId,
      user_id: userId,
      org_id: resolveOrgId(d.orgDomain || d.organization),
      customer_id: customerId,
      service_id: serviceId,
      date: dateVal,
      duration_hours: duration,
      notes: d.notes || null,
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }
  const { inserted: teIns, errored: teErr } = await batchUpsert(supabase, "timesheet_entries", tsEntryRows, "firebase_doc_id");
  trackStats("timesheet_entries", tsEntryRows.length, teIns, teErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Grants
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 5: Grants ━━━");

  start = Date.now();
  const grantDocs = collections.grant_suggestions?._docs || {};
  const grantRows: any[] = [];
  for (const [docId, doc] of Object.entries(grantDocs) as [string, any][]) {
    const d = doc._data;
    grantRows.push({
      firebase_doc_id: docId,
      org_id: resolveOrgId(d.organization),
      title: d.title || "Untitled Grant",
      grantor: d.grantor || null,
      description: d.description || null,
      funding_amount: typeof d.fundingAmount === "number" ? String(d.fundingAmount) : d.fundingAmount || null,
      match_score: d.matchScore || null,
      deadline: d.deadline || null,
      url: d.url || null,
      status: d.status || "saved",
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }
  const { inserted: gIns, errored: gErr } = await batchUpsert(supabase, "grants", grantRows, "firebase_doc_id");
  trackStats("grants", grantRows.length, gIns, gErr, start);

  // Grant Sessions
  start = Date.now();
  const gSessionDocs = collections.grant_sessions?._docs || {};
  const gSessionRows: any[] = [];
  for (const [docId, doc] of Object.entries(gSessionDocs) as [string, any][]) {
    const d = doc._data;
    const userId = resolveUserId(d.userId) || defaultAdminUserId;
    if (!userId) continue;

    gSessionRows.push({
      firebase_doc_id: docId,
      user_id: userId,
      org_id: resolveOrgId(d.orgId || d.organization),
      status: d.status || "in_progress",
      summary: d.summary || d.name || (d.agents ? "Agent Scan Session" : "Scan Session"),
      created_at:
        parseTimestamp(d.createdAt) ||
        parseTimestamp(d.lastScanTimes?.agent_1) ||
        parseTimestamp(d.lastScanTimes?.agent_2) ||
        new Date().toISOString(),
    });
  }
  const { inserted: gsIns, errored: gsErr } = await batchUpsert(supabase, "grant_sessions", gSessionRows, "firebase_doc_id");
  trackStats("grant_sessions", gSessionRows.length, gsIns, gsErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 6: Action Board / Activity Log / AI Usage
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 6: Action Board / Activity / AI Usage ━━━");

  start = Date.now();
  const abDocs = collections.action_board_tasks?._docs || {};
  const abRows: any[] = [];
  for (const [docId, doc] of Object.entries(abDocs) as [string, any][]) {
    const d = doc._data;
    abRows.push({
      firebase_doc_id: docId,
      org_id: resolveOrgId(d.organization),
      title: d.title || "Untitled",
      description: d.description || null,
      assigned_to: d.assignedTo || null,
      status: d.status || "todo",
      priority: d.priority || "medium",
      due_date: parseDate(d.dueDate),
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
      updated_at: parseTimestamp(d.updatedAt) || new Date().toISOString(),
    });
  }
  const { inserted: abIns, errored: abErr } = await batchUpsert(supabase, "action_board_tasks", abRows, "firebase_doc_id");
  trackStats("action_board_tasks", abRows.length, abIns, abErr, start);

  // Activity Log
  start = Date.now();
  const alDocs = collections.activity_log?._docs || {};
  const alRows: any[] = [];
  for (const [docId, doc] of Object.entries(alDocs) as [string, any][]) {
    const d = doc._data;
    alRows.push({
      firebase_doc_id: docId,
      user_id: resolveUserId(d.userId) || null,
      org_id: resolveOrgId(d.organization),
      action: d.action || "unknown",
      user_name: d.userName || null,
      details: d.details || {},
      created_at: parseTimestamp(d.timestamp) || new Date().toISOString(),
    });
  }
  const { inserted: alIns, errored: alErr } = await batchUpsert(supabase, "activity_log", alRows, "firebase_doc_id");
  trackStats("activity_log", alRows.length, alIns, alErr, start);

  // AI Usage
  start = Date.now();
  const auDocs = collections.ai_usage?._docs || {};
  const auRows: any[] = [];
  for (const [docId, doc] of Object.entries(auDocs) as [string, any][]) {
    const d = doc._data;
    auRows.push({
      firebase_doc_id: docId,
      user_id: resolveUserId(d.userId) || null,
      org_id: resolveOrgId(d.organization),
      feature: d.feature || null,
      model: d.model || null,
      prompt_tokens: d.promptTokens || null,
      completion_tokens: d.completionTokens || null,
      total_tokens: d.totalTokens || null,
      cost_estimate: d.costEstimate || null,
      created_at: parseTimestamp(d.timestamp) || new Date().toISOString(),
    });
  }
  const { inserted: auIns, errored: auErr } = await batchUpsert(supabase, "ai_usage", auRows, "firebase_doc_id");
  trackStats("ai_usage", auRows.length, auIns, auErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 7: Chat Sessions & Messages
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 7: Chat Sessions & Messages ━━━");
  start = Date.now();

  const chatSessionRows: any[] = [];
  const messageRows: any[] = [];

  for (const [userId, userDoc] of Object.entries(userDocs) as [string, any][]) {
    const pgUserId = resolveUserId(userId);
    if (!pgUserId) continue;

    const jarvisSessions = userDoc._subcollections?.jarvis_sessions?._docs || {};
    const userProfile = userDoc._data;
    const userOrgId = resolveOrgId(userProfile?.organization) || resolveOrgId(userProfile?.allowedOrgs?.[0]);

    for (const [sessionId, sessionDoc] of Object.entries(jarvisSessions) as [string, any][]) {
      const sd = sessionDoc._data;
      const firebaseDocId = `${userId}__${sessionId}`;

      chatSessionRows.push({
        firebase_doc_id: firebaseDocId,
        user_id: pgUserId,
        org_id: userOrgId,
        session_name: sd.sessionName || null,
        scope: "user" as const,
        token_count: sd.tokenCount || 0,
        created_at: parseTimestamp(sd.createdAt) || new Date().toISOString(),
        updated_at: parseTimestamp(sd.updatedAt) || new Date().toISOString(),
      });

      const msgs = sd.messages || [];
      for (let i = 0; i < msgs.length; i++) {
        const msg = msgs[i];
        if (!msg.content && !msg.text) continue;
        messageRows.push({
          _session_firebase_id: firebaseDocId,
          role: msg.role || "user",
          content: msg.content || msg.text || "",
          tokens: msg.tokens || null,
          metadata: { originalIndex: i, timestamp: msg.timestamp || null },
          created_at: parseTimestamp(msg.timestamp) || parseTimestamp(sd.createdAt) || new Date().toISOString(),
        });
      }
    }
  }

  const { inserted: csIns, errored: csErr } = await batchUpsert(supabase, "chat_sessions", chatSessionRows, "firebase_doc_id");
  trackStats("chat_sessions", chatSessionRows.length, csIns, csErr, start);

  const sessionFirebaseToId = new Map<string, string>();
  const { data: csData } = await supabase.from("chat_sessions").select("id, firebase_doc_id");
  for (const cs of csData || []) {
    if (cs.firebase_doc_id) sessionFirebaseToId.set(cs.firebase_doc_id, cs.id);
  }

  start = Date.now();
  const resolvedMsgRows = messageRows
    .map((m) => {
      const sessionId = sessionFirebaseToId.get(m._session_firebase_id);
      if (!sessionId) return null;
      const { _session_firebase_id, ...rest } = m;
      return { ...rest, session_id: sessionId };
    })
    .filter(Boolean) as any[];

  // Clean wipe session messages before insert for idempotency
  const sessionIds = [...new Set(resolvedMsgRows.map((r) => r.session_id))];
  for (let i = 0; i < sessionIds.length; i += 100) {
    const batch = sessionIds.slice(i, i + 100);
    await supabase.from("messages").delete().in("session_id", batch);
  }

  let msgInserted = 0;
  let msgErrored = 0;
  for (let i = 0; i < resolvedMsgRows.length; i += BATCH_SIZE) {
    const batch = resolvedMsgRows.slice(i, i + BATCH_SIZE);
    const { error: msgErr } = await supabase.from("messages").insert(batch);
    if (msgErr) {
      for (const row of batch) {
        const { error: rowErr } = await supabase.from("messages").insert(row);
        if (rowErr) {
          msgErrored++;
          errors.push({ table: "messages", docId: row.session_id, error: rowErr.message });
        } else {
          msgInserted++;
        }
      }
    } else {
      msgInserted += batch.length;
    }
    process.stdout.write(`  ⏳ messages: ${msgInserted}/${resolvedMsgRows.length}\r`);
  }
  process.stdout.write("\n");
  trackStats("messages", resolvedMsgRows.length, msgInserted, msgErrored, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 8: Beta CRM Contacts
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 8: Beta CRM Contacts ━━━");
  start = Date.now();

  const crmRows: any[] = [];
  for (const [userId, userDoc] of Object.entries(userDocs) as [string, any][]) {
    const pgUserId = resolveUserId(userId);
    if (!pgUserId) continue;

    const contacts = userDoc._subcollections?.contacts?._docs || {};
    const userProfile = userDoc._data;
    const fallbackOrgId =
      resolveOrgId(userProfile?.organization) ||
      resolveOrgId(userProfile?.allowedOrgs?.[0]) ||
      defaultOrgId;

    for (const [contactId, contactDoc] of Object.entries(contacts) as [string, any][]) {
      const d = contactDoc._data;
      const targetOrgId = resolveOrgId(d.organization) || fallbackOrgId;
      if (!targetOrgId) continue;

      crmRows.push({
        firebase_doc_id: `${userId}__${contactId}`,
        user_id: pgUserId,
        org_id: targetOrgId,
        full_name: d.fullName || `${d.firstName || ""} ${d.lastName || ""}`.trim() || null,
        email: d.email || null,
        phone: d.phone || null,
        company: d.company || null,
        job_title: d.jobTitle || null,
        lead_status: d.leadStatus || null,
        deal_value: d.dealValue || null,
        data: d,
        created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
        updated_at: parseTimestamp(d.updatedAt) || new Date().toISOString(),
      });
    }
  }

  const { inserted: crmIns, errored: crmErr } = await batchUpsert(supabase, "beta_crm_contacts", crmRows, "firebase_doc_id");
  trackStats("beta_crm_contacts", crmRows.length, crmIns, crmErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 9: Beta Campaigning
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 9: Beta Campaigning ━━━");
  start = Date.now();

  const campaignRows: any[] = [];

  const igPostDocs = collections.scheduled_instagram_posts?._docs || {};
  for (const [docId, doc] of Object.entries(igPostDocs) as [string, any][]) {
    const d = doc._data;
    campaignRows.push({
      firebase_doc_id: `ig_post__${docId}`,
      org_id: resolveOrgId(d.organization),
      type: "instagram_post",
      status: d.status || null,
      data: d,
      scheduled_at: parseTimestamp(d.scheduledTime) || null,
      created_at: parseTimestamp(d.createdAt) || new Date().toISOString(),
    });
  }

  const igConnDocs = collections.instagram_connections?._docs || {};
  for (const [docId, doc] of Object.entries(igConnDocs) as [string, any][]) {
    const d = doc._data;
    campaignRows.push({
      firebase_doc_id: `ig_conn__${docId}`,
      org_id: resolveOrgId(d.organization || docId),
      type: "instagram_connection",
      status: "connected",
      data: d,
      created_at: parseTimestamp(d.connectedAt) || new Date().toISOString(),
    });
  }

  const { inserted: campIns, errored: campErr } = await batchUpsert(supabase, "beta_campaigning", campaignRows, "firebase_doc_id");
  trackStats("beta_campaigning", campaignRows.length, campIns, campErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // PHASE 10: Legacy Data
  // ══════════════════════════════════════════════════════════════════════════
  console.log("━━━ Phase 10: Legacy Data ━━━");
  start = Date.now();

  const migratedCollections = new Set([
    "org_profiles", "orgs", "users", "timesheet_customers", "timesheet_services",
    "timesheet_entries", "grant_suggestions", "grant_sessions", "action_board_tasks",
    "activity_log", "ai_usage", "scheduled_instagram_posts", "instagram_connections",
    "shared",
  ]);

  const legacyRows: any[] = [];
  for (const [collName, collData] of Object.entries(collections) as [string, any][]) {
    if (migratedCollections.has(collName)) continue;
    const docs = collData._docs || {};
    for (const [docId, doc] of Object.entries(docs) as [string, any][]) {
      legacyRows.push({
        collection_name: collName,
        firebase_doc_id: docId,
        data: doc._data || {},
        created_at: parseTimestamp(doc._data?.createdAt) || parseTimestamp(doc._data?.timestamp) || new Date().toISOString(),
      });
    }
  }

  const { inserted: legIns, errored: legErr } = await batchUpsert(
    supabase, "legacy_data", legacyRows, "collection_name,firebase_doc_id"
  );
  trackStats("legacy_data", legacyRows.length, legIns, legErr, start);
  console.log();

  // ══════════════════════════════════════════════════════════════════════════
  // FINAL REPORT
  // ══════════════════════════════════════════════════════════════════════════
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Migration Complete — Final Report                       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  console.log("  Table                    Source  Loaded  Errors  Time");
  console.log("  " + "─".repeat(60));
  let totalSource = 0;
  let totalLoaded = 0;
  let totalErrors = 0;
  for (const s of stats) {
    totalSource += s.source;
    totalLoaded += s.inserted;
    totalErrors += s.errors;
    console.log(
      `  ${s.table.padEnd(25)} ${String(s.source).padStart(5)}  ${String(s.inserted).padStart(6)}  ${String(s.errors).padStart(6)}  ${s.duration}ms`
    );
  }
  console.log("  " + "─".repeat(60));
  console.log(
    `  ${"TOTAL".padEnd(25)} ${String(totalSource).padStart(5)}  ${String(totalLoaded).padStart(6)}  ${String(totalErrors).padStart(6)}`
  );

  if (errors.length > 0) {
    console.log(`\n  ⚠️  ${errors.length} row-level errors:`);
    for (const e of errors.slice(0, 20)) {
      console.log(`    → ${e.table} [${e.docId}]: ${e.error}`);
    }
    if (errors.length > 20) {
      console.log(`    ... and ${errors.length - 20} more`);
    }
  }

  console.log(`\n  Next: npx tsx src/scripts/verify-migration.ts\n`);

  if (totalErrors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message || err);
  process.exit(1);
});
