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
    description: 'Provide at least two emergency contacts with names, phone numbers, and relationships.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 10,
    itemType: 'form',
    completionGating: 'form_submitted',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'form' as const,
      title: 'Emergency Contact Information',
      description: 'Please provide at least two emergency contacts. This information is kept confidential and used only in case of a workplace emergency.',
      fields: [
        { id: 'contact1_name', label: 'Primary Contact — Full Name', fieldType: 'text' as const, required: true, placeholder: 'Jane Doe' },
        { id: 'contact1_relationship', label: 'Primary Contact — Relationship', fieldType: 'dropdown' as const, required: true, options: ['Spouse/Partner', 'Parent', 'Sibling', 'Child (Adult)', 'Other Family', 'Friend', 'Other'] },
        { id: 'contact1_phone', label: 'Primary Contact — Phone Number', fieldType: 'phone' as const, required: true, placeholder: '(555) 123-4567' },
        { id: 'contact1_email', label: 'Primary Contact — Email (optional)', fieldType: 'email' as const, required: false, placeholder: 'jane@example.com' },
        { id: 'contact2_name', label: 'Secondary Contact — Full Name', fieldType: 'text' as const, required: true, placeholder: 'John Smith' },
        { id: 'contact2_relationship', label: 'Secondary Contact — Relationship', fieldType: 'dropdown' as const, required: true, options: ['Spouse/Partner', 'Parent', 'Sibling', 'Child (Adult)', 'Other Family', 'Friend', 'Other'] },
        { id: 'contact2_phone', label: 'Secondary Contact — Phone Number', fieldType: 'phone' as const, required: true, placeholder: '(555) 987-6543' },
        { id: 'medical_conditions', label: 'Known Medical Conditions or Allergies (optional)', fieldType: 'textarea' as const, required: false, placeholder: 'List any conditions, allergies, or medications that first responders should know about...' },
        { id: 'preferred_hospital', label: 'Preferred Hospital (optional)', fieldType: 'text' as const, required: false, placeholder: 'e.g. Memorial Hospital' },
      ],
    },
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
    description: 'Review the Employee Handbook and electronically sign the acknowledgment confirming you have read, understood, and agree to abide by all policies.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 60,
    itemType: 'policy_acknowledgment',
    completionGating: 'acknowledgment_signed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'policy_acknowledgment' as const,
      policyText: `# Employee Handbook Acknowledgment

## Purpose
This acknowledgment confirms that you have received, read, and understand the Employee Handbook provided by NXT Chapter Inc. The handbook outlines the organization's policies, procedures, and expectations for all employees.

## Key Policies Covered
By signing below, you acknowledge that you have reviewed and understand the following sections:

1. **Employment Policies** — At-will employment, equal opportunity, anti-discrimination, and anti-harassment policies.
2. **Code of Conduct** — Professional behavior, dress code, attendance, and workplace conduct expectations.
3. **Compensation & Benefits** — Pay schedules, overtime, PTO accrual, health insurance, and retirement plan information.
4. **Leave Policies** — FMLA, sick leave, bereavement, jury duty, and military leave.
5. **Safety & Security** — Workplace safety, emergency procedures, drug-free workplace, and incident reporting.
6. **Technology & Communications** — Acceptable use of computers, email, internet, social media, and company devices.
7. **Confidentiality** — Protection of client data, proprietary information, and HIPAA/42 CFR Part 2 obligations.
8. **Disciplinary Process** — Progressive discipline steps, grounds for immediate termination, and grievance procedures.

## Agreement
I understand that:
- The handbook is not a contract of employment
- Policies may be updated from time to time, and I will be notified of material changes
- It is my responsibility to read, understand, and comply with all policies
- I may ask my supervisor or HR for clarification on any policy
- Violation of these policies may result in disciplinary action, up to and including termination

*If you have questions about any handbook policy, ask JARVIS — your 24/7 AI assistant — or speak with your supervisor before signing.*`,
      requireScrollToBottom: true,
      requireTypedName: true,
      requireDrawnSignature: true,
      acknowledgmentText: 'I have read, understand, and agree to abide by all policies in the Employee Handbook.',
      consentDisclosure: 'By typing your name and signing below, you are providing your electronic signature in accordance with the ESIGN Act (15 U.S.C. § 7001 et seq.). This electronic signature carries the same legal weight as a handwritten signature.',
    },
  },
  {
    id: 'step_hipaa',
    phase: 2,
    title: 'Sign HIPAA & 42 CFR Part 2 Confidentiality Agreement',
    description: 'Review the HIPAA Privacy Notice and 42 CFR Part 2 Confidentiality Agreement, then electronically sign to confirm your understanding. Violations carry federal penalties.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 30,
    itemType: 'policy_acknowledgment',
    completionGating: 'acknowledgment_signed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'policy_acknowledgment' as const,
      policyText: `# HIPAA & 42 CFR Part 2 Confidentiality Agreement

## Federal Confidentiality Protections
As an employee of NXT Chapter Inc., you will have access to Protected Health Information (PHI) governed by two critical federal regulations:

### HIPAA (Health Insurance Portability and Accountability Act)
- Protects individually identifiable health information
- Applies to all client records, treatment plans, progress notes, and communications
- Violations can result in civil penalties up to **$50,000 per violation** and criminal penalties including imprisonment

### 42 CFR Part 2 (Confidentiality of Substance Use Disorder Records)
- Provides **additional, stricter protections** beyond HIPAA for substance use disorder (SUD) treatment records
- SUD records **cannot be disclosed** without specific written patient consent — even to other healthcare providers, courts, or law enforcement
- Re-disclosure is prohibited: recipients of SUD records cannot share them further
- Violations carry federal criminal penalties including fines up to **$500 per first offense** and **$5,000 for subsequent offenses**

## Your Obligations
By signing below, you agree to:

1. **Never disclose** client PHI or SUD records without proper written authorization
2. **Access only** the minimum necessary information required for your job duties
3. **Secure** all records — physical and electronic — against unauthorized access
4. **Report immediately** any suspected breach or unauthorized disclosure to your supervisor
5. **Not discuss** client information in public areas, social media, or with unauthorized persons
6. **Complete** annual HIPAA refresher training as required
7. **Return or destroy** all PHI upon separation from employment
8. **Understand** that these obligations survive termination of employment

## Acknowledgment
I have read and understand the HIPAA Privacy Notice and 42 CFR Part 2 confidentiality requirements. I understand that violation of these regulations may result in disciplinary action up to and including termination, as well as civil and criminal penalties under federal law.`,
      requireScrollToBottom: true,
      requireTypedName: true,
      requireDrawnSignature: true,
      acknowledgmentText: 'I have read, understand, and agree to comply with all HIPAA and 42 CFR Part 2 confidentiality requirements.',
      consentDisclosure: 'By typing your name and signing below, you are providing your electronic signature in accordance with the ESIGN Act (15 U.S.C. § 7001 et seq.). This electronic signature carries the same legal weight as a handwritten signature.',
    },
  },
  {
    id: 'step_hipaa_quiz',
    phase: 2,
    title: 'HIPAA & 42 CFR Part 2 Knowledge Assessment',
    description: 'Complete this quiz to demonstrate your understanding of HIPAA and 42 CFR Part 2 confidentiality requirements. You must score 80% or higher to pass.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 15,
    itemType: 'quiz',
    completionGating: 'quiz_passed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'quiz' as const,
      passingScore: 80,
      maxAttempts: 0,
      shuffleQuestions: true,
      shuffleAnswers: true,
      showCorrectAnswers: true,
      questions: [
        {
          id: 'hipaa_q1',
          text: 'Which federal regulation provides ADDITIONAL protections beyond HIPAA specifically for substance use disorder (SUD) treatment records?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h1a', text: 'FERPA', isCorrect: false },
            { id: 'h1b', text: '42 CFR Part 2', isCorrect: true },
            { id: 'h1c', text: 'ADA Title II', isCorrect: false },
            { id: 'h1d', text: 'OSHA 29 CFR 1910', isCorrect: false },
          ],
        },
        {
          id: 'hipaa_q2',
          text: 'Under 42 CFR Part 2, can you share a client\'s substance use disorder records with another healthcare provider without the client\'s specific written consent?',
          questionType: 'true_false' as const,
          options: [
            { id: 'h2a', text: 'True — healthcare providers can always share records', isCorrect: false },
            { id: 'h2b', text: 'False — specific written consent is required even for other providers', isCorrect: true },
          ],
        },
        {
          id: 'hipaa_q3',
          text: 'What is the HIPAA "Minimum Necessary" standard?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h3a', text: 'Only access the minimum PHI required to perform your job duties', isCorrect: true },
            { id: 'h3b', text: 'Share records with the minimum number of coworkers', isCorrect: false },
            { id: 'h3c', text: 'Keep physical records to a minimum number of pages', isCorrect: false },
            { id: 'h3d', text: 'Use the minimum required security software', isCorrect: false },
          ],
        },
        {
          id: 'hipaa_q4',
          text: 'You overhear a coworker discussing a client\'s treatment details in the break room with another employee who is not involved in that client\'s care. What should you do?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h4a', text: 'Nothing — casual conversation between coworkers is fine', isCorrect: false },
            { id: 'h4b', text: 'Join the conversation to learn more about the case', isCorrect: false },
            { id: 'h4c', text: 'Politely remind them that client information should only be discussed with authorized care team members, and report the incident to your supervisor', isCorrect: true },
            { id: 'h4d', text: 'Report them to the police', isCorrect: false },
          ],
        },
        {
          id: 'hipaa_q5',
          text: 'What does "re-disclosure" mean under 42 CFR Part 2?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h5a', text: 'Updating a client\'s records with new information', isCorrect: false },
            { id: 'h5b', text: 'A recipient of SUD records sharing those records with a third party — which is prohibited', isCorrect: true },
            { id: 'h5c', text: 'Re-reading a client\'s file before a session', isCorrect: false },
            { id: 'h5d', text: 'Sending a copy of records to the client themselves', isCorrect: false },
          ],
        },
        {
          id: 'hipaa_q6',
          text: 'Which of the following would be considered a HIPAA violation?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h6a', text: 'Discussing a client\'s care plan with their assigned case manager', isCorrect: false },
            { id: 'h6b', text: 'Locking your computer screen when stepping away from your desk', isCorrect: false },
            { id: 'h6c', text: 'Posting a photo from a group session on your personal social media', isCorrect: true },
            { id: 'h6d', text: 'Shredding old paper records according to the retention policy', isCorrect: false },
          ],
        },
        {
          id: 'hipaa_q7',
          text: 'Your confidentiality obligations under HIPAA and 42 CFR Part 2 end when you leave the organization.',
          questionType: 'true_false' as const,
          options: [
            { id: 'h7a', text: 'True', isCorrect: false },
            { id: 'h7b', text: 'False — these obligations survive termination of employment', isCorrect: true },
          ],
        },
        {
          id: 'hipaa_q8',
          text: 'If you suspect a breach of client data has occurred, what is the FIRST thing you should do?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'h8a', text: 'Wait and see if anyone notices', isCorrect: false },
            { id: 'h8b', text: 'Report it to your supervisor immediately', isCorrect: true },
            { id: 'h8c', text: 'Try to fix the breach yourself before telling anyone', isCorrect: false },
            { id: 'h8d', text: 'Call the client to apologize', isCorrect: false },
          ],
        },
      ],
    },
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

