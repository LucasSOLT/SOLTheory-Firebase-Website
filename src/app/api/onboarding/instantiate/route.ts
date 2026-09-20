// ============================================================================
// POST /api/onboarding/instantiate
//
// Instantiates an onboarding template into Action Board tasks for a new hire.
// Creates the full set of tasks with calculated due dates and an
// OnboardingInstance tracking document. Admin-only endpoint.
//
// Request body:
//   orgId:           string  — Organization ID (e.g. "nxtchapter")
//   targetUserId:    string  — Firebase UID of the new hire
//   targetUserEmail: string  — Email of the new hire
//   targetUserName:  string  — Display name of the new hire
//   templateId:      string  — Template ID to instantiate
//   startDate:       string  — ISO 8601 start date (e.g. "2026-10-01")
//   mentorUid?:      string  — Optional mentor/supervisor UID
//   mentorEmail?:    string  — Optional mentor/supervisor email
// ============================================================================

import { NextResponse } from 'next/server';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { verifyRole } from '@/lib/api-auth';
import { getSystemTemplateById } from '@/lib/onboarding-templates-registry';
import type { OnboardingInstance } from '@/types/onboarding-templates';

const LOG_PREFIX = '[Onboarding:Instantiate]';

export async function POST(req: Request) {
  try {
    // ── 1. Auth: Require at least admin role in the org ──
    const body = await req.json();
    const {
      orgId,
      targetUserId,
      targetUserEmail,
      targetUserName,
      templateId,
      startDate,
      mentorUid,
      mentorEmail,
    } = body;

    if (!orgId || !targetUserId || !targetUserEmail || !targetUserName || !templateId || !startDate) {
      return NextResponse.json(
        { error: 'Missing required fields: orgId, targetUserId, targetUserEmail, targetUserName, templateId, startDate' },
        { status: 400 },
      );
    }

    const auth = await verifyRole(req, orgId, 'admin');

    // ── 2. Load the template ──
    // First check system templates, then fall back to Firestore custom templates
    let template = getSystemTemplateById(templateId);

    if (!template) {
      initAdmin();
      const db = getFirestore();
      const customDoc = await db
        .collection('orgs')
        .doc(orgId)
        .collection('onboarding_templates')
        .doc(templateId)
        .get();

      if (customDoc.exists) {
        template = { id: customDoc.id, ...customDoc.data() } as any;
      }
    }

    if (!template) {
      return NextResponse.json(
        { error: `Template not found: "${templateId}". Check available templates for this organization.` },
        { status: 404 },
      );
    }

    if (template.steps.length === 0) {
      return NextResponse.json(
        { error: 'Template has no steps defined. Cannot create empty onboarding track.' },
        { status: 400 },
      );
    }

    console.log(
      `${LOG_PREFIX} Instantiating "${template.roleName}" for ${targetUserEmail} in ${orgId} (${template.steps.length} steps)`,
    );

    // ── 3. Calculate due dates and prepare task batch ──
    initAdmin();
    const db = getFirestore();
    const batch = db.batch();
    const startDateMs = new Date(startDate).getTime();
    const MS_PER_DAY = 86_400_000;
    const taskIds: string[] = [];

    // Generate a unique instance ID
    const instanceRef = db.collection('onboarding_instances').doc();
    const instanceId = instanceRef.id;

    for (const step of template.steps) {
      const taskRef = db.collection('action_board_tasks').doc();
      const taskId = taskRef.id;
      taskIds.push(taskId);

      const dueDate = new Date(startDateMs + step.dayOffset * MS_PER_DAY);

      batch.set(taskRef, {
        // Standard Action Board fields
        id: taskId,
        orgId,
        title: step.title,
        description: step.description,
        priority: step.priority,
        column: 'todo',

        // Assignment — direct so it bypasses the approval inbox
        assignedTo: targetUserId,
        assignedToEmail: targetUserEmail,
        assignedToName: targetUserName,
        assignmentStatus: 'direct',

        // Creator — the admin who initiated onboarding
        createdBy: auth.uid,
        createdByEmail: auth.email,
        createdByName: '', // will be populated client-side if needed

        // Dates
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        dueDate,
        startDate: new Date(startDateMs),

        // Time estimate
        ...(step.estimatedMinutes ? { estimatedMinutes: step.estimatedMinutes } : {}),

        // Onboarding metadata — used to connect tasks to the instance
        category: 'onboarding',
        metadata: {
          onboardingInstanceId: instanceId,
          stepId: step.id,
          phase: step.phase,
          requiresDocumentUpload: step.requiresDocumentUpload,
          ...(step.documentCategory ? { documentCategory: step.documentCategory } : {}),
          ...(step.sopUrl ? { sopUrl: step.sopUrl } : {}),
          ...(step.itemType ? { itemType: step.itemType } : {}),
          ...(step.completionGating ? { completionGating: step.completionGating } : {}),
          ...(step.instructions ? { instructions: step.instructions } : {}),
          ...(step.hyperlink ? { hyperlink: step.hyperlink } : {}),
          ...(step.headerImageUrl ? { headerImageUrl: step.headerImageUrl } : {}),
          ...(step.backgroundColor ? { backgroundColor: step.backgroundColor } : {}),
          ...(step.mediaUrl ? { mediaUrl: step.mediaUrl } : {}),
          ...(step.mediaType ? { mediaType: step.mediaType } : {}),
          interactiveContent: step.interactiveContent || null,
        },

        // Automations — notify admin on completion
        automations: {
          emails: [auth.email],
          emailTriggers: ['completed', 'overdue'],
        },

        // Clean defaults
        comments: [],
        attachments: [],
        isArchived: false,
        isLate: false,
      });
    }

    // ── 4. Create the OnboardingInstance tracking document ──
    const instanceData: Omit<OnboardingInstance, 'startedAt' | 'completedAt'> & {
      startedAt: ReturnType<typeof FieldValue.serverTimestamp>;
      completedAt: null;
    } = {
      id: instanceId,
      orgId,
      userId: targetUserId,
      userEmail: targetUserEmail,
      userName: targetUserName,
      templateId: template.id,
      roleName: template.roleName,
      status: 'in_progress',
      startedAt: FieldValue.serverTimestamp(),
      completedAt: null,
      overallProgress: 0,
      totalSteps: template.steps.length,
      completedSteps: 0,
      taskIds,
      initiatedBy: auth.uid,
      initiatedByEmail: auth.email,
      ...(mentorUid ? { mentorUid } : {}),
      ...(mentorEmail ? { mentorEmail } : {}),
    };

    batch.set(instanceRef, instanceData);

    // ── 5. Log to audit trail ──
    const auditRef = db.collection('activity_log').doc();
    batch.set(auditRef, {
      type: 'item_created',
      userEmail: auth.email,
      userName: auth.email.split('@')[0],
      orgDomain: auth.email.split('@')[1] || orgId,
      description: `${auth.email.split('@')[0]} started onboarding track "${template.roleName}" for ${targetUserName} (${targetUserEmail})`,
      category: 'general',
      timestamp: FieldValue.serverTimestamp(),
      metadata: {
        action: 'onboarding_track_started',
        onboardingInstanceId: instanceId,
        templateId: template.id,
        roleName: template.roleName,
        targetUserId,
        targetUserEmail,
        totalSteps: template.steps.length,
      },
    });

    // ── 6. Commit the batch ──
    await batch.commit();

    console.log(
      `${LOG_PREFIX} ✅ Successfully created ${taskIds.length} tasks + instance ${instanceId} for ${targetUserEmail}`,
    );

    return NextResponse.json({
      status: 'ok',
      instanceId,
      tasksCreated: taskIds.length,
      roleName: template.roleName,
      startDate,
      taskIds,
    });
  } catch (err: any) {
    // Handle role verification errors cleanly
    if (err.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (err.message?.includes('Insufficient permissions')) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }

    console.error(`${LOG_PREFIX} Fatal error:`, err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to instantiate onboarding template', details: err.message },
      { status: 500 },
    );
  }
}
