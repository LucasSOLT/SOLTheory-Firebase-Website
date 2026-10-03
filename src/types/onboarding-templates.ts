// ============================================================================
// Onboarding Templates — Type Definitions
//
// Defines the blueprint system for the Automated Onboarding Engine.
// Templates are role-specific task roadmaps (e.g. "Peer Recovery Coach")
// that get instantiated into Action Board tasks when a new hire starts.
// ============================================================================

/**
 * Onboarding phases are now dynamic and unlimited.
 * The numbers represent the sequential phase order.
 */
export type OnboardingPhaseNumber = number;

/** A custom-defined phase within a blueprint. Admins can create unlimited phases with custom names and day ranges. */
export interface OnboardingPhaseDefinition {
  /** Phase number (1-indexed, matches step.phase). */
  phaseNumber: number;
  /** Custom name for this phase (e.g. 'Pre-boarding & Admin'). */
  name: string;
  /** Day range start relative to onboarding start date. */
  dayRangeStart: number;
  /** Day range end relative to onboarding start date. */
  dayRangeEnd: number;
  /** Optional description for this phase. */
  description?: string;
}

/** Human-readable labels for each phase (default for system templates). */
export const ONBOARDING_PHASE_LABELS: Record<number, string> = {
  1: 'Pre-boarding & Admin',
  2: 'Regulatory & Safety Compliance',
  3: 'Operational Knowledge & Training',
  4: 'Milestone Checkpoints',
};

/** Estimated timeline descriptions for each phase (default for system templates). */
export const ONBOARDING_PHASE_TIMELINES: Record<number, string> = {
  1: 'Day 0 – Day 1',
  2: 'Day 1 – Day 3',
  3: 'Week 1 – Week 2',
  4: 'Month 1+',
};

/**
 * Document categories for compliance items.
 * Each maps to a specific legal or HR document type.
 */
export type ComplianceDocumentCategory =
  | 'w4'
  | 'i9'
  | 'direct_deposit'
  | 'emergency_contacts'
  | 'background_check'
  | 'employee_handbook'
  | 'hipaa_42cfr'
  | 'media_release'
  | 'evacuation_sop'
  | 'narcan_protocol'
  | 'abuse_reporting'
  | 'job_description'
  | 'other';

/** Human-readable labels for compliance document categories. */
export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceDocumentCategory, string> = {
  w4: 'W-4 Tax Form',
  i9: 'I-9 Identity Verification',
  direct_deposit: 'Direct Deposit Authorization',
  emergency_contacts: 'Emergency Contact Sheet',
  background_check: 'Background Check Release',
  employee_handbook: 'Employee Handbook Acknowledgment',
  hipaa_42cfr: 'HIPAA & 42 CFR Part 2 Confidentiality Agreement',
  media_release: 'Media Release Form',
  evacuation_sop: 'Evacuation SOPs Review',
  narcan_protocol: 'De-escalation & Overdose/Narcan Protocol',
  abuse_reporting: 'Mandatory Abuse Reporting Rules',
  job_description: 'Master Job Description Review',
  other: 'Other Document',
};

// ── Blueprint Step ──────────────────────────────────────────────────────────

/**
 * A single step in an onboarding template.
 * When the template is instantiated, each step becomes an Action Board task
 * with a calculated due date and optional compliance upload requirement.
 */
export interface OnboardingStep {
  /** Unique ID within the template (e.g. "step_w4", "step_hipaa"). */
  id: string;

  /** Which onboarding phase this step belongs to. */
  phase: number;

  /** Task title shown on the Action Board (e.g. "Submit W-4 Tax Form"). */
  title: string;

  /** Description / instructions for the new hire. */
  description: string;

  /** Task priority: High for compliance-critical, Medium for training, Low for optional. */
  priority: 'High' | 'Medium' | 'Low';

  /**
   * Number of calendar days after the start date that this step is due.
   * Examples: 0 = same day, 1 = next day, 7 = one week, 30 = one month.
   */
  dayOffset: number;

  /** Estimated time to complete in minutes (optional, used for timesheet logging). */
  estimatedMinutes?: number;

  /** Whether this step requires the new hire to upload a document for verification. */
  requiresDocumentUpload: boolean;

  /**
   * If requiresDocumentUpload is true, which compliance category the document belongs to.
   * Used to tag the file in the compliance vault and track verification status.
   */
  documentCategory?: ComplianceDocumentCategory;

  /** Optional URL to a Standard Operating Procedure or reference document. */
  sopUrl?: string;