// ── Universal: General Staff Onboarding ─────────────────────────────────────

const UNIVERSAL_GENERAL_STAFF_STEPS: OnboardingStep[] = [
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 1),
  {
    id: 'step_gen_it_setup',
    phase: 1,
    title: 'Workstation, Email & Security Setup',
    description: 'Configure your company email account, enable Two-Factor Authentication (2FA), install required software, and review acceptable hardware use policies.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 30,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'it_email', text: 'Log into organization email account and reset temporary password', required: true },
        { id: 'it_2fa', text: 'Enable Two-Factor Authentication (2FA) via authenticator app or SMS', required: true },
        { id: 'it_password_mgr', text: 'Configure enterprise password manager', required: false },
        { id: 'it_screen_lock', text: 'Verify automatic screen lock is enabled (5 minutes or less)', required: true },
        { id: 'it_software', text: 'Verify required work applications are installed and operational', required: true },
      ],
    },
  },
  {
    id: 'step_gen_handbook',
    phase: 2,
    title: 'Read & Sign Employee Handbook Acknowledgment',
    description: 'Review the Employee Handbook and electronically sign the acknowledgment confirming you have read, understood, and agree to abide by all policies.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 45,
    itemType: 'policy_acknowledgment',
    completionGating: 'acknowledgment_signed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'policy_acknowledgment' as const,
      policyText: `# Employee Handbook & Code of Conduct Acknowledgment\n\n## Workplace Standards\nAll employees are expected to uphold the highest standards of professional conduct, ethics, anti-harassment, and confidentiality. Please review the comprehensive handbook before signing.`,
      requireScrollToBottom: true,
      requireTypedName: true,
      requireDrawnSignature: true,
      acknowledgmentText: 'I acknowledge receipt of the Employee Handbook and agree to comply with all organization policies.',
      consentDisclosure: 'By typing your name and signing below, you are providing your electronic signature in accordance with the ESIGN Act.',
    },
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 2 && s.id === 'step_evacuation_sop'),
  {
    id: 'step_gen_cybersecurity',
    phase: 2,
    title: 'Information Security & Data Protection Quiz',
    description: 'Test your understanding of phishing prevention, password security, clean desk rules, and confidential data protection.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 20,
    itemType: 'quiz',
    completionGating: 'quiz_passed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'quiz' as const,
      passingScore: 80,
      maxAttempts: 3,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showCorrectAnswers: true,
      questions: [
        {
          id: 'q_phishing',
          text: 'You receive an urgent email from "IT Support" asking you to click a link to verify your password immediately. What should you do?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'opt_1', text: 'Click the link and enter your credentials right away', isCorrect: false },
            { id: 'opt_2', text: 'Forward it to your personal email', isCorrect: false },
            { id: 'opt_3', text: 'Do not click the link; report the suspicious email to IT/management immediately', isCorrect: true },
            { id: 'opt_4', text: 'Reply asking if the email is legitimate', isCorrect: false },
          ],
        },
        {
          id: 'q_screen_lock',
          text: 'When stepping away from your desk or laptop, what is the required protocol?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'opt_1', text: 'Leave everything open so you can resume work faster', isCorrect: false },
            { id: 'opt_2', text: 'Lock your screen immediately (Windows Key + L / Command + Control + Q)', isCorrect: true },
            { id: 'opt_3', text: 'Turn down the brightness', isCorrect: false },
            { id: 'opt_4', text: 'Ask a nearby coworker to watch your laptop', isCorrect: false },
          ],
        },
        {
          id: 'q_sharing_passwords',
          text: 'Is it ever permissible to share your organization password with a colleague or temporary staff member?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'opt_1', text: 'Yes, if they need to complete an urgent task while you are out', isCorrect: false },
            { id: 'opt_2', text: 'No, individual account credentials must never be shared under any circumstances', isCorrect: true },
            { id: 'opt_3', text: 'Yes, as long as you change it the next day', isCorrect: false },
            { id: 'opt_4', text: 'Only with supervisor permission', isCorrect: false },
          ],
        },
      ],
    },
  },
  {
    id: 'step_gen_mission_values',
    phase: 3,
    title: 'Organization Mission, Vision & Core Values',
    description: 'Familiarize yourself with the founding vision, strategic objectives, and values that guide our daily operations and community impact.',
    priority: 'Medium',
    dayOffset: 5,
    estimatedMinutes: 30,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_gen_communication_channels',
    phase: 3,
    title: 'Communication Channels & Team Meeting Cadence',
    description: 'Learn team communication standards, channel etiquette, calendar conventions, and weekly standup / all-hands schedules.',
    priority: 'Medium',
    dayOffset: 6,
    estimatedMinutes: 20,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'comm_channels', text: 'Join relevant team messaging channels & groups', required: true },
        { id: 'comm_calendar', text: 'Subscribe to team master calendar and verify weekly meeting invites', required: true },
        { id: 'comm_signature', text: 'Configure standardized email signature with job title and contact details', required: true },
        { id: 'comm_emergency', text: 'Save supervisor and emergency escalation contact numbers to phone', required: true },
      ],
    },
  },
  {
    id: 'step_gen_jarvis_intro',
    phase: 3,
    title: 'Explore Jarvis AI Platform Capabilities',
    description: 'Learn how to leverage Jarvis — your embedded 24/7 AI assistant in INSiGHT — for drafting documents, reviewing policies, analyzing metrics, and accelerating workflows.',
    priority: 'Low',
    dayOffset: 8,
    estimatedMinutes: 20,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_gen_supervisor_1on1',
    phase: 3,
    title: '1-on-1 Welcome & 30-Day Goal Setting Session',
    description: 'Meet with your direct supervisor to align on key priorities, 30-day deliverables, support resources, and training progress.',
    priority: 'High',
    dayOffset: 10,
    estimatedMinutes: 60,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 4),
];

