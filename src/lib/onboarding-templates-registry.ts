// ============================================================================
// Onboarding Templates Registry
//
// Pre-built onboarding blueprints for NXT Chapter roles, plus registry
// helpers for loading, listing, and saving custom templates.
//
// Built-in seed blueprints are returned for organizations that haven't
// created custom templates yet. Custom templates are stored in Firestore
// at orgs/${orgId}/onboarding_templates.
// ============================================================================

import type {
  OnboardingTemplate,
  OnboardingStep,
  OnboardingPhaseDefinition,
} from '@/types/onboarding-templates';

// ── NXT Chapter: Peer Recovery Coach ────────────────────────────────────────

const PEER_RECOVERY_COACH_STEPS: OnboardingStep[] = [
  // ── Phase 1: Pre-boarding & Admin (Day 0–1) ──
  {
    id: 'step_w4',
    phase: 1,
    title: 'Submit W-4 Tax Form',
    description: 'Complete and submit your federal W-4 tax withholding form. Upload a signed copy to your Onboarding Vault.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 15,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'w4',
  },
  {
    id: 'step_i9',
    phase: 1,
    title: 'Complete I-9 Identity Verification',
    description: 'Provide valid identification documents (passport, driver\'s license + social security card, etc.) for I-9 employment eligibility verification. Upload a signed copy.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 20,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'i9',
  },
  {
    id: 'step_direct_deposit',
    phase: 1,
    title: 'Set Up Direct Deposit',
    description: 'Submit your banking information for direct deposit payroll. Upload a voided check or bank authorization letter.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 10,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'direct_deposit',
  },
  {
    id: 'step_emergency_contacts',
    phase: 1,
    title: 'Submit Emergency Contact Information',
    description: 'Provide at least two emergency contacts with names, phone numbers, and relationships. Upload the completed emergency contact form.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 10,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'emergency_contacts',
  },
  {
    id: 'step_background_check',
    phase: 1,
    title: 'Sign Background Check Release',
    description: 'Review and sign the background check authorization and consent form. This is required for all staff working with vulnerable populations.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 10,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'background_check',
  },

  // ── Phase 2: Regulatory & Safety Compliance (Day 1–3) ──
  {
    id: 'step_handbook',
    phase: 2,
    title: 'Read & Sign Employee Handbook Acknowledgment',
    description: 'Review the full Employee Handbook and sign the acknowledgment form confirming you have read, understood, and agree to abide by all policies. Ask JARVIS if you have any questions about specific policies.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 60,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'employee_handbook',
  },
  {
    id: 'step_hipaa',
    phase: 2,
    title: 'Sign HIPAA & 42 CFR Part 2 Confidentiality Agreement',
    description: 'Review and sign the HIPAA Privacy Notice and 42 CFR Part 2 Confidentiality Agreement. These protect client substance use disorder records. Violations carry federal penalties.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 30,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'hipaa_42cfr',
  },
  {
    id: 'step_media_release',
    phase: 2,
    title: 'Complete Media Release Form',
    description: 'Review and sign the media release/photo consent form for organizational communications and grant reporting.',
    priority: 'Medium',
    dayOffset: 3,
    estimatedMinutes: 10,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'media_release',
  },
  {
    id: 'step_evacuation',
    phase: 2,
    title: 'Review Evacuation SOPs',
    description: 'Review the building evacuation procedures, emergency exit locations, and fire safety protocols. Know your designated assembly point.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 20,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_narcan',
    phase: 2,
    title: 'Complete De-escalation & Overdose/Narcan Protocol Training',
    description: 'Review the de-escalation techniques and overdose response protocol, including Narcan (naloxone) administration. This is critical for all peer recovery staff.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 45,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'narcan_protocol',
  },
  {
    id: 'step_abuse_reporting',
    phase: 2,
    title: 'Review Mandatory Abuse Reporting Rules',
    description: 'Learn the mandatory reporting obligations for suspected child abuse, elder abuse, and vulnerable adult abuse. Know who to report to and the timeline requirements.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 30,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: true,
    documentCategory: 'abuse_reporting',
  },

  // ── Phase 3: Operational Knowledge & Training (Week 1–2) ──
  {
    id: 'step_job_description',
    phase: 3,
    title: 'Review Master Job Description & 30-Day Goals',
    description: 'Read your full job description and discuss 30-day goals with your supervisor. Understand your core responsibilities, caseload expectations, and success metrics.',
    priority: 'Medium',
    dayOffset: 5,
    estimatedMinutes: 30,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'job_description',
  },
  {
    id: 'step_jarvis_practice',
    phase: 3,
    title: 'Practice Queries with JARVIS (Social Work Prompt Library)',
    description: 'Open JARVIS and practice asking common questions: "What is our policy on mileage reimbursement?", "Where do I find the de-escalation checklist?", "What are my core responsibilities?". Get comfortable with your 24/7 AI buddy.',
    priority: 'Medium',
    dayOffset: 7,
    estimatedMinutes: 30,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_shelter_network',
    phase: 3,
    title: 'Learn Local Emergency Shelter Networks',
    description: 'Complete the interactive walkthrough of local emergency shelters, transitional housing programs, and warming/cooling centers in your service area. Bookmark key contact numbers.',
    priority: 'Medium',
    dayOffset: 10,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_dmv_workflow',
    phase: 3,
    title: 'Learn DMV ID Acquisition Workflow',
    description: 'Review the step-by-step process for helping clients obtain state-issued ID cards, including required documents, fee waivers, and appointment scheduling procedures.',
    priority: 'Medium',
    dayOffset: 10,
    estimatedMinutes: 30,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_shadowing',
    phase: 3,
    title: 'Complete Job Shadowing with Senior Peer Recovery Coach',
    description: 'Attend scheduled shadowing sessions with a senior coach. Observe client interactions, group facilitation, and documentation best practices. Your shadowing sessions have been auto-scheduled on your Google Calendar.',
    priority: 'Medium',
    dayOffset: 14,
    estimatedMinutes: 480,
    itemType: 'shadowing_session',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },

  // ── Phase 4: 30/60/90 Day Milestone Checkpoints (Month 1+) ──
  {
    id: 'step_30day_review',
    phase: 4,
    title: '30-Day Checkpoint Review',
    description: 'Meet with your supervisor for a 30-day performance check-in. Discuss progress on initial goals, caseload development, and any support needed. Your supervisor will sign off on this milestone.',
    priority: 'Medium',
    dayOffset: 30,
    estimatedMinutes: 60,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_60day_review',
    phase: 4,
    title: '60-Day Mid-Point Review',
    description: 'Meet with your supervisor for a 60-day mid-point evaluation. Review caseload quality, documentation accuracy, client engagement metrics, and professional development goals.',
    priority: 'Medium',
    dayOffset: 60,
    estimatedMinutes: 60,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_90day_evaluation',
    phase: 4,
    title: '90-Day Manager Evaluation & Sign-Off',
    description: 'Complete the formal 90-day performance evaluation with your supervisor. This is the final onboarding milestone — your supervisor will sign off confirming you are fully onboarded and field-ready.',
    priority: 'High',
    dayOffset: 90,
    estimatedMinutes: 90,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
];

// ── NXT Chapter: Case Manager ───────────────────────────────────────────────

const CASE_MANAGER_STEPS: OnboardingStep[] = [
  // Phase 1 — identical admin steps
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 1),

  // Phase 2 — same compliance core + case documentation standards
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 2),
  {
    id: 'step_case_documentation',
    phase: 2,
    title: 'Review Case Documentation Standards & HMIS Training',
    description: 'Learn the Homeless Management Information System (HMIS) data entry standards, case note formatting requirements, and quality assurance review process.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 60,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },

  // Phase 3 — case manager specific training
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 3 && s.id === 'step_job_description'),
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 3 && s.id === 'step_jarvis_practice'),
  {
    id: 'step_intake_workflow',
    phase: 3,
    title: 'Master Client Intake & Assessment Workflow',
    description: 'Learn the end-to-end client intake process including initial screening, needs assessment, service plan development, and referral coordination. Practice with a mock case file.',
    priority: 'High',
    dayOffset: 7,
    estimatedMinutes: 90,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_community_resources',
    phase: 3,
    title: 'Complete Community Resource Mapping',
    description: 'Build a personal resource directory of local service providers including housing, food banks, mental health, substance abuse treatment, legal aid, and employment assistance programs.',
    priority: 'Medium',
    dayOffset: 10,
    estimatedMinutes: 60,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_county_liaison',
    phase: 3,
    title: 'Review County Liaison & Reporting Protocols',
    description: 'Learn the protocols for coordinating with county social services, probation/parole officers, court systems, and other government agencies. Know the reporting timelines and documentation requirements.',
    priority: 'Medium',
    dayOffset: 12,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_cm_shadowing',
    phase: 3,
    title: 'Complete Job Shadowing with Senior Case Manager',
    description: 'Shadow a senior case manager for intake interviews, case conferences, and home visits. Observe documentation, rapport-building, and crisis intervention techniques.',
    priority: 'Medium',
    dayOffset: 14,
    estimatedMinutes: 480,
    itemType: 'shadowing_session',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },

  // Phase 4 — same milestone checkpoints
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 4),
];

