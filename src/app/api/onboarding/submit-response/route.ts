import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';
import { generateSignedPdf } from '@/lib/generate-signed-pdf';
import { sendSignedCopy } from '@/lib/send-signed-copy';
import { notifyOnboardingTaskCompleted } from '@/lib/onboarding-notifications';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const body = await req.json();
    const { orgId, taskId, responseType, responseData } = body;

    if (!orgId || !taskId || !responseType || !responseData) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    initAdmin();
    const db = getFirestore();

    const taskRef = db.collection('action_board_tasks').doc(taskId);
    const taskDoc = await taskRef.get();

    if (!taskDoc.exists) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = taskDoc.data()!;
    if (task.assignedTo !== auth.uid) {
      return NextResponse.json({ error: 'Unauthorized: User is not assigned to this task' }, { status: 403 });
    }

    const metadata = task.metadata || {};
    const interactiveContent = metadata.interactiveContent;
    let passed = true;
    let score: number | undefined = undefined;
    let message = 'Response submitted successfully';
    let needsReview = false;

    const responseEntry: any = {
      type: responseType,
      data: responseData,
      submittedAt: new Date().toISOString(),
      submittedBy: auth.uid,
    };

    if (responseType === 'quiz') {
      if (!interactiveContent || interactiveContent.type !== 'quiz') {
        return NextResponse.json({ error: 'Task is not a quiz' }, { status: 400 });
      }

      const userResponses = (metadata.userResponse || []) as any[];
      const attempts = userResponses.filter(r => r.type === 'quiz').length;
      if (interactiveContent.maxAttempts > 0 && attempts >= interactiveContent.maxAttempts) {
        return NextResponse.json({ error: 'Maximum attempts reached' }, { status: 403 });
      }

      let correctCount = 0;
      const totalQuestions = interactiveContent.questions.length;
      
      const answerMap = responseData.answers || responseData;
      const gradedAnswers = interactiveContent.questions.map((q: any) => {
        const userAnswer = answerMap[q.id];
        const correctOptions = q.options.filter((o: any) => o.isCorrect).map((o: any) => o.id);
        
        let isCorrect = false;
        if (Array.isArray(userAnswer)) {
          isCorrect = userAnswer.length === correctOptions.length && userAnswer.every(a => correctOptions.includes(a));
        } else if (userAnswer !== undefined && userAnswer !== null) {
          isCorrect = correctOptions.length === 1 && correctOptions[0] === userAnswer;
        }

        if (isCorrect) correctCount++;
        return { questionId: q.id, userAnswer, isCorrect };
      });

      score = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 100;
      passed = score >= (interactiveContent.passingScore || 80);
      responseEntry.score = score;
      responseEntry.passed = passed;
      responseEntry.gradedAnswers = gradedAnswers;
      
      message = passed ? `Passed with score ${score.toFixed(1)}%` : `Failed with score ${score.toFixed(1)}%`;

    } else if (responseType === 'policy_acknowledgment') {
      if (!interactiveContent || interactiveContent.type !== 'policy_acknowledgment') {
        return NextResponse.json({ error: 'Task is not a policy acknowledgment' }, { status: 400 });
      }

      // ── Requirement 1: Validate explicit ESIGN consent ──
      if (!responseData.esignConsent) {
        return NextResponse.json({ 
          error: 'Electronic signature consent is required. Please check the ESIGN consent box before signing.' 
        }, { status: 400 });
      }

      // ── Requirement 3: Capture comprehensive audit trail metadata ──
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';

      // Policy text hash (for version tracking)
      const policyHash = crypto.createHash('sha256').update(interactiveContent.policyText || '').digest('hex');

      // Generate unique Document Version ID
      const shortHash = policyHash.substring(0, 8);
      const documentVersionId = `DOC-${taskId.substring(0, 8)}-${shortHash}-${Date.now()}`;

      // ── Requirement 2: Look up signer's role at time of signing ──
      let signerRole = 'unknown';
      try {
        const memberDoc = await db.collection('orgs').doc(orgId).collection('members').doc(auth.uid).get();
        if (memberDoc.exists) {
          signerRole = memberDoc.data()?.role || 'user';
        }
      } catch { /* default to unknown */ }

      // ── Requirement 4: Composite tamper-evident seal ──
      const sealPayload = JSON.stringify({
        policyText: interactiveContent.policyText || '',
        signatureData: responseData.signatureData || '',
        typedName: responseData.typedName || '',
        signerUid: auth.uid,
        signerEmail: auth.email,
        timestamp: responseEntry.submittedAt,
        documentVersionId,
      });
      const compositeSealHash = crypto.createHash('sha256').update(sealPayload).digest('hex');

      // Store all compliance fields in the response entry
      responseEntry.ipAddress = ip;
      responseEntry.userAgent = userAgent;
      responseEntry.policyHash = policyHash;
      responseEntry.compositeSealHash = compositeSealHash;
      responseEntry.documentVersionId = documentVersionId;
      responseEntry.signature = responseData.signature || responseData.signatureData || null;
      responseEntry.typedName = responseData.typedName || null;
      responseEntry.acknowledged = responseData.acknowledged ?? true;
      responseEntry.signerUid = auth.uid;
      responseEntry.signerEmail = auth.email;
      responseEntry.signerRole = signerRole;
      responseEntry.esignConsentGranted = true;
      responseEntry.esignConsentTimestamp = responseData.esignConsentTimestamp || responseEntry.submittedAt;

      // ── Requirement 5: Auto-generate PDF and email signed copy ──
      // This runs after the task is updated (below) — fire-and-forget to not block the response
      const signerName = responseData.typedName || auth.email.split('@')[0];

      // Fetch signer info for PDF
      let signerDisplayName = signerName;
      let signerEmail = auth.email;
      try {
        const userDoc = await db.collection('users').doc(auth.uid).get();
        if (userDoc.exists) {
          const udata = userDoc.data();
          if (udata?.displayName) signerDisplayName = udata.displayName;
          if (udata?.email) signerEmail = udata.email;
        }
      } catch { /* use defaults */ }

      // Generate PDF and email it (non-blocking — wrapped in its own try/catch)
      const pdfPromise = (async () => {
        try {
          const orgLabel = orgId.charAt(0).toUpperCase() + orgId.slice(1);

          const pdfResult = await generateSignedPdf({
            orgId,
            taskId,
            taskTitle: task.title || 'Policy Acknowledgment',
            assignedTo: task.assignedTo,
            signerName: signerDisplayName,
            signerEmail,
            signerRole,
            signerUid: auth.uid,
            policyText: interactiveContent.policyText || '',
            acknowledgmentText: interactiveContent.acknowledgmentText || 'I have read and agree to the above policy.',
            consentDisclosure: interactiveContent.consentDisclosure,
            signatureData: responseData.signatureData || responseData.signature,
            typedName: responseData.typedName,
            submittedAt: responseEntry.submittedAt,
            ipAddress: ip,
            userAgent,
            policyHash,
            compositeSealHash,
            documentVersionId,
            esignConsentGranted: true,
            esignConsentTimestamp: responseEntry.esignConsentTimestamp,
            generatedByUid: auth.uid,
            generatedByEmail: auth.email,
          });

          // Send email copy to signer
          await sendSignedCopy({
            recipientEmail: signerEmail,
            recipientName: signerDisplayName,
            documentTitle: task.title || 'Policy Acknowledgment',
            pdfBuffer: pdfResult.pdfBuffer,
            fileName: pdfResult.fileName,
            documentVersionId,
            signedAt: responseEntry.submittedAt,
            orgName: orgLabel,
          });

          console.log(`[submit-response] Auto-generated PDF and emailed signed copy to ${signerEmail}`);
        } catch (pdfErr: any) {
          // Log but don't fail the signing — PDF/email delivery is best-effort
          console.error('[submit-response] Auto PDF/email failed (signing still valid):', pdfErr.message);
        }
      })();

      // Don't await — let it run in background so the user gets a fast response
      // The Promise will resolve on its own in the Node.js event loop
      pdfPromise.catch(() => {}); // Prevent unhandled rejection

    } else if (responseType === 'short_answer' || responseType === 'recorded_response') {
      if (interactiveContent && interactiveContent.reviewMode === 'admin_review') {
        needsReview = true;
        passed = false;
        message = 'Response submitted and pending review';
      }
    } else if (responseType === 'external_verification') {
      if (interactiveContent?.verificationMethod === 'admin_verify') {
        needsReview = true;
        passed = false;
        message = 'External completion submitted for admin verification';
      } else if (interactiveContent?.verificationMethod === 'completion_code') {
        const code = (responseData.code || '').trim();
        const validCodes = (interactiveContent.validCodes || []).map((c: string) => c.trim());
        if (validCodes.length > 0 && !validCodes.includes(code)) {
          return NextResponse.json({ error: 'Invalid completion code' }, { status: 400 });
        }
      }
    }

    const updates: any = {};
    updates['metadata.userResponse'] = FieldValue.arrayUnion(responseEntry);
    
    if (needsReview) {
      updates['metadata.reviewStatus'] = 'pending_review';
    }

    if (passed && !needsReview) {
      updates.column = 'done';
      updates.completedAt = FieldValue.serverTimestamp();
      updates.updatedAt = FieldValue.serverTimestamp();
    }

    await taskRef.update(updates);

    const activityRef = db.collection('activity_log').doc();
    await activityRef.set({
      type: 'task_response_submitted',
      userEmail: auth.email,
      userName: auth.email.split('@')[0],
      orgDomain: orgId,
      description: `${auth.email.split('@')[0]} submitted a response for task "${task.title}"`,
      category: 'onboarding',
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        taskId,
        responseType,
        passed,
        score,
        needsReview,
      }
    });

    // Notify supervisor/admin when this completes a document, a phase, or the whole blueprint
    // (task just became 'done', or a document entered pending review). Failed quizzes skip this.
    if (passed || needsReview) {
      await notifyOnboardingTaskCompleted({ orgId, taskId, actorUid: auth.uid, actorEmail: auth.email });
    }

    return NextResponse.json({ success: true, passed, score, message });

  } catch (err: any) {
    console.error('Error submitting response:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
