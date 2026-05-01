'use client';
import {
  Auth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from 'firebase/auth';

// NOTE: Anonymous sign-in and account creation have been intentionally removed.
// Only existing users with email/password can sign in.

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string) {
  // CRITICAL: Call signInWithEmailAndPassword directly. Do NOT use 'await signInWithEmailAndPassword(...)'.
  return signInWithEmailAndPassword(authInstance, email, password);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate password reset email (non-blocking). */
export function initiatePasswordReset(authInstance: Auth, email: string) {
    // CRITICAL: Call sendPasswordResetEmail directly. Do NOT use 'await sendPasswordResetEmail(...)'.
    return sendPasswordResetEmail(authInstance, email);
}
