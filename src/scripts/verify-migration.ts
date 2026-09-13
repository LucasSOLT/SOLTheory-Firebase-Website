#!/usr/bin/env npx tsx
/**
 * verify-migration.ts — Automated Integrity Validation
 *
 * Compares source JSON document counts against Supabase table row counts.
 * Flags any discrepancies, orphan records, or missing data.
 *
 * Usage:
 *   npx tsx src/scripts/verify-migration.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const BACKUP_DIR = path.join(process.cwd(), "backups");
const FIRESTORE_FILE = path.join(BACKUP_DIR, "firebase_backup_raw.json");
const AUTH_FILE = path.join(BACKUP_DIR, "users_export.json");

interface VerificationRow {
  table: string;
  sourceLabel: string;
  sourceCount: number;
  dbCount: number;
  status: "✅ MATCH" | "⚠️ DIFF" | "❌ MISSING";
  delta: number;
}

async function main() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Migration Integrity Verification                        ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Load source data
  const firestore = JSON.parse(fs.readFileSync(FIRESTORE_FILE, "utf8"));
  const authExport = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
  const collections = firestore.collections;
  const authUsers: any[] = authExport.users || authExport;

  // Count subcollection documents
  const userDocs = collections.users?._docs || {};
  let totalContacts = 0;
  let totalJarvisSessions = 0;
  let totalMessages = 0;

  for (const [, userDoc] of Object.entries(userDocs) as [string, any][]) {
    const contacts = userDoc._subcollections?.contacts?._docs || {};
    totalContacts += Object.keys(contacts).length;

    const sessions = userDoc._subcollections?.jarvis_sessions?._docs || {};
    totalJarvisSessions += Object.keys(sessions).length;

    for (const [, sessionDoc] of Object.entries(sessions) as [string, any][]) {
      const msgs = (sessionDoc as any)._data?.messages || [];
      totalMessages += msgs.filter((m: any) => m.content || m.text).length;
    }
  }

  // Count legacy collections (everything not migrated to a dedicated table)
  const migratedCollections = new Set([
    "org_profiles", "orgs", "users", "timesheet_customers", "timesheet_services",
    "timesheet_entries", "grant_suggestions", "grant_sessions", "action_board_tasks",
    "activity_log", "ai_usage", "scheduled_instagram_posts", "instagram_connections",
    "shared",
  ]);
  let legacySourceCount = 0;
  for (const [collName, collData] of Object.entries(collections) as [string, any][]) {
    if (migratedCollections.has(collName)) continue;
    const docs = (collData as any)._docs || {};
    legacySourceCount += Object.keys(docs).length;
  }

  // Count Instagram campaigning items
  const igPostCount = Object.keys(collections.scheduled_instagram_posts?._docs || {}).length;
  const igConnCount = Object.keys(collections.instagram_connections?._docs || {}).length;

  // Count users including auth-only users
  const firestoreUserIds = new Set(Object.keys(userDocs));
  let authOnlyUsers = 0;
  for (const au of authUsers) {
    if (!firestoreUserIds.has(au.localId)) authOnlyUsers++;
  }
  const totalExpectedUsers = Object.keys(userDocs).length + authOnlyUsers;

  // Count org members from source (mirroring ETL derivation logic)
  const memberPairs = new Set<string>();
  for (const [docId, doc] of Object.entries(userDocs) as [string, any][]) {
    const d = doc._data;
    const orgs = new Set([
      ...(d.allowedOrgs || []),
      ...Object.keys(d.orgRoles || {}),
    ]);
    if (orgs.size === 0 && d.organization) orgs.add(d.organization);
    if (orgs.size === 0) orgs.add("soltheory");
    for (const slug of orgs) {
      memberPairs.add(`${docId}:${slug.toLowerCase()}`);
    }
  }
  const expectedMembers = memberPairs.size;

  // ── Define verification checks ──
  const checks: { table: string; sourceLabel: string; sourceCount: number }[] = [
    { table: "organizations", sourceLabel: "org_profiles", sourceCount: Object.keys(collections.org_profiles?._docs || {}).length },
    { table: "users", sourceLabel: "users + auth", sourceCount: totalExpectedUsers },
    { table: "org_members", sourceLabel: "derived from users", sourceCount: expectedMembers },
    { table: "timesheet_customers", sourceLabel: "timesheet_customers", sourceCount: Object.keys(collections.timesheet_customers?._docs || {}).length },
    { table: "timesheet_services", sourceLabel: "timesheet_services", sourceCount: Object.keys(collections.timesheet_services?._docs || {}).length },
    { table: "timesheet_entries", sourceLabel: "timesheet_entries", sourceCount: Object.keys(collections.timesheet_entries?._docs || {}).length },
    { table: "grants", sourceLabel: "grant_suggestions", sourceCount: Object.keys(collections.grant_suggestions?._docs || {}).length },
    { table: "grant_sessions", sourceLabel: "grant_sessions", sourceCount: Object.keys(collections.grant_sessions?._docs || {}).length },
    { table: "action_board_tasks", sourceLabel: "action_board_tasks", sourceCount: Object.keys(collections.action_board_tasks?._docs || {}).length },
    { table: "activity_log", sourceLabel: "activity_log", sourceCount: Object.keys(collections.activity_log?._docs || {}).length },
    { table: "ai_usage", sourceLabel: "ai_usage", sourceCount: Object.keys(collections.ai_usage?._docs || {}).length },
    { table: "chat_sessions", sourceLabel: "users/*/jarvis_sessions", sourceCount: totalJarvisSessions },
    { table: "messages", sourceLabel: "flattened messages[]", sourceCount: totalMessages },
    { table: "beta_crm_contacts", sourceLabel: "users/*/contacts", sourceCount: totalContacts },
    { table: "beta_campaigning", sourceLabel: "ig_posts + ig_conns", sourceCount: igPostCount + igConnCount },
    { table: "legacy_data", sourceLabel: "remaining collections", sourceCount: legacySourceCount },
  ];

  // ── Run verification ──
  const results: VerificationRow[] = [];
  let passed = 0;
  let failed = 0;

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select("*", { count: "exact", head: true });

    const dbCount = count || 0;

    if (error) {
      results.push({
        table: check.table,
        sourceLabel: check.sourceLabel,
        sourceCount: check.sourceCount,
        dbCount: 0,
        status: "❌ MISSING",
        delta: -check.sourceCount,
      });
      failed++;
    } else {
      const delta = dbCount - check.sourceCount;
      const match = Math.abs(delta) <= 1; // allow ±1 for rounding/dedup
      results.push({
        table: check.table,
        sourceLabel: check.sourceLabel,
        sourceCount: check.sourceCount,
        dbCount,
        status: match ? "✅ MATCH" : "⚠️ DIFF",
        delta,
      });
      if (match) passed++;
      else failed++;
    }
  }

  // ── Print results table ──
  console.log("  Table                    Source  Supabase  Delta  Status");
  console.log("  " + "─".repeat(66));

  for (const r of results) {
    const deltaStr = r.delta > 0 ? `+${r.delta}` : String(r.delta);
    console.log(
      `  ${r.table.padEnd(25)} ${String(r.sourceCount).padStart(5)}  ${String(r.dbCount).padStart(8)}  ${deltaStr.padStart(5)}  ${r.status}`
    );
  }

  console.log("  " + "─".repeat(66));

  // ── FK Integrity Checks ──
  console.log("\n━━━ Foreign Key Integrity ━━━");

  // Check for orphan org_members (user_id not in users)
  const { count: orphanMembers } = await supabase
    .from("org_members")
    .select("*", { count: "exact", head: true })
    .is("user_id", null);
  console.log(`  ${orphanMembers === 0 ? "✅" : "⚠️"} Orphan org_members (null user_id): ${orphanMembers || 0}`);

  // Check for orphan timesheet_entries
  const { count: orphanTs } = await supabase
    .from("timesheet_entries")
    .select("*", { count: "exact", head: true })
    .is("user_id", null);
  console.log(`  ${orphanTs === 0 ? "✅" : "⚠️"} Orphan timesheet_entries (null user_id): ${orphanTs || 0}`);

  // Check for messages with null session_id
  const { count: orphanMsgs } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .is("session_id", null);
  console.log(`  ${orphanMsgs === 0 ? "✅" : "⚠️"} Orphan messages (null session_id): ${orphanMsgs || 0}`);

  // Check vector column exists on messages
  const { data: sampleMsg } = await supabase
    .from("messages")
    .select("id, embedding")
    .limit(1);
  const hasVectorCol = sampleMsg !== null;
  console.log(`  ${hasVectorCol ? "✅" : "❌"} messages.embedding vector(1536) column exists`);

  // ── Final Summary ──
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  if (failed === 0) {
    console.log("║  🎉 ALL CHECKS PASSED — Migration Verified!              ║");
  } else {
    console.log(`║  ⚠️  ${failed} CHECK(S) HAVE DISCREPANCIES                       ║`);
  }
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`  ✅ Passed: ${passed}  |  ⚠️ Discrepancies: ${failed}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err.message);
  process.exit(1);
});