  /** What type of onboarding item this is. Determines completion gating behavior. */
  itemType?: 'document_upload' | 'video_watch' | 'reading' | 'shadowing_session' | 'action_item' | 'form_sign'
    | 'quiz' | 'short_answer' | 'form' | 'checklist'
    | 'policy_acknowledgment' | 'external_verification' | 'recorded_response'
    | 'pdf_form';

  /** Rich instructions for the new hire (may contain line breaks). */
  instructions?: string;

  /** External URL link (e.g. to a training portal, Google Doc, or SOP). */
  hyperlink?: string | null;

  /** Header image URL for the rich item popup. */
  headerImageUrl?: string | null;

  /** Background color (hex) for the item popup screen. */
  backgroundColor?: string | null;

  /** Uploaded media URL (video, image, or PDF for preview in item popup). */
  mediaUrl?: string | null;

  /** Type of the uploaded media. */
  mediaType?: 'video' | 'image' | 'pdf' | null;

  /** How completion is gated for this item. */
  completionGating?: 'self' | 'upload_required' | 'video_started'
    | 'quiz_passed' | 'response_required' | 'response_reviewed'
    | 'form_submitted' | 'checklist_complete' | 'acknowledgment_signed' | 'external_verified';

  /**
   * Interactive content configuration for quiz, form, checklist, etc.
   * Stored as JSON and passed through to task metadata on instantiation.
   */
  interactiveContent?: InteractiveContent;

  /**
   * Role suppression tags. If the target user's job title, role, or tags
   * match ANY of these strings (case-insensitive), this step is skipped
   * during blueprint instantiation.
   *
   * Examples: ["1099", "Contractor", "Part-Time"]
   * Use case: A W-4 tax form step can be suppressed for 1099 contractors
   * who don't need W-2 tax forms.
   */
  suppressForTags?: string[];
}

// ── Template Blueprint ──────────────────────────────────────────────────────

/**
 * An onboarding template is a reusable role-specific blueprint
 * defining all the tasks a new hire must complete.
 */
export interface OnboardingTemplate {
  /** Unique template ID (e.g. "nxtchapter_peer_recovery_coach"). */
  id: string;

  /** Organization this template belongs to. */
  orgId: string;

  /** Job title / role name (e.g. "Peer Recovery Coach", "Case Manager"). */
  roleName: string;

  /** Human-readable description of this onboarding track. */
  description: string;

  /** Whether this is a built-in system template or a custom org template. */
  source: 'system' | 'custom';

  /** Ordered list of onboarding steps. */
  steps: OnboardingStep[];

  /** Whether this is a read-only system template. System templates can be cloned but not edited. */
  isSystem?: boolean;

  /** Whether this is a custom org-created template. */
  isCustom?: boolean;

  /** Custom phase definitions. If present, overrides the default 4-phase structure. */
  phaseDefinitions?: OnboardingPhaseDefinition[];

  /** When this template was created. */
  createdAt?: any;

  /** When this template was last updated. */
  updatedAt?: any;

  /** UID of who created this template. */
  createdBy?: string;
}

// ── Onboarding Instance ─────────────────────────────────────────────────────

/**
 * An active onboarding instance represents a single new hire
 * going through an instantiated onboarding track.
 */
export interface OnboardingInstance {
  /** Unique instance ID (Firestore document ID). */
  id: string;

  /** Organization ID. */
  orgId: string;

  /** The new hire's Firebase UID. */
  userId: string;

  /** The new hire's email address. */
  userEmail: string;

  /** The new hire's display name. */
  userName: string;

  /** Which template was instantiated. */
  templateId: string;

  /** The role name from the template (denormalized for quick display). */
  roleName: string;

  /** Current status. */
  status: 'in_progress' | 'completed';

  /** When the onboarding track was started. */
  startedAt: Date | any; // Firestore Timestamp

  /** When all steps were completed (null if still in progress). */
  completedAt: Date | any | null;

  /** Overall completion percentage (0–100), recalculated on each task update. */
  overallProgress: number;

  /** Total number of steps in this track. */
  totalSteps: number;

  /** Number of steps completed. */
  completedSteps: number;

  /** Array of Action Board task IDs created for this instance. */
  taskIds: string[];

  /** Optional: UID of assigned mentor / supervisor for shadowing. */
  mentorUid?: string;

  /** Optional: Email of assigned mentor / supervisor. */
  mentorEmail?: string;

  /** The admin who initiated this onboarding. */
  initiatedBy: string;

  /** Email of the admin who initiated this onboarding. */
  initiatedByEmail: string;
}

