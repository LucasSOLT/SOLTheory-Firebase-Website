import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

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

      const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
      const userAgent = req.headers.get('user-agent') || 'unknown';
      const hash = crypto.createHash('sha256').update(interactiveContent.policyText || '').digest('hex');

      responseEntry.ipAddress = ip;
      responseEntry.userAgent = userAgent;
      responseEntry.policyHash = hash;
      responseEntry.signature = responseData.signature || responseData.signatureData || null; 
      responseEntry.typedName = responseData.typedName || null;
      responseEntry.acknowledged = responseData.acknowledged ?? true;

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

    return NextResponse.json({ success: true, passed, score, message });

  } catch (err: any) {
    console.error('Error submitting response:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
