import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore } from 'firebase-admin/firestore';
import { createStreamingCompletion } from '@/lib/llm-router';
import { retrieveActivityContext } from '@/lib/activity-retriever';

export const runtime = 'nodejs'; // Use Node.js runtime for firebase-admin compatibility

export async function POST(req: NextRequest) {
  try {
    // 1. Auth: verifyRequest(req) -> get auth.uid
    const auth = await verifyRequest(req);
    if (!auth.ok) {
      return auth.response;
    }

    // Parse input
    const body = await req.json().catch(() => ({}));
    const { query, emailContent, emailSubject, contactId, orgId } = body;

    // Validate required fields
    if (!query || !emailContent || !contactId || !orgId) {
      return NextResponse.json(
        { error: 'Missing required fields (query, emailContent, contactId, orgId)' },
        { status: 400 }
      );
    }

    // 2. Fetch context from Firestore (admin SDK, in parallel)
    await initAdmin();
    const db = getFirestore();

    // Promises for parallel fetching
    const contactRef = db.doc(`orgs/${orgId}/crm-instances/default/contacts/${contactId}`);
    const activitiesRef = contactRef.collection('activities');
    const orgRef = db.doc(`organizations/${orgId}`);
    const userRef = db.doc(`users/${auth.uid}`);
    const guidedProfileRef = db.doc(`orgs/${orgId}/guided-profiles/${auth.uid}`);

    let contactData: any = {};
    let activitiesData: any[] = [];
    let orgData: any = {};
    let userData: any = {};
    let guidedProfileData: any = {};

    try {
      const [
        contactSnap,
        activitiesSnap,
        orgSnap,
        userSnap,
        guidedProfileSnap,
      ] = await Promise.all([
        contactRef.get().catch(() => null),
        activitiesRef.orderBy('timestamp', 'desc').limit(30).get().catch(() => null),
        orgRef.get().catch(() => null),
        userRef.get().catch(() => null),
        guidedProfileRef.get().catch(() => null),
      ]);

      if (contactSnap && contactSnap.exists) contactData = contactSnap.data();
      if (activitiesSnap) {
        activitiesData = activitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
      if (orgSnap && orgSnap.exists) orgData = orgSnap.data();
      if (userSnap && userSnap.exists) userData = userSnap.data();
      if (guidedProfileSnap && guidedProfileSnap.exists) guidedProfileData = guidedProfileSnap.data();
    } catch (fetchError) {
      console.warn('Error fetching some context from Firestore:', fetchError);
      // Continue with empty defaults
    }

    // 3. Run activity retriever
    let retrievedContext: any[] = [];
    try {
      retrievedContext = retrieveActivityContext(query, {
        emailContent,
        emailSubject,
        activities: activitiesData,
        crmContactData: contactData,
        orgBrainText: Array.isArray(orgData?.brainRules)
          ? orgData.brainRules.join('\n')
          : (orgData?.brain || orgData?.orgBrain || ''),
        pactText: userData?.pactText || '',
        guidedProfileText: guidedProfileData?.answers ? JSON.stringify(guidedProfileData.answers) : '',
      });
    } catch (err) {
      console.warn('Activity retriever failed, using empty context', err);
    }

    // Format retrieved snippets
    const contextSnippets = retrievedContext
      .map((item: any, i: number) => `${i + 1}. [${item.source || 'Context'}] ${item.text || item.snippet || ''}`)
      .join('\n\n');

    // 4. Build system prompt
    const safeEmailContent = String(emailContent).substring(0, 3000);
    const safeOrgDesc = String(orgData?.orgDescription || '').substring(0, 500);
    
    const systemPrompt = `You are JARVIS, an AI assistant embedded in the CRM. The user is looking at a specific email and asking you a contextual question about it.

You have access to:
- The email they're reading
- The CRM contact's full profile and activity history
- The organization's knowledge base and brain rules
- Relevant context snippets retrieved based on their question

Be concise, helpful, and specific. Reference the email content directly when relevant.
Use markdown formatting for readability.

--- EMAIL BEING DISCUSSED ---
Subject: ${emailSubject || '(No subject)'}
${safeEmailContent}

--- CONTACT INFO ---
Name: ${contactData.firstName || ''} ${contactData.lastName || ''}
Email: ${contactData.email || 'N/A'}
Company: ${contactData.company || 'N/A'}
Status: ${contactData.leadStatus || 'N/A'}
${contactData.aiNotes ? `AI Notes:\n${contactData.aiNotes}` : ''}

--- RELEVANT CONTEXT (retrieved based on your question) ---
${contextSnippets || 'No additional relevant context found.'}

--- ORGANIZATION CONTEXT ---
${safeOrgDesc}`;

    // 5. Call LLM via streaming and stream SSE response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          const completionStream = createStreamingCompletion({
            model: 'gemini-2.5-flash',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query }
            ]
          });

          for await (const chunk of completionStream) {
            if (chunk.token) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', content: chunk.token })}\n\n`)
              );
            }
            if (chunk.done) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
              );
            }
          }
        } catch (llmError) {
          console.error('LLM streaming error:', llmError);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: 'LLM failed to respond' })}\n\n`)
          );
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
