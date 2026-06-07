"use client";

import { Header } from '@/components/sections/header';
import { StarBackground } from '@/components/ui/star-background';
import { useState, useCallback } from 'react';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Loader2, MessageSquare } from 'lucide-react';

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
  const firestore = useFirestore();

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

  const isValid = firstName.trim().length > 0 && stripPhone(phone).length === 10 && consent;

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
        consentGiven: true,
        consentTimestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        source: 'website_sms_optin_page',
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
    <div className="flex flex-col min-h-screen bg-[#0A0A0B] text-slate-200 selection:bg-fuchsia-500/30 overflow-x-hidden">
      <title>SMS Opt-In | SOL Theory</title>

      <div className="absolute top-0 w-full z-50 fixed">
        <Header />
      </div>

      <main className="flex-grow z-10 w-full relative">
        <div className="relative w-full min-h-screen overflow-hidden">
          <StarBackground />

          {/* Ambient glow effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
              className="absolute top-[10%] left-[15%] w-[500px] h-[500px] bg-gradient-to-tr from-fuchsia-600/30 to-indigo-500/20 rounded-full blur-[140px]"
            />
            <motion.div
              animate={{ scale: [1, 1.3, 1], opacity: [0.06, 0.12, 0.06] }}
              transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
              className="absolute bottom-[5%] right-[10%] w-[600px] h-[600px] bg-gradient-to-bl from-cyan-500/20 to-purple-500/20 rounded-full blur-[140px]"
            />
          </div>

          <div className="relative z-10 container mx-auto px-4 pt-36 pb-24 flex flex-col items-center">
            {/* Back link */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="self-start mb-10"
            >
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-fuchsia-400 transition-colors font-medium group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </Link>
            </motion.div>

            {/* Page Title */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="text-center mb-12 space-y-4"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 mb-4">
                <MessageSquare className="w-4 h-4 text-fuchsia-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400">
                  SMS Updates
                </span>
              </div>
              <h1 className="font-nunito text-4xl md:text-6xl font-bold text-white tracking-tight drop-shadow-2xl">
                Stay Connected
              </h1>
              <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-light leading-relaxed">
                Sign up to receive important updates, event notifications, and program announcements via text message.
              </p>
            </motion.div>

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="w-full max-w-lg"
            >
              <div className="relative">
                {/* Card glow */}
                <div className="absolute -inset-1 bg-gradient-to-b from-fuchsia-500/10 to-indigo-500/5 rounded-3xl blur-xl" />

                <div className="relative bg-[#0f0f10]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-8 md:p-10 shadow-2xl">
                  {submitted ? (
                    /* Success State */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className="flex flex-col items-center text-center py-8"
                    >
                      <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-3">
                        You are all set!
                      </h2>
                      <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
                        Thank you for signing up. You will start receiving SMS updates from SOL Theory. Reply STOP at any time to unsubscribe.
                      </p>
                      <Link
                        href="/"
                        className="mt-8 inline-flex items-center gap-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors font-medium"
                      >
                        <ArrowLeft className="w-4 h-4" />
                        Return to Home
                      </Link>
                    </motion.div>
                  ) : (
                    /* Form */
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* First Name */}
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-slate-300 mb-2">
                          First Name <span className="text-fuchsia-400">*</span>
                        </label>
                        <input
                          id="firstName"
                          type="text"
                          required
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="Jane"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all duration-200"
                        />
                      </div>

                      {/* Last Name */}
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-slate-300 mb-2">
                          Last Name
                        </label>
                        <input
                          id="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Doe"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all duration-200"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-2">
                          Email Address
                        </label>
                        <input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="jane@example.com"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all duration-200"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-2">
                          Mobile Phone Number <span className="text-fuchsia-400">*</span>
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={phone}
                          onChange={handlePhoneChange}
                          placeholder="(123) 456-7890"
                          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-500/50 focus:border-fuchsia-500/50 transition-all duration-200"
                        />
                      </div>

                      {/* Consent Checkbox */}
                      <div className="flex items-start gap-3 pt-2">
                        <input
                          id="consent"
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-white/5 text-fuchsia-500 focus:ring-fuchsia-500/50 focus:ring-offset-0 cursor-pointer accent-fuchsia-500"
                        />
                        <label htmlFor="consent" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                          By submitting this form, you consent to receive SMS messages from SOL Theory.
                          Message and data rates may apply. Reply STOP to unsubscribe at any time.
                          View our{' '}
                          <Link href="/privacy" className="text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-2">
                            Privacy Policy
                          </Link>{' '}
                          and{' '}
                          <Link href="/terms" className="text-fuchsia-400 hover:text-fuchsia-300 underline underline-offset-2">
                            Terms of Service
                          </Link>.
                        </label>
                      </div>

                      {/* Error */}
                      {error && (
                        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                          {error}
                        </p>
                      )}

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={!isValid || submitting}
                        className="w-full py-3.5 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-fuchsia-600 to-indigo-600 hover:from-fuchsia-500 hover:to-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-300 shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Sign Up for SMS Updates'
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Bottom note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="text-slate-600 text-xs font-medium mt-10 text-center max-w-md"
            >
              Message frequency varies. Standard message and data rates may apply. Text HELP for assistance.
            </motion.p>
          </div>
        </div>
      </main>
    </div>
  );
}