// ── Intake & Admissions Coordinator ─────────────────────────────────────────

const INTAKE_ADMISSIONS_COORDINATOR_STEPS: OnboardingStep[] = [
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 1),
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 2 && (s.id === 'step_handbook' || s.id === 'step_hipaa' || s.id === 'step_abuse_reporting')),
  {
    id: 'step_intake_deescalation',
    phase: 2,
    title: 'Crisis Inquiry & Telephone De-escalation Protocol',
    description: 'Learn trauma-informed intake communication, active listening, handling crisis inquiries, and warm handoffs to clinical personnel or emergency crisis services.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_intake_workflow',
    phase: 3,
    title: 'Master Client Intake & Assessment Workflow',
    description: 'Learn the end-to-end client intake process including initial screening, needs assessment, service plan development, and referral coordination.',
    priority: 'High',
    dayOffset: 5,
    estimatedMinutes: 60,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_intake_ehr',
    phase: 3,
    title: 'Electronic Health Record (EHR) Patient Registration Training',
    description: 'Complete training on client demographic entry, insurance capture, encounter scheduling, and document uploading in the organization EHR system.',
    priority: 'High',
    dayOffset: 7,
    estimatedMinutes: 90,
    itemType: 'external_verification',
    completionGating: 'external_verified',
    requiresDocumentUpload: false,
    hyperlink: 'https://ehr.nxtchapter.org',
    interactiveContent: {
      type: 'external_verification' as const,
      externalUrl: 'https://ehr.nxtchapter.org',
      verificationMethod: 'completion_code' as const,
    },
  },
  {
    id: 'step_intake_insurance',
    phase: 3,
    title: 'Insurance Eligibility & Pre-Authorization Verification',
    description: 'Learn verification workflows for commercial insurance, Medicaid/Medicare eligibility systems, benefit carve-outs, and prior authorization requirements.',
    priority: 'High',
    dayOffset: 9,
    estimatedMinutes: 60,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'ins_medicaid', text: 'Perform eligibility check via state Medicaid provider portal', required: true },
        { id: 'ins_commercial', text: 'Verify commercial behavioral health benefits & co-pay/deductible', required: true },
        { id: 'ins_preauth', text: 'Review prior authorization requirements and clinical documentation criteria', required: true },
        { id: 'ins_record', text: 'Upload verification report directly to client profile in EHR', required: true },
      ],
    },
  },
  {
    id: 'step_intake_consent_packet',
    phase: 3,
    title: 'Client Consent Packet & Release of Information (ROI) SOP',
    description: 'Master mandatory consent documentation including consent for treatment, financial liability, HIPAA acknowledgments, and 42 CFR Part 2 specialized SUD releases.',
    priority: 'Medium',
    dayOffset: 11,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_intake_shadowing',
    phase: 3,
    title: 'Job Shadowing with Lead Admissions Coordinator',
    description: 'Shadow lead coordinator through live inquiry calls, in-person client intakes, document collections, and appointment scheduling.',
    priority: 'High',
    dayOffset: 14,
    estimatedMinutes: 480,
    itemType: 'shadowing_session',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 4),
];

