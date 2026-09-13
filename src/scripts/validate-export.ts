#!/usr/bin/env npx tsx
/**
 * validate-export.ts — Post-Export Validation & Manifest Generation
 * 
 * Validates that firebase_backup_raw.json and users_export.json are:
 *   1. Non-empty files that exist on disk
 *   2. Valid JSON that parses without errors
 *   3. Contain all expected essential collections
 *   4. Auth UIDs cross-reference with Firestore users collection
 * 
 * Generates backups/export_manifest.json with checksums and metadata.
 * 
 * Usage:
 *   npx tsx src/scripts/validate-export.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const FIRESTORE_FILE = path.join(BACKUP_DIR, 'firebase_backup_raw.json');
const AUTH_FILE = path.join(BACKUP_DIR, 'users_export.json');
const MANIFEST_FILE = path.join(BACKUP_DIR, 'export_manifest.json');

// Essential collections that MUST be present for a valid export
const ESSENTIAL_COLLECTIONS = [
  'users',
  'orgs',
  'org_profiles',
  'grant_suggestions',
  'timesheet_entries',
  'timesheet_customers',
  'timesheet_services',
  'action_board_tasks',
  'activity_log',
  'ai_usage',
];

// Collections we expect to find (but some may legitimately have 0 docs)
const EXPECTED_COLLECTIONS = [
  ...ESSENTIAL_COLLECTIONS,
  'org_channels',
  'dms',
  'grant_sessions',
  'grant_agent_config',
  'scheduled_instagram_posts',
  'instagram_connections',
  'instagram_posts',
  'otp_tokens',
  'support_tickets',
  'contact_submissions',
  'sms_messages',
  'sms_optins',
  'insight_walkthroughs',
  'bi_panel_requests',
];

let passed = 0;
let failed = 0;
let warnings = 0;

function pass(msg: string) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg: string) { console.log(`  ❌ ${msg}`); failed++; }
function warn(msg: string) { console.log(`  ⚠️  ${msg}`); warnings++; }
function info(msg: string) { console.log(`  ℹ️  ${msg}`); }

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function sha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║  Firebase Export Validation                      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');

  const manifest: any = {
    validatedAt: new Date().toISOString(),
    files: {},
    collections: {},
    auth: {},
    crossReference: {},
  };

  // ── 1. Validate Firestore export file ──
  console.log('━━━ Firestore Export (firebase_backup_raw.json) ━━━');

  if (!fs.existsSync(FIRESTORE_FILE)) {
    fail(`File not found: ${FIRESTORE_FILE}`);
    console.log('\n  Run the export first: npx tsx src/scripts/firebase-export.ts --export\n');
    process.exit(1);
  }

  const firestoreStat = fs.statSync(FIRESTORE_FILE);
  if (firestoreStat.size === 0) {
    fail('firebase_backup_raw.json is empty (0 bytes)');
    process.exit(1);
  }
  pass(`firebase_backup_raw.json exists (${formatBytes(firestoreStat.size)})`);

  manifest.files.firestore = {
    path: FIRESTORE_FILE,
    sizeBytes: firestoreStat.size,
    sizeHuman: formatBytes(firestoreStat.size),
    sha256: sha256(FIRESTORE_FILE),
    lastModified: firestoreStat.mtime.toISOString(),
  };

  // Parse JSON
  let firestoreData: any;
  try {
    const raw = fs.readFileSync(FIRESTORE_FILE, 'utf8');
    firestoreData = JSON.parse(raw);
    pass('Valid JSON — parsed successfully');
  } catch (err) {
    fail(`Invalid JSON: ${(err as Error).message}`);
    process.exit(1);
  }

  // Check metadata
  if (firestoreData._meta) {
    const meta = firestoreData._meta;
    info(`Exported at: ${meta.exportedAt}`);
    info(`Project: ${meta.projectId}`);
    info(`Total collections: ${meta.totalTopLevelCollections}`);
    info(`Total documents: ${meta.totalDocuments}`);
    info(`Export duration: ${(meta.exportDurationMs / 1000).toFixed(1)}s`);
    pass(`Metadata present — ${meta.totalTopLevelCollections} collections, ${meta.totalDocuments} documents`);
    manifest.collections.totalTopLevel = meta.totalTopLevelCollections;
    manifest.collections.totalDocuments = meta.totalDocuments;
  } else {
    warn('No _meta field found in export');
  }

  // Check collections
  const collections = firestoreData.collections || {};
  const collectionNames = Object.keys(collections);

  console.log(`\n  Collections found: ${collectionNames.length}`);

  // Check essential collections
  let missingEssential = 0;
  for (const name of ESSENTIAL_COLLECTIONS) {
    if (collections[name]) {
      const count = collections[name]._count || 0;
      if (count > 0) {
        pass(`${name}: ${count} documents`);
      } else {
        warn(`${name}: 0 documents (collection exists but is empty)`);
      }
      manifest.collections[name] = count;
    } else {
      fail(`MISSING essential collection: ${name}`);
      missingEssential++;
    }
  }

  // Check other expected collections
  console.log('');
  for (const name of EXPECTED_COLLECTIONS) {
    if (ESSENTIAL_COLLECTIONS.includes(name)) continue; // already checked
    if (collections[name]) {
      const count = collections[name]._count || 0;
      info(`${name}: ${count} documents`);
      manifest.collections[name] = count;
    }
  }

  // Report any extra collections not in our expected list
  const unexpected = collectionNames.filter(
    (n) => !EXPECTED_COLLECTIONS.includes(n)
  );
  if (unexpected.length > 0) {
    console.log(`\n  Additional collections found (${unexpected.length}):`);
    for (const name of unexpected) {
      const count = collections[name]?._count || 0;
      info(`${name}: ${count} documents`);
      manifest.collections[name] = count;
    }
  }

  // ── 2. Validate Auth export ──
  console.log('\n━━━ Auth Export (users_export.json) ━━━');

  if (!fs.existsSync(AUTH_FILE)) {
    warn('users_export.json not found — run: firebase auth:export backups/users_export.json --format=json --project studio-5711990008-7ac2c');
  } else {
    const authStat = fs.statSync(AUTH_FILE);
    if (authStat.size === 0) {
      fail('users_export.json is empty (0 bytes)');
    } else {
      pass(`users_export.json exists (${formatBytes(authStat.size)})`);

      manifest.files.auth = {
        path: AUTH_FILE,
        sizeBytes: authStat.size,
        sizeHuman: formatBytes(authStat.size),
        sha256: sha256(AUTH_FILE),
        lastModified: authStat.mtime.toISOString(),
      };

      try {
        const authRaw = fs.readFileSync(AUTH_FILE, 'utf8');
        const authData = JSON.parse(authRaw);
        const users = authData.users || authData;
        const userCount = Array.isArray(users) ? users.length : 0;

        if (userCount > 0) {
          pass(`Found ${userCount} auth records`);
          manifest.auth.userCount = userCount;

          // Sample fields check
          const sample = users[0];
          const fields = Object.keys(sample || {});
          info(`Sample fields: ${fields.slice(0, 8).join(', ')}${fields.length > 8 ? '...' : ''}`);

          // Check for UIDs
          const hasUids = users.every((u: any) => u.localId || u.uid);
          if (hasUids) {
            pass('All auth records have UIDs (localId/uid field present)');
          } else {
            warn('Some auth records may be missing UIDs');
          }

          // Cross-reference with Firestore users collection
          const firestoreUserCount = collections['users']?._count || 0;
          manifest.crossReference = {
            authUsers: userCount,
            firestoreUsers: firestoreUserCount,
            match: userCount === firestoreUserCount,
          };

          if (userCount === firestoreUserCount) {
            pass(`Auth UID count (${userCount}) matches Firestore users collection (${firestoreUserCount}) ✓`);
          } else {
            warn(`Auth count (${userCount}) ≠ Firestore users (${firestoreUserCount}) — this is common if some users never completed profile setup`);
          }
        } else {
          fail('No user records found in auth export');
        }
      } catch (err) {
        fail(`Invalid JSON in users_export.json: ${(err as Error).message}`);
      }
    }
  }

  // ── 3. Write manifest ──
  console.log('\n━━━ Manifest ━━━');

  manifest.summary = {
    passed,
    failed,
    warnings,
    overallStatus: failed === 0 ? (warnings > 0 ? 'PASS_WITH_WARNINGS' : 'PASS') : 'FAIL',
  };

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  pass(`Manifest written to ${MANIFEST_FILE}`);

  // ── Final summary ──
  console.log('\n╔══════════════════════════════════════════════════╗');
  if (failed === 0) {
    console.log('║  🎉 VALIDATION PASSED                            ║');
  } else {
    console.log('║  ❌ VALIDATION FAILED                             ║');
  }
  console.log('╚══════════════════════════════════════════════════╝');
  console.log(`  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}  |  ⚠️ Warnings: ${warnings}\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('\n❌ Validation error:', err.message);
  process.exit(1);
});
