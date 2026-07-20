/**
 * @file route.ts
 * @description API route to migrate legacy shared CRM data to org-scoped CRM data on the server side.
 * Bypasses Firestore rules and avoids client-side network rate limiting.
 * GET  /api/admin/migrate-crm-scoped?secret=<CRON_SECRET>&orgId=soltheory
 */

import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const CRON_SECRET = process.env.CRON_SECRET || "";

function verifyAuth(req: NextRequest): boolean {
  const fromQuery = req.nextUrl.searchParams.get("secret") || "";
  const authHeader = req.headers.get("authorization");
  const fromHeader = authHeader ? authHeader.replace("Bearer ", "") : "";
  const token = fromQuery || fromHeader;
  if (!CRON_SECRET || !token) return false;

  try {
    const a = Buffer.from(token);
    const b = Buffer.from(CRON_SECRET);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const orgId = req.nextUrl.searchParams.get("orgId") || "soltheory";
  console.log(`[CRM Server Migration] Starting migration from shared/crm to orgs/${orgId}/crm-instances/default...`);

  try {
    await initAdmin();
    const db = getFirestore();
    const BATCH_SIZE = 400;

    // 1. Migrate Contacts
    const sharedContactsRef = db.collection("shared/crm/contacts");
    const sharedContactsSnap = await sharedContactsRef.get();
    let contactsMigrated = 0;

    if (!sharedContactsSnap.empty) {
      console.log(`[CRM Server Migration] Found ${sharedContactsSnap.size} legacy contacts to migrate.`);
      const docs = sharedContactsSnap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach((doc) => {
          const destRef = db.collection(`orgs/${orgId}/crm-instances/default/contacts`).doc(doc.id);
          batch.set(destRef, doc.data(), { merge: true });
          contactsMigrated++;
        });
        await batch.commit();
      }
      console.log(`[CRM Server Migration] Successfully migrated ${contactsMigrated} contacts.`);
    } else {
      console.log("[CRM Server Migration] No legacy contacts found in shared/crm/contacts.");
    }

    // 2. Migrate Meetings
    const sharedMeetingsRef = db.collection("shared/crm/meetings");
    const sharedMeetingsSnap = await sharedMeetingsRef.get();
    let meetingsMigrated = 0;

    if (!sharedMeetingsSnap.empty) {
      console.log(`[CRM Server Migration] Found ${sharedMeetingsSnap.size} legacy meetings to migrate.`);
      const docs = sharedMeetingsSnap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach((doc) => {
          const destRef = db.collection(`orgs/${orgId}/crm-instances/default/meetings`).doc(doc.id);
          batch.set(destRef, doc.data(), { merge: true });
          meetingsMigrated++;
        });
        await batch.commit();
      }
      console.log(`[CRM Server Migration] Successfully migrated ${meetingsMigrated} meetings.`);
    }

    // 3. Migrate Tasks
    const sharedTasksRef = db.collection("shared/crm/tasks");
    const sharedTasksSnap = await sharedTasksRef.get();
    let tasksMigrated = 0;

    if (!sharedTasksSnap.empty) {
      console.log(`[CRM Server Migration] Found ${sharedTasksSnap.size} legacy tasks to migrate.`);
      const docs = sharedTasksSnap.docs;
      for (let i = 0; i < docs.length; i += BATCH_SIZE) {
        const chunk = docs.slice(i, i + BATCH_SIZE);
        const batch = db.batch();
        chunk.forEach((doc) => {
          const destRef = db.collection(`orgs/${orgId}/crm-instances/default/tasks`).doc(doc.id);
          batch.set(destRef, doc.data(), { merge: true });
          tasksMigrated++;
        });
        await batch.commit();
      }
      console.log(`[CRM Server Migration] Successfully migrated ${tasksMigrated} tasks.`);
    }

    return NextResponse.json({
      success: true,
      contactsMigrated,
      meetingsMigrated,
      tasksMigrated,
      message: `Migrated shared CRM to orgs/${orgId} successfully.`,
    });
  } catch (error: any) {
    console.error("[CRM Server Migration] Error:", error);
    return NextResponse.json({ error: error.message || "Migration failed." }, { status: 500 });
  }
}