// ── Clinical Supervisor / Director ──────────────────────────────────────────

const CLINICAL_SUPERVISOR_STEPS: OnboardingStep[] = [
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 1),
  {
    id: 'step_clin_license_upload',
    phase: 1,
    title: 'Upload State Clinical License & NPI Verification',
    description: 'Upload your current, unencumbered state clinical license (LCSW, LMFT, LPC, PsyD, etc.), NPI registration, and DEA number if applicable.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 15,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'other',
  },
  {
    id: 'step_clin_malpractice_upload',
    phase: 1,
    title: 'Upload Professional Liability Insurance (Malpractice)',
    description: 'Provide certificate of insurance proving current professional liability/malpractice coverage with minimum policy limits.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 15,
    itemType: 'document_upload',
    completionGating: 'upload_required',
    requiresDocumentUpload: true,
    documentCategory: 'other',
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 2 && (s.id === 'step_handbook' || s.id === 'step_hipaa')),
  {
    id: 'step_clin_ethics_ack',
    phase: 2,
    title: 'Clinical Code of Ethics & Scope of Practice Acknowledgment',
    description: 'Review and electronically sign adherence to state licensing board ethics, professional boundaries, dual-relationship prohibitions, and duty to warn standards.',
    priority: 'High',
    dayOffset: 2,
    estimatedMinutes: 45,
    itemType: 'policy_acknowledgment',
    completionGating: 'acknowledgment_signed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'policy_acknowledgment' as const,
      policyText: `# Clinical Code of Ethics & Professional Scope\n\nClinical supervisors oversee client welfare and supervise clinician compliance with all statutory, regulatory, and ethical standards.`,
      requireScrollToBottom: true,
      requireTypedName: true,
      requireDrawnSignature: true,
      acknowledgmentText: 'I agree to adhere to all clinical ethics and supervisory standards.',
      consentDisclosure: 'Electronic signature under ESIGN Act.',
    },
  },
  {
    id: 'step_clin_sentinel_quiz',
    phase: 2,
    title: 'Incident & Sentinel Event Reporting Protocol Quiz',
    description: 'Review protocol for reporting clinical emergencies, medical interventions, client grievances, and sentinel events to executive leadership and state regulatory boards.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 25,
    itemType: 'quiz',
    completionGating: 'quiz_passed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'quiz' as const,
      passingScore: 100,
      maxAttempts: 3,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showCorrectAnswers: true,
      questions: [
        {
          id: 'q_sentinel_timeline',
          text: 'What is the required reporting window for immediate notification to executive leadership upon occurrence of a sentinel event?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'opt_1', text: 'Within 2 hours', isCorrect: true },
            { id: 'opt_2', text: 'Within 24 hours', isCorrect: false },
            { id: 'opt_3', text: 'Within 3 business days', isCorrect: false },
            { id: 'opt_4', text: 'At the next weekly staff meeting', isCorrect: false },
          ],
        },
        {
          id: 'q_mandatory_reporting',
          text: 'If a clinician suspects elder or child abuse reported during a session, when must the verbal report to protective authorities occur?',
          questionType: 'multiple_choice' as const,
          options: [
            { id: 'opt_1', text: 'Immediately / without delay', isCorrect: true },
            { id: 'opt_2', text: 'After conferring with legal counsel', isCorrect: false },
            { id: 'opt_3', text: 'Within 14 days', isCorrect: false },
            { id: 'opt_4', text: 'Only if the client signs an ROI', isCorrect: false },
          ],
        },
      ],
    },
  },
  {
    id: 'step_clin_ehr_admin',
    phase: 3,
    title: 'EHR Master Clinical Setup & Supervisory Sign-Off Permissions',
    description: 'Configure supervisory rights, diagnosis sign-off queues, treatment plan approvals, and co-signature workflows in the organization EHR.',
    priority: 'High',
    dayOffset: 5,
    estimatedMinutes: 60,
    itemType: 'external_verification',
    completionGating: 'external_verified',
    requiresDocumentUpload: false,
    hyperlink: 'https://ehr.nxtchapter.org',
    interactiveContent: {
      type: 'external_verification' as const,
      externalUrl: 'https://ehr.nxtchapter.org',
      verificationMethod: 'admin_verify' as const,
    },
  },
  {
    id: 'step_clin_supervision_framework',
    phase: 3,
    title: 'Clinical Supervision & State Board Hours Framework',
    description: 'Review expectations for individual and group supervision hours, supervision agreement contracts, and official board log maintenance.',
    priority: 'High',
    dayOffset: 8,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_clin_chart_audit_sop',
    phase: 3,
    title: 'Chart Auditing & Quality Assurance QA Protocol',
    description: 'Master the monthly chart audit checklist: Golden Thread alignment from intake assessment to treatment plan, progress notes, and discharge criteria.',
    priority: 'Medium',
    dayOffset: 10,
    estimatedMinutes: 60,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'qa_golden_thread', text: 'Verify Golden Thread connection between diagnosis, goals, and interventions', required: true },
        { id: 'qa_timely_notes', text: 'Confirm progress notes are signed within 24–48 hours of service', required: true },
        { id: 'qa_tx_plan_update', text: 'Verify treatment plans are reviewed and updated every 90 days', required: true },
        { id: 'qa_signatures', text: 'Ensure all required client and clinician signatures are present', required: true },
      ],
    },
  },
  {
    id: 'step_clin_team_meeting',
    phase: 3,
    title: 'Interdisciplinary Clinical Team Meeting & Case Conference',
    description: 'Participate in weekly clinical case conference, review high-acuity client cases, and coordinate care with medical/case management leads.',
    priority: 'High',
    dayOffset: 14,
    estimatedMinutes: 90,
    itemType: 'action_item',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 4),
];

