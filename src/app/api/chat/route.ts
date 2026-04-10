import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";


import { nxtChapterKnowledge } from "@/lib/morpheus-knowledge";
const tools: any = [
  {
    type: "function",
    function: {
      name: "search_emails",
      description: "Search the user's Gmail using standard Gmail search queries (e.g., 'from:john@example.com'). Returns a list of matching emails with their messageId, from, subject, and snippet. Use this BEFORE deleting to find the correct messageId.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_email",
      description: "Permanently trash an email by its messageId.",
      parameters: {
        type: "object",
        properties: { messageId: { type: "string" } },
        required: ["messageId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_folder",
      description: "Create a new folder (Label) in the user's Gmail.",
      parameters: {
        type: "object",
        properties: { folderName: { type: "string" } },
        required: ["folderName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "block_sender",
      description: "Block a sender by creating a strict Gmail filter that routes their emails directly to the trash.",
      parameters: {
        type: "object",
        properties: { senderEmail: { type: "string" } },
        required: ["senderEmail"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_outbound_email",
      description: "Draft an outbound email. This places it in the user's Drafts folder for review.",
      parameters: {
        type: "object",
        properties: { 
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string", description: "The plaintext or HTML body of the email." }
        },
        required: ["to", "subject", "body"]
      }
    }
  },

  {
    type: "function",
    function: {
      name: "list_calendar_events",
      description: "List the user's scheduled calendar events for the upcoming or specified days. Provides event summary, start/end time.",
      parameters: {
        type: "object",
        properties: { 
          timeMin: { type: "string", description: "ISO string, e.g., 2026-04-10T00:00:00Z" },
          timeMax: { type: "string", description: "ISO string, e.g., 2026-04-12T00:00:00Z" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event on the user's Google Calendar.",
      parameters: {
        type: "object",
        properties: { 
          summary: { type: "string" },
          description: { type: "string" },
          startDateTime: { type: "string", description: "ISO string, e.g., 2026-04-10T10:00:00-06:00" },
          endDateTime: { type: "string", description: "ISO string, e.g., 2026-04-10T11:00:00-06:00" }
        },
        required: ["summary", "startDateTime", "endDateTime"]
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const { messages, agentId: rawAgentId, soul, brain, uid, refreshToken, contacts, knowledgeBaseText } = await req.json();
    
    // Parse out scope prefixes for logic, but keep raw for database
    const agentId = (rawAgentId || "").replace("soltheory_", "").replace("nxtchapter_", "");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const isNxtChapter = (rawAgentId || "").includes("nxtchapter");
    const isSolTheory = (rawAgentId || "").includes("soltheory");

    let agentRole = "";
    switch (agentId) {
      case "morpheus":
        if (isNxtChapter) {
          agentRole = "You are Morpheus, the primary AI agent for NXT Chapter — a youth mentorship and community empowerment organization. You are a highly organized executive assistant and persuasive outreach expert combined into one. You handle ALL inbound email management (replies, drafts, organization, deletions) AND outbound campaigns (partnership outreach, follow-ups, community engagement emails). You must NEVER mention SOL Theory or any other organization. You work exclusively for NXT Chapter. Focus on excellent communication, swift resolution, and high engagement for NXT Chapter's mission. If the user asks you to perform inbox actions (delete, draft, folder, block), use your tools autonomously. IMPORTANT: Do NOT automatically draft emails when the user is simply chatting or discussing topics. ONLY draft emails when explicitly commanded to do so.";
        } else {
          agentRole = "You are Morpheus, the primary AI agent for SOL Theory. You are a highly organized executive assistant and persuasive sales expert combined into one. You handle ALL inbound email management (replies, drafts, organization, deletions) AND outbound campaigns (cold outreach, follow-ups, high-converting sales emails). Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on excellent customer satisfaction, swift resolution, and high engagement on outbound prospects. If the user asks you to perform inbox actions (delete, draft, folder, block), use your tools autonomously. IMPORTANT: Do NOT automatically draft emails when the user is simply chatting or discussing topics. ONLY draft emails when explicitly commanded to do so.";
        }
        break;
      default:
        agentRole = isNxtChapter
          ? "a helpful AI assistant for NXT Chapter, a youth mentorship and community empowerment organization. Never mention SOL Theory."
          : "a helpful AI assistant for SOL Theory, the Etsy of Self Improvement. Always embody our core values: Simple, Practical, and Fun (SPF).";
        break;
    }

    if (soul) agentRole += `\n\nYour specific personality, tone, and character overrides (Soul): ${soul}`;
    if (brain) agentRole += `\n\nStrict operational instructions and persistent knowledge (Brain): ${brain}`;
    
    if (contacts && Array.isArray(contacts) && contacts.length > 0) {
      agentRole += `\n\n[CONTACT GLOSSARY]\nYou have an address book mapping nicknames to emails. When drafting emails to these nicknames, MUST use the associated email address. Do not generate fake emails for these people. \n`;
      contacts.forEach(c => {
        if (!c.ignore) agentRole += `- ${c.email} (Aliases: ${c.aliases})\n`;
      });
    }

    agentRole += `\n\n[CRITICAL]: You must review and remember the entire conversation history provided in the messages array. Your responses must inherently reflect knowledge of previous user requests in this specific chat thread. Do NOT treat each user message in isolation.`;

    // --- KNOWLEDGE BASE DATA IS NO LONGER APPENDED DIRECTLY TO AGENT ROLE ---
    console.log("[DEBUG SERVER] knowledgeBaseText length:", knowledgeBaseText?.length || 0);
    console.log("[DEBUG SERVER] knowledgeBaseText preview:", knowledgeBaseText?.substring(0, 150));


    // Gmail Auth Hook Configuration
    const isEmailAgent = agentId === "morpheus";
    
    if (isEmailAgent) {
      agentRole += `\n\n[CRITICAL SYSTEM DIRECTIVE]: You have active Gmail API Tools available. You are a fully authorized Inbox Administrator. YOU MUST USE YOUR TOOLS for email operations. If the user asks you to read, search, delete, block, folder, or draft an EMAIL, YOU ABSOLUTELY MUST execute the appropriate tool function.\n\nHOWEVER, if the user asks you to "read", "check", or "search" a DOCUMENT or your KNOWLEDGE BASE, DO NOT execute your email tools. Instead, answer directly using the [KNOWLEDGE BASE DATA] provided below.`;
    }


    let gmail: any = null;
    let calendar: any = null;

    if (isEmailAgent && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    }


    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const createCompletionWithRetry = async (messagesArray: any[], useTools: boolean, maxRetries = 2) => {
      let attempts = 0;
      while (attempts < maxRetries) {
        try {
          return await groq.chat.completions.create({
            messages: messagesArray,
            model: "llama-3.3-70b-versatile",
            ...(useTools ? { tools, tool_choice: "auto" } : {}),
          });
        } catch (err: any) {
          attempts++;
          console.warn(`[DEBUG] Groq API Attempt ${attempts} failed: ${err?.message || err}`);
          if (err.response) {
            console.warn(`[DEBUG] Error data:`, err.response?.data);
          }
          if (attempts >= maxRetries) throw err;
        }
      }
    };

    // Payload Array Compilation
    let groqMessages: any[] = [
      { role: "system", content: agentRole }
    ];

    // --- KNOWLEDGE BASE: SECONDARY SYSTEM PROMPT ---
    let combinedKnowledge = "";
    if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
      combinedKnowledge += knowledgeBaseText + "\n\n";
    }

    if (rawAgentId && rawAgentId.includes("nxtchapter")) {
      combinedKnowledge += "\n\n[HARDCODED ORGANIZATIONAL KNOWLEDGE BASE]\n" + nxtChapterKnowledge;
    }

    if (combinedKnowledge.trim().length > 0) {
      const cappedKB = combinedKnowledge.substring(0, 100000); // Increased cap to 100k for the hardcoded knowledge
      groqMessages.push({
        role: "system",
        content: `IMPORTANT INSTRUCTION REGARDING KNOWLEDGE BASE:\nThe user has provided factual reference data for you below. You MUST use this data to confidently answer their questions, even if it introduces new context you did not know. Do NOT hallucinate tool calls or attempt to use the 'search' tool for this data - it is already completely provided to you inside the XML tags below. Do not mention that you are reading from a knowledge base unless explicitly asked. Do NOT say "I don't have information on..." if the answer is within the knowledge base.\n\n<knowledge_base>\n${cappedKB}\n</knowledge_base>`
      });
    }

    groqMessages.push(...messages);

    const useTools = !!(gmail);

    // PASS 1: Generate Standard Response OR Tool Target
    let completion: any = await createCompletionWithRetry(groqMessages, useTools);

    let responseMessage = completion.choices[0]?.message;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    // If LLM generated tool_calls but gmail isn't available, re-call without tools
    if (responseMessage?.tool_calls && !gmail) {
      completion = await createCompletionWithRetry(groqMessages, false);
      responseMessage = completion.choices[0]?.message;
    }

    // Execute Tool Loop if Triggered
    while (responseMessage?.tool_calls && gmail && loopCount < MAX_LOOPS) {
      groqMessages.push(responseMessage);
      
      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        
        let functionResult = "";
        try {
          const args = JSON.parse(toolCall.function.arguments);
          
          if (functionName === "search_emails") {
            const res = await gmail.users.messages.list({ userId: 'me', q: args.query, maxResults: 10 });
            if (!res.data.messages || res.data.messages.length === 0) {
              functionResult = JSON.stringify({ result: "No emails found matching query. Try broadening your 'query' (e.g. using just the domain, or name)." });
            } else {
              const detailPromises = res.data.messages.slice(0, 5).map((msg: any) => 
                gmail.users.messages.get({ userId: 'me', id: msg.id, format: 'metadata', metadataHeaders: ['Subject', 'From', 'Date'] })
              );
              const details = await Promise.all(detailPromises);
              const formatted = details.map((d: any) => {
                const h = d.data.payload?.headers || [];
                return {
                  messageId: d.data.id,
                  subject: h.find((x:any)=>x.name==='Subject')?.value,
                  from: h.find((x:any)=>x.name==='From')?.value,
                  snippet: d.data.snippet
                };
              });
              functionResult = JSON.stringify({ result: formatted });
            }
          } else if (functionName === "delete_email") {
            await gmail.users.messages.trash({ userId: 'me', id: args.messageId });
            functionResult = JSON.stringify({ result: `Message successfully moved to trash.` });
          } else if (functionName === "create_folder") {
            await gmail.users.labels.create({
              userId: 'me',
              requestBody: { name: args.folderName, labelListVisibility: 'labelShow', messageListVisibility: 'show' }
            });
            functionResult = JSON.stringify({ result: `Folder '${args.folderName}' successfully created.` });
          } else if (functionName === "block_sender") {
            await gmail.users.settings.filters.create({
              userId: 'me',
              requestBody: {
                criteria: { from: args.senderEmail },
                action: { addLabelIds: ['TRASH'] }
              }
            });
            functionResult = JSON.stringify({ result: `Sender '${args.senderEmail}' blocked.` });
          } else if (functionName === "list_calendar_events") {
            const timeMin = args.timeMin || new Date().toISOString();
            const timeMax = args.timeMax || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const res = await calendar.events.list({
              calendarId: 'primary',
              timeMin: timeMin,
              timeMax: timeMax,
              singleEvents: true,
              orderBy: 'startTime'
            });
            const formatted = (res.data.items || []).map((e: any) => ({
              summary: e.summary,
              startTime: e.start.dateTime || e.start.date,
              endTime: e.end.dateTime || e.end.date,
              link: e.htmlLink
            }));
            functionResult = JSON.stringify({ result: formatted });
          } else if (functionName === "create_calendar_event") {
            const res = await calendar.events.insert({
              calendarId: 'primary',
              requestBody: {
                summary: args.summary,
                description: args.description,
                start: { dateTime: args.startDateTime },
                end: { dateTime: args.endDateTime }
              }
            });
            functionResult = JSON.stringify({ result: `Event created successfully: ${res.data.htmlLink}` });
          } else if (functionName === "draft_outbound_email") {
            const emailLines = [
              `To: ${args.to}`,
              `Subject: ${args.subject}`,
              `Content-Type: text/html; charset=utf-8`,
              ``,
              args.body
            ];
            const raw = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw } }
            });
            functionResult = JSON.stringify({ result: `Draft to ${args.to} successfully created.` });
          } else {
            functionResult = JSON.stringify({ error: "Unknown function" });
          }
        } catch (err: any) {
          functionResult = JSON.stringify({ error: err.message });
        }
        
        // Push Result Object back onto context array
        groqMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: functionResult,
        });
      }
      
      // PASS: Agent processes tool outputs and decides next step
      completion = await createCompletionWithRetry(groqMessages, useTools);
      
      responseMessage = completion.choices[0]?.message;
      loopCount++;
    }

    // Default Raw Response
    return NextResponse.json({ response: responseMessage?.content || "" });
  } catch (error: any) {
    console.error("[DEBUG SERVER] Groq Error Catch Block:", error?.message || error, JSON.stringify(error?.error || {}));
    
    const errMsg = error?.message || "";
    if (errMsg.includes("tool_use_failed") || errMsg.includes("Failed to call a function")) {
      return NextResponse.json({ response: "I encountered a brief system formatting error while assembling that tool execution. Could you please try asking me that one more time?" });
    }
    if (errMsg.includes("rate_limit") || errMsg.includes("429")) {
      return NextResponse.json({ response: "I'm receiving too many requests right now. Please wait a moment and try again." });
    }
    if (errMsg.includes("context_length") || errMsg.includes("too many tokens") || errMsg.includes("maximum context")) {
      return NextResponse.json({ response: "Your conversation or document data is too long for me to process at once. Try starting a new chat session, or reduce the size of your knowledge base documents." });
    }
    return NextResponse.json({ error: errMsg || "Failed to generate response" }, { status: 500 });
  }
}
