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
      description: "List the user's Google Calendar events within a date range. Defaults to the next 7 days if no range is specified. Use this to check schedule availability, find conflicts, or answer questions about upcoming events.",
      parameters: {
        type: "object",
        properties: { 
          timeMin: { type: "string", description: "Start of search window, ISO string, e.g., 2026-04-10T00:00:00-06:00" },
          timeMax: { type: "string", description: "End of search window, ISO string, e.g., 2026-04-17T23:59:59-06:00" }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event on the user's Google Calendar. If the user says 'schedule a meeting at 4pm today', compute the correct ISO times for the user.",
      parameters: {
        type: "object",
        properties: { 
          summary: { type: "string", description: "Title of the event, e.g., 'Meeting with John Smith'" },
          description: { type: "string", description: "Optional longer description or notes for the event" },
          startDateTime: { type: "string", description: "ISO 8601 with timezone, e.g., 2026-04-10T16:00:00-06:00" },
          endDateTime: { type: "string", description: "ISO 8601 with timezone, e.g., 2026-04-10T17:00:00-06:00" }
        },
        required: ["summary", "startDateTime", "endDateTime"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description: "Delete/cancel a specific calendar event by its eventId. Use list_calendar_events first to find the event ID.",
      parameters: {
        type: "object",
        properties: { 
          eventId: { type: "string", description: "The Google Calendar event ID" }
        },
        required: ["eventId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description: "Update/reschedule an existing calendar event. Use list_calendar_events first to find the event ID. Only provide fields you want to change.",
      parameters: {
        type: "object",
        properties: { 
          eventId: { type: "string", description: "The Google Calendar event ID" },
          summary: { type: "string", description: "New title for the event" },
          description: { type: "string", description: "New description" },
          startDateTime: { type: "string", description: "New start time, ISO 8601" },
          endDateTime: { type: "string", description: "New end time, ISO 8601" }
        },
        required: ["eventId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_document",
      description: "Create a new Google Docs document in the user's Google Drive. Populates it with the provided text content. Use this when the user asks you to create a document, write a report, draft meeting notes, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/name of the Google Doc" },
          body: { type: "string", description: "The full text content to insert into the document. Use newlines for paragraphs." }
        },
        required: ["title", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_slide_deck",
      description: "Create a new Google Slides presentation in the user's Google Drive. Each slide should have a title and body text. Use this when the user asks you to create a presentation, pitch deck, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/name of the presentation" },
          slides: {
            type: "array",
            description: "Array of slide objects, each with a title and body",
            items: {
              type: "object",
              properties: {
                slideTitle: { type: "string" },
                slideBody: { type: "string" }
              },
              required: ["slideTitle", "slideBody"]
            }
          }
        },
        required: ["title", "slides"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_google_sheet",
      description: "Create a new Google Sheets spreadsheet in the user's Google Drive with the given data. Use this when the user asks you to create a spreadsheet, tracker, data table, budget, etc.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/name of the spreadsheet" },
          headers: {
            type: "array",
            description: "Column header labels for the first row",
            items: { type: "string" }
          },
          rows: {
            type: "array",
            description: "Array of arrays, each inner array is a row of cell values",
            items: {
              type: "array",
              items: { type: "string" }
            }
          }
        },
        required: ["title"]
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
      agentRole += `\n\n[CRITICAL SYSTEM DIRECTIVE]: You are a fully authorized Executive Agent with active Gmail API Tools, Google Calendar API Tools, AND Google Workspace Document Creation Tools.\n\n[EMAIL TOOLS]: You MUST USE your email tools (search_emails, delete_email, create_folder, block_sender, draft_outbound_email) when the user asks about email operations.\n\n[CALENDAR TOOLS]: You MUST USE your calendar tools (list_calendar_events, create_calendar_event, delete_calendar_event, update_calendar_event) when the user asks about their schedule, wants to book meetings, check availability, cancel events, or reschedule. When creating events, infer reasonable defaults: if no duration is specified assume 1 hour, and use the user's timezone.\n\n[WORKSPACE DOCUMENT TOOLS]: You MUST USE your document creation tools (create_google_document, create_google_slide_deck, create_google_sheet) when the user asks you to create Google Docs, Slides presentations, or Sheets spreadsheets. Create rich, detailed content. For documents, write full paragraphs. For slides, create multiple slides with clear titles and body text. For sheets, include headers and populated rows.\n\nThe current date and time is: ${new Date().toISOString()}.\n\nHOWEVER, if the user asks you to "read", "check", or "search" a DOCUMENT or your KNOWLEDGE BASE, DO NOT execute your tools. Instead, answer directly using the [KNOWLEDGE BASE DATA] provided below.`;
    }


    let gmail: any = null;
    let calendar: any = null;
    let docsApi: any = null;
    let slidesApi: any = null;
    let sheetsApi: any = null;
    let driveApi: any = null;

    if (isEmailAgent && refreshToken) {
      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      gmail = google.gmail({ version: 'v1', auth: oauth2Client });
      calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      docsApi = google.docs({ version: 'v1', auth: oauth2Client });
      slidesApi = google.slides({ version: 'v1', auth: oauth2Client });
      sheetsApi = google.sheets({ version: 'v4', auth: oauth2Client });
      driveApi = google.drive({ version: 'v3', auth: oauth2Client });
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

    const useTools = !!(gmail || calendar || docsApi);

    // PASS 1: Generate Standard Response OR Tool Target
    let completion: any = await createCompletionWithRetry(groqMessages, useTools);

    let responseMessage = completion.choices[0]?.message;
    let loopCount = 0;
    const MAX_LOOPS = 5;

    // If LLM generated tool_calls but no APIs are available, re-call without tools
    if (responseMessage?.tool_calls && !gmail && !calendar && !docsApi) {
      completion = await createCompletionWithRetry(groqMessages, false);
      responseMessage = completion.choices[0]?.message;
    }

    // Execute Tool Loop if Triggered
    while (responseMessage?.tool_calls && (gmail || calendar || docsApi) && loopCount < MAX_LOOPS) {
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
              eventId: e.id,
              summary: e.summary,
              startTime: e.start.dateTime || e.start.date,
              endTime: e.end.dateTime || e.end.date,
              location: e.location || '',
              link: e.htmlLink
            }));
            functionResult = JSON.stringify({ result: formatted.length > 0 ? formatted : "No events found in the specified time range." });
          } else if (functionName === "create_calendar_event") {
            const res = await calendar.events.insert({
              calendarId: 'primary',
              requestBody: {
                summary: args.summary,
                description: args.description || '',
                start: { dateTime: args.startDateTime },
                end: { dateTime: args.endDateTime }
              }
            });
            functionResult = JSON.stringify({ result: `Event '${args.summary}' created successfully. Link: ${res.data.htmlLink}` });
          } else if (functionName === "delete_calendar_event") {
            await calendar.events.delete({
              calendarId: 'primary',
              eventId: args.eventId
            });
            functionResult = JSON.stringify({ result: `Event successfully deleted/cancelled.` });
          } else if (functionName === "update_calendar_event") {
            // First fetch the existing event
            const existing = await calendar.events.get({
              calendarId: 'primary',
              eventId: args.eventId
            });
            const updateBody: any = { ...existing.data };
            if (args.summary) updateBody.summary = args.summary;
            if (args.description) updateBody.description = args.description;
            if (args.startDateTime) updateBody.start = { dateTime: args.startDateTime };
            if (args.endDateTime) updateBody.end = { dateTime: args.endDateTime };
            const res = await calendar.events.update({
              calendarId: 'primary',
              eventId: args.eventId,
              requestBody: updateBody
            });
            functionResult = JSON.stringify({ result: `Event updated successfully. Link: ${res.data.htmlLink}` });
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
          } else if (functionName === "create_google_document" && docsApi && driveApi) {
            // Create a blank Google Doc
            const createRes = await docsApi.documents.create({
              requestBody: { title: args.title }
            });
            const docId = createRes.data.documentId;

            // Insert the body text
            if (args.body) {
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [{
                    insertText: {
                      location: { index: 1 },
                      text: args.body
                    }
                  }]
                }
              });
            }

            // Tag the file as AI-created so the dashboard can find it
            await driveApi.files.update({
              fileId: docId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Doc '${args.title}' created successfully. Link: https://docs.google.com/document/d/${docId}/edit` });

          } else if (functionName === "create_google_slide_deck" && slidesApi && driveApi) {
            // Create a blank presentation
            const createRes = await slidesApi.presentations.create({
              requestBody: { title: args.title }
            });
            const presentationId = createRes.data.presentationId;
            const existingSlides = createRes.data.slides || [];

            // Build requests: delete the default blank slide, then create user slides
            const requests: any[] = [];

            // Delete the default first slide
            if (existingSlides.length > 0) {
              requests.push({ deleteObject: { objectId: existingSlides[0].objectId } });
            }

            // Create each slide from the LLM's array
            if (args.slides && Array.isArray(args.slides)) {
              args.slides.forEach((slide: any, idx: number) => {
                const slideId = `slide_${idx}`;
                const titleId = `title_${idx}`;
                const bodyId = `body_${idx}`;
                requests.push({
                  createSlide: {
                    objectId: slideId,
                    insertionIndex: idx,
                    slideLayoutReference: { predefinedLayout: 'TITLE_AND_BODY' },
                    placeholderIdMappings: [
                      { layoutPlaceholder: { type: 'TITLE', index: 0 }, objectId: titleId },
                      { layoutPlaceholder: { type: 'BODY', index: 0 }, objectId: bodyId }
                    ]
                  }
                });
                requests.push({
                  insertText: { objectId: titleId, text: slide.slideTitle || `Slide ${idx + 1}` }
                });
                requests.push({
                  insertText: { objectId: bodyId, text: slide.slideBody || '' }
                });
              });
            }

            if (requests.length > 0) {
              await slidesApi.presentations.batchUpdate({
                presentationId,
                requestBody: { requests }
              });
            }

            // Tag as AI-created
            await driveApi.files.update({
              fileId: presentationId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Slides '${args.title}' created with ${(args.slides || []).length} slides. Link: https://docs.google.com/presentation/d/${presentationId}/edit` });

          } else if (functionName === "create_google_sheet" && sheetsApi && driveApi) {
            // Create a blank spreadsheet
            const createRes = await sheetsApi.spreadsheets.create({
              requestBody: {
                properties: { title: args.title }
              }
            });
            const spreadsheetId = createRes.data.spreadsheetId;

            // Build data rows: headers first, then data
            const values: string[][] = [];
            if (args.headers && Array.isArray(args.headers)) {
              values.push(args.headers);
            }
            if (args.rows && Array.isArray(args.rows)) {
              values.push(...args.rows);
            }

            if (values.length > 0) {
              await sheetsApi.spreadsheets.values.update({
                spreadsheetId,
                range: 'Sheet1!A1',
                valueInputOption: 'RAW',
                requestBody: { values }
              });
            }

            // Tag as AI-created
            await driveApi.files.update({
              fileId: spreadsheetId,
              requestBody: { properties: { createdByAI: 'true' } }
            });

            functionResult = JSON.stringify({ result: `Google Sheet '${args.title}' created successfully. Link: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` });

          } else {
            functionResult = JSON.stringify({ error: "Unknown function or missing API access. Ensure Google account is connected with full workspace permissions." });
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