// ── Operations & Office Manager ─────────────────────────────────────────────

const OPERATIONS_OFFICE_MANAGER_STEPS: OnboardingStep[] = [
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 1),
  {
    id: 'step_ops_facility_access',
    phase: 1,
    title: 'Facility Access, Keycard & Alarm Codes Setup',
    description: 'Obtain master keys, program individual alarm security codes, and register keycard credentials for main facility and sensitive record rooms.',
    priority: 'High',
    dayOffset: 1,
    estimatedMinutes: 30,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'acc_master_keys', text: 'Receive and log master building keys', required: true },
        { id: 'acc_alarm_code', text: 'Test individual alarm arm/disarm code with monitoring station', required: true },
        { id: 'acc_records_room', text: 'Verify locked access to physical medical/compliance files room', required: true },
        { id: 'acc_emergency_call_list', text: 'Register as primary or secondary facility alarm call contact', required: true },
      ],
    },
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 2 && (s.id === 'step_handbook' || s.id === 'step_evacuation_sop')),
  {
    id: 'step_ops_vendor_confidentiality',
    phase: 2,
    title: 'Vendor & Independent Contractor Oversight Policy',
    description: 'Review protocols for screening vendors, executing Business Associate Agreements (BAAs), and managing facility contractors on site.',
    priority: 'High',
    dayOffset: 3,
    estimatedMinutes: 30,
    itemType: 'policy_acknowledgment',
    completionGating: 'acknowledgment_signed',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'policy_acknowledgment' as const,
      policyText: `# Vendor Management & Facility Oversight Policy\n\nAll outside vendors and contractors entering facility premises must be verified, logged, and supervised when entering areas where client data may be present.`,
      requireScrollToBottom: true,
      requireTypedName: true,
      requireDrawnSignature: true,
      acknowledgmentText: 'I agree to uphold all vendor management and facility security protocols.',
      consentDisclosure: 'Electronic signature under ESIGN Act.',
    },
  },
  {
    id: 'step_ops_procurement_system',
    phase: 3,
    title: 'Supply Procurement, Inventory & Vendor Accounts',
    description: 'Set up administrative accounts for office supplies, clinical drug testing kits, kitchen/facility provisions, and recurring replenishment orders.',
    priority: 'High',
    dayOffset: 6,
    estimatedMinutes: 60,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'proc_vendors', text: 'Log into corporate purchasing portals and review credit terms', required: true },
        { id: 'proc_inventory_count', text: 'Complete initial baseline physical inventory of supplies and forms', required: true },
        { id: 'proc_reorder_par', text: 'Establish min/max par levels for essential office and client supplies', required: true },
      ],
    },
  },
  {
    id: 'step_ops_staff_scheduling',
    phase: 3,
    title: 'Staff Scheduling & Shift Coverage Management',
    description: 'Learn master scheduling system for peer coaches, intake coordinators, and facility coverage, including call-out replacement protocols.',
    priority: 'High',
    dayOffset: 8,
    estimatedMinutes: 60,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_ops_invoicing_pettycash',
    phase: 3,
    title: 'Petty Cash, Invoicing & Accounts Payable Workflow',
    description: 'Review finance guidelines for managing petty cash logs, reconciling employee expense receipts, and routing invoices to accounting.',
    priority: 'Medium',
    dayOffset: 10,
    estimatedMinutes: 45,
    itemType: 'reading',
    completionGating: 'self',
    requiresDocumentUpload: false,
  },
  {
    id: 'step_ops_newhire_logistics',
    phase: 3,
    title: 'New Hire Physical Logistics & Onboarding Welcome SOP',
    description: 'Review checklist for preparing new employee workstations, issuing keys/fobs, ordering name badges, and arranging Day 1 welcome logistics.',
    priority: 'Medium',
    dayOffset: 12,
    estimatedMinutes: 30,
    itemType: 'checklist',
    completionGating: 'self',
    requiresDocumentUpload: false,
    interactiveContent: {
      type: 'checklist' as const,
      items: [
        { id: 'nh_desk_clean', text: 'Inspect and sanitize incoming employee desk and chair', required: true },
        { id: 'nh_swag_badge', text: 'Prepare employee lanyard, badge, and welcome handbook package', required: true },
        { id: 'nh_keys_ready', text: 'Cut or program keys/keycard for new employee start date', required: true },
      ],
    },
  },
  ...PEER_RECOVERY_COACH_STEPS.filter(s => s.phase === 4),
];

