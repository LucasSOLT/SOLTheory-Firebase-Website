"use client";

import { Header } from '@/components/sections/header';
import { useState, useCallback, useMemo } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';
import Link from 'next/link';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Footer } from '@/components/sections/footer';

function getPublicFirestore() {
  const appName = 'sms-optin-public';
  let app;
  try {
    app = getApp(appName);
  } catch {
    app = initializeApp(firebaseConfig, appName);
  }
  return getFirestore(app);
}

function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}

function stripPhone(value: string): string {
  return value.replace(/\D/g, '');
}

export default function SmsOptInPage() {
  const firestore = useMemo(() => getPublicFirestore(), []);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = stripPhone(raw);
    if (digits.length <= 10) {
      setPhone(formatPhoneNumber(raw));
    }
  }, []);

  const isValid = stripPhone(phone).length === 10 && consent;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      await addDoc(collection(firestore, 'sms_optins'), {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
        email: email.trim() || null,
        phone: stripPhone(phone),
        sms_opt_in: true,
        optedOut: false,
        consentGiven: true,
        consentTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        source: 'website_sms_optin_page',
      });

      // Send confirmation SMS (fire-and-forget, don't block the UI)
      fetch('/api/sms/opt-in-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: stripPhone(phone) }),
      }).catch((smsErr) => {
        console.warn('Confirmation SMS failed (non-blocking):', smsErr);
      });

      setSubmitted(true);
    } catch (err) {
      console.error('SMS opt-in submission error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#09090b] text-slate-200">
      <title>SMS Notifications | SOL Theory</title>

      <Header />

      <main className="flex-grow flex items-center justify-center px-4 py-28 md:py-32">
        <div className="w-full max-w-xl">

          {/* Header text */}
          <div className="mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">SMS Notifications</p>
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              Stay in the loop
            </h1>
            <p className="text-[15px] text-slate-400 mt-3 leading-relaxed">
              Receive important updates, reminders, and announcements directly to your phone.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-[#111113] border border-[#1e1e22] rounded-xl p-7 md:p-10">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-6">
                <div className="w-12 h-12 rounded-full bg-emerald-900/40 flex items-center justify-center mb-5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-2">
                  Thank you!
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
                  You are now subscribed to SOLTheory notifications. A confirmation text has been sent to your phone. Message and data rates may apply. Reply STOP at any time to unsubscribe, or text HELP for assistance.
                </p>
                <Link
                  href="/"
                  className="mt-6 text-sm text-slate-400 hover:text-white transition-colors"
                >
                  Return to homepage
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-slate-400 mb-2">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Jane"
                      className="w-full px-4 py-3 bg-[#09090b] border border-[#1e1e22] rounded-lg text-white placeholder-slate-600 text-[15px] focus:outline-none focus:border-[#333] transition-colors"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-slate-400 mb-2">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Doe"
                      className="w-full px-4 py-3 bg-[#09090b] border border-[#1e1e22] rounded-lg text-white placeholder-slate-600 text-[15px] focus:outline-none focus:border-[#333] transition-colors"
                    />
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-400 mb-2">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full px-4 py-3 bg-[#09090b] border border-[#1e1e22] rounded-lg text-white placeholder-slate-600 text-[15px] focus:outline-none focus:border-[#333] transition-colors"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-400 mb-2">
                    Mobile Phone <span className="text-red-400">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(123) 456-7890"
                    className="w-full px-4 py-3 bg-[#09090b] border border-[#1e1e22] rounded-lg text-white placeholder-slate-600 text-[15px] focus:outline-none focus:border-[#333] transition-colors"
                  />
                </div>

                {/* Divider */}
                <div className="h-px bg-[#1e1e22] my-1" />

                {/* Consent Checkbox */}
                <div className="flex items-start gap-3">
                  <input
                    id="consent"
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-0.5 h-[18px] w-[18px] rounded border-[#333] bg-[#09090b] cursor-pointer accent-white shrink-0"
                  />
                  <label htmlFor="consent" className="text-[13px] text-slate-500 leading-relaxed cursor-pointer">
                    I agree to receive automated text messages from SOL Theory at the mobile number provided. I understand that consent is not a condition of any purchase. Message and data rates may apply. Message frequency varies. I can unsubscribe at any time by replying STOP or text HELP for assistance. View our{' '}
                    <Link href="/privacy-policy" className="text-slate-300 hover:text-white underline underline-offset-2">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link href="/terms-and-conditions" className="text-slate-300 hover:text-white underline underline-offset-2">
                      Terms & Conditions
                    </Link>.
                  </label>
                </div>

                {/* Validation Warning */}
                {stripPhone(phone).length === 10 && !consent && (
                  <p className="text-[11px] text-amber-400 pl-7">
                    Please check the consent box to continue.
                  </p>
                )}

                {/* Error */}
                {error && (
                  <p className="text-sm text-red-400 bg-red-950/50 border border-red-900/50 rounded-lg px-4 py-2">
                    {error}
                  </p>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!isValid || submitting}
                  className="w-full py-3 rounded-lg font-medium text-[15px] text-white bg-white/[0.08] hover:bg-white/[0.12] border border-[#1e1e22] disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Opt-In to Notifications'
                  )}
                </button>
              </form>
            )}
          </div>

          {/* Footer note */}
          <p className="text-[10px] text-slate-600 mt-4 text-center leading-relaxed">
            Message frequency varies. Standard message and data rates may apply. Text HELP for assistance.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