// ── Compliance Document (Vault) ─────────────────────────────────────────────

/**
 * Compliance verification status for an uploaded legal/HR document.
 */
export type VerificationStatus = 'pending_review' | 'verified' | 'rejected';

/**
 * A compliance document uploaded to the secure vault.
 * Stored in Firestore at orgs/${orgId}/compliance_documents.
 */
export interface ComplianceDocument {
  /** Unique document ID (Firestore doc ID). */
  id: string;

  /** Organization ID (e.g. "nxtchapter"). */
  orgId: string;

  /** The employee's Firebase UID. */
  userId: string;

  /** The employee's email address. */
  userEmail: string;

  /** The employee's display name. */
  userName: string;

  /** Which compliance category this document belongs to. */
  documentCategory: ComplianceDocumentCategory;

  /** Original file name (e.g. "Signed_I9_Form.pdf"). */
  fileName: string;

  /** File size in bytes. */
  fileSize: number;

  /** MIME type (e.g. "application/pdf", "image/png"). */
  mimeType: string;

  /** Public or signed download URL. */
  downloadUrl: string;

  /** Firebase Storage object path. */
  storagePath: string;

  /** Verification status. */
  status: VerificationStatus;

  /** When the document was uploaded. */
  uploadedAt: any; // Firestore Timestamp or Date

  /** UID of the manager/admin who verified or rejected this document. */
  verifiedBy?: string | null;

  /** Email of the manager/admin who verified or rejected this document. */
  verifiedByEmail?: string | null;

  /** When the document was verified or rejected. */
  verifiedAt?: any | null; // Firestore Timestamp or Date

  /** Optional manager review notes (e.g. reason for rejection or approval note). */
  notes?: string;

  /** Associated Action Board task ID if uploaded via an onboarding checklist item. */
  taskId?: string;
}


// ============================================================================
// Interactive Content Types — Quiz, Form, Checklist, E-Signature, etc.
//
// Each interactive item type stores its admin-configured content as a typed
// JSON blob on OnboardingStep.interactiveContent. When instantiated, this
// blob is copied into the Action Board task's metadata for user rendering.
// ============================================================================

// ── Discriminated Union ─────────────────────────────────────────────────────

export type InteractiveContent =
  | QuizContent
  | ShortAnswerContent
  | FormContent
  | ChecklistContent
  | PolicyAcknowledgmentContent
  | ExternalVerificationContent
  | RecordedResponseContent
  | PdfFormContent;

// ── 1. Quiz / Knowledge Check ───────────────────────────────────────────────

export interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
  /** Minimum percentage (0-100) to pass. Default: 80. */
  passingScore: number;
  /** Max attempts allowed. 0 = unlimited retries. */
  maxAttempts: number;
  /** Randomize question order each attempt. */
  shuffleQuestions: boolean;
  /** Randomize answer option order each attempt. */
  shuffleAnswers: boolean;
  /** Show which answers were correct after submission. */
  showCorrectAnswers: boolean;
}

export interface QuizQuestion {
  id: string;
  text: string;
  questionType: 'multiple_choice' | 'true_false' | 'select_all';
  options: QuizOption[];
  /** Optional image URL displayed with the question. */
  imageUrl?: string;
}

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

// ── 2. Short Answer / Text Response ─────────────────────────────────────────

export interface ShortAnswerContent {
  type: 'short_answer';
  prompts: ShortAnswerPrompt[];
  /** 'auto_complete' marks task done on submit. 'admin_review' requires manager approval. */
  reviewMode: 'auto_complete' | 'admin_review';
}

export interface ShortAnswerPrompt {
  id: string;
  question: string;
  required: boolean;
  minLength?: number;
  maxLength?: number;
  placeholder?: string;
}

// ── 3. Form / Data Collection ───────────────────────────────────────────────

export interface FormContent {
  type: 'form';
  title: string;
  description?: string;
  fields: FormField[];
}

export interface FormField {
  id: string;
  label: string;
  fieldType: 'text' | 'email' | 'phone' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'textarea';
  required: boolean;
  placeholder?: string;
  /** Options list for dropdown fields. */
  options?: string[];
  /** Optional regex validation pattern. */
  validationPattern?: string;
}

// ── 4. Checklist (Multi-step Task) ──────────────────────────────────────────

export interface ChecklistContent {
  type: 'checklist';
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
  /** Optional URL link for reference material. */
  linkUrl?: string;
}

// ── 5. Policy Acknowledgment / E-Signature ──────────────────────────────────

