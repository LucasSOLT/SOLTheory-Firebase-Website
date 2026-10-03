'use client';

// ============================================================================
// usePdfDocument — loads a PDF with pdfjs-dist (client-only)
//
// Phase 2, Step 2.1 (Onboarding Document System — APPROVED PLAN, Option A)
//
// - pdfjs-dist is dynamically imported so it never runs during SSR
//   (it needs browser globals like DOMMatrix).
// - The worker is loaded from a version-pinned CDN, matching the existing
//   pattern in ai-knowledge-base/page.tsx.
// - pdf.js transfers the input buffer to its worker (detaching it), so we
//   always pass a copy to keep the caller's bytes usable.
// ============================================================================

import { useEffect, useState } from 'react';
import type { PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { PdfDocumentState } from './types';

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsPromise: Promise<PdfJsModule> | null = null;

/** Lazily loads pdfjs-dist once per page session and configures its worker. */
export function loadPdfJs(): Promise<PdfJsModule> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('pdf.js can only be loaded in the browser'));
  }
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist')
      .then((lib) => {
        // Don't override a worker another screen already configured (same version).
        if (!lib.GlobalWorkerOptions.workerSrc) {
          lib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${lib.version}/build/pdf.worker.min.mjs`;
        }
        return lib;
      })
      .catch((err) => {
        pdfjsPromise = null; // allow a retry on the next call
        throw err;
      });
  }
  return pdfjsPromise;
}

function copyBytes(bytes: Uint8Array | ArrayBuffer): Uint8Array {
  return bytes instanceof Uint8Array ? bytes.slice() : new Uint8Array(bytes.slice(0));
}

const IDLE_STATE: PdfDocumentState = { status: 'idle', doc: null, numPages: 0, error: null };

export function usePdfDocument({
  fileUrl,
  pdfBytes,
}: {
  fileUrl?: string;
  pdfBytes?: Uint8Array | ArrayBuffer;
}): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>(IDLE_STATE);

  useEffect(() => {
    if (!fileUrl && !pdfBytes) {
      setState(IDLE_STATE);
      return;
    }

    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | null = null;
    setState({ status: 'loading', doc: null, numPages: 0, error: null });

    (async () => {
      try {
        const lib = await loadPdfJs();
        if (cancelled) return;

        // Non-embedded standard fonts (Helvetica, ZapfDingbats checkmarks on IRS forms) and CJK
        // character maps are loaded from the same version-pinned CDN as the worker.
        const assetBase = `https://unpkg.com/pdfjs-dist@${lib.version}`;
        const assets = {
          standardFontDataUrl: `${assetBase}/standard_fonts/`,
          cMapUrl: `${assetBase}/cmaps/`,
          cMapPacked: true,
        };
        loadingTask = lib.getDocument(
          pdfBytes ? { data: copyBytes(pdfBytes), ...assets } : { url: fileUrl!, ...assets },
        );
        const doc = await loadingTask.promise;
        if (cancelled) return; // cleanup already destroyed the task (and doc)

        setState({ status: 'ready', doc, numPages: doc.numPages, error: null });
      } catch (err) {
        if (cancelled) return;
        console.error('[PdfViewer] Failed to load PDF:', err);
        setState({
          status: 'error',
          doc: null,
          numPages: 0,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      }
    })();

    return () => {
      cancelled = true;
      // Destroying the loading task also destroys the document + worker port.
      loadingTask?.destroy().catch(() => {});
    };
  }, [fileUrl, pdfBytes]);

  return state;
}
