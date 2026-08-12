import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { initAdmin } from "@/firebase/admin";
import { getFirestore } from "firebase-admin/firestore";
import sendgrid from "@sendgrid/mail";

export async function POST(req: NextRequest) {
  const auth = await verifyRequest(req);
  if (!auth.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, panelType, description, orgId, orgName, userEmail, userName } = body || {};

    if (!title || !panelType || !description) {
      return NextResponse.json(
        { error: "Title, panel type, and description are required." },
        { status: 400 }
      );
    }

    const trimmedTitle = String(title).trim();
    const trimmedType = String(panelType).trim();
    const trimmedDesc = String(description).trim();
    const trimmedOrg = String(orgId || "unknown").trim();
    const trimmedOrgName = String(orgName || trimmedOrg).trim();
    const trimmedEmail = String(userEmail || auth.uid).trim();
    const trimmedName = String(userName || "Unknown User").trim();

    // 1. Save to Firestore for records
    await initAdmin();
    const db = getFirestore();
    const docRef = await db.collection("bi_panel_requests").add({
      title: trimmedTitle,
      panelType: trimmedType,
      description: trimmedDesc,
      orgId: trimmedOrg,
      orgName: trimmedOrgName,
      requestedBy: trimmedEmail,
      requestedByName: trimmedName,
      requestedByUid: auth.uid,
      createdAt: new Date().toISOString(),
      status: "pending",
    });

    // 2. Send notification email via SendGrid
    const sendGridKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || "noreply@soltheory.com";
    if (sendGridKey) {
      try {
        sendgrid.setApiKey(sendGridKey);
        await sendgrid.send({
          to: "lucas@soltheory.com",
          from: fromEmail,
          replyTo: trimmedEmail,
          subject: `[BI Panel Request] ${trimmedTitle} — ${trimmedOrgName}`,
          html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px 24px; background: #fafafa;">
            <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e2e8f0;">
              <h2 style="margin: 0 0 4px; font-size: 20px; color: #0f172a;">📊 New Custom BI Panel Request</h2>
              <p style="margin: 0 0 24px; font-size: 13px; color: #64748b;">Submitted via INSiGHT Business Intelligence</p>

              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; width: 140px;">Title</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; font-weight: 600;">${trimmedTitle}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Panel Type</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">${trimmedType}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Organization</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">${trimmedOrgName} (${trimmedOrg})</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Requested By</td>
                  <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b;">${trimmedName} (<a href="mailto:${trimmedEmail}" style="color: #6366f1;">${trimmedEmail}</a>)</td>
                </tr>
              </table>

              <div style="margin-top: 20px;">
                <p style="font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 8px;">Description</p>
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; white-space: pre-wrap; line-height: 1.6;">${trimmedDesc}</div>
              </div>

              <p style="margin: 24px 0 0; font-size: 11px; color: #94a3b8;">Request ID: ${docRef.id}</p>
            </div>
          </div>`,
        });
      } catch (sgError) {
        console.warn("[API/BI-Request] Failed to send email via SendGrid:", sgError);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Your custom BI panel request has been submitted! We'll review it shortly.",
      requestId: docRef.id,
    });
  } catch (error: any) {
    console.error("[API/BI-Request] Error:", error);
    return NextResponse.json(
      { error: "Internal server error. Please try again later." },
      { status: 500 }
    );
  }
}