export interface PolicyAcknowledgmentContent {
  type: 'policy_acknowledgment';
  /** Policy text (supports markdown formatting). */
  policyText: string;
  /** Require user to scroll to bottom before acknowledging. */
  requireScrollToBottom: boolean;
  /** Require user to type their full legal name. */
  requireTypedName: boolean;
  /** Require user to draw a signature on a canvas pad. */
  requireDrawnSignature: boolean;
  /** Checkbox label text (e.g. "I have read and agree to the above policy"). */
  acknowledgmentText: string;
  /** ESIGN Act consent disclosure text. */
  consentDisclosure: string;
  /** Optional custom text for the explicit ESIGN consent checkbox.
   *  Defaults to: "I agree to conduct business electronically and understand
   *  that my digital signature is legally binding under the ESIGN Act." */
  esignConsentText?: string;
}

// ── 6. External Completion Verification ─────────────────────────────────────

export interface ExternalVerificationContent {
  type: 'external_verification';
  /** URL to the external training/resource. */
  externalUrl: string;
  /** How completion is verified. */
  verificationMethod: 'upload_certificate' | 'completion_code' | 'admin_verify';
  /** Valid completion codes (for 'completion_code' method). */
  validCodes?: string[];
  /** Instructions for the user. */
  instructions?: string;
}

// ── 7. Recorded Response (Video/Audio) ──────────────────────────────────────

export interface RecordedResponseContent {
  type: 'recorded_response';
  /** Prompt/question for the user to respond to. */
  prompt: string;
  /** Maximum recording duration in seconds. Default: 120. */
  maxDurationSeconds: number;
  /** What media types are accepted. */
  mediaType: 'video' | 'audio' | 'either';
  /** 'auto_complete' marks done on submit. 'admin_review' requires manager approval. */
  reviewMode: 'auto_complete' | 'admin_review';
}

// ── 8. Fillable PDF Form ────────────────────────────────────────────────────

