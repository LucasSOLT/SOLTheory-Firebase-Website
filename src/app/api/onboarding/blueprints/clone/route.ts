import { NextRequest, NextResponse } from 'next/server';
import { verifyRequest, verifyRole } from '@/lib/api-auth';
import { isDeveloper } from '@/lib/org-config';
import { initAdmin } from '@/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getSystemTemplateById } from '@/lib/onboarding-templates-registry';

const LOG_PREFIX = '[Onboarding:Clone]';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orgId, sourceOrgId, targetOrgId, sourceTemplateId, newRoleName } = body;

    const effectiveTargetOrg = targetOrgId || orgId;
    const effectiveSourceOrg = sourceOrgId || orgId;

    if (!effectiveTargetOrg || !sourceTemplateId) {
      return NextResponse.json({ error: 'Missing required fields (targetOrg and sourceTemplateId required)' }, { status: 400 });
    }

    const auth = await verifyRequest(req);
    if (!auth.ok) {
      return auth.response;
    }
    const isDev = isDeveloper(auth.email);
    if (!isDev) {
      // Must be admin of target org to add a blueprint there
      await verifyRole(req, effectiveTargetOrg, 'admin');
    }

    // 1. Load source template (check system registry first)
    let sourceTemplate = getSystemTemplateById(sourceTemplateId);
    
    initAdmin();
    const db = getFirestore();

    if (!sourceTemplate) {
      // Check source organization custom templates
      if (effectiveSourceOrg) {
        const customDoc = await db.collection('orgs').doc(effectiveSourceOrg).collection('onboarding_templates').doc(sourceTemplateId).get();
        if (customDoc.exists) {
          sourceTemplate = { id: customDoc.id, ...customDoc.data() } as any;
        }
      }
      // Fallback: check target organization if different
      if (!sourceTemplate && effectiveTargetOrg !== effectiveSourceOrg) {
        const customDoc = await db.collection('orgs').doc(effectiveTargetOrg).collection('onboarding_templates').doc(sourceTemplateId).get();
        if (customDoc.exists) {
          sourceTemplate = { id: customDoc.id, ...customDoc.data() } as any;
        }
      }
    }

    if (!sourceTemplate) {
      return NextResponse.json({ error: 'Source template not found' }, { status: 404 });
    }

    const finalRoleName = newRoleName || sourceTemplate.roleName;

    // 2. Deep-copy steps and generate new step IDs
    const clonedSteps = (sourceTemplate.steps || []).map((step, idx) => ({
      ...step,
      id: `custom_${Math.random().toString(36).substring(2, 9)}_${Date.now()}_${idx}`
    }));

    const docRef = db.collection('orgs').doc(effectiveTargetOrg).collection('onboarding_templates').doc();

    const newBlueprint = {
      id: docRef.id,
      orgId: effectiveTargetOrg,
      roleName: finalRoleName,
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

    return NextResponse.json({
      success: true,
      blueprint: newBlueprint,
      targetOrgId: effectiveTargetOrg
    });
  } catch (err: any) {
    if (err.message === 'Unauthorized') return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    if (err.message?.includes('Insufficient permissions')) return NextResponse.json({ error: err.message }, { status: 403 });
    console.error(LOG_PREFIX, err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
