'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Header } from '@/components/sections/header';
import { Footer } from '@/components/sections/footer';
import { StarBackground } from '@/components/ui/star-background';
import { 
  ArrowRight, ArrowLeft, Loader2, CheckCircle2, Mail, Lock, 
  User, Phone, Briefcase, Award, Eye, EyeOff, Search, X, 
  Building2, ShieldCheck, AlertCircle, Sparkles, LogOut, Check
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  JOB_ROLES_BY_INDUSTRY, 
  ALL_JOB_ROLES, 
  COMMON_CERTIFICATIONS, 
  searchJobRoles, 
  searchCertifications 
} from '@/lib/job-roles';
import { getOrgLabel } from '@/lib/org-config';
import { initializeFirebase } from '@/firebase/init';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

// Wrapped in Suspense because of useSearchParams
function SignupWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteParam = searchParams.get('invite');

  // State
  const [step, setStep] = useState(1);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [accountType, setAccountType] = useState<'org' | 'demo'>('demo');
  const [manualInviteToken, setManualInviteToken] = useState('');

  // Form fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [certifications, setCertifications] = useState<string[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [roleSearch, setRoleSearch] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showCertDropdown, setShowCertDropdown] = useState(false);

  // ── Upgrade flow: detect logged-in demo users with invite tokens ──
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isDemoUpgrade, setIsDemoUpgrade] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [upgradeOrgId, setUpgradeOrgId] = useState('');

  // Refs for clicking outside
  const roleRef = useRef<HTMLDivElement>(null);
  const certRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (roleRef.current && !roleRef.current.contains(event.target as Node)) setShowRoleDropdown(false);
      if (certRef.current && !certRef.current.contains(event.target as Node)) setShowCertDropdown(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (inviteParam) {
      validateInvite(inviteParam);
    }
  }, [inviteParam]);

  // ── Detect logged-in demo users who clicked an invite link ──
  useEffect(() => {
    if (!inviteParam) return;
    try {
      const { auth, firestore } = initializeFirebase();
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        setCurrentUser(user);
        if (user && inviteData?.valid !== false) {
          // Check if the logged-in user is a demo user
          try {
            const userDocRef = doc(firestore, 'users', user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists() && userDocSnap.data()?.accountType === 'demo') {
              setIsDemoUpgrade(true);
            }
          } catch { /* silently fail — show normal signup form */ }
        }
      });
      return () => unsubscribe();
    } catch { /* Firebase init failure — show normal form */ }
  }, [inviteParam, inviteData]);

  // ── Handle upgrade from demo to org_member ──
  const handleUpgrade = async () => {
    if (!currentUser || !inviteToken) return;
    setUpgradeLoading(true);
    setUpgradeError('');
    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/auth/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ inviteToken }),
      });
      const data = await res.json();
      if (res.ok) {
        setUpgradeSuccess(true);
        setUpgradeOrgId(data.orgId || '');
        // Redirect to the new org dashboard after a brief delay
        setTimeout(() => {
          router.push(`/portal/dashboard/${data.orgId}`);
        }, 3000);
      } else {
        setUpgradeError(data.error || 'Upgrade failed. Please try again.');
      }
    } catch {
      setUpgradeError('An unexpected error occurred during upgrade.');
    } finally {
      setUpgradeLoading(false);
    }
  };

  const validateInvite = async (token: string) => {
    setInviteLoading(true);
    setInviteError('');
    try {
      const res = await fetch(`/api/auth/invite?token=${token}`);
      const data = await res.json();
      if (res.ok) {
        setInviteData(data);
        setInviteToken(token);
        setAccountType('org');
        if (data.email) setEmail(data.email);
      } else {
        setInviteError(data.error || 'Invalid invite token');
        setAccountType('demo');
      }
    } catch (err) {
      setInviteError('Failed to validate invite');
      setAccountType('demo');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleManualInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInviteToken) {
      validateInvite(manualInviteToken);
    }
  };

  const isStepValid = () => {
    switch (step) {
      case 1:
        return true;
      case 2:
        return firstName.trim() !== '' && lastName.trim() !== '' && email.includes('@') && phone.trim() !== '';
      case 3:
        return jobTitle.trim() !== '' && certifications.length >= 1;
      case 4:
        return password.length >= 8 && password === confirmPassword;
      case 5:
        return agreedToTerms;
      default:
        return false;
    }
  };

  const nextStep = () => {
    if (isStepValid() && step < 5) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
    if (!isStepValid()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = {
        firstName, lastName, email, phone, jobTitle, certifications, password, accountType,
        ...(inviteToken && { inviteToken })
      };
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitSuccess(true);
      } else {
        setSubmitError(data.error || 'Registration failed');
      }
    } catch (err) {
      setSubmitError('An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="w-full max-w-3xl mx-auto mb-10">
      <div className="flex justify-between relative">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-700 -z-10 -translate-y-1/2 rounded"></div>
        <div 
          className="absolute top-1/2 left-0 h-1 bg-indigo-600 -z-10 -translate-y-1/2 rounded transition-all duration-300"
          style={{ width: `${((step - 1) / 4) * 100}%` }}
        ></div>
        {[1, 2, 3, 4, 5].map((num) => (
          <div 
            key={num} 
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors duration-300
              ${step === num ? 'bg-indigo-600 text-white ring-4 ring-indigo-900/50' : 
                step > num ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 border border-slate-600'}`}
          >
            {step > num ? <CheckCircle2 className="w-5 h-5" /> : num}
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-3 px-1 text-xs text-slate-400 font-medium">
        <span className={step >= 1 ? 'text-indigo-400' : ''}>Account</span>
        <span className={step >= 2 ? 'text-indigo-400' : ''}>Personal Info</span>
        <span className={step >= 3 ? 'text-indigo-400' : ''}>Role</span>
        <span className={step >= 4 ? 'text-indigo-400' : ''}>Security</span>
        <span className={step >= 5 ? 'text-indigo-400' : ''}>Review</span>
      </div>
    </div>
  );

  const getFilteredRoles = (): { category: string; roles: { id: string; title: string }[] }[] => {
    try {
      const grouped = searchJobRoles(roleSearch);
      return Object.entries(grouped).map(([category, roles]) => ({
        category,
        roles: roles.map((r, i) => ({ id: `${category}-${i}`, title: r })),
      }));
    } catch {
      return [{ category: 'Matches', roles: [{ id: '1', title: roleSearch }] }];
    }
  };

  const getFilteredCerts = () => {
    try {
      return searchCertifications(certSearch) || [];
    } catch {
      return [{ id: '1', name: certSearch }];
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col relative overflow-hidden">
      <div className="opacity-15"><StarBackground /></div>
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 relative z-10">
        {(isDemoUpgrade || upgradeSuccess) ? (
          <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl overflow-hidden p-8 sm:p-10 my-10 relative">
            {upgradeSuccess ? (
              <div className="text-center py-8 space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-white mb-2">Upgrade Complete!</h2>
                  <p className="text-slate-300 text-base">
                    Your account has been officially upgraded to <span className="font-semibold text-emerald-400">{getOrgLabel(upgradeOrgId || inviteData?.orgId || '')}</span>.
                  </p>
                </div>
                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 space-y-2 text-left">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Demo watermark removed
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Premium AI models unlocked (Opus 5, GPT-5.6, Gemini 3.5 Flash)
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Organization Knowledge Base & Document uploads unlocked
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> CRM, BI & team collaboration tools unlocked
                  </div>
                </div>
                <div className="pt-2">
                  <Link
                    href={`/portal/dashboard/${upgradeOrgId || inviteData?.orgId || ''}`}
                    className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/20"
                  >
                    Enter Organization Workspace <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="text-xs text-slate-500">Redirecting automatically in a few seconds...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-full w-fit">
                  <Sparkles className="w-3.5 h-3.5" /> Organization Upgrade Invite
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                    Upgrade to {getOrgLabel(inviteData?.orgId || '')}
                  </h2>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    You are currently signed in as <span className="text-slate-200 font-medium">{currentUser?.email}</span>. Click below to upgrade your existing demo account and join <span className="text-indigo-300 font-medium">{getOrgLabel(inviteData?.orgId || '')}</span> with full organization access.
                  </p>
                </div>

                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
                  <div className="font-semibold text-slate-200 text-sm mb-1">What you'll unlock immediately:</div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Full AI model catalog (Opus 5, GPT-5.6, Gemini 3.5 Flash)
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> AI Brain document uploads & Shared Org Brain
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Full CRM, Business Intelligence & Campaign tools
                  </div>
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4 shrink-0" /> Remove demo watermark & limits permanently
                  </div>
                </div>

                {upgradeError && (
                  <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-xl text-red-200 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{upgradeError}</span>
                  </div>
                )}

                <div className="space-y-3 pt-2">
                  <button
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="w-full py-3.5 px-6 rounded-xl font-semibold bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {upgradeLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Upgrading your account...
                      </>
                    ) : (
                      <>
                        Accept Invite & Upgrade Account <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700/60 text-xs text-slate-400">
                    <button
                      onClick={async () => {
                        try {
                          const { auth } = initializeFirebase();
                          await signOut(auth);
                          setCurrentUser(null);
                          setIsDemoUpgrade(false);
                        } catch (e) { console.error(e); }
                      }}
                      className="hover:text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" /> Sign out to use another email
                    </button>
                    <Link
                      href="/portal/dashboard/personal"
                      className="hover:text-slate-200 transition-colors"
                    >
                      Continue in Demo →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="text-center mb-10 mt-10">
              <h1 className="text-4xl font-bold text-white mb-3 tracking-tight">Create your INSiGHT account</h1>
              <p className="text-slate-400 text-lg">Join the premier platform for organization management.</p>
            </div>

            {renderStepIndicator()}

            <div className="w-full max-w-xl bg-slate-800/80 backdrop-blur-md rounded-2xl border border-slate-700 shadow-xl overflow-hidden min-h-[500px] flex flex-col mb-10">
          <div className="p-8 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="h-full"
              >
                {step === 1 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Building2 className="w-6 h-6 text-indigo-400" /> Account Type
                    </h2>
                    
                    {inviteToken && inviteData ? (
                      <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-xl p-6 text-center">
                        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                        <h3 className="text-xl font-bold text-emerald-300 mb-2">You've been invited!</h3>
                        <p className="text-emerald-100/80">Join <span className="font-semibold text-white">{inviteData.orgName || 'your organization'}</span> as a member.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div 
                          className={`p-5 rounded-xl border cursor-pointer transition-colors ${accountType === 'demo' ? 'bg-indigo-900/30 border-indigo-500' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500'}`}
                          onClick={() => setAccountType('demo')}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <User className={`w-5 h-5 ${accountType === 'demo' ? 'text-indigo-400' : 'text-slate-400'}`} />
                            <h3 className="font-semibold text-white text-lg">Create Individual Account</h3>
                          </div>
                          <p className="text-sm text-slate-400">Create a personal demo account. <i className="text-slate-300">This is a demo account. To access full features, request an invite link from your organization's admin.</i></p>
                        </div>
                        
                        <div className={`p-5 rounded-xl border transition-colors ${accountType === 'org' ? 'bg-slate-800 border-slate-600' : 'bg-slate-800/50 border-slate-700'}`}>
                          <div className="flex items-center gap-3 mb-2">
                            <Building2 className="w-5 h-5 text-slate-400" />
                            <h3 className="font-semibold text-white text-lg">Join an Organization</h3>
                          </div>
                          <p className="text-sm text-slate-400 mb-4">Have an invite token? Paste it below to join your organization.</p>
                          <form onSubmit={handleManualInvite} className="flex gap-2">
                            <div className="relative flex-1">
                              <ShieldCheck className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input 
                                type="text"
                                placeholder="Invite Token"
                                value={manualInviteToken}
                                onChange={(e) => setManualInviteToken(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                              />
                            </div>
                            <button type="submit" disabled={inviteLoading || !manualInviteToken} className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                              {inviteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate'}
                            </button>
                          </form>
                          {inviteError && <p className="text-red-400 text-sm mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {inviteError}</p>}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <User className="w-6 h-6 text-indigo-400" /> Personal Info
                    </h2>
                    
                    {accountType === 'org' && (
                      <div className="bg-blue-900/30 border border-blue-500/30 p-4 rounded-lg flex gap-3 text-blue-200">
                        <Mail className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-sm">💡 We recommend using your official organizational email (e.g., name@company.org) to ensure proper integration.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">First Name *</label>
                        <input 
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Last Name *</label>
                        <input 
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">Email Address *</label>
                      <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 px-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-slate-300">Phone Number *</label>
                      <div className="relative">
                        <Phone className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="tel"
                          placeholder="+1 (555) 000-0000"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Briefcase className="w-6 h-6 text-indigo-400" /> Role & Certifications
                    </h2>

                    <div className="space-y-1.5 relative" ref={roleRef}>
                      <label className="text-sm font-medium text-slate-300">Job Role *</label>
                      {jobTitle ? (
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-600 rounded-lg p-2">
                          <span className="bg-indigo-600/30 text-indigo-300 px-3 py-1.5 rounded-md text-sm font-medium">{jobTitle}</span>
                          <button onClick={() => setJobTitle('')} className="ml-auto p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="text"
                            placeholder="Search job roles..."
                            value={roleSearch}
                            onChange={(e) => {
                              setRoleSearch(e.target.value);
                              setShowRoleDropdown(true);
                            }}
                            onFocus={() => setShowRoleDropdown(true)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          {showRoleDropdown && (
                            <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                              {roleSearch && (
                                <div 
                                  className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 text-indigo-300 text-sm font-medium"
                                  onClick={() => { setJobTitle(roleSearch); setShowRoleDropdown(false); setRoleSearch(''); }}
                                >
                                  Use "{roleSearch}" as custom role
                                </div>
                              )}
                              {getFilteredRoles().map((group: any, idx: number) => (
                                <div key={idx} className="p-2">
                                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-2">{group.category}</div>
                                  {group.roles?.map((r: any) => (
                                    <div 
                                      key={r.id}
                                      className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-md cursor-pointer"
                                      onClick={() => { setJobTitle(r.title); setShowRoleDropdown(false); setRoleSearch(''); }}
                                    >
                                      {r.title}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 relative" ref={certRef}>
                      <label className="text-sm font-medium text-slate-300">Certifications *</label>
                      <div className="relative">
                        <Award className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                          type="text"
                          placeholder="Search and add certifications..."
                          value={certSearch}
                          onChange={(e) => {
                            setCertSearch(e.target.value);
                            setShowCertDropdown(true);
                          }}
                          onFocus={() => setShowCertDropdown(true)}
                          className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        />
                        {showCertDropdown && (
                          <div className="absolute z-20 w-full mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {certSearch && (
                              <div 
                                className="p-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 text-indigo-300 text-sm font-medium"
                                onClick={() => { 
                                  if(!certifications.includes(certSearch)) setCertifications([...certifications, certSearch]); 
                                  setShowCertDropdown(false); setCertSearch(''); 
                                }}
                              >
                                Add "{certSearch}" as custom certification
                              </div>
                            )}
                            {getFilteredCerts().map((c: any, idx: number) => (
                              <div 
                                key={idx}
                                className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-md cursor-pointer"
                                onClick={() => { 
                                  if(!certifications.includes(c.name || c)) setCertifications([...certifications, c.name || c]); 
                                  setShowCertDropdown(false); setCertSearch(''); 
                                }}
                              >
                                {c.name || c}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {certifications.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-3 p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                          {certifications.map((cert) => (
                            <div key={cert} className="flex items-center gap-1 bg-slate-700 text-white px-3 py-1 rounded-full text-sm">
                              {cert}
                              <button onClick={() => setCertifications(certifications.filter(c => c !== cert))} className="text-slate-400 hover:text-white">
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Lock className="w-6 h-6 text-indigo-400" /> Create Password
                    </h2>
                    
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Password *</label>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-10 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-300">Confirm Password *</label>
                        <div className="relative">
                          <Lock className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type={showConfirmPassword ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg py-2.5 pl-10 pr-10 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                          />
                          <button 
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          >
                            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-4 bg-slate-900/50 rounded-lg border border-slate-800 space-y-2">
                        <p className="text-sm font-medium text-slate-300 mb-2">Password Requirements:</p>
                        <div className="flex items-center gap-2 text-sm">
                          {password.length >= 8 ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-slate-600" />}
                          <span className={password.length >= 8 ? 'text-emerald-400' : 'text-slate-400'}>At least 8 characters</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {password !== '' && password === confirmPassword ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <div className="w-4 h-4 rounded-full border border-slate-600" />}
                          <span className={password !== '' && password === confirmPassword ? 'text-emerald-400' : 'text-slate-400'}>Passwords match</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="space-y-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <CheckCircle2 className="w-6 h-6 text-indigo-400" /> Review & Submit
                    </h2>
                    
                    {submitSuccess ? (
                      <div className="bg-emerald-900/30 border border-emerald-500/50 rounded-xl p-8 text-center space-y-4">
                        <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
                        <h3 className="text-2xl font-bold text-emerald-300">Account Created!</h3>
                        <p className="text-emerald-100/80 mb-6">Your INSiGHT account has been successfully created. You can now log in.</p>
                        <Link href="/portal/login/insight" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors">
                          Go to Login <ArrowRight className="w-5 h-5" />
                        </Link>
                      </div>
                    ) : (
                      <>
                        <div className="bg-slate-900 rounded-xl p-5 border border-slate-700 space-y-4 text-sm">
                          <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-3">
                            <span className="text-slate-500">Account Type</span>
                            <span className="col-span-2 font-medium text-white flex items-center gap-2">
                              {accountType === 'org' ? <><Building2 className="w-4 h-4 text-indigo-400"/> Organization ({inviteData?.orgName || 'Invited'})</> : <><User className="w-4 h-4 text-slate-400"/> Individual / Demo</>}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-3">
                            <span className="text-slate-500">Name</span>
                            <span className="col-span-2 font-medium text-white">{firstName} {lastName}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 border-b border-slate-800 pb-3">
                            <span className="text-slate-500">Contact</span>
                            <span className="col-span-2 font-medium text-white block">
                              <div>{email}</div>
                              <div className="text-slate-400 mt-0.5">{phone}</div>
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <span className="text-slate-500">Role</span>
                            <span className="col-span-2 font-medium text-white block">
                              <div>{jobTitle}</div>
                              {certifications.length > 0 && <div className="text-slate-400 mt-1 flex flex-wrap gap-1">{certifications.map(c => <span key={c} className="bg-slate-800 px-1.5 py-0.5 rounded text-xs">{c}</span>)}</div>}
                            </span>
                          </div>
                        </div>

                        {submitError && (
                          <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-lg flex gap-3 text-red-200">
                            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm">{submitError}</p>
                          </div>
                        )}

                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className="relative flex items-center mt-0.5">
                            <input 
                              type="checkbox" 
                              checked={agreedToTerms}
                              onChange={(e) => setAgreedToTerms(e.target.checked)}
                              className="w-5 h-5 bg-slate-900 border-2 border-slate-600 rounded appearance-none checked:bg-indigo-600 checked:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors"
                            />
                            {agreedToTerms && <CheckCircle2 className="absolute inset-0 w-5 h-5 text-white pointer-events-none scale-75" />}
                          </div>
                          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">
                            I agree to the <Link href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Terms of Service</Link> and <Link href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2">Privacy Policy</Link>.
                          </span>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {!submitSuccess && (
            <div className="p-6 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center mt-auto">
              {step > 1 ? (
                <button 
                  onClick={prevStep}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-lg border border-slate-600 text-white font-medium hover:bg-slate-800 hover:border-slate-500 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
              ) : <div></div>}

              {step < 5 ? (
                <button 
                  onClick={nextStep}
                  disabled={!isStepValid()}
                  className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-indigo-600"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button 
                  onClick={handleSubmit}
                  disabled={!isStepValid() || isSubmitting}
                  className="px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:hover:bg-indigo-600"
                >
                  {isSubmitting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                  ) : (
                    <>Create Account <CheckCircle2 className="w-4 h-4" /></>
                  )}
                </button>
              )}
            </div>
          )}
        </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function SignupWizard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><Loader2 className="w-12 h-12 text-indigo-500 animate-spin" /></div>}>
      <SignupWizardContent />
    </Suspense>
  );
}
