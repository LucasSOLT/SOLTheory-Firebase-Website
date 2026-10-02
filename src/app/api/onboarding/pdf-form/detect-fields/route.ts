// ============================================================================
// POST /api/onboarding/pdf-form/detect-fields
//
// Analyzes a PDF to extract its AcroForm fields. Used by the blueprint editor
// when an admin uploads a PDF template — the detected fields are stored in the
// blueprint step's interactiveContent so the employee form UI knows what to
// render at onboarding time.
//
// Request body (JSON):
//   {
//     storagePath: string,  // Firebase Storage path to the PDF
//   }
//
// Response:
//   {
//     fields: PdfFormField[],
//     pageCount: number,
//     title?: string,
//   }
// ============================================================================

import { NextResponse } from 'next/server';
import { verifyRequest } from '@/lib/api-auth';
import { initAdmin } from '@/firebase/admin';
import { getStorage } from 'firebase-admin/storage';
import { firebaseConfig } from '@/firebase/config';
import { detectPdfFields } from '@/lib/pdf-form-engine';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const auth = await verifyRequest(req);
    if (!auth.ok) return auth.response;

    const { storagePath } = await req.json();

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'Missing storagePath' }, { status: 400 });
    }

    await initAdmin();
    const bucket = getStorage().bucket(firebaseConfig.storageBucket);

    // Download the PDF
    const [buffer] = await bucket.file(storagePath).download();
    const pdfBytes = new Uint8Array(buffer);

    // Detect fields
    const fields = await detectPdfFields(pdfBytes);

    // Get page count
    const { PDFDocument } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const pageCount = pdfDoc.getPageCount();
    const title = pdfDoc.getTitle() || undefined;

    return NextResponse.json({
      fields,
      pageCount,
      title,
      totalFields: fields.length,
      fillableFields: fields.filter((f) => !f.readOnly).length,
    });
  } catch (err: any) {
    console.error('[PDF Detect Fields] Error:', err.message, err.stack);
    return NextResponse.json(
      { error: 'Failed to detect PDF fields', details: err.message },
      { status: 500 },
    );
  }
}
