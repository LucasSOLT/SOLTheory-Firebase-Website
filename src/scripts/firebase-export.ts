#!/usr/bin/env npx tsx
/**
 * firebase-export.ts — Full Recursive Firestore Export via REST API
 * 
 * Uses the Firebase CLI's stored refresh token to authenticate directly
 * against the Firestore REST API, bypassing Admin SDK credential issues.
 * 
 * Usage:
 *   npx tsx src/scripts/firebase-export.ts --dry-run    # Preview collections & counts
 *   npx tsx src/scripts/firebase-export.ts --export      # Full export to JSON
 * 
 * Output: ./backups/firebase_backup_raw.json
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';

// ── Configuration ──
const PROJECT_ID = 'studio-5711990008-7ac2c';
const OUTPUT_DIR = path.join(process.cwd(), 'backups');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'firebase_backup_raw.json');
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Stats ──
let totalDocuments = 0;
let totalCollections = 0;
const collectionStats: Record<string, number> = {};

// ── Get access token from Firebase CLI's stored refresh token ──
async function getAccessToken(): Promise<string> {
  // Find firebase-tools.json
  const candidates = [
    path.join(process.env.HOME || 'C:\\Users\\lucas', '.config', 'configstore', 'firebase-tools.json'),
    path.join(process.env.APPDATA || '', 'configstore', 'firebase-tools.json'),
  ];
  const configPath = candidates.find(p => fs.existsSync(p));

  if (!configPath) {
    throw new Error('Firebase CLI config not found. Run: firebase login --reauth');
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config?.tokens?.refresh_token;

  if (!refreshToken) {
    throw new Error('No refresh token found in Firebase CLI config. Run: firebase login --reauth');
  }

  // Exchange refresh token for a fresh access token via Google OAuth2
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
      client_secret: 'j9iVZfS8kkCEFUPaAeJV0sAi',
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const tokenData = await tokenResponse.json() as any;
  return tokenData.access_token;
}

// ── Firestore REST API helpers ──
async function firestoreGet(path: string, token: string): Promise<any> {
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Firestore API error (${response.status}): ${err}`);
  }
  return response.json();
}

// List all documents in a collection (paginated)
async function listDocuments(collectionPath: string, token: string): Promise<any[]> {
  const allDocs: any[] = [];
  let pageToken: string | undefined;

  while (true) {
    let url = `${FIRESTORE_BASE}/${collectionPath}?pageSize=300`;
    if (pageToken) url += `&pageToken=${pageToken}`;

    const data = await firestoreGet(url, token);
    const docs = data.documents || [];
    allDocs.push(...docs);

    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
    } else {
      break;
    }
  }

  return allDocs;
}

// List collection IDs under a document (or root)
async function listCollectionIds(documentPath: string | null, token: string): Promise<string[]> {
  const url = documentPath
    ? `${FIRESTORE_BASE}/${documentPath}:listCollectionIds`
    : `${FIRESTORE_BASE}:listCollectionIds`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pageSize: 1000 }),
  });

  if (!response.ok) {
    // 404 = no subcollections, which is fine
    if (response.status === 404) return [];
    const err = await response.text();
    throw new Error(`listCollectionIds error (${response.status}): ${err}`);
  }

  const data = await response.json() as any;
  return data.collectionIds || [];
}

// ── Convert Firestore REST API value format to plain JSON ──
function convertValue(val: any): any {
  if (val === null || val === undefined) return null;

  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return { _type: 'timestamp', iso: val.timestampValue };
  if ('geoPointValue' in val) return { _type: 'geopoint', latitude: val.geoPointValue.latitude, longitude: val.geoPointValue.longitude };
  if ('referenceValue' in val) return { _type: 'ref', path: val.referenceValue };
  if ('bytesValue' in val) return { _type: 'bytes', base64: val.bytesValue };

  if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(convertValue);
  }

  if ('mapValue' in val) {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
      result[k] = convertValue(v);
    }
    return result;
  }

  return val;
}

// Convert a full Firestore document to plain object
function convertDocument(doc: any): Record<string, any> {
  const result: Record<string, any> = {};
  if (doc.fields) {
    for (const [key, val] of Object.entries(doc.fields)) {
      result[key] = convertValue(val);
    }
  }
  return result;
}

// Extract document ID from full resource name
function getDocId(doc: any): string {
  const parts = doc.name.split('/');
  return parts[parts.length - 1];
}

// ── Recursive collection export ──
async function exportCollection(
  collectionPath: string,
  token: string,
  depth: number = 0,
): Promise<{ _count: number; _docs: Record<string, any> }> {
  const indent = '  '.repeat(depth);
  const collName = collectionPath.split('/').pop() || collectionPath;

  // Fetch all documents in this collection
  let docs: any[];
  try {
    docs = await listDocuments(collectionPath, token);
  } catch (err) {
    console.warn(`${indent}⚠ Error reading ${collectionPath}: ${(err as Error).message}`);
    return { _count: 0, _docs: {} };
  }

  const result: Record<string, any> = {};

  for (const doc of docs) {
    const docId = getDocId(doc);
    totalDocuments++;

    const docData: any = {
      _data: convertDocument(doc),
    };

    // Check for subcollections
    const docResourcePath = doc.name.split('/documents/')[1];
    try {
      const subCollIds = await listCollectionIds(docResourcePath, token);
      if (subCollIds.length > 0) {
        docData._subcollections = {};
        for (const subCollId of subCollIds) {
          const subPath = `${docResourcePath}/${subCollId}`;
          const subResult = await exportCollection(subPath, token, depth + 1);
          if (subResult._count > 0) {
            docData._subcollections[subCollId] = subResult;
          }
        }
        if (Object.keys(docData._subcollections).length === 0) {
          delete docData._subcollections;
        }
      }
    } catch {
      // Subcollection discovery failed — skip silently
    }

    result[docId] = docData;
  }

  if (depth === 0) {
    collectionStats[collName] = docs.length;
    console.log(`  📦 ${collName}: ${docs.length} documents`);
  } else if (docs.length > 0) {
    console.log(`${indent}  └─ ${collName}: ${docs.length} docs`);
  }

  return { _count: docs.length, _docs: result };
}

// ── Dry Run ──
async function dryRun(token: string): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Firestore Export — 🔍 DRY RUN (Preview)    ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const collectionIds = await listCollectionIds(null, token);
  console.log(`Found ${collectionIds.length} top-level collections:\n`);

  let grandTotal = 0;

  for (const collId of collectionIds) {
    try {
      const docs = await listDocuments(collId, token);
      grandTotal += docs.length;
      console.log(`  📊 ${collId.padEnd(40)} ${docs.length.toString().padStart(6)} documents`);
    } catch (err) {
      console.log(`  ⚠  ${collId.padEnd(40)}  ERROR: ${(err as Error).message.slice(0, 60)}`);
    }
  }

  console.log(`\n${'─'.repeat(55)}`);
  console.log(`  TOTAL: ${collectionIds.length} collections, ${grandTotal} top-level documents`);
  console.log(`  (Subcollection documents discovered during full export)\n`);
  console.log('  To run full export:');
  console.log('  npx tsx src/scripts/firebase-export.ts --export\n');
}

// ── Full Export ──
async function fullExport(token: string): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  Firestore Export — ⚡ FULL EXPORT           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  const startTime = Date.now();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // Discover top-level collections
  const collectionIds = await listCollectionIds(null, token);
  totalCollections = collectionIds.length;
  console.log(`📂 Discovered ${totalCollections} top-level collections\n`);

  const exportData: Record<string, any> = {};

  for (const collId of collectionIds) {
    const result = await exportCollection(collId, token, 0);
    exportData[collId] = result;
  }

  // Build final output
  const output = {
    _meta: {
      exportedAt: new Date().toISOString(),
      projectId: PROJECT_ID,
      totalTopLevelCollections: totalCollections,
      totalDocuments: totalDocuments,
      collectionStats: collectionStats,
      exportDurationMs: Date.now() - startTime,
    },
    collections: exportData,
  };

  console.log(`\n📝 Writing to ${OUTPUT_FILE}...`);
  const jsonStr = JSON.stringify(output, null, 2);
  fs.writeFileSync(OUTPUT_FILE, jsonStr, 'utf8');

  const fileSizeMB = (Buffer.byteLength(jsonStr) / (1024 * 1024)).toFixed(2);
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n━━━ Export Complete ━━━');
  console.log(`  📁 File: ${OUTPUT_FILE}`);
  console.log(`  📊 Size: ${fileSizeMB} MB`);
  console.log(`  📦 Collections: ${totalCollections}`);
  console.log(`  📄 Documents: ${totalDocuments}`);
  console.log(`  ⏱  Duration: ${durationSec}s`);
  console.log('');
  console.log('  Next: npx tsx src/scripts/validate-export.ts');
  console.log('');
}

// ── Main ──
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExport = args.includes('--export');

  if (!isDryRun && !isExport) {
    console.log('Usage:');
    console.log('  npx tsx src/scripts/firebase-export.ts --dry-run    # Preview collections');
    console.log('  npx tsx src/scripts/firebase-export.ts --export      # Full export');
    process.exit(0);
  }

  console.log('🔐 Authenticating via Firebase CLI refresh token...');
  const token = await getAccessToken();
  console.log('🔐 Authentication successful\n');

  if (isDryRun) {
    await dryRun(token);
  } else {
    await fullExport(token);
  }
}

main().catch((err) => {
  console.error('\n❌ Export failed:', err.message);
  console.error('\nFix: Run `firebase login --reauth` and try again.');
  process.exit(1);
});
