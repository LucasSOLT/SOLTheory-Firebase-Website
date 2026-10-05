'use client';

// ============================================================================
// usePdfFormSource — decides whether a pdf_form item can use the visual viewer
//
// Phase 2, Step 2.4 (Onboarding Document System — APPROVED PLAN, Option A)
//
// - Inside a real task: loads the PDF through the authenticated task-template
//   route. If the task's saved fields predate Step 2.2 (no widget geometry),
//   it also asks the server to re-detect them, so old assignments work too.
// - Outside a task (e.g. previews): uses pdfDownloadUrl when geometry exists.
// - Phase I fix: Blueprint Preview of a Document Library / Visual-Designer PDF
//   (no pdfDownloadUrl) loads the template through the admin-only design route
//   (and re-detects fields if the saved ones have no geometry), so admins can
//   test-fill the document exactly like an employee would.
// - Anything else → 'unavailable', and the caller keeps the legacy form grid.
// ============================================================================

import { useEffect, useRef, useState } from 'react';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { PdfFormContent, PdfFormField } from '@/types/onboarding-templates';

export type PdfFormSourceState =
  | { status: 'loading' }
  | { status: 'ready'; pdfBytes?: Uint8Array; fileUrl?: string; fields: PdfFormField[] }
  | { status: 'unavailable' };

export const hasFieldLayout = (fields?: PdfFormField[]) =>
  !!fields?.some((f) => f.widgets?.some((w) => !w.hidden && w.pageIndex >= 0));

export function usePdfFormSource({
  content,
  taskId,
  orgId,
}: {
  content: PdfFormContent;
  taskId?: string;
  /** Lets previews (no task) load a library template through the admin-only route. */
  orgId?: string;
}): PdfFormSourceState {
  const [state, setState] = useState<PdfFormSourceState>({ status: 'loading' });

  // Firestore snapshots recreate this array often; read it via a ref so we don't refetch the PDF each time.
  const savedFieldsRef = useRef(content.detectedFields);
  savedFieldsRef.current = content.detectedFields;
  const savedHasLayout = hasFieldLayout(content.detectedFields);

  useEffect(() => {
    let cancelled = false;

    if (!taskId) {
      if (content.pdfDownloadUrl && savedHasLayout) {
        setState({ status: 'ready', fileUrl: content.pdfDownloadUrl, fields: savedFieldsRef.current || [] });
        return;
      }
      const path = content.pdfStoragePath;
      if (!orgId || !path) {
        setState({ status: 'unavailable' });
        return;
      }
      setState({ status: 'loading' });
      (async () => {
        try {
          const headers = await getAuthHeaders();
          const [pdfRes, detRes] = await Promise.all([
            fetch(`/api/onboarding/pdf-form/design?orgId=${encodeURIComponent(orgId)}&path=${encodeURIComponent(path)}`, { headers }),
            savedHasLayout
              ? Promise.resolve(null)
              : fetch('/api/onboarding/pdf-form/detect-fields', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', ...headers },
                  body: JSON.stringify({ storagePath: path, orgId }),
                }),
          ]);
          if (!pdfRes.ok) throw new Error(`PDF request failed (${pdfRes.status})`);
          const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
          let fields = savedFieldsRef.current || [];
          if (detRes) {
            if (!detRes.ok) throw new Error(`Field request failed (${detRes.status})`);
            fields = ((await detRes.json()).fields as PdfFormField[]) || [];
          }
          if (cancelled) return;
          setState(hasFieldLayout(fields) ? { status: 'ready', pdfBytes, fields } : { status: 'unavailable' });
        } catch (err) {
          console.warn('[PdfForm] Preview could not load the template, using standard form:', err);
          if (!cancelled) setState({ status: 'unavailable' });
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    setState({ status: 'loading' });
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const base = `/api/onboarding/pdf-form/task-template?taskId=${encodeURIComponent(taskId)}`;
        const [pdfRes, fieldsRes] = await Promise.all([
          fetch(base, { headers }),
          savedHasLayout ? Promise.resolve(null) : fetch(`${base}&fields=1`, { headers }),
        ]);
        if (!pdfRes.ok) throw new Error(`PDF request failed (${pdfRes.status})`);

        const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
        let fields = savedFieldsRef.current || [];
        if (fieldsRes) {
          if (!fieldsRes.ok) throw new Error(`Field request failed (${fieldsRes.status})`);
          fields = ((await fieldsRes.json()).fields as PdfFormField[]) || [];
        }
        if (cancelled) return;

        setState(hasFieldLayout(fields) ? { status: 'ready', pdfBytes, fields } : { status: 'unavailable' });
      } catch (err) {
        console.warn('[PdfForm] Visual viewer unavailable, using standard form:', err);
        if (!cancelled) setState({ status: 'unavailable' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId, orgId, content.pdfStoragePath, content.pdfDownloadUrl, savedHasLayout]);

  return state;
}
