import { NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { sendPushToEmails, sendPushToUser, PushNotificationPayload } from "@/lib/fcm-notify";

/**
 * Dispatch FCM push notifications to recipients (phones & desktop browsers).
 * Requires authenticated user.
 */
export async function POST(req: Request) {
  const auth = await verifyRequest(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { recipientEmails, recipientUid, payload } = body as {
      recipientEmails?: string[];
      recipientUid?: string;
      payload: PushNotificationPayload;
    };

    if (!payload || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Missing required notification payload (title, body)" }, { status: 400 });
    }

    if (recipientUid) {
      const result = await sendPushToUser(recipientUid, payload);
      return NextResponse.json({ success: true, ...result });
    }

    if (recipientEmails && recipientEmails.length > 0) {
      // Filter out sender's own email so they don't get pinged with their own outbound messages
      const targets = recipientEmails.filter((email) => email.toLowerCase() !== auth.email?.toLowerCase());
      if (targets.length > 0) {
        await sendPushToEmails(targets, payload);
      }
      return NextResponse.json({ success: true, targeted: targets.length });
    }

    return NextResponse.json({ error: "No recipients specified" }, { status: 400 });
  } catch (error: any) {
    console.error("[Notification Dispatch API] Error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