// ── Built-in System Templates ───────────────────────────────────────────────

/** Pre-built onboarding templates available to NXT Chapter. */
export const SYSTEM_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'nxtchapter_peer_recovery_coach',
    orgId: 'nxtchapter',
    roleName: 'Peer Recovery Coach',
    description: 'Complete onboarding track for new Peer Recovery Coaches covering administrative paperwork, HIPAA & 42 CFR Part 2 compliance, Narcan certification, community resource training, job shadowing, and 30/60/90-day milestone reviews.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: PEER_RECOVERY_COACH_STEPS,
  },
  {
    id: 'nxtchapter_case_manager',
    orgId: 'nxtchapter',
    roleName: 'Case Manager',
    description: 'Complete onboarding track for new Case Managers covering administrative paperwork, HIPAA compliance, HMIS data entry training, client intake & assessment workflows, community resource mapping, county liaison protocols, and 30/60/90-day milestone reviews.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: CASE_MANAGER_STEPS,
  },
];

// ── Registry Helpers ────────────────────────────────────────────────────────

/**
 * Get all available onboarding templates for an organization.
 * Returns built-in system templates + any custom templates from Firestore.
 *
 * Note: Custom template loading from Firestore is handled server-side
 * in the /api/onboarding/* routes. This function provides the system
 * templates that are always available.
 */
