/**
 * PACT Purge Script — One-time cleanup
 * 
 * Deletes all pact_entries_soltheory and pact_entries_nxtchapter fields
 * from ALL user documents in Firestore.
 * 
 * Usage: npx tsx scripts/purge-pact-entries.ts
 */

const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin with service account
const serviceAccountPath = path.resolve(__dirname, "../firebase-service-account.json");

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  // Fallback: try environment variable
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

const db = admin.firestore();

async function purgeAllPactEntries() {
  console.log("🧹 Starting PACT entry purge across ALL users...\\n");

  const usersSnapshot = await db.collection("users").get();
  console.log(`Found ${usersSnapshot.size} user documents.\\n`);

  let purgedCount = 0;
  let skippedCount = 0;
  const batch = db.batch();
  let batchCount = 0;
  const MAX_BATCH = 400; // Firestore batch limit is 500

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const updates: Record<string, any> = {};

    // Check for any pact_entries_* fields
    for (const key of Object.keys(data)) {
      if (key.startsWith("pact_entries_")) {
        const entries = data[key];
        const count = Array.isArray(entries) ? entries.length : "non-array";
        console.log(`  ✂️  User ${doc.id}: Deleting ${key} (${count} entries)`);
        updates[key] = admin.firestore.FieldValue.delete();
      }
    }

    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      purgedCount++;
      batchCount++;

      // Commit batch if approaching limit
      if (batchCount >= MAX_BATCH) {
        await batch.commit();
        console.log(`\\n  📦 Committed batch of ${batchCount} updates.\\n`);
        batchCount = 0;
      }
    } else {
      skippedCount++;
    }
  }

  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
    console.log(`\\n  📦 Committed final batch of ${batchCount} updates.`);
  }

  console.log(`\\n✅ PACT purge complete!`);
  console.log(`   Purged: ${purgedCount} users`);
  console.log(`   Skipped (no PACT data): ${skippedCount} users`);
  console.log(`   Total: ${usersSnapshot.size} users\\n`);
}

purgeAllPactEntries()
  .then(() => process.exit(0))
  .catch((err: Error) => {
    console.error("❌ PACT purge failed:", err);
    process.exit(1);
  });
