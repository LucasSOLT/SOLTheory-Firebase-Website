'use client';

// ============================================================================
// useSavedSignature — Signature Suite, Phase A (+ Phase F initials)
//
// Loads / saves / clears the signed-in user's reusable signature OR initials
// through /api/onboarding/saved-signature (`?kind=initials` for initials). A
// module-level cache means opening the signature pad repeatedly (one tap per
// field) doesn't refetch every time. Failures are non-fatal: signing always
// still works without a saved copy.
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { getAuthHeaders } from '@/lib/api-auth-client';
import type { SignatureMethod } from '@/lib/signature-image';

export interface SavedSignature {
  imageData: string;
  method: SignatureMethod;
  updatedAt: string | null;
}

export type SavedKind = 'signature' | 'initials';

const ENDPOINT = '/api/onboarding/saved-signature';
const urlFor = (kind: SavedKind) => (kind === 'initials' ? `${ENDPOINT}?kind=initials` : ENDPOINT);

// Cache is keyed by uid so switching accounts in the same tab never leaks a signature.
// One cache + inflight slot per kind.
const caches: Record<SavedKind, { uid: string; value: SavedSignature | null } | null> = {
  signature: null,
  initials: null,
};
const inflights: Record<SavedKind, Promise<SavedSignature | null> | null> = { signature: null, initials: null };

const currentUid = () => getAuth().currentUser?.uid || '';

async function fetchSaved(kind: SavedKind): Promise<SavedSignature | null> {
  const uid = currentUid();
  if (!uid) return null;
  const cache = caches[kind];
  if (cache?.uid === uid) return cache.value;
  if (!inflights[kind]) {
    inflights[kind] = (async () => {
      try {
        const res = await fetch(urlFor(kind), { headers: await getAuthHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        const value: SavedSignature | null = data?.signature || null;
        caches[kind] = { uid, value };
        return value;
      } catch {
        return null;
      } finally {
        inflights[kind] = null;
      }
    })();
  }
  return inflights[kind];
}

export function useSavedSignature(enabled: boolean, kind: SavedKind = 'signature') {
  const [saved, setSaved] = useState<SavedSignature | null>(() => {
    const uid = typeof window !== 'undefined' ? currentUid() : '';
    const cache = caches[kind];
    return cache && cache.uid === uid ? cache.value : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    fetchSaved(kind)
      .then((v) => alive && setSaved(v))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [enabled, kind]);

  /** Saves (or replaces) the item. Returns false on failure — never throws. */
  const save = useCallback(
    async (imageData: string, method: SignatureMethod) => {
      try {
        const res = await fetch(urlFor(kind), {
          method: 'PUT',
          headers: await getAuthHeaders(),
          body: JSON.stringify({ imageData, method }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        const value: SavedSignature | null = data?.signature || null;
        caches[kind] = { uid: currentUid(), value };
        setSaved(value);
        return true;
      } catch {
        return false;
      }
    },
    [kind],
  );

  const remove = useCallback(async () => {
    try {
      const res = await fetch(urlFor(kind), { method: 'DELETE', headers: await getAuthHeaders() });
      if (!res.ok) return false;
      caches[kind] = { uid: currentUid(), value: null };
      setSaved(null);
      return true;
    } catch {
      return false;
    }
  }, [kind]);

  return { saved, loading, save, remove };
}
