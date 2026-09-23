import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { getStorage } from "firebase-admin/storage";
import { FieldValue } from "firebase-admin/firestore";
import { firebaseConfig } from "@/firebase/config";
import { ADMIN_EMAILS } from "@/lib/admin";
import { isOracle, isOrgAdmin } from "@/lib/org-config";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const { docId, sourceScope, targetScope, orgId } = body;

    if (!docId || typeof docId !== "string") {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }
    if (!["personal", "org"].includes(sourceScope) || !["personal", "org"].includes(targetScope)) {
      return NextResponse.json({ error: "sourceScope and targetScope must be 'personal' or 'org'" }, { status: 400 });
    }
    if (sourceScope === targetScope) {
      return NextResponse.json({ error: "sourceScope and targetScope cannot be identical" }, { status: 400 });
    }
    if (!orgId || typeof orgId !== "string") {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    await initAdmin();
    const db = getAdminFirestore();
    const email = (auth.email || "").toLowerCase();

    // ── RBAC Check ──
    const memberDoc = await db.doc(`orgs/${orgId}/members/${auth.uid}`).get();
    const memberRole = memberDoc.exists ? memberDoc.data()?.role : "user";
    const isAdminUser =
      memberRole === "admin" ||
      memberRole === "oracle" ||
      isOracle(email) ||
      ADMIN_EMAILS.includes(email) ||
      isOrgAdmin(orgId, email);

    if (!isAdminUser) {
      return NextResponse.json(
        { error: "Forbidden — admin access required to move documents to or from Organization AI Brain" },
        { status: 403 }
      );
    }

    // ── Fetch Source Document ──
    const sourceColPath = sourceScope === "personal"
      ? `users/${auth.uid}/ai_brain_docs`
      : `orgs/${orgId}/org_brain_docs`;

    const targetColPath = targetScope === "personal"
      ? `users/${auth.uid}/ai_brain_docs`
      : `orgs/${orgId}/org_brain_docs`;

    const sourceDocRef = db.collection(sourceColPath).doc(docId);
    const sourceDocSnap = await sourceDocRef.get();

    if (!sourceDocSnap.exists) {
      return NextResponse.json(
        { error: `Document ${docId} not found in ${sourceScope} AI Brain` },
        { status: 404 }
      );
    }

    const sourceData = sourceDocSnap.data() || {};
    const fileName = sourceData.name || `doc_${docId}`;

    // ── Move Storage File (if exists) ──
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);
    const oldStoragePath = sourceData.storagePath as string | undefined;
    const newStoragePath = targetScope === "personal"
      ? `ai_brain/${auth.uid}/${docId}/${fileName}`
      : `ai_brain/org/${orgId}/${docId}/${fileName}`;

    let newDownloadUrl = sourceData.downloadUrl || "";

    if (oldStoragePath && oldStoragePath !== newStoragePath) {
      try {
        const sourceFile = bucket.file(oldStoragePath);
        const [exists] = await sourceFile.exists();

        if (exists) {
          const targetFile = bucket.file(newStoragePath);
          await sourceFile.copy(targetFile);

          // Generate new download URL
          try {
            const [signedUrl] = await targetFile.getSignedUrl({
              action: "read",
              expires: "03-01-2030",
            });
            newDownloadUrl = signedUrl;
          } catch {
            newDownloadUrl = `https://storage.googleapis.com/${firebaseConfig.storageBucket}/${encodeURIComponent(newStoragePath)}`;
          }

          // Delete source file
          await sourceFile.delete().catch((delErr) => {
            console.warn("[AI Brain Move] Could not delete old storage file (non-fatal):", delErr.message);
          });
        }
      } catch (storageErr: any) {
        console.warn("[AI Brain Move] Storage move encountered warning (continuing):", storageErr.message);
      }
    }

    // ── Move Vector Embeddings ──
    const sourceVectorColPath = sourceScope === "personal"
      ? `users/${auth.uid}/ai_brain_vectors`
      : `orgs/${orgId}/kb_vectors`;

    const targetVectorColPath = targetScope === "personal"
      ? `users/${auth.uid}/ai_brain_vectors`
      : `orgs/${orgId}/kb_vectors`;

    try {
      const vectorSnap = await db.collection(sourceVectorColPath).where("docId", "==", docId).get();
      if (!vectorSnap.empty) {
        const batchPromises: Promise<any>[] = [];
        vectorSnap.docs.forEach((vDoc) => {
          const vData = vDoc.data();
          const newVectorData: Record<string, any> = {
            ...vData,
            createdAt: vData.createdAt || FieldValue.serverTimestamp(),
          };

          if (targetScope === "org") {
            delete newVectorData.userId;
            newVectorData.orgId = orgId;
          } else {
            delete newVectorData.orgId;
            newVectorData.userId = auth.uid;
          }

          batchPromises.push(db.collection(targetVectorColPath).add(newVectorData));
          batchPromises.push(vDoc.ref.delete());
        });

        await Promise.all(batchPromises);
        console.log(`[AI Brain Move] Moved ${vectorSnap.size} vector chunks from ${sourceVectorColPath} to ${targetVectorColPath}`);
      }
    } catch (vecErr: any) {
      console.warn("[AI Brain Move] Vector chunk move failed (non-fatal):", vecErr.message);
    }

    // ── Create Target Document Metadata ──
    const targetDocData: Record<string, any> = {
      ...sourceData,
      id: docId,
      storagePath: newStoragePath,
      downloadUrl: newDownloadUrl,
      movedFrom: sourceScope,
      movedBy: auth.uid,
      movedByEmail: auth.email,
      movedAt: FieldValue.serverTimestamp(),
    };

    if (targetScope === "org") {
      targetDocData.orgId = orgId;
    } else {
      delete targetDocData.orgId;
    }

    await db.collection(targetColPath).doc(docId).set(targetDocData);

    // ── Delete Source Document ──
    await sourceDocRef.delete();

    console.log(`[AI Brain Move] Successfully moved "${fileName}" (${docId}) from ${sourceScope} to ${targetScope}`);

    return NextResponse.json({
      success: true,
      docId,
      name: fileName,
      sourceScope,
      targetScope,
      doc: {
        ...targetDocData,
        createdAt: sourceData.createdAt?.toDate?.() || new Date(),
        movedAt: new Date(),
      },
    });
  } catch (error: any) {
    console.error("[AI Brain Move] Error:", error);
    return NextResponse.json(
      { error: "Move failed", details: error.message },
      { status: 500 }
    );
  }
}
