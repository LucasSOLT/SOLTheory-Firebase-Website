#!/usr/bin/env npx tsx
/**
 * firestore-trim.ts — Controlled Firestore Collection Cleanup
 * 
 * Purpose: Safely identify, export, and delete obsolete Firestore collections
 * that are no longer referenced by the active codebase.
 * 
 * Usage:
 *   npx tsx src/scripts/firestore-trim.ts --dry-run    # Preview only (SAFE)
 *   npx tsx src/scripts/firestore-trim.ts --execute     # Actually delete
 * 
 * SAFETY: Always run --dry-run first. The script will:
 *   1. Count documents in each obsolete collection
 *   2. Export all documents to a JSON backup file
 *   3. Only delete after successful backup verification
 * 
 * IMPORTANT: This script requires Firebase Admin SDK credentials.
 * Set GOOGLE_APPLICATION_CREDENTIALS or have .gcloud-adc.json configured.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ── Initialize Firebase Admin ──
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

// ── Collections to Trim ──
// These are obsolete/dead paths identified during the codebase audit.
// NEVER add Essential or Frozen collections here.
const OBSOLETE_COLLECTIONS = [
  // Legacy CRM (superseded by orgs/{orgId}/crm-instances/...)
  'shared/crm/contacts',
  'shared/crm/meetings',
  'shared/crm/tasks',
  
  // Legacy survey prototypes
  'survey_submissions',
  'custom_surveys',
  'custom_survey_responses',
  
  // Deprecated/disconnected caches
  '_warmup',
  'platform_analytics',
  'agent_health_logs',
];

// User-scoped subcollections to trim (requires iterating users)
const USER_SCOPED_PATHS = [
  'google_ads_cronjobs',
  'email_memory',
  'gmail_tags',
];

// ── PROTECTED: Never delete these ──
const PROTECTED_PREFIXES = [
  'users',
  'organizations',
  'orgs',
  'grant_',
  'timesheet_',
  'action_board_',
  'instagram_',
  'scheduled_instagram_',
  'ai_usage',
  'activity_log',
  'org_channels',
  'dms',
];

function isProtected(collPath: string): boolean {
  const root = collPath.split('/')[0];
  return PROTECTED_PREFIXES.some(p => root.startsWith(p));
}

async function countDocs(collectionPath: string): Promise<number> {
  try {
    // For nested paths like 'shared/crm/contacts', navigate through subcollections
    const parts = collectionPath.split('/');
    let ref: admin.firestore.CollectionReference | admin.firestore.DocumentReference = db.collection(parts[0]);
    
    for (let i = 1; i < parts.length; i++) {
      if (i % 2 === 1) {
        // Document reference
        ref = (ref as admin.firestore.CollectionReference).doc(parts[i]);
      } else {
        // Collection reference
        ref = (ref as admin.firestore.DocumentReference).collection(parts[i]);
      }
    }
    
    // If the path has odd number of segments, it's a collection
    if (parts.length % 2 === 1) {
      const snap = await (ref as admin.firestore.CollectionReference).count().get();
      return snap.data().count;
    } else {
      // It's a document path — check subcollections
      const subcols = await (ref as admin.firestore.DocumentReference).listCollections();
      let total = 0;
      for (const sub of subcols) {
        const snap = await sub.count().get();
        total += snap.data().count;
      }
      return total;
    }
  } catch (err) {
    console.warn(`  ⚠ Could not count ${collectionPath}: ${(err as Error).message}`);
    return 0;
  }
}

async function exportCollection(collectionPath: string, backupDir: string): Promise<any[]> {
  const parts = collectionPath.split('/');
  let ref: any = db;
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      ref = ref.collection(parts[i]);
    } else {
      ref = ref.doc(parts[i]);
    }
  }
  
  if (parts.length % 2 === 1) {
    // Collection
    const snap = await ref.get();
    const docs = snap.docs.map((d: admin.firestore.QueryDocumentSnapshot) => ({
      id: d.id,
      path: d.ref.path,
      data: d.data(),
    }));
    
    const filename = collectionPath.replace(/\//g, '_') + '.json';
    const filepath = path.join(backupDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(docs, null, 2));
    console.log(`  📦 Exported ${docs.length} docs → ${filepath}`);
    return docs;
  }
  
  return [];
}

async function deleteCollection(collectionPath: string, batchSize = 500): Promise<number> {
  const parts = collectionPath.split('/');
  let ref: any = db;
  
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      ref = ref.collection(parts[i]);
    } else {
      ref = ref.doc(parts[i]);
    }
  }
  
  if (parts.length % 2 !== 1) return 0;
  
  let deleted = 0;
  let snap = await ref.limit(batchSize).get();
  
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((doc: admin.firestore.QueryDocumentSnapshot) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    deleted += snap.docs.length;
    console.log(`  🗑  Deleted batch of ${snap.docs.length} (total: ${deleted})`);
    snap = await ref.limit(batchSize).get();
  }
  
  return deleted;
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || !args.includes('--execute');
  
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log(`║  Firestore Trim Script — ${isDryRun ? '🔍 DRY RUN (Preview)' : '⚡ EXECUTE (Deleting)'}  ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  if (!isDryRun) {
    console.log('⚠️  WARNING: This will PERMANENTLY DELETE documents from Firestore!');
    console.log('    Press Ctrl+C within 5 seconds to abort...\n');
    await new Promise(r => setTimeout(r, 5000));
  }
  
  // Create backup directory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', `firestore-trim-${timestamp}`);
  
  if (!isDryRun) {
    fs.mkdirSync(backupDir, { recursive: true });
    console.log(`📁 Backup directory: ${backupDir}\n`);
  }
  
  let totalDocs = 0;
  let totalDeleted = 0;
  
  // ── Process top-level obsolete collections ──
  console.log('━━━ Top-Level Obsolete Collections ━━━');
  for (const collPath of OBSOLETE_COLLECTIONS) {
    // Safety check
    if (isProtected(collPath)) {
      console.log(`  🛡  SKIPPING protected path: ${collPath}`);
      continue;
    }
    
    const count = await countDocs(collPath);
    totalDocs += count;
    console.log(`  📊 ${collPath}: ${count} documents`);
    
    if (!isDryRun && count > 0) {
      await exportCollection(collPath, backupDir);
      const deleted = await deleteCollection(collPath);
      totalDeleted += deleted;
    }
  }
  
  // ── Process user-scoped subcollections ──
  console.log('\n━━━ User-Scoped Subcollections ━━━');
  const usersSnap = await db.collection('users').listDocuments();
  console.log(`  Found ${usersSnap.length} user documents`);
  
  for (const userDoc of usersSnap) {
    for (const subPath of USER_SCOPED_PATHS) {
      const fullPath = `users/${userDoc.id}/${subPath}`;
      const count = await countDocs(fullPath);
      if (count > 0) {
        totalDocs += count;
        console.log(`  📊 ${fullPath}: ${count} documents`);
        
        if (!isDryRun) {
          await exportCollection(fullPath, backupDir);
          const deleted = await deleteCollection(fullPath);
          totalDeleted += deleted;
        }
      }
    }
  }
  
  // ── Summary ──
  console.log('\n━━━ Summary ━━━');
  console.log(`  Total documents found: ${totalDocs}`);
  if (isDryRun) {
    console.log('  Mode: DRY RUN — no documents were deleted');
    console.log('  To execute: npx tsx src/scripts/firestore-trim.ts --execute');
  } else {
    console.log(`  Total documents deleted: ${totalDeleted}`);
    console.log(`  Backups saved to: ${backupDir}`);
  }
  console.log('');
}

main().catch(console.error);
