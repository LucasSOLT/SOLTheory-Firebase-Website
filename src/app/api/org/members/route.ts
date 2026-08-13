import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";

export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { orgId, targetUid } = body;
    
    if (!orgId || !targetUid) {
      return NextResponse.json({ error: "orgId and targetUid are required" }, { status: 400 });
    }

    // Verify requesting user is admin
    const auth = await verifyRole(req, orgId, 'admin');

    if (auth.uid === targetUid) {
      return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
    }

    await initAdmin();
    const db = getFirestore();
    const targetDoc = await db.doc(`orgs/${orgId}/members/${targetUid}`).get();

    if (!targetDoc.exists) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const targetRole = targetDoc.data()?.role;
    if (targetRole === 'owner') {
      return NextResponse.json({ error: "Cannot remove an owner" }, { status: 403 });
    }

    await db.doc(`orgs/${orgId}/members/${targetUid}`).delete();

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message.includes('Insufficient permissions') || err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("[API/org/members] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
