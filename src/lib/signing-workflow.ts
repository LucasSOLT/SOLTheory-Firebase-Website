// ============================================================================
// lib/signing-workflow.ts — Phase 3 multi-party signing, shared rules
//
// Pure functions (no Firebase, no DOM) used by BOTH the browser (configurator
// + signing UI) and the server (sign-step API), so ownership and signature-box
// rules can never drift apart. The server is always the authority — it calls
// these same functions to re-validate every submission.
// ============================================================================

import type {
  PdfFieldWidget,
  PdfFormContent,
  PdfFormField,
  SignerDefinition,
  SigningWorkflow,
} from '@/types/onboarding-templates';
import { signatureSpotsOf, spotToWidget } from '@/lib/signature-spots';

/** Prefix for per-signer virtual signature boxes (built from `signaturePosition`). */
export const SIGNER_SIGNATURE_FIELD_PREFIX = '__soltheory_signature__:';

export const signerSignatureFieldName = (order: number) => `${SIGNER_SIGNATURE_FIELD_PREFIX}${order}`;

export const isSignerSignatureField = (name: string) => name.startsWith(SIGNER_SIGNATURE_FIELD_PREFIX);

/** True when this PDF item uses the multi-signer flow (enabled + 2 or more signers). */
export function isMultiSignerWorkflow(content: Pick<PdfFormContent, 'signingWorkflow'> | null | undefined): boolean {
  const wf = content?.signingWorkflow;
  return !!wf?.enabled && Array.isArray(wf.signers) && wf.signers.length >= 2;
}

/** Signers sorted by `order`, renumbered 1..n (defensive against gaps). */
export function orderedSigners(workflow: SigningWorkflow): SignerDefinition[] {
  return [...workflow.signers]
    .sort((a, b) => a.order - b.order)
    .map((s, i) => ({ ...s, order: i + 1 }));
}

/** Fields that a person can actually fill (skips read-only and unsupported types). */
export function fillableFieldNames(detected: PdfFormField[]): string[] {
  return detected.filter((f) => !f.readOnly && f.type !== 'unknown').map((f) => f.name);
}

/**
 * Final field ownership: order → field names.
 * - Each field belongs to the FIRST signer (by order) that lists it.
 * - Fields nobody claimed go to the employee signer (or signer #1 if there is
 *   no employee signer), so nothing on the form is left without an owner.
 * - Names that don't exist on the PDF are dropped.
 */
export function resolveFieldOwnership(workflow: SigningWorkflow, detected: PdfFormField[]): Map<number, string[]> {
  const signers = orderedSigners(workflow);
  const fillable = new Set(fillableFieldNames(detected));
  const owner = new Map<string, number>();

  for (const s of signers) {
    for (const name of s.fieldNames || []) {
      if (fillable.has(name) && !owner.has(name)) owner.set(name, s.order);
    }
  }

  const fallbackOrder = (signers.find((s) => s.kind === 'employee') ?? signers[0])?.order ?? 1;
  for (const name of fillable) {
    if (!owner.has(name)) owner.set(name, fallbackOrder);
  }

  const result = new Map<number, string[]>(signers.map((s) => [s.order, [] as string[]]));
  for (const [name, order] of owner) result.get(order)?.push(name);
  return result;
}

export interface SignatureBox {
  /** Field the box belongs to (AcroForm signature field or virtual per-signer field). */
  fieldName: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

const visibleWidgets = (f: PdfFormField): PdfFieldWidget[] =>
  (f.widgets || []).filter((w) => !w.hidden && w.pageIndex >= 0);

/**
 * Where a signer is allowed to sign: the widgets of every signature-type field
 * they own, plus each of their signature spots (`signaturePositions`, or the
 * legacy single `signaturePosition`).
 */
export function signatureBoxesForSigner(
  signer: SignerDefinition,
  ownedFieldNames: string[],
  detected: PdfFormField[],
): SignatureBox[] {
  const owned = new Set(ownedFieldNames);
  const boxes: SignatureBox[] = [];
  for (const f of detected) {
    if (f.type !== 'signature' || !owned.has(f.name)) continue;
    for (const w of visibleWidgets(f)) {
      boxes.push({ fieldName: f.name, pageIndex: w.pageIndex, x: w.x, y: w.y, width: w.width, height: w.height });
    }
  }
  // Signature Suite Phase B: every spot shares ONE virtual field, so one signature fills them all.
  for (const pos of signatureSpotsOf(signer)) {
    boxes.push({ fieldName: signerSignatureFieldName(signer.order), ...pos });
  }
  return boxes;
}

/** True when the stamp lies inside one of the boxes (1pt tolerance). */
export function isStampInsideBoxes(
  stamp: { pageIndex: number; x: number; y: number; width: number; height: number },
  boxes: SignatureBox[],
  tolerance = 1,
): boolean {
  if (![stamp.x, stamp.y, stamp.width, stamp.height].every(Number.isFinite) || stamp.width <= 0 || stamp.height <= 0) {
    return false;
  }
  return boxes.some(
    (b) =>
      b.pageIndex === stamp.pageIndex &&
      stamp.x >= b.x - tolerance &&
      stamp.y >= b.y - tolerance &&
      stamp.x + stamp.width <= b.x + b.width + tolerance &&
      stamp.y + stamp.height <= b.y + b.height + tolerance,
  );
}

/** Virtual signature fields (one per signer with signature spots; one widget per spot) for the overlay. */
export function buildSignerSignatureFields(workflow: SigningWorkflow): PdfFormField[] {
  const out: PdfFormField[] = [];
  for (const s of orderedSigners(workflow)) {
    const spots = signatureSpotsOf(s);
    if (!s.requireSignature || spots.length === 0) continue;
    out.push({
      name: signerSignatureFieldName(s.order),
      type: 'signature',
      readOnly: false,
      required: true,
      tooltip: `Signature — ${s.label || `Signer ${s.order}`}`,
      widgets: spots.map(spotToWidget),
    });
  }
  return out;
}

/** Problems that make a workflow unusable (shown in the editor; enforced at assignment time). */
export function validateSigningWorkflow(workflow: SigningWorkflow | undefined): string[] {
  if (!workflow?.enabled) return [];
  const problems: string[] = [];
  const signers = workflow.signers || [];
  if (signers.length < 2) problems.push('Add at least two signers (or turn off multiple signers).');
  signers.forEach((s, i) => {
    if (s.kind === 'member' && !s.memberUid) problems.push(`Signer ${i + 1}: choose a person.`);
  });
  if (signers.filter((s) => s.kind === 'employee').length > 1) {
    problems.push('Only one signer can be "Employee".');
  }
  const seen = new Map<string, number>();
  signers.forEach((s, i) => {
    for (const name of s.fieldNames || []) {
      if (seen.has(name)) problems.push(`"${name}" is assigned to both signer ${seen.get(name)! + 1} and signer ${i + 1}.`);
      else seen.set(name, i);
    }
  });
  return problems;
}
