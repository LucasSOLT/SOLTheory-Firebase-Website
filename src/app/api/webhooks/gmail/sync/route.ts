import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: Request) {
  try {
    const { uid, refreshToken, agentId: rawAgentId, soul, brain, selectedEmailIds, contacts, knowledgeBaseText } = await req.json();
    if (!uid || !refreshToken) return NextResponse.json({ error: "Missing uid or refresh token" }, { status: 400 });

    const agentId = (rawAgentId || "").replace("soltheory_", "").replace("nxtchapter_", "");
    const isNxtChapter = (rawAgentId || "").includes("nxtchapter");

    let agentRole = isNxtChapter
      ? "You are Jarvis, the primary AI agent for NXT Chapter — a youth mentorship and community empowerment organization. You are a highly organized executive assistant. Help the user manage and reply to incoming messages. Focus on excellent communication and swift resolution. Keep replies concise and professional. You must NEVER mention SOL Theory. When you have knowledge base data, use it to write detailed and comprehensive content."
      : "You are Jarvis (Email Agent) for SOL Theory. Think of yourself as a highly organized, empathetic executive assistant and persuasive sales expert combined into one. Help the user manage and reply to incoming messages. Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on excellent customer satisfaction and swift resolution. Keep replies concise and professional. When you have knowledge base data, use it to write detailed and comprehensive content.";

    if (soul) agentRole += `\n\nYour specific personality, tone, and character overrides (Soul): ${soul}`;
    if (brain) agentRole += `\n\nStrict operational instructions and persistent knowledge (Brain): ${brain}`;

    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      agentRole += `\n\n[CONTACT GLOSSARY]\nYou have an address book mapping nicknames to emails. Use this for context on who individuals are:\n`;
      contacts.forEach(c => {
        if (!c.ignore) agentRole += `- ${c.email} (Aliases: ${c.aliases})\n`;
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: refreshToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Step 1: Draft Explicitly Selected Emails Only
    const messages = Array.isArray(selectedEmailIds) ? selectedEmailIds.map((id: string) => ({ id })) : [];
    
    if (messages.length === 0) {
      return NextResponse.json({ status: "success", message: "No explicitly selected emails found in payload." });
    }

    let processedCount = 0;

    for (const msg of messages) {
      if (!msg.id) continue;

      const messageDetails = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      });

      const headers = messageDetails.data.payload?.headers;
      const subject = headers?.find(h => h.name === 'Subject')?.value || 'No Subject';
      const from = headers?.find(h => h.name === 'From')?.value || 'Unknown';
      const to = headers?.find(h => h.name === 'To')?.value || 'Unknown';
      const messageId = headers?.find(h => h.name === 'Message-ID')?.value;

      // Skip our own emails or auto-responses if needed
      
      // Get body using recursive MIME parser
      let bodyData = "";
      const extractBody = (parts: any[]): string => {
        if (!parts) return "";
        for (const p of parts) {
          if (p.mimeType === 'text/plain' && p.body?.data) return p.body.data;
          if (p.mimeType === 'text/html' && p.body?.data) return p.body.data;
          if (p.parts) {
            const nested = extractBody(p.parts);
            if (nested) return nested;
          }
        }
        return "";
      };

      if (messageDetails.data.payload?.parts) {
        bodyData = extractBody(messageDetails.data.payload.parts);
      } else if (messageDetails.data.payload?.body?.data) {
        bodyData = messageDetails.data.payload.body.data;
      }

      if (bodyData) {
        const emailContent = Buffer.from(bodyData, 'base64').toString('utf-8');

        // --- KNOWLEDGE BASE: USE CLIENT-PROVIDED TEXT ---
        let retrievedContext = "";
        if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
          retrievedContext = knowledgeBaseText.substring(0, 50000); // Cap at 50k chars
        }
        // --- END KNOWLEDGE BASE ---

        // Build the full system prompt with KB data
        let dynamicRole = agentRole;
        if (retrievedContext) {
          dynamicRole += `\n\n[KNOWLEDGE BASE DATA]\nThe following is factual reference data from uploaded documents. Use this to craft accurate, comprehensive replies.\n\n${retrievedContext}`;
        }

        // Generate Reply via Groq
        const prompt = `You are replying to an email.\nFrom: ${from}\nSubject: ${subject}\n\nEmail Content:\n${emailContent}\n\nPlease generate a polite, helpful reply. Do not include subject line in your response, just the body.`;

        const completion = await groq.chat.completions.create({
          messages: [
            { role: "system", content: dynamicRole },
            { role: "user", content: prompt }
          ],
          model: "llama-3.3-70b-versatile",
        });

        const replyText = completion.choices[0]?.message?.content || "Thank you for reaching out. We will get back to you shortly.";

        // Construct email message to send
        const replyMessage = [
          `To: ${from}`,
          `In-Reply-To: ${messageId}`,
          `References: ${messageId}`,
          `Subject: Re: ${subject}`,
          `Content-Type: text/plain; charset=utf-8`,
          ``,
          replyText
        ].join('\n');

        const encodedMessage = Buffer.from(replyMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        // Create Draft instead of sending directly
        await gmail.users.drafts.create({
          userId: 'me',
          requestBody: {
            message: {
              raw: encodedMessage,
              threadId: messageDetails.data.threadId
            }
          }
        });

        // Mark as read by removing UNREAD label
        await gmail.users.messages.modify({
          userId: 'me',
          id: msg.id,
          requestBody: {
            removeLabelIds: ['UNREAD']
          }
        });

        processedCount++;
      }
    }

    return NextResponse.json({ status: "success", message: `Created drafts for ${processedCount} emails` });
  } catch (error: any) {
    console.error("Gmail Sync Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