export function getSystemTemplatesForOrg(orgId: string): OnboardingTemplate[] {
  return SYSTEM_TEMPLATES.filter(t => t.orgId === orgId);
}

/**
 * Get a specific template by ID from the system templates.
 * Returns undefined if not found (caller should then check Firestore for custom templates).
 */
export function getSystemTemplateById(templateId: string): OnboardingTemplate | undefined {
  return SYSTEM_TEMPLATES.find(t => t.id === templateId);
}

/**
 * Get all unique role names from available system templates for an org.
 * Useful for populating role selector dropdowns.
 */
export function getAvailableRolesForOrg(orgId: string): string[] {
  return getSystemTemplatesForOrg(orgId).map(t => t.roleName);
}

/**
 * Calculate the total number of steps in each phase for a template.
 * Useful for rendering phase progress indicators.
 */
export function getPhaseBreakdown(template: OnboardingTemplate): Record<number, { total: number; titles: string[] }> {
  const breakdown: Record<number, { total: number; titles: string[] }> = {};

  for (const step of template.steps) {
    if (!breakdown[step.phase]) {
      breakdown[step.phase] = { total: 0, titles: [] };
    }
    breakdown[step.phase].total++;
    breakdown[step.phase].titles.push(step.title);
  }

  return breakdown;
}