// ── Built-in System Templates ───────────────────────────────────────────────

/** Pre-built onboarding templates available universally across organizations. */
export const SYSTEM_TEMPLATES: OnboardingTemplate[] = [
  {
    id: 'nxtchapter_peer_recovery_coach',
    orgId: 'global',
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
    orgId: 'global',
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
  {
    id: 'universal_general_staff',
    orgId: 'global',
    roleName: 'General Staff / Universal Onboarding',
    description: 'Universal foundation onboarding track suitable for any staff member covering standard tax forms (W-4, I-9), direct deposit, IT workstation setup, employee handbook, cybersecurity awareness, anti-harassment, mission & values, and 30/60/90-day check-ins.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: UNIVERSAL_GENERAL_STAFF_STEPS,
  },
  {
    id: 'intake_admissions_coordinator',
    orgId: 'global',
    roleName: 'Intake & Admissions Coordinator',
    description: 'Comprehensive onboarding track for Admissions and Intake staff covering HIPAA & 42 CFR Part 2 confidentiality, crisis phone de-escalation, EHR patient registration, insurance verification & prior authorization, client consent packets, and live job shadowing.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: INTAKE_ADMISSIONS_COORDINATOR_STEPS,
  },
  {
    id: 'clinical_supervisor_director',
    orgId: 'global',
    roleName: 'Clinical Supervisor / Director',
    description: 'Specialized clinical onboarding track for licensed Clinical Supervisors and Directors covering state license & malpractice verification, supervisory code of ethics, incident/sentinel event reporting, EHR supervisory rights, QA chart auditing, and clinical case conferences.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: CLINICAL_SUPERVISOR_STEPS,
  },
  {
    id: 'operations_office_manager',
    orgId: 'global',
    roleName: 'Operations & Office Manager',
    description: 'Complete operational track for Office Managers and Operations Leads covering building access & security codes, facility safety, vendor management, office procurement, staff scheduling systems, petty cash reconciliation, and onboarding logistics.',
    source: 'system',
    isSystem: true,
    isCustom: false,
    phaseDefinitions: [
      { phaseNumber: 1, name: 'Pre-boarding & Admin', dayRangeStart: 0, dayRangeEnd: 1 },
      { phaseNumber: 2, name: 'Regulatory & Safety Compliance', dayRangeStart: 1, dayRangeEnd: 3 },
      { phaseNumber: 3, name: 'Operational Knowledge & Training', dayRangeStart: 5, dayRangeEnd: 14 },
      { phaseNumber: 4, name: 'Milestone Checkpoints', dayRangeStart: 30, dayRangeEnd: 90 },
    ],
    steps: OPERATIONS_OFFICE_MANAGER_STEPS,
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
  return SYSTEM_TEMPLATES.filter(t => t.orgId === orgId || t.orgId === 'global' || t.orgId === 'nxtchapter' || t.orgId === 'soltheory');
}

/**
 * Get a specific template by ID from the system templates.
 * Returns undefined if not found (caller should then check Firestore for custom templates).
 */
export function getSystemTemplateById(templateId: string): OnboardingTemplate | undefined {
  return SYSTEM_TEMPLATES.find(t =>
    t.id === templateId ||
    t.id === `nxtchapter_${templateId}` ||
    templateId === `nxtchapter_${t.id}` ||
    t.id === `global_${templateId}` ||
    templateId === `global_${t.id}`
  );
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
