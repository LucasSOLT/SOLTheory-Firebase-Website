import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, verifyRole } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { SYSTEM_TEMPLATES } from '@/lib/onboarding-templates-registry';

const LOG_PREFIX = '[Onboarding:Blueprints]';

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyRequest(req);
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');

    if (!orgId) {
      return NextResponse.json({ error: 'Missing orgId' }, { status: 400 });
    }

    const systemBlueprints = SYSTEM_TEMPLATES.filter(t => t.orgId === orgId || t.orgId === 'nxtchapter');

    initAdmin();
    const db = getFirestore();
    const customDocs = await db.collection('orgs').doc(orgId).collection('onboarding_templates').where('deletedAt', '==', null).get();
    
    const customBlueprints = customDocs.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ blueprints: [...systemBlueprints, ...customBlueprints] });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, roleName, description, steps, phaseDefinitions } = body;
    
    if (!orgId || !roleName || !steps) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await verifyRole(req, orgId, 'admin');

    initAdmin();
    const db = getFirestore();
    
    const docRef = db.collection('orgs').doc(orgId).collection('onboarding_templates').doc();
    
    const newBlueprint = {
      id: docRef.id,
      orgId,
      roleName,
      description: description || '',
      steps,
      phaseDefinitions: phaseDefinitions || [],
      isSystem: false,
      isCustom: true,
      source: 'custom',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: auth.uid,
      deletedAt: null
    };

    await docRef.set(newBlueprint);

    return NextResponse.json(newBlueprint);
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (err.message?.includes('Insufficient permissions')) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, templateId, updates, applyToActive } = body;

    if (!orgId || !templateId || !updates) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await verifyRole(req, orgId, 'admin');

    initAdmin();
    const db = getFirestore();

    const docRef = db.collection('orgs').doc(orgId).collection('onboarding_templates').doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const updatedData = {
      ...updates,
      updatedAt: FieldValue.serverTimestamp()
    };

    await docRef.update(updatedData);

    if (applyToActive && updates.steps) {
      const instancesSnapshot = await db.collection('onboarding_instances')
        .where('templateId', '==', templateId)
        .where('status', '==', 'in_progress')
        .get();

      if (!instancesSnapshot.empty) {
        const batch = db.batch();
        const MS_PER_DAY = 86_400_000;
        
        for (const instanceDoc of instancesSnapshot.docs) {
          const instanceData = instanceDoc.data();
          const startDateMs = instanceData.startedAt?.toDate().getTime() || Date.now();
          const existingTasksRef = await db.collection('action_board_tasks')
            .where('metadata.onboardingInstanceId', '==', instanceDoc.id)
            .get();
            
          const existingStepIds = new Set(existingTasksRef.docs.map(d => d.data().metadata?.stepId));
          const newTaskIds: string[] = [];

          for (const step of updates.steps) {
            if (!existingStepIds.has(step.id)) {
              const taskRef = db.collection('action_board_tasks').doc();
              const taskId = taskRef.id;
              newTaskIds.push(taskId);

              const dueDate = new Date(startDateMs + step.dayOffset * MS_PER_DAY);

              batch.set(taskRef, {
                id: taskId,
                orgId: instanceData.orgId,
                title: step.title,
                description: step.description,
                priority: step.priority,
                column: 'todo',
                assignedTo: instanceData.userId,
                assignedToEmail: instanceData.userEmail,
                assignedToName: instanceData.userName,
                assignmentStatus: 'direct',
                createdBy: auth.uid,
                createdByEmail: auth.email,
                createdByName: '',
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                dueDate,
                startDate: new Date(startDateMs),
                ...(step.estimatedMinutes ? { estimatedMinutes: step.estimatedMinutes } : {}),
                category: 'onboarding',
                metadata: {
                  onboardingInstanceId: instanceDoc.id,
                  stepId: step.id,
                  phase: step.phase,
                  requiresDocumentUpload: step.requiresDocumentUpload || false,
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
                },
                automations: {
                  emails: [auth.email],
                  emailTriggers: ['completed', 'overdue'],
                },
                comments: [],
                attachments: [],
                isArchived: false,
                isLate: false,
              });
            }
          }
          
          if (newTaskIds.length > 0) {
            batch.update(instanceDoc.ref, {
              taskIds: FieldValue.arrayUnion(...newTaskIds),
              totalSteps: instanceData.totalSteps + newTaskIds.length
            });
          }
        }
        await batch.commit();
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (err.message?.includes('Insufficient permissions')) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId');
    const templateId = searchParams.get('templateId') || searchParams.get('id');

    if (!orgId || !templateId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const isSystem = SYSTEM_TEMPLATES.some(t => t.id === templateId);
    if (isSystem) {
      return NextResponse.json({ error: 'Cannot delete system templates' }, { status: 400 });
    }

    const auth = await verifyRole(req, orgId, 'admin');

    initAdmin();
    const db = getFirestore();

    const docRef = db.collection('orgs').doc(orgId).collection('onboarding_templates').doc(templateId);
    const doc = await docRef.get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await docRef.update({
      deletedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (err.message?.includes('Insufficient permissions')) return NextResponse.json({ error: err.message }, { status: 403 });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
