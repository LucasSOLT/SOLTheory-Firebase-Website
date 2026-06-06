import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function POST(req: Request) {
  try {
    const { uid, refreshToken, messageId, attachmentId } = await req.json();

    if (!uid || !refreshToken || !messageId || !attachmentId) {
      return NextResponse.json(
        { error: "Missing required fields: uid, refreshToken, messageId, attachmentId" },
        { status: 400 }
      );
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // Fetch the attachment data from Gmail
    const attachment = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: messageId,
      id: attachmentId,
    });

    const base64Data = attachment.data.data;
    if (!base64Data) {
      return NextResponse.json(
        { error: "Attachment data is empty" },
        { status: 404 }
      );
    }

    // Gmail returns base64url-encoded data — decode it to a binary Buffer
    const buffer = Buffer.from(base64Data, "base64url");

    // To determine the filename and mimeType we need the message metadata.
    // Fetch the message in metadata format and walk the parts to find the matching attachment.
    const message = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["Content-Type"],
    });

    let filename = "attachment";
    let mimeType = "application/octet-stream";

    function findAttachmentMeta(part: any): void {
      if (
        part.body?.attachmentId === attachmentId &&
        part.filename &&
        part.filename.length > 0
      ) {
        filename = part.filename;
        mimeType = part.mimeType || "application/octet-stream";
        return;
      }
      if (part.parts) {
        for (const child of part.parts) {
          findAttachmentMeta(child);
        }
      }
    }

    if (message.data.payload) {
      findAttachmentMeta(message.data.payload);
    }

    // Return the binary data with appropriate headers
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, '\\"')}"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (error: any) {
    console.error("Gmail Attachment Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch attachment" },
      { status: 500 }
    );
  }
}
