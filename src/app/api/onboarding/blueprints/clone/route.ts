import { NextRequest, NextResponse } from 'next/server';
import { verifyRole } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getSystemTemplateById } from '@/lib/onboarding-templates-registry';

const LOG_PREFIX = '[Onboarding:Clone]';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, sourceTemplateId, newRoleName } = body;

    if (!orgId || !sourceTemplateId || !newRoleName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const auth = await verifyRole(req, orgId, 'admin');

    // 1. Load source template
    let sourceTemplate = getSystemTemplateById(sourceTemplateId);
    
    initAdmin();
    const db = getFirestore();

    if (!sourceTemplate) {
      const customDoc = await db.collection('orgs').doc(orgId).collection('onboarding_templates').doc(sourceTemplateId).get();
      if (customDoc.exists) {
        sourceTemplate = { id: customDoc.id, ...customDoc.data() } as any;
      }
    }

    if (!sourceTemplate) {
      return NextResponse.json({ error: 'Source template not found' }, { status: 404 });
    }

    // 2. Deep-copy steps and generate new step IDs
    const clonedSteps = sourceTemplate.steps.map(step => ({
      ...step,
      id: `custom_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`
    }));

    const docRef = db.collection('orgs').doc(orgId).collection('onboarding_templates').doc();

    const newBlueprint = {
      id: docRef.id,
      orgId,
      roleName: newRoleName,
      description: sourceTemplate.description || '',
      steps: clonedSteps,
      phaseDefinitions: (sourceTemplate as any).phaseDefinitions || [],
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
