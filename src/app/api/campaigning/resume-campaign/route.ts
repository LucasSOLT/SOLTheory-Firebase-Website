/**
 * API route to create a resume campaign from the original.
 * Hit this endpoint locally: GET /api/campaigning/resume-campaign?dryRun=true
 */
import { NextRequest, NextResponse } from "next/server";
import { initAdmin, getFirestore } from "@/firebase/admin";
import { verifyRequest } from "@/lib/api-auth";

const CUTOFF_NAME = "justin";

export async function GET(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;
  const dryRun = req.nextUrl.searchParams.get("dryRun") !== "false";
  
  try {
    initAdmin();
    const db = getFirestore();
    
    // Find the big campaign across all users
    const usersSnap = await db.collection("users").get();
    let ownerUid = "";
    let originalCampaign: any = null;

    for (const userDoc of usersSnap.docs) {
      const campsSnap = await db.collection(`users/${userDoc.id}/campaigns`).get();
      for (const campDoc of campsSnap.docs) {
        const data = campDoc.data();
        if ((data.recipients?.length || 0) > 500) {
          ownerUid = userDoc.id;
          originalCampaign = { ...data, _id: campDoc.id };
          break;
        }
      }
      if (ownerUid) break;
    }

    if (!ownerUid || !originalCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const allRecipients: any[] = originalCampaign.recipients || [];

    // Sort alphabetically (same order as handleSave loop)
    const sorted = [...allRecipients].sort((a, b) => {
      const na = (a.name || a.firstName || a.email || "").toLowerCase();
      const nb = (b.name || b.firstName || b.email || "").toLowerCase();
      return na.localeCompare(nb);
    });

    // Find cutoff
    let cutoff = sorted.length;
    for (let i = 0; i < sorted.length; i++) {
      const n = (sorted[i].name || sorted[i].firstName || sorted[i].email || "").toLowerCase();
      if (n.localeCompare(CUTOFF_NAME) >= 0) { cutoff = i; break; }
    }

    const remaining = sorted.slice(cutoff);
    const triggerAt = "2026-07-07T12:00:00.000Z"; // 6 AM MT
    const newId = `camp-resume-${Date.now()}`;

    const context = {
      around: sorted.slice(Math.max(0, cutoff - 3), cutoff + 5).map((r, i) => ({
        index: Math.max(0, cutoff - 3) + i,
        name: r.name || r.firstName || r.email,
        email: r.email,
        status: (Math.max(0, cutoff - 3) + i) < cutoff ? "SENT" : ((Math.max(0, cutoff - 3) + i) === cutoff ? "CUTOFF" : "REMAINING"),
      })),
    };

    const newCampaign: Record<string, any> = {
      id: newId,
      name: `Resume: NXT Chapter Grand Opening (${remaining.length} remaining)`,
      subject: originalCampaign.subject,
      body: originalCampaign.body || "",
      recipients: remaining,
      status: "active",
      triggerAt,
      createdAt: new Date().toISOString(),
      sent: 0,
      repeatDays: 0,
    };
    if (originalCampaign.htmlContent) newCampaign.htmlContent = originalCampaign.htmlContent;
    if (originalCampaign.senderName) newCampaign.senderName = originalCampaign.senderName;
    if (originalCampaign.senderEmail) newCampaign.senderEmail = originalCampaign.senderEmail;
    if (originalCampaign.channel) newCampaign.channel = originalCampaign.channel;

    if (dryRun) {
      return NextResponse.json({
        status: "DRY_RUN",
        originalCampaign: originalCampaign.name,
        originalRecipients: allRecipients.length,
        cutoffIndex: cutoff,
        cutoffContext: context,
        remainingCount: remaining.length,
        firstFive: remaining.slice(0, 5).map(r => ({ name: r.name || r.firstName, email: r.email })),
        lastFive: remaining.slice(-5).map(r => ({ name: r.name || r.firstName, email: r.email })),
        newCampaignName: newCampaign.name,
        triggerAt: "6:00 AM MT tomorrow (2026-07-07)",
        message: "Add ?dryRun=false to create the campaign",
      });
    }

    // Create the campaign
    await db.doc(`users/${ownerUid}/campaigns/${newId}`).set(newCampaign);

    return NextResponse.json({
      status: "CREATED",
      campaignId: newId,
      name: newCampaign.name,
      recipients: remaining.length,
      triggerAt: "6:00 AM MT tomorrow",
      message: "Campaign created! Check Josie's Agentic Campaigning page.",
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
