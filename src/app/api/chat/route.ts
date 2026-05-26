import { Groq } from "groq-sdk";
import { NextResponse } from "next/server";
import { google } from "googleapis";

import { initAdmin, getFirestore as getAdminFirestore } from "@/firebase/admin";
import { nxtChapterKnowledge } from "@/lib/jarvis-knowledge";
import { solTheoryKnowledge } from "@/lib/soltheory-knowledge";
import { logAIUsage, calculateGroqCost } from "@/lib/log-ai-usage";
import { extractPACTFacts } from "@/lib/pact-extractor";
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
      description: "Draft an outbound email and place it in the user's Gmail Drafts folder. If the user wants a Google Meet link in the email, set includeGoogleMeetLink to true and the system will automatically create a calendar event, generate the Meet URL, and embed it into the email body for you.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "The full email body with STRICT formatting rules. Structure MUST be exactly: 'Hello [Name],\\n\\n[Body paragraph(s)]\\n\\nThanks,\\n[Sender Name]'. The greeting (e.g. 'Hello John,') MUST be on its own line. There MUST be exactly one blank line after the greeting before the body content. The body paragraphs go next. Then there MUST be one blank line before the closing. The closing (e.g. 'Thanks,' or 'Best regards,') MUST be on its own line, followed by the sender's name on the NEXT line. Use \\n for line breaks. Do NOT write any placeholder text for meeting links — the system handles that automatically when includeGoogleMeetLink is true." },
          includeGoogleMeetLink: { type: "boolean", description: "Set to true if the user wants a Google Meet video call link in this email. The system will auto-generate a calendar event + Meet URL and append it to the email." },
          meetingSummary: { type: "string", description: "Title for the auto-created calendar event (e.g. 'Catch-up with Steve'). Required when includeGoogleMeetLink is true." },
          meetingDateTime: { type: "string", description: "ISO 8601 datetime for the meeting start (e.g. '2026-04-21T19:00:00-06:00'). Required when includeGoogleMeetLink is true." }
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
          endDateTime: { type: "string", description: "ISO 8601 with timezone, e.g., 2026-04-10T17:00:00-06:00" },
          addGoogleMeetLink: { type: "boolean", description: "Set to true if the event requires a Google Meet virtual video conference link." }
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
      description: "Create a new Google Docs document in the user's Google Drive. Populates it with the provided text content. Use this when the user asks you to create a document, write a report, draft meeting notes, etc. You MUST write the full document — do not truncate or summarize. Write long-form, professional prose with clear paragraph breaks.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The title/name of the Google Doc" },
          body: { type: "string", description: "The full text content to insert. Use newlines for paragraphs. Separate sections with headings prefixed by '## '. CRITICAL: If you need to paste an entire large uploaded document, DO NOT output the full document text here! Use '[INSERT_DOCUMENT_CONTEXT]' instead and the system will replace it." },
          font: { type: "string", description: "The font family to apply (e.g. 'Arial', 'Times New Roman', 'Georgia'). If not specified, defaults to 'Arial'." },
          lineSpacing: { type: "string", enum: ["single", "double"], description: "Line spacing: 'single' (1.0) or 'double' (2.0). Defaults to 'double'." }
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
  },
  {
    type: "function",
    function: {
      name: "search_google_drive",
      description: "Search the user's Google Drive for files matching a keyword. Use this when the user asks you to find a file on their drive.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The keyword to search for, e.g., 'marketing plan'" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_drive_document",
      description: "Read the text content of a Google Doc. You MUST use search_google_drive first to find the fileId.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "The ID of the document to read." }
        },
        required: ["fileId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_youtube_video",
      description: "Prepare and store a drafted YouTube video onto the user's YouTube Studio. This automatically creates a Google Doc script, generates a dummy private draft video to hold the data, and links the script in the YouTube description. Use this whenever the user wants to draft a video.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The YouTube video title." },
          description: { type: "string", description: "The YouTube description including hashtags." },
          tags: { type: "array", items: { type: "string" }, description: "Array of comma-separated string tags" },
          script: { type: "string", description: "The full script for the YouTube video. DO NOT output the script in your conversational reply, just pass it here." }
        },
        required: ["title", "description", "tags", "script"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_and_send_survey",
      description: "Create an AI-generated survey and optionally email invitation links to specified recipients. The survey is saved to Firestore and a public link is generated. Use this when the user wants to create a survey, feedback form, or questionnaire and send it to people. You MUST look up recipient email addresses from the Contact Glossary when the user refers to people by name.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string", description: "A detailed description of the survey topic/purpose. Be specific about what questions should cover." },
          questionCount: { type: "number", description: "Number of questions to generate. Default 10 if not specified." },
          recipientEmails: { type: "array", items: { type: "string" }, description: "Array of email addresses to send the survey invitation to. Look these up from the Contact Glossary." },
          recipientNames: { type: "array", items: { type: "string" }, description: "Array of display names corresponding to each recipient email, for personalized email greetings." },
          authorName: { type: "string", description: "The name of the survey creator/author to display on the survey. Use the user's name." }
        },
        required: ["topic", "recipientEmails"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_past_conversations",
      description: "Search the user's past Jarvis chat sessions for relevant context. Use this when the user references something from a previous conversation, asks 'remember when we talked about...', 'what did we discuss about...', or any time they need information from a past session. This searches all saved chat history across sessions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query to find relevant past conversations. Use keywords related to what the user is asking about." }
        },
        required: ["query"]
      }
    }
  },
  // ── iMessage Tools ──
  {
    type: "function",
    function: {
      name: "list_imessage_chats",
      description: "List the user's recent text message conversations. Returns contact numbers and last message preview. Use this when the user asks about their messages, texts, or wants to see recent conversations.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max number of conversations to return. Default 20." }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_imessage_thread",
      description: "Get messages from a specific text conversation thread. Use list_imessage_chats first to find the contact number. Use this when the user wants to read specific messages or see their conversation history with someone.",
      parameters: {
        type: "object",
        properties: {
          contact: { type: "string", description: "The contact's phone number, e.g. '+15551234567'" },
          limit: { type: "number", description: "Number of messages to retrieve. Default 25." }
        },
        required: ["contact"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_imessages",
      description: "Search across all text message conversations for messages containing a keyword or phrase. Use this when the user asks to find specific messages or search their message history.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search term to find in messages" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_imessage",
      description: "Send a text message to a phone number. Look up phone numbers from the Contact Glossary when users refer to people by name. Format phone numbers with country code (e.g. +15551234567).",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "The recipient's phone number, e.g. '+15551234567' or '5551234567'" },
          message: { type: "string", description: "The text message to send" }
        },
        required: ["to", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "summarize_imessages",
      description: "Get a summary of recent text message activity. Use this when the user asks 'what messages do I have', 'any new texts', 'summarize my messages', 'do I have unread messages', etc.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  }
];

export async function POST(req: Request) {
  try {
    const { messages, agentId: rawAgentId, soul, brain, uid, refreshToken, contacts, knowledgeBaseText, videoUrl, pactText, userName, model: requestedModel, orgBrainText } = await req.json();

    // Validate model against whitelist, default to llama-3.3-70b
    const ALLOWED_MODELS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct'];
    const selectedModel = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : 'llama-3.3-70b-versatile';

    // Parse out scope prefixes for logic, but keep raw for database
    const agentId = (rawAgentId || "").replace("soltheory_", "").replace("nxtchapter_", "");

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "Messages array is required" }, { status: 400 });
    }

    const isNxtChapter = (rawAgentId || "").includes("nxtchapter");
    const isSolTheory = (rawAgentId || "").includes("soltheory");

    let agentRole = "";
    switch (agentId) {
      case "jarvis":
        if (isNxtChapter) {
          agentRole = "You are Jarvis, the primary AI agent for NXT Chapter — a youth mentorship and community empowerment organization. You are a highly organized executive assistant and persuasive outreach expert combined into one. You handle ALL inbound email management (replies, drafts, organization, deletions) AND outbound campaigns (partnership outreach, follow-ups, community engagement emails). You must NEVER mention SOL Theory or any other organization. You work exclusively for NXT Chapter. Focus on excellent communication, swift resolution, and high engagement for NXT Chapter's mission. If the user asks you to perform inbox actions (delete, draft, folder, block), use your tools autonomously. IMPORTANT: Do NOT automatically draft emails when the user is simply chatting or discussing topics. ONLY draft emails when explicitly commanded to do so.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'";
        } else {
          agentRole = "You are Jarvis, the primary AI agent for SOL Theory. You are a highly organized executive assistant and persuasive sales expert combined into one. You handle ALL inbound email management (replies, drafts, organization, deletions) AND outbound campaigns (cold outreach, follow-ups, high-converting sales emails). Embody our core values: keep your advice Simple, Practical, and Fun (SPF). Focus on excellent customer satisfaction, swift resolution, and high engagement on outbound prospects. If the user asks you to perform inbox actions (delete, draft, folder, block), use your tools autonomously. IMPORTANT: Do NOT automatically draft emails when the user is simply chatting or discussing topics. ONLY draft emails when explicitly commanded to do so.\n\nCRITICAL DIRECTIVE: When asked to create, draft, or generate a document, email, spreadsheet, or similar item, do NOT output the drafted content in your chat response. Just execute the corresponding tool, and reply strictly with: 'I have generated that [insert the specific thing] for you, go take a look.'";
        }
        break;
      case "youtube_director":
        agentRole = "You are the YouTube Creative Director, a highly specialized AI agent for video content strategy and production. You have FULL ACTIVE ACCESS to YouTube API tools. When the user asks you to draft, create, or brainstorm a video, you will use the `draft_youtube_video` tool to physically push the draft to their YouTube Studio. However, follow your specific soul/brain instructions regarding when to ask questions FIRST before calling the tool. After successfully calling the tool, confirm that the draft was pushed to YouTube Studio.";
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
      agentRole += `\n\n[CONTACT GLOSSARY / ADDRESS BOOK]\nYou possess an address book that maps nicknames/aliases to real email addresses AND phone numbers. Whenever the user asks you to email someone by name or nickname, you MUST look up their email address in this glossary and use the EXACT email address for the 'to' parameter. DO NOT use placeholder emails. When the user asks you to TEXT or MESSAGE someone by name, you MUST look up their PHONE NUMBER in this glossary and use it for the 'to' parameter of send_imessage.\n`;
      contacts.forEach(c => {
        if (!c.ignore) {
          let line = `- NAME/ALIASES: ${c.aliases} => EMAIL: ${c.email}`;
          if (c.phone) line += ` | PHONE: ${c.phone}`;
          agentRole += line + '\n';
        }
      });
    }

    agentRole += `\n\n[CRITICAL]: You must review and remember the entire conversation history provided in the messages array. Your responses must inherently reflect knowledge of previous user requests in this specific chat thread. Do NOT treat each user message in isolation.`;

    // --- KNOWLEDGE BASE DATA IS NO LONGER APPENDED DIRECTLY TO AGENT ROLE ---
    console.log("[DEBUG SERVER] knowledgeBaseText length:", knowledgeBaseText?.length || 0);
    console.log("[DEBUG SERVER] knowledgeBaseText preview:", knowledgeBaseText?.substring(0, 150));


    // Gmail Auth Hook Configuration
    const isEmailAgent = agentId === "jarvis" || agentId === "drive_assistant" || agentId === "calendar_assistant" || agentId.includes("youtube_director");

    if (isEmailAgent) {
      agentRole += `\n\n[CRITICAL SYSTEM DIRECTIVE]: You are a fully authorized Executive Agent with active Gmail API Tools, Google Calendar API Tools, YouTube Integration Tools, Google Workspace Document Creation Tools, Survey Creation Tools, Past Conversation Memory, AND iMessage Tools.\n\n[CONVERSATION MEMORY]: You MUST USE your search_past_conversations tool when the user references something from a previous chat, asks "remember when...", "what did we discuss about...", "last time we talked about...", or any time they need information from a past session. This tool searches ALL of their saved chat history across all sessions. Use it proactively when you sense the user is referencing prior context you don't have in the current conversation.\n\n[EMAIL TOOLS]: You MUST USE your email tools (search_emails, delete_email, create_folder, block_sender, draft_outbound_email) when the user asks about email operations.\n\n[CALENDAR & MEET TOOLS]: You MUST USE your calendar tools (list_calendar_events, create_calendar_event, delete_calendar_event, update_calendar_event) when the user asks about their schedule, wants to book meetings, check availability, cancel events, or reschedule. When creating events, infer reasonable defaults: if no duration is specified assume 1 hour, and use the user's timezone. IMPORTANT: If the meeting is virtual or a video call, set 'addGoogleMeetLink' to true in create_calendar_event to automatically generate a Google Meet link.\n\n[YOUTUBE TOOLS]: You MUST USE your draft_youtube_video tool when the user asks you to draft a video, create a video concept, or store a YouTube video, PROVIDED you have gathered all necessary information. If your specific system instructions require you to ask questions first (like when a video file is attached), ask those questions BEFORE calling the tool. Do NOT just reply with the script in standard chat text; push it to their YouTube Dashboard via the execution tool.\n\n[WORKSPACE DOCUMENT TOOLS]: You MUST USE your document creation tools (create_google_document, create_google_slide_deck, create_google_sheet) when the user asks you to create Google Docs, Slides presentations, or Sheets spreadsheets. Create rich, detailed content. For documents, write full paragraphs. For slides, create multiple slides with clear titles and body text. For sheets, include headers and populated rows.\n\n[SURVEY TOOLS]: You MUST USE your create_and_send_survey tool when the user asks you to create a survey, questionnaire, or feedback form. When the user says to send it to people by name, you MUST look up the email addresses in the Contact Glossary above and pass them as recipientEmails. Include a good detailed topic description so the AI generates high-quality questions. If the user specifies a number of questions, pass it as questionCount.\n\n[iMESSAGE TOOLS]: You MUST USE your iMessage tools (list_imessage_chats, get_imessage_thread, search_imessages, send_imessage, summarize_imessages) when the user asks about their text messages, iMessages, or wants to text someone. Use list_imessage_chats to find conversations, get_imessage_thread to read specific chats, search_imessages to find messages by keyword, send_imessage to send texts, and summarize_imessages for an overview of recent/unread messages. When the user refers to a contact by name, look up their PHONE NUMBER in the Contact Glossary and construct the chatGuid as 'iMessage;-;+1XXXXXXXXXX'. Present message summaries in a clean, readable format.\n\n[MAPS & GEOLOCATION]: You do NOT have a direct Google Maps API. If the user asks for local business recommendations, directions, or deep Google Maps advice, you MUST use your web search capabilities (e.g. searching the web for local places or routes) to gather the data and present it effectively.\n\nThe current date and time is: ${new Date().toISOString()}.\n\nHOWEVER, if the user asks you to "read", "check", or "search" a DOCUMENT or your KNOWLEDGE BASE, DO NOT execute your tools. Instead, answer directly using the [KNOWLEDGE BASE DATA] provided below.`;
    }


    let gmail: any = null;
    let calendar: any = null;
    let docsApi: any = null;
    let slidesApi: any = null;
    let sheetsApi: any = null;
    let driveApi: any = null;
    let youtubeApi: any = null;

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
      youtubeApi = google.youtube({ version: 'v3', auth: oauth2Client });
    }


    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const createCompletionWithRetry = async (messagesArray: any[], useTools: boolean, maxRetries = 2) => {
      let attempts = 0;
      while (attempts < maxRetries) {
        try {
          return await groq.chat.completions.create({
            messages: messagesArray,
            model: selectedModel,
            ...(useTools ? { tools, tool_choice: "auto" } : {}),
          });
        } catch (err: any) {
          attempts++;
          console.warn(`[DEBUG] Groq API Attempt ${attempts} failed: ${err?.message || err}`);
          if (err.response) {
            console.warn(`[DEBUG] Error data:`, JSON.stringify(err.response?.data));
          }
          if (attempts >= maxRetries) {
            // Fallback: If it failed due to tools, try one last time WITHOUT tools
            const errMsg = err?.message || "";
            if (useTools && (errMsg.includes("tool_use_failed") || errMsg.includes("Failed to call a function") || errMsg.includes("tool_calls"))) {
              console.warn(`[DEBUG] Max retries reached for tools. Falling back to non-tool completion...`);
              const cleanMessages = messagesArray.filter((m: any) => m.role !== "tool" && !m.tool_calls);
              return await groq.chat.completions.create({
                messages: cleanMessages.length > 0 ? cleanMessages : messagesArray,
                model: selectedModel,
              });
            }
            throw err;
          }
        }
      }
    };

    // Payload Array Compilation
    let groqMessages: any[] = [
      { role: "system", content: agentRole + "\n\nCRITICAL CONVERSATION RULE: You must always respond in natural, conversational human text. NEVER output raw JSON payloads like {\"title\": \"...\", \"body\": \"...\"} in your message content unless you are explicitly calling a tool via the function calling API. If the user shares a fact, just acknowledge it conversationally." }
    ];

    // --- KNOWLEDGE BASE: SECONDARY SYSTEM PROMPT ---
    let combinedKnowledge = "";
    if (knowledgeBaseText && typeof knowledgeBaseText === "string" && knowledgeBaseText.trim().length > 0) {
      combinedKnowledge += knowledgeBaseText + "\n\n";
    }

    if (rawAgentId && rawAgentId.includes("nxtchapter")) {
      combinedKnowledge += "\n\n[HARDCODED ORGANIZATIONAL KNOWLEDGE BASE]\n" + nxtChapterKnowledge;
    }

    if (rawAgentId && rawAgentId.includes("soltheory")) {
      combinedKnowledge += "\n\n[HARDCODED ORGANIZATIONAL KNOWLEDGE BASE]\n" + solTheoryKnowledge;
    }

    if (orgBrainText && typeof orgBrainText === "string" && orgBrainText.trim().length > 0) {
      combinedKnowledge += "\n\n[EDITABLE ORGANIZATIONAL KNOWLEDGE BASE]\n" + orgBrainText;
    }

    if (combinedKnowledge.trim().length > 0) {
      const cappedKB = combinedKnowledge.substring(0, 100000); // Increased cap to 100k for the hardcoded knowledge
      groqMessages.push({
        role: "system",
        content: `IMPORTANT INSTRUCTION REGARDING KNOWLEDGE BASE:\nThe user has provided factual reference data for you below. You MUST use this data to confidently answer their questions, even if it introduces new context you did not know. Do NOT hallucinate tool calls or attempt to use the 'search' tool for this data - it is already completely provided to you inside the XML tags below. Do not mention that you are reading from a knowledge base unless explicitly asked. Do NOT say "I don't have information on..." if the answer is within the knowledge base.\n\n<knowledge_base>\n${cappedKB}\n</knowledge_base>`
      });
    }

    // --- P.A.C.T.: Personalized AI Conversation Training ---
    if (pactText && typeof pactText === "string" && pactText.trim().length > 0) {
      const cappedPact = pactText.substring(0, 5000);
      groqMessages.push({
        role: "system",
        content: `[P.A.C.T. — PERSONALIZED USER CONTEXT]\nYou have learned the following facts about this specific user from previous conversations. Use this knowledge naturally when relevant. Do not repeat these facts unprompted. Do not mention that you have a "PACT" or "training document" — just use the knowledge as if you naturally remember it.\n\n${cappedPact}`
      });
    }

    groqMessages.push(...messages);

    const useTools = !!(gmail || calendar || docsApi || youtubeApi || uid);

    console.log(`[DEBUG] agentId="${agentId}" rawAgentId="${rawAgentId}" isEmailAgent=${isEmailAgent} refreshToken=${refreshToken ? "YES" : "NO"}`);
    console.log(`[DEBUG] APIs: gmail=${!!gmail} calendar=${!!calendar} docs=${!!docsApi} youtube=${!!youtubeApi} useTools=${useTools}`);

    // PASS 1: Generate Standard Response OR Tool Target
    let completion: any = await createCompletionWithRetry(groqMessages, useTools);

    let responseMessage = completion.choices[0]?.message;
    console.log(`[DEBUG] LLM response: tool_calls=${responseMessage?.tool_calls?.length || 0} content_length=${responseMessage?.content?.length || 0}`);
    if (responseMessage?.tool_calls) {
      responseMessage.tool_calls.forEach((tc: any) => console.log(`[DEBUG] Tool requested: ${tc.function.name}`));
    }
    let loopCount = 0;
    let lastMeetLink: string | null = null;
    const MAX_LOOPS = 5;
    const executedTools: { name: string; args: any }[] = [];

    // If LLM generated tool_calls but no APIs are available, re-call without tools
    if (responseMessage?.tool_calls && !gmail && !calendar && !docsApi && !youtubeApi && !uid) {
      console.log(`[DEBUG] LLM called tools but no APIs available — re-calling without tools`);
      completion = await createCompletionWithRetry(groqMessages, false);
      responseMessage = completion.choices[0]?.message;
    }

    // Execute Tool Loop if Triggered
    while (responseMessage?.tool_calls && (gmail || calendar || docsApi || youtubeApi || uid) && loopCount < MAX_LOOPS) {
      groqMessages.push(responseMessage);

      // Sort tool calls: process calendar events BEFORE email drafts so Meet links are available
      const sortedToolCalls = [...responseMessage.tool_calls].sort((a: any, b: any) => {
        const order = (name: string) => name === 'create_calendar_event' ? 0 : name === 'draft_outbound_email' ? 2 : 1;
        return order(a.function.name) - order(b.function.name);
      });
      for (const toolCall of sortedToolCalls) {
        const functionName = toolCall.function.name;
        console.log(`[TOOL CALL] LLM requested tool: ${functionName} | args: ${toolCall.function.arguments?.substring(0, 200)}`);

        let functionResult = "";
        try {
          const args = JSON.parse(toolCall.function.arguments);
          executedTools.push({ name: functionName, args });

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
                  subject: h.find((x: any) => x.name === 'Subject')?.value,
                  from: h.find((x: any) => x.name === 'From')?.value,
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
            const requestBody: any = {
              summary: args.summary,
              description: args.description || '',
              start: { dateTime: args.startDateTime },
              end: { dateTime: args.endDateTime }
            };

            if (args.addGoogleMeetLink) {
              requestBody.conferenceData = {
                createRequest: {
                  requestId: `meet_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  conferenceSolutionKey: { type: "hangoutsMeet" }
                }
              };
            }

            const res = await calendar.events.insert({
              calendarId: 'primary',
              conferenceDataVersion: 1,
              requestBody
            });
            if (res.data.hangoutLink) {
              lastMeetLink = res.data.hangoutLink;
            }
            const meetLink = res.data.hangoutLink ? ` Meet Link: ${res.data.hangoutLink}` : '';
            functionResult = JSON.stringify({ result: `Event '${args.summary}' created successfully. Link: ${res.data.htmlLink}${meetLink}` });
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
            let finalBody = args.body;
            if (finalBody.includes('[INSERT_DOCUMENT_CONTEXT]')) {
              const lastContextMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && m.content.includes("Here are the extracted contents:"));
              if (lastContextMsg) {
                const match = lastContextMsg.content.match(/Here are the extracted contents:\n\n([\s\S]+?)(?=\n\n\[USER COMMENT\]:|$)/);
                finalBody = finalBody.replace('[INSERT_DOCUMENT_CONTEXT]', (match && match[1]) ? match[1].trim() : lastContextMsg.content);
              }
            }

            // ── AUTO-CREATE Google Meet link if requested ──
            let generatedMeetLink: string | null = lastMeetLink; // Use one from earlier in this batch if available
            if (args.includeGoogleMeetLink && calendar && !generatedMeetLink) {
              try {
                const meetStart = args.meetingDateTime || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                const meetEnd = new Date(new Date(meetStart).getTime() + 60 * 60 * 1000).toISOString();
                const calRes = await calendar.events.insert({
                  calendarId: 'primary',
                  conferenceDataVersion: 1,
                  requestBody: {
                    summary: args.meetingSummary || `Meeting with ${args.to}`,
                    start: { dateTime: meetStart },
                    end: { dateTime: meetEnd },
                    conferenceData: {
                      createRequest: {
                        requestId: `meet_auto_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                        conferenceSolutionKey: { type: "hangoutsMeet" }
                      }
                    }
                  }
                });
                generatedMeetLink = calRes.data.hangoutLink || null;
                console.log('[MEET LINK AUTO-GENERATED]', generatedMeetLink);
              } catch (meetErr: any) {
                console.error('[MEET LINK AUTO-CREATE FAILED]', meetErr.message);
              }
            }

            // Replace any placeholder the LLM might have written (catch-all patterns)
            if (generatedMeetLink) {
              // Specific known patterns
              finalBody = finalBody.replace(/\[MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_MEETING_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_GOOGLE_MEET_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[INSERT_LINK\]/gi, generatedMeetLink);
              finalBody = finalBody.replace(/\[GOOGLE_MEET_LINK\]/gi, generatedMeetLink);
              // Catch-all: any [...] or {...} containing 'meet' or 'link' (case insensitive)
              finalBody = finalBody.replace(/[\[{][^\]}]*(?:meet|link)[^\]}]*[\]}]/gi, generatedMeetLink);
            }

            // If includeGoogleMeetLink was requested and we got a link, append it to the body if no placeholder was replaced
            if (args.includeGoogleMeetLink && generatedMeetLink && !finalBody.includes(generatedMeetLink)) {
              finalBody += `\n\nGoogle Meet Link: ${generatedMeetLink}`;
            }

            // ── SERVER-SIDE EMAIL FORMATTING ──
            // First: normalize literal escaped newlines that LLM sometimes outputs as two chars
            finalBody = finalBody.replace(/\\n/g, '\n');

            // Split body into lines (by real newlines)
            let lines = finalBody.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

            // If still just one big block (LLM didn't use newlines), try to smart-split
            if (lines.length === 1) {
              const text = lines[0];
              // Detect greeting pattern at start: "Hello Steve," or "Hi Steve," or "Dear Steve,"
              const greetingMatch = text.match(/^((?:Hello|Hi|Hey|Dear|Good\s+(?:morning|afternoon|evening))[^.!?\n]*?[,.])\s*/i);
              // Detect sign-off pattern at end: "Best, Lucas" or "Cheers, Lucas" or "Thanks, Lucas"
              const signoffMatch = text.match(/\s*((?:Best|Cheers|Thanks|Thank\s+you|Regards|Sincerely|Warm\s+regards|Best\s+regards|Kind\s+regards|All\s+the\s+best)[,.]?\s*.{1,30})$/i);

              if (greetingMatch || signoffMatch) {
                let bodyMiddle = text;
                let greeting = '';
                let signoff = '';

                if (greetingMatch) {
                  greeting = greetingMatch[1];
                  bodyMiddle = bodyMiddle.slice(greetingMatch[0].length).trim();
                }
                if (signoffMatch) {
                  signoff = signoffMatch[1];
                  bodyMiddle = bodyMiddle.slice(0, bodyMiddle.length - signoffMatch[0].length).trim();
                }

                lines = [];
                if (greeting) lines.push(greeting);
                if (bodyMiddle) lines.push(bodyMiddle);
                if (signoff) {
                  // Split sign-off into "Cheers," and "Lucas" on separate lines
                  const signoffParts = signoff.split(/,\s*/);
                  if (signoffParts.length === 2) {
                    lines.push(signoffParts[0] + ',');
                    lines.push(signoffParts[1]);
                  } else {
                    lines.push(signoff);
                  }
                }
              }
            } else {
              // LLM used newlines — still enforce sign-off splitting
              const lastLine = lines[lines.length - 1];
              const signoffSplitMatch = lastLine.match(/^((?:Best|Cheers|Thanks|Thank\s+you|Regards|Sincerely|Warm\s+regards|Best\s+regards|Kind\s+regards|All\s+the\s+best)[,.])\s+(.+)$/i);
              if (signoffSplitMatch) {
                lines[lines.length - 1] = signoffSplitMatch[1];
                lines.push(signoffSplitMatch[2]);
              }
            }

            // Build HTML with proper paragraph spacing
            const htmlBody = lines.map((line: string, idx: number) => {
              // First line (greeting) and last two lines (sign-off) get single breaks
              // Body paragraphs get double breaks (paragraph spacing)
              return `<p style="margin:0 0 12px 0;">${line}</p>`;
            }).join('');

            const emailLines = [
              `To: ${args.to}`,
              `Subject: ${args.subject}`,
              `Content-Type: text/html; charset=utf-8`,
              ``,
              htmlBody
            ];
            const raw = Buffer.from(emailLines.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
            await gmail.users.drafts.create({
              userId: 'me',
              requestBody: { message: { raw } }
            });
            const meetNote = generatedMeetLink ? ` A Google Meet link (${generatedMeetLink}) was embedded.` : '';
            functionResult = JSON.stringify({ result: `Draft to ${args.to} successfully created.${meetNote}` });
          } else if (functionName === "create_google_document" && docsApi && driveApi) {
            // Create a blank Google Doc
            const createRes = await docsApi.documents.create({
              requestBody: { title: args.title }
            });
            const docId = createRes.data.documentId;

            // Insert the body text
            if (args.body) {
              let finalBody = args.body;
              if (finalBody.includes('[INSERT_DOCUMENT_CONTEXT]')) {
                const lastContextMsg = messages.slice().reverse().find((m: any) => m.role === 'user' && m.content.includes("Here are the extracted contents:"));
                if (lastContextMsg) {
                  const match = lastContextMsg.content.match(/Here are the extracted contents:\n\n([\s\S]+?)(?=\n\n\[USER COMMENT\]:|$)/);
                  finalBody = finalBody.replace('[INSERT_DOCUMENT_CONTEXT]', (match && match[1]) ? match[1].trim() : lastContextMsg.content);
                }
              }

              // Insert all text first
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: {
                  requests: [{
                    insertText: {
                      location: { index: 1 },
                      text: finalBody
                    }
                  }]
                }
              });

              // Now apply formatting (font + line spacing)
              const fontFamily = args.font || "Arial";
              const spacingMode = args.lineSpacing || "double";
              const lineSpacingValue = spacingMode === "single" ? 100 : 200; // 100 = 1.0, 200 = 2.0 (in hundredths of a point-ratio)

              const textLength = finalBody.length;
              const formatRequests: any[] = [];

              // Apply font family + size 12pt to the entire body
              formatRequests.push({
                updateTextStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  textStyle: {
                    fontFamily: fontFamily,
                    fontSize: { magnitude: 12, unit: "PT" }
                  },
                  fields: "fontFamily,fontSize"
                }
              });

              // Apply line spacing to entire body
              formatRequests.push({
                updateParagraphStyle: {
                  range: { startIndex: 1, endIndex: 1 + textLength },
                  paragraphStyle: {
                    lineSpacing: lineSpacingValue,
                    spaceAbove: { magnitude: 0, unit: "PT" },
                    spaceBelow: { magnitude: 0, unit: "PT" }
                  },
                  fields: "lineSpacing,spaceAbove,spaceBelow"
                }
              });

              // Detect headings marked with "## " and apply HEADING_2 style
              const lines = finalBody.split('\n');
              let charIdx = 1; // Document starts at index 1
              for (const line of lines) {
                if (line.startsWith('## ')) {
                  // Apply heading style to this line
                  const headingStart = charIdx;
                  const headingEnd = charIdx + line.length;
                  formatRequests.push({
                    updateParagraphStyle: {
                      range: { startIndex: headingStart, endIndex: headingEnd },
                      paragraphStyle: { namedStyleType: "HEADING_2" },
                      fields: "namedStyleType"
                    }
                  });
                  // Remove the "## " prefix from the text
                  formatRequests.push({
                    deleteContentRange: {
                      range: { startIndex: headingStart, endIndex: headingStart + 3 }
                    }
                  });
                }
                charIdx += line.length + 1; // +1 for the newline
              }

              // Apply formatting requests (process in reverse order for heading deletions to maintain correct indices)
              if (formatRequests.length > 0) {
                // Separate delete requests (must be applied separately, in reverse order)
                const deleteReqs = formatRequests.filter((r: any) => r.deleteContentRange);
                const styleReqs = formatRequests.filter((r: any) => !r.deleteContentRange);

                // Apply style requests first
                if (styleReqs.length > 0) {
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: styleReqs }
                  });
                }

                // Apply delete requests in reverse order so indices stay correct
                if (deleteReqs.length > 0) {
                  deleteReqs.reverse();
                  await docsApi.documents.batchUpdate({
                    documentId: docId,
                    requestBody: { requests: deleteReqs }
                  });
                }
              }
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

          } else if (functionName === "search_google_drive" && driveApi) {
            const res = await driveApi.files.list({
              q: `name contains '${args.query}' and trashed = false`,
              fields: "files(id, name, mimeType, webViewLink)",
              pageSize: 10
            });
            const files = res.data.files || [];
            functionResult = JSON.stringify({ result: files.length > 0 ? files : "No files found." });

          } else if (functionName === "read_drive_document" && docsApi) {
            try {
              const res = await docsApi.documents.get({ documentId: args.fileId });
              const content = res.data.body?.content || [];
              let text = "";
              content.forEach((el: any) => {
                if (el.paragraph && el.paragraph.elements) {
                  el.paragraph.elements.forEach((elem: any) => {
                    if (elem.textRun && elem.textRun.content) text += elem.textRun.content;
                  });
                }
              });
              functionResult = JSON.stringify({ result: text || "Document is empty or cannot be read as text." });
            } catch (err: any) {
              functionResult = JSON.stringify({ error: "Failed to read document. Make sure it is a Google Doc. " + err.message });
            }
          } else if (functionName === "draft_youtube_video" && docsApi && driveApi) {
            console.log("[YOUTUBE TOOL] draft_youtube_video triggered! Args:", JSON.stringify(args));
            console.log("[YOUTUBE TOOL] videoUrl available:", !!videoUrl);
            try {
              // 1. Create the Script Doc in Google Drive
              console.log("[YOUTUBE TOOL] Creating Google Doc script...");
              const docRes = await docsApi.documents.create({
                requestBody: { title: `Script: ${args.title}` }
              });
              const docId = docRes.data.documentId;

              const scriptContent = args.script || "Script content will be added here.";
              await docsApi.documents.batchUpdate({
                documentId: docId,
                requestBody: { requests: [{ insertText: { location: { index: 1 }, text: scriptContent } }] }
              });

              await driveApi.files.update({
                fileId: docId,
                requestBody: { properties: { createdByAI: 'true' } }
              });

              const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
              const tagsString = Array.isArray(args.tags) ? args.tags.join(', ') : (args.tags || '');
              const fullDescription = `${args.description}\n\nTags: ${tagsString}\n\n🎥 Full Script: ${docUrl}`;
              console.log("[YOUTUBE TOOL] Script doc created:", docUrl);

              // 2. If user uploaded a video file, upload it to YouTube as a REAL video draft
              if (videoUrl && youtubeApi) {
                try {
                  console.log("[YOUTUBE TOOL] Downloading video from Firebase Storage...");
                  const videoFetchRes = await fetch(videoUrl);
                  if (!videoFetchRes.ok) throw new Error(`Failed to download video: ${videoFetchRes.status}`);
                  const videoBuffer = Buffer.from(await videoFetchRes.arrayBuffer());
                  console.log(`[YOUTUBE TOOL] Video downloaded: ${videoBuffer.length} bytes`);

                  const { Readable } = require('stream');
                  const videoStream = new Readable();
                  videoStream.push(videoBuffer);
                  videoStream.push(null);

                  console.log("[YOUTUBE TOOL] Uploading video to YouTube...");
                  const ytRes = await youtubeApi.videos.insert({
                    part: ['snippet', 'status'],
                    requestBody: {
                      snippet: {
                        title: args.title,
                        description: fullDescription,
                        tags: args.tags || [],
                        categoryId: '27'
                      },
                      status: {
                        privacyStatus: 'private',
                        selfDeclaredMadeForKids: false
                      }
                    },
                    media: { body: videoStream }
                  });

                  const videoId = ytRes.data.id;
                  console.log("[YOUTUBE TOOL] Video uploaded! ID:", videoId);
                  functionResult = JSON.stringify({
                    result: `Video draft uploaded to YouTube!\n- YouTube Video: https://studio.youtube.com/video/${videoId}/edit (Private)\n- Script Doc: ${docUrl}\n\nYour video "${args.title}" is now in YouTube Studio as a private draft. Review and publish when ready!\n\n[YOUTUBE_METADATA: ID=${videoId}, TYPE=video]`
                  });
                } catch (uploadErr: any) {
                  console.error("[YOUTUBE TOOL] Video upload failed:", uploadErr.message);
                  // Fall back to playlist if upload fails
                  functionResult = JSON.stringify({
                    result: `Video upload failed (${uploadErr.message}), but your Script Doc was created: ${docUrl}. Try re-uploading the video file.`
                  });
                }
              } else {
                // No video file — create a YouTube Playlist as the draft container
                let playlistUrl = "";
                let playlistIdStr = "";
                if (youtubeApi) {
                  try {
                    console.log("[YOUTUBE TOOL] No video file — creating YouTube playlist...");
                    const playlistRes = await youtubeApi.playlists.insert({
                      part: ['snippet', 'status'],
                      requestBody: {
                        snippet: {
                          title: `[DRAFT] ${args.title}`,
                          description: fullDescription,
                          tags: args.tags || []
                        },
                        status: { privacyStatus: 'private' }
                      }
                    });
                    const playlistId = playlistRes.data.id;
                    playlistIdStr = playlistId;
                    playlistUrl = `https://www.youtube.com/playlist?list=${playlistId}`;
                    console.log("[YOUTUBE TOOL] Playlist created:", playlistId);
                  } catch (playlistErr: any) {
                    console.error("[YOUTUBE TOOL] Playlist creation failed:", playlistErr.message);
                  }
                }
                functionResult = JSON.stringify({
                  result: `Video concept created (no video file attached)!\n- YouTube Draft Playlist: ${playlistUrl || "unavailable"}\n- Script Doc: ${docUrl}\n\nUpload a video file on the dashboard to create a full YouTube video draft next time.\n\n[YOUTUBE_METADATA: ID=${playlistIdStr}, TYPE=playlist]`
                });
              }
            } catch (err: any) {
              console.error("[YOUTUBE TOOL] Error:", err.message);
              functionResult = JSON.stringify({ error: "Failed to create video concept: " + err.message });
            }
          } else if (functionName === "create_and_send_survey") {
            try {
              console.log("[SURVEY TOOL] Creating survey:", args.topic);

              // Step 1: Generate survey questions using Groq
              const surveyGroq = new Groq({ apiKey: process.env.GROQ_API_KEY });
              const surveyCompletion = await surveyGroq.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content: `You are an expert survey designer. The user will give you a description of what they want to survey. 
You must return a valid JSON object representing the survey. DO NOT wrap it in markdown blockquotes like \`\`\`json. Just return raw JSON.
The JSON must have this exact structure:
{
  "title": "Survey Title",
  "description": "A brief description of the survey's purpose",
  "questions": [
    { "id": "q1", "type": "text", "prompt": "Question text" },
    { "id": "q2", "type": "choice", "prompt": "Question text", "options": ["Option 1", "Option 2", "Option 3"] },
    { "id": "q3", "type": "rating", "prompt": "Rate something from 1 to 5" }
  ]
}
Allowed types for questions are: "text", "choice", "rating".
Generate exactly ${args.questionCount || 10} questions. Make the survey professional and perfectly tailored to their request. Use a good mix of text, choice, and rating question types.`
                  },
                  { role: "user", content: args.topic }
                ],
                model: selectedModel,
                temperature: 0.7,
                response_format: { type: "json_object" }
              });

              let surveyJson = surveyCompletion.choices[0]?.message?.content || "";
              surveyJson = surveyJson.trim().replace(/^```json/, "").replace(/^```/, "").replace(/```$/, "").trim();
              const surveyData = JSON.parse(surveyJson);
              console.log("[SURVEY TOOL] Generated survey:", surveyData.title, "with", surveyData.questions?.length, "questions");

              // Step 2: Save to Firestore using Admin SDK
              initAdmin();
              const adminDb = getAdminFirestore();

              // Extract user email from soul context
              const userEmailMatch = soul?.match(/email address is: ([^\s.]+@[^\s.]+\.[^\s]+)/);
              const userEmail = userEmailMatch?.[1] || "unknown@soltheory.com";
              const userDomain = userEmail.split("@")[1] || "soltheory.com";

              const surveyDoc = await adminDb.collection("custom_surveys").add({
                ...surveyData,
                userId: uid || "unknown",
                creatorEmail: userEmail,
                authorName: args.authorName || "",
                visibility: "specific",
                domain: userDomain,
                invitedEmails: args.recipientEmails || [],
                createdAt: new Date()
              });

              const surveyUrl = `https://soltheory.com/survey/${surveyDoc.id}`;
              console.log("[SURVEY TOOL] Survey saved:", surveyDoc.id, "URL:", surveyUrl);

              // Step 3: Send email invitations via Gmail API
              let emailResults: string[] = [];
              if (gmail && args.recipientEmails && args.recipientEmails.length > 0) {
                for (let i = 0; i < args.recipientEmails.length; i++) {
                  const recipientEmail = args.recipientEmails[i];
                  const recipientName = args.recipientNames?.[i] || recipientEmail.split("@")[0];

                  const emailBody = `Hello ${recipientName},\n\nYou've been invited to take a survey: "${surveyData.title}"\n\n${surveyData.description || ""}\n\nPlease click the link below to participate:\n${surveyUrl}\n\nThank you for your time and feedback!\n\nBest regards`;

                  const emailSubject = `Survey Invitation: ${surveyData.title}`;

                  const rawEmail = [
                    `To: ${recipientEmail}`,
                    `Subject: ${emailSubject}`,
                    `Content-Type: text/plain; charset="UTF-8"`,
                    "",
                    emailBody
                  ].join("\n");

                  const encodedEmail = Buffer.from(rawEmail).toString("base64url");

                  try {
                    await gmail.users.messages.send({
                      userId: "me",
                      requestBody: { raw: encodedEmail }
                    });
                    emailResults.push(`✅ Sent to ${recipientName} (${recipientEmail})`);
                    console.log("[SURVEY TOOL] Email sent to:", recipientEmail);
                  } catch (emailErr: any) {
                    emailResults.push(`❌ Failed to send to ${recipientEmail}: ${emailErr.message}`);
                    console.error("[SURVEY TOOL] Email send error:", emailErr.message);
                  }
                }
              }

              functionResult = JSON.stringify({
                result: `Survey "${surveyData.title}" created successfully with ${surveyData.questions?.length || 0} questions!\n\nSurvey Link: ${surveyUrl}\n\nEmail Status:\n${emailResults.length > 0 ? emailResults.join("\n") : "No emails sent (no recipients specified)"}`
              });
            } catch (surveyErr: any) {
              console.error("[SURVEY TOOL] Error:", surveyErr.message);
              functionResult = JSON.stringify({ error: "Failed to create survey: " + surveyErr.message });
            }
          } else if (functionName === "search_past_conversations") {
            try {
              if (!uid) throw new Error("User not authenticated");
              initAdmin();
              const adminDb = getAdminFirestore();
              const sessionsSnap = await adminDb
                .collection("users")
                .doc(uid)
                .collection("jarvis_sessions")
                .orderBy("updatedAt", "desc")
                .limit(100)
                .get();

              if (sessionsSnap.empty) {
                functionResult = JSON.stringify({ result: "No past conversations found." });
              } else {
                const searchQuery = (args.query || "").toLowerCase();
                const searchTerms = searchQuery.split(/\s+/).filter((t: string) => t.length > 2);

                const results: any[] = [];
                sessionsSnap.forEach((docSnap: any) => {
                  const data = docSnap.data();
                  const msgs: any[] = data.messages || [];
                  let score = 0;
                  const matchingMsgs: any[] = [];

                  // Title match
                  if ((data.title || "").toLowerCase().includes(searchQuery)) score += 10;

                  // Message matches
                  msgs.forEach((m: any) => {
                    const text = (m.text || "").toLowerCase();
                    if (text.includes(searchQuery)) { score += 5; matchingMsgs.push(m.text.substring(0, 200)); }
                    else { searchTerms.forEach((term: string) => { if (text.includes(term)) { score += 1; matchingMsgs.push(m.text.substring(0, 150)); } }); }
                  });

                  if (score > 0) {
                    const dateStr = data.updatedAt ? new Date(data.updatedAt).toLocaleDateString() : "unknown date";
                    results.push({
                      title: data.title,
                      date: dateStr,
                      score,
                      snippets: matchingMsgs.slice(0, 4),
                    });
                  }
                });

                results.sort((a, b) => b.score - a.score);
                const topResults = results.slice(0, 5);
                functionResult = JSON.stringify({
                  result: topResults.length > 0
                    ? `Found ${topResults.length} relevant past conversations:\n\n` + topResults.map((r, i) => `${i + 1}. "${r.title}" (${r.date})\n   Matching messages: ${r.snippets.join(" | ")}`).join("\n\n")
                    : "No past conversations matched that query."
                });
              }
            } catch (searchErr: any) {
              functionResult = JSON.stringify({ error: "Failed to search past conversations: " + searchErr.message });
            }
          } else if (functionName === "list_imessage_chats") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const userData = userDoc.data();
              if (!userData?.twilioPhoneNumber) {
                functionResult = JSON.stringify({ result: "Messaging is not set up yet. Tell the user to go to the Messages page in the sidebar to activate their messaging number." });
              } else {
                const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(500).get();
                const convMap = new Map<string, any>();
                snapshot.docs.forEach((d: any) => {
                  const data = d.data();
                  const contact = data.direction === "inbound" ? data.from : data.to;
                  if (!convMap.has(contact)) {
                    convMap.set(contact, { contact, lastMessage: data.body || "", lastTime: data.createdAt, unreadCount: 0, messageCount: 0 });
                  }
                  const conv = convMap.get(contact)!;
                  conv.messageCount++;
                  if (data.direction === "inbound" && !data.read) conv.unreadCount++;
                });
                const convos = Array.from(convMap.values()).sort((a: any, b: any) => new Date(b.lastTime).getTime() - new Date(a.lastTime).getTime());
                functionResult = JSON.stringify({ result: convos.length > 0 ? convos : "No text conversations found." });
              }
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to list conversations: " + imErr.message });
            }
          } else if (functionName === "get_imessage_thread") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(100).get();
              const normalizedContact = (args.contact || "").replace(/[^+\d]/g, "");
              const msgs = snapshot.docs.map((d: any) => d.data()).filter((m: any) => (m.from || "").includes(normalizedContact) || (m.to || "").includes(normalizedContact)).map((m: any) => ({
                from: m.direction === 'outbound' ? 'You' : m.from,
                text: m.body || '[Media]',
                time: m.createdAt,
              }));
              functionResult = JSON.stringify({ result: msgs.length > 0 ? msgs : "No messages found in this conversation." });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to get message thread: " + imErr.message });
            }
          } else if (functionName === "search_imessages") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(200).get();
              const searchQuery = (args.query || "").toLowerCase();
              const results = snapshot.docs.map((d: any) => d.data()).filter((m: any) => (m.body || "").toLowerCase().includes(searchQuery)).slice(0, 20).map((m: any) => ({
                from: m.direction === 'outbound' ? 'You' : m.from,
                to: m.to,
                text: (m.body || "").substring(0, 200),
                time: m.createdAt,
              }));
              functionResult = JSON.stringify({ result: results.length > 0 ? results : `No messages found matching "${args.query}".` });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to search messages: " + imErr.message });
            }
          } else if (functionName === "send_imessage") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const myNumber = userDoc.data()?.twilioPhoneNumber;
              if (!myNumber) throw new Error("Messaging not set up. Tell user to go to Messages page first.");
              const baseUrl = process.env.NEXT_PUBLIC_APP_URL && process.env.NEXT_PUBLIC_APP_URL !== 'http://localhost:3000'
                ? process.env.NEXT_PUBLIC_APP_URL
                : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
              const res = await fetch(`${baseUrl}/api/sms/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ from: myNumber, to: args.to, message: args.message }),
              });
              const data = await res.json();
              if (!res.ok) throw new Error(data.error);
              // Cache sent message
              await adminDb.collection("users").doc(uid).collection("sms_messages").add({
                sid: data.sid, from: myNumber, to: data.to || args.to, body: args.message,
                direction: "outbound", status: "sent", createdAt: new Date().toISOString(),
              });
              functionResult = JSON.stringify({ result: `Text message sent successfully to ${args.to}.` });
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to send text: " + imErr.message });
            }
          } else if (functionName === "summarize_imessages") {
            try {
              initAdmin();
              const adminDb = getAdminFirestore();
              const userDoc = await adminDb.collection("users").doc(uid).get();
              const myNumber = userDoc.data()?.twilioPhoneNumber;
              if (!myNumber) {
                functionResult = JSON.stringify({ result: "Messaging is not set up. Tell the user to go to the Messages page to get their messaging number." });
              } else {
                const snapshot = await adminDb.collection("users").doc(uid).collection("sms_messages").orderBy("createdAt", "desc").limit(500).get();
                const convMap = new Map<string, any>();
                snapshot.docs.forEach((d: any) => {
                  const data = d.data();
                  const contact = data.direction === "inbound" ? data.from : data.to;
                  if (!convMap.has(contact)) convMap.set(contact, { contact, lastMessage: data.body || "", lastTime: data.createdAt, unreadCount: 0 });
                  if (data.direction === "inbound" && !data.read) convMap.get(contact)!.unreadCount++;
                });
                const convos = Array.from(convMap.values());
                const unread = convos.filter((c: any) => c.unreadCount > 0);
                functionResult = JSON.stringify({ result: {
                  myNumber, totalConversations: convos.length, unreadConversations: unread.length,
                  totalUnreadMessages: unread.reduce((acc: number, c: any) => acc + c.unreadCount, 0),
                  recentConversations: convos.slice(0, 10),
                }});
              }
            } catch (imErr: any) {
              functionResult = JSON.stringify({ error: "Failed to summarize messages: " + imErr.message });
            }
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

    // Log AI usage (non-blocking, don't let it crash the request)
    const inputTokens = completion?.usage?.prompt_tokens || 0;
    const outputTokens = completion?.usage?.completion_tokens || 0;
    const totalTokens = completion?.usage?.total_tokens || 0;
    const model = selectedModel;
    try {
      logAIUsage({
        userId: uid || "anonymous",
        orgId: isNxtChapter ? "nxtchapter" : "soltheory",
        model,
        provider: "groq",
        endpoint: "/api/chat",
        inputTokens,
        outputTokens,
        totalTokens,
        costUsd: calculateGroqCost(model, inputTokens, outputTokens),
        timestamp: new Date(),
      });
    } catch (logErr) {
      console.warn("[AI Usage] Logging failed (non-fatal):", (logErr as any)?.message);
    }

    // --- P.A.C.T. Extraction (extract facts, return to client for saving) ---
    // --- Sanitize response: strip hallucinated XML tool calls ---
    const sanitizeResponse = (text: string): string => {
      if (!text) return text;
      // Remove <function=...>...</function>, <search_past_conversations>...</search_past_conversations>, etc.
      let clean = text.replace(/<\/?(?:function|search_past_conversations|search_emails|create_folder|send_email|draft_email|delete_email|create_calendar_event|get_calendar_events|create_google_document|create_youtube_video|create_spreadsheet|create_presentation|search_google_drive|read_google_drive_file)[^>]*>/gi, '');
      // Remove JSON-like tool args that were hallucinated inline
      clean = clean.replace(/\{"(?:query|folderName|to|subject|body|title|date|time|description|videoTitle|content|searchQuery|fileId)"\s*:\s*"[^"]*"\s*\}/g, '');
      // Collapse multiple whitespace/newlines into single space
      clean = clean.replace(/\n{3,}/g, '\n\n').trim();
      // If the cleaned response is empty or too short, provide a fallback
      if (clean.length < 5) {
        clean = "I've noted that information. How can I help you today?";
      }
      return clean;
    };

    const finalResponse = sanitizeResponse(responseMessage?.content || "");

    // Default Raw Response
    return NextResponse.json({
      response: finalResponse,
      usage: totalTokens,
      executedTools: executedTools.length > 0 ? executedTools : undefined
    });
  } catch (error: any) {
    console.error("[DEBUG SERVER] Groq Error Catch Block:", error?.message || error, JSON.stringify(error?.error || {}));

    const errMsg = error?.message || "";
    if (errMsg.includes("tool_use_failed") || errMsg.includes("Failed to call a function") || errMsg.includes("tool_calls")) {
      return NextResponse.json({ response: "I encountered a tool execution error. Could you please try asking me that one more time?" });
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
