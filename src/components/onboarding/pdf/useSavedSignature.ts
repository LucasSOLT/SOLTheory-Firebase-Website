'use client';

// ============================================================================
// useSavedSignature — Signature Suite, Phase A
//
// Loads / saves / clears the signed-in user's reusable signature through
// /api/onboarding/saved-signature. A module-level cache means opening the
// signature pad repeatedly (one tap per field) doesn't refetch every time.
// Failures are non-fatal: signing always still works without a saved copy.
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

const ENDPOINT = '/api/onboarding/saved-signature';

// Cache is keyed by uid so switching accounts in the same tab never leaks a signature.
let cache: { uid: string; value: SavedSignature | null } | null = null;
let inflight: Promise<SavedSignature | null> | null = null;

const currentUid = () => getAuth().currentUser?.uid || '';

async function fetchSaved(): Promise<SavedSignature | null> {
  const uid = currentUid();
  if (!uid) return null;
  if (cache?.uid === uid) return cache.value;
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(ENDPOINT, { headers: await getAuthHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        const value: SavedSignature | null = data?.signature || null;
        cache = { uid, value };
        return value;
      } catch {
        return null;
      } finally {
        inflight = null;
      }
    })();
  }
  return inflight;
}

export function useSavedSignature(enabled: boolean) {
  const [saved, setSaved] = useState<SavedSignature | null>(() => {
    const uid = typeof window !== 'undefined' ? currentUid() : '';
    return cache && cache.uid === uid ? cache.value : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    fetchSaved()
      .then((v) => alive && setSaved(v))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [enabled]);

  /** Saves (or replaces) the signature. Returns false on failure — never throws. */
  const save = useCallback(async (imageData: string, method: SignatureMethod) => {
    try {
      const res = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: await getAuthHeaders(),
        body: JSON.stringify({ imageData, method }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      const value: SavedSignature | null = data?.signature || null;
      cache = { uid: currentUid(), value };
      setSaved(value);
      return true;
    } catch {
      return false;
    }
  }, []);

  const remove = useCallback(async () => {
    try {
      const res = await fetch(ENDPOINT, { method: 'DELETE', headers: await getAuthHeaders() });
      if (!res.ok) return false;
      cache = { uid: currentUid(), value: null };
      setSaved(null);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { saved, loading, save, remove };
}