export interface PdfFormContent {
  type: 'pdf_form';
  /** Firebase Storage path to the PDF template. */
  pdfStoragePath: string;
  /** Signed download URL for client-side preview. */
  pdfDownloadUrl?: string;
  /** Detected AcroForm fields from the PDF template. */
  detectedFields?: PdfFormField[];
  /** Number of pages in the PDF template. */
  pageCount?: number;
  /** Optional PDF title extracted from metadata. */
  pdfTitle?: string;
  /** Whether a drawn signature is required to submit. */
  requireSignature: boolean;
  /** Page index and coordinates for the signature stamp (if requireSignature). */
  signaturePosition?: {
    pageIndex: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Compliance document category for vault cataloging. */
  documentCategory?: string;
  /** Whether to require ESIGN Act consent checkbox. */
  requireEsignConsent?: boolean;
  /**
   * Phase 3 — multi-party signing. When enabled with 2+ signers, the document
   * routes signer → signer in `order`, is partially filled at each step, and is
   * only flattened + sealed after the LAST signer completes. When absent or
   * disabled, the single-signer flow (requireSignature / signaturePosition
   * above) is used unchanged.
   */
  signingWorkflow?: SigningWorkflow;
}

// ── Phase 3: Multi-Party Signing ────────────────────────────────────────────

/**
 * Who fills a signer slot.
 *  - 'employee'   → whoever the blueprint is assigned to
 *  - 'supervisor' → the supervisor chosen for that onboarding track (mentorUid)
 *  - 'member'     → one specific org member picked in the Blueprint Editor
 */
export type SignerKind = 'employee' | 'supervisor' | 'member';

/** One box in the signing-order chain (configured in the Blueprint Editor). */
export interface SignerDefinition {
  /** Stable ID (survives reordering). */
  id: string;
  /** 1-based position in the chain. */
  order: number;
  kind: SignerKind;
  /** kind === 'member': the chosen org member. */
  memberUid?: string;
  memberEmail?: string;
  memberName?: string;
  /** Optional role label shown to everyone, e.g. "HR Director". */
  label?: string;
  /**
   * AcroForm field names this signer fills. A field belongs to at most one
   * signer; unassigned fields belong to the employee signer.
   */
  fieldNames: string[];
  /** Whether this signer must draw a signature. */
  requireSignature: boolean;
  /** Where to stamp this signer's signature when the PDF has no signature field for them. */
  signaturePosition?: { pageIndex: number; x: number; y: number; width: number; height: number };
}

export interface SigningWorkflow {
  enabled: boolean;
  signers: SignerDefinition[];
}

/** Document lifecycle for multi-signer PDFs (locked spec). */
export type DocumentSigningStatus = 'draft' | 'partially_signed' | 'fully_executed' | 'archived';

/** Audit record written when a signer completes their portion. */
export interface SignerCompletion {
  order: number;
  signerUid: string;
  signerEmail: string;
  signerName: string;
  typedName: string;
  signedAt: string; // ISO
  ipAddress: string;
  userAgent: string;
  fieldsFilled: number;
  signaturesApplied: number;
  /** SHA-256 of the partially filled PDF produced by this step. */
  partialPdfSha256: string;
  esignConsent: boolean;
}

/**
 * Display-only mirror of the signing state on the parent task
 * (`metadata.signing`). The authoritative state lives server-side in
 * `onboarding_signing_sessions/{taskId}` and is never trusted from the client.
 */
export interface TaskSigningMirror {
  status: DocumentSigningStatus;
  round: number;
  currentSignerOrder: number;
  totalSigners: number;
  currentSignerUid?: string | null;
  currentSignerName?: string | null;
  completedOrders: number[];
  /** True once fully executed — Phase 4 "Send & Archive" becomes available. */
  readyToSendAndArchive?: boolean;
}

/** Metadata shape for a detected PDF AcroForm field (mirrored from pdf-form-engine). */
export interface PdfFormField {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'signature' | 'unknown';
  readOnly: boolean;
  options?: string[];
  currentValue?: string | boolean;
  pageIndex?: number;
  tooltip?: string;
  required?: boolean;
  /**
   * Phase 2 Step 2.2 — on-page placements of this field. One field can have
   * several widgets (each radio option, or the same text field repeated on
   * multiple pages). Absent on blueprints detected before Step 2.2.
   */
  widgets?: PdfFieldWidget[];
  /** Text fields: allows line breaks (render as <textarea>). */
  multiline?: boolean;
  /** Text fields: maximum character count from the PDF. */
  maxLength?: number;
  /** Font size in PDF points from the field's /DA string. Absent = auto-size. */
  fontSize?: number;
}

/**
 * Phase 2 Step 2.2 — one on-page placement (widget annotation) of a form field.
 *
 * Coordinates are raw PDF user space: points (1/72"), origin at the BOTTOM-LEFT
 * of the page's coordinate system. Do not hand-convert to CSS — pass `rect` to
 * pdf.js `viewport.convertToViewportRectangle(rect)`, which applies scale,
 * rotation, and CropBox offset (see PageViewportMetrics in components/onboarding/pdf).
 */
export interface PdfFieldWidget {
  /** 0-based page the widget is drawn on. -1 if it couldn't be resolved. */
  pageIndex: number;
  /** Normalized [x1, y1, x2, y2] with x1 < x2 and y1 < y2. */
  rect: number[];
  /** Same box as `rect`, as lower-left corner + size. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Checkbox/radio: the value this widget represents when selected. */
  exportValue?: string;
  /** True when the PDF hides this widget on screen (Hidden/NoView flags or zero size). */
  hidden?: boolean;
}

// ── Human-readable labels for interactive item types ────────────────────────

export const INTERACTIVE_ITEM_TYPE_LABELS: Record<string, string> = {
  document_upload: 'Document Upload',
  video_watch: 'Video Watch',
  reading: 'Reading',
  shadowing_session: 'Shadowing Session',
  action_item: 'Action Item',
  form_sign: 'Form Signature',
  quiz: 'Quiz / Knowledge Check',
  short_answer: 'Short Answer Response',
  form: 'Form / Data Collection',
  checklist: 'Checklist (Multi-step)',
  policy_acknowledgment: 'Policy Acknowledgment / E-Signature',
  external_verification: 'External Completion Verification',
  recorded_response: 'Recorded Response (Video/Audio)',
  pdf_form: 'Fillable PDF Form',
};

/** Map from interactive itemType to its default completionGating value. */
export const ITEM_TYPE_DEFAULT_GATING: Record<string, string> = {
  document_upload: 'upload_required',
  video_watch: 'video_started',
  reading: 'self',
  shadowing_session: 'self',
  action_item: 'self',
  form_sign: 'upload_required',
  quiz: 'quiz_passed',
  short_answer: 'response_required',
  form: 'form_submitted',
  checklist: 'checklist_complete',
  policy_acknowledgment: 'acknowledgment_signed',
  external_verification: 'external_verified',
  recorded_response: 'response_required',
  pdf_form: 'pdf_form_submitted',
};

