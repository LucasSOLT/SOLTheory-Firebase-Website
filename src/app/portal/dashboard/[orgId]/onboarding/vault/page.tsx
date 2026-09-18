'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { useOrgId } from '@/contexts/OrgContext';
import { useTheme } from '@/components/ThemeProvider';
import { useOrgRole } from '@/hooks/useOrgRole';
import { getAuthHeaders } from '@/lib/api-auth-client';
import {
  collection,
  query,
  onSnapshot,
  orderBy,
} from 'firebase/firestore';
import {
  ShieldCheck,
  FileCheck,
  AlertTriangle,
  Clock,
  Download,
  Search,
  Filter,
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  COMPLIANCE_CATEGORY_LABELS,
  type ComplianceDocument,
  type ComplianceDocumentCategory,
  type VerificationStatus,
} from '@/types/onboarding-templates';

export default function ComplianceVaultPage() {
  const { orgId: routeOrgId } = useParams<{ orgId: string }>();
  const contextOrgId = useOrgId();
  const orgId = routeOrgId || contextOrgId;
  const router = useRouter();

  const { user } = useUser();
  const firestore = useFirestore();
  const { isDarkMode } = useTheme();
  const { role, isLoading: isRoleLoading } = useOrgRole(orgId);

  const isAdmin = role === 'admin' || role === 'oracle';

  // ── State ─────────────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | VerificationStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Verify modal state
  const [selectedDoc, setSelectedDoc] = useState<ComplianceDocument | null>(null);
  const [actionType, setActionType] = useState<'verified' | 'rejected' | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // ── Data Subscription & Server Fallback ──────────────────────────────────
  const fetchServerVault = useCallback(async () => {
    if (!orgId) return;
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/onboarding/vault/list?orgId=${orgId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.documents) {
          setDocuments(data.documents);
        }
      }
    } catch (err) {
      console.warn('[Vault] Server fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchServerVault();
  }, [fetchServerVault]);

  useEffect(() => {
    if (!firestore || !orgId || !user?.uid) return;

    const docsRef = collection(firestore, `orgs/${orgId}/compliance_documents`);
    const q = query(docsRef);

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as ComplianceDocument));
        setDocuments(items);
        setLoading(false);
      },
      (err) => {
        fetchServerVault();
      },
    );

    return () => unsub();
  }, [firestore, orgId, user?.uid, fetchServerVault]);

  // ── Filtered Documents ────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (statusFilter !== 'all' && doc.status !== statusFilter) return false;
      if (categoryFilter !== 'all' && doc.documentCategory !== categoryFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          doc.userName.toLowerCase().includes(q) ||
          doc.userEmail.toLowerCase().includes(q) ||
          doc.fileName.toLowerCase().includes(q) ||
          (COMPLIANCE_CATEGORY_LABELS[doc.documentCategory] || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [documents, statusFilter, categoryFilter, searchQuery]);

  // ── Metrics ───────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = documents.length;
    const verified = documents.filter(d => d.status === 'verified').length;
    const pending = documents.filter(d => d.status === 'pending_review').length;
    const rejected = documents.filter(d => d.status === 'rejected').length;
    return { total, verified, pending, rejected };
  }, [documents]);

  // ── Verification Action Handler ───────────────────────────────────────────
  const handlePerformAction = async () => {
    if (!selectedDoc || !actionType) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/onboarding/vault/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          orgId,
          documentId: selectedDoc.id,
          status: actionType,
          notes: reviewNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update document status');
      }

      // Close modal
      setSelectedDoc(null);
      setActionType(null);
      setReviewNotes('');
    } catch (err: any) {
      console.error('[Vault] Action error:', err);
      setActionError(err.message || 'Verification update failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ── CSV Audit Export ──────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (documents.length === 0) return;

    const headers = [
      'Document ID',
      'Employee Name',
      'Employee Email',
      'Document Category',
      'File Name',
      'Verification Status',
      'Upload Date',
      'Verified By',
      'Verified Date',
      'Review Notes',
      'Download URL',
    ];

    const rows = documents.map(d => [
      d.id,
      `"${d.userName.replace(/"/g, '""')}"`,
      d.userEmail,
      `"${(COMPLIANCE_CATEGORY_LABELS[d.documentCategory] || d.documentCategory).replace(/"/g, '""')}"`,
      `"${d.fileName.replace(/"/g, '""')}"`,
      d.status.toUpperCase(),
      d.uploadedAt?.toDate?.()?.toISOString() || '',
      d.verifiedByEmail || '—',
      d.verifiedAt?.toDate?.()?.toISOString() || '—',
      `"${(d.notes || '').replace(/"/g, '""')}"`,
      d.downloadUrl,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Compliance_Audit_Manifest_${orgId}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [documents, orgId]);

  // ── Loading & RBAC Guard ──────────────────────────────────────────────────
  if (loading || isRoleLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
        <p className={`text-sm font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          Loading Compliance Vault...
        </p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-6">
        <ShieldCheck className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-xl font-bold">Access Restricted</h2>
        <p className={`text-sm mt-1 max-w-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          The Executive Compliance Vault is reserved for administrators and supervisors.
        </p>
        <button
          onClick={() => router.push(`/portal/dashboard/${orgId}/onboarding`)}
          className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white"
        >
          Return to Onboarding
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full -mx-4 -mb-4 md:-mx-10 md:-mb-10 ${isDarkMode ? 'bg-slate-900 text-white' : 'bg-[#f5f1e8] text-slate-900'} font-sans overflow-hidden`}>
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className={`shrink-0 px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b ${isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200/80 bg-[#f5f1e8]'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => router.push(`/portal/dashboard/${orgId}/onboarding`)}
                className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Onboarding
              </button>
              <span className={`text-xs ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>•</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 uppercase tracking-wider">
                Monica Engine
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-indigo-900/50 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                <ShieldCheck className="w-5 h-5" />
              </div>
              Executive Compliance Vault
            </h1>
            <p className={`mt-1 text-sm ml-[52px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Audit-safe repository and one-click verification console for all legal, HR, and safety documents.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportCSV}
              disabled={documents.length === 0}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm active:scale-[0.98] ${
                documents.length === 0
                  ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-500'
                  : isDarkMode
                    ? 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
                    : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
              }`}
            >
              <Download className="w-4 h-4" />
              Export Audit Manifest (CSV)
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6 space-y-6">

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[
            {
              label: 'Total Documents',
              value: metrics.total,
              icon: <FileText className="w-4 h-4" />,
              accent: isDarkMode ? 'text-indigo-400 bg-indigo-900/40' : 'text-indigo-600 bg-indigo-50',
            },
            {
              label: 'Verified & Approved',
              value: metrics.verified,
              icon: <CheckCircle2 className="w-4 h-4" />,
              accent: isDarkMode ? 'text-emerald-400 bg-emerald-900/40' : 'text-emerald-600 bg-emerald-50',
            },
            {
              label: 'Pending Review',
              value: metrics.pending,
              icon: <Clock className="w-4 h-4" />,
              accent: isDarkMode ? 'text-amber-400 bg-amber-900/40' : 'text-amber-600 bg-amber-50',
            },
            {
              label: 'Action Required',
              value: metrics.rejected,
              icon: <AlertTriangle className="w-4 h-4" />,
              accent: isDarkMode ? 'text-rose-400 bg-rose-900/40' : 'text-rose-600 bg-rose-50',
            },
          ].map((stat, idx) => (
            <div
              key={idx}
              className={`rounded-xl px-4 py-3 ${isDarkMode ? 'bg-slate-800/60 border border-slate-700/50' : 'bg-white/70 border border-slate-200/80 shadow-sm'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${stat.accent}`}>
                  {stat.icon}
                </div>
                <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {stat.label}
                </span>
              </div>
              <div className={`text-xl font-extrabold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search by employee, category, or file name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                isDarkMode
                  ? 'bg-slate-800/60 border-slate-700/50 text-white placeholder:text-slate-500 focus:border-indigo-500/50'
                  : 'bg-white/70 border-slate-200/80 text-slate-900 placeholder:text-slate-400 focus:border-indigo-400/50'
              } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Pills */}
            {(['all', 'pending_review', 'verified', 'rejected'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === status
                    ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-white')
                    : (isDarkMode ? 'bg-slate-800 text-slate-400 hover:bg-slate-700' : 'bg-white/80 text-slate-500 hover:bg-slate-100 border border-slate-200/60')
                }`}
              >
                {status === 'all' ? 'All' : status === 'pending_review' ? 'Pending' : status === 'verified' ? 'Verified' : 'Rejected'}
              </button>
            ))}
          </div>
        </div>

        {/* Audit Document List */}
        {filteredDocs.length === 0 ? (
          <div className={`rounded-2xl border-2 border-dashed px-6 py-12 text-center ${
            isDarkMode ? 'border-slate-700/50 bg-slate-800/20' : 'border-slate-200/60 bg-white/30'
          }`}>
            <FileText className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-slate-600' : 'text-slate-300'}`} />
            <h3 className={`text-lg font-bold mb-1 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              No compliance documents match your filters
            </h3>
            <p className={`text-sm ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              Documents uploaded by new hires through their onboarding track will appear here for verification.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map(doc => {
              const categoryLabel = COMPLIANCE_CATEGORY_LABELS[doc.documentCategory] || doc.documentCategory;
              const isPending = doc.status === 'pending_review';
              const isVerified = doc.status === 'verified';
              const isRejected = doc.status === 'rejected';

              return (
                <div
                  key={doc.id}
                  className={`rounded-xl px-5 py-4 transition-all ${
                    isDarkMode
                      ? 'bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800/80'
                      : 'bg-white/70 border border-slate-200/80 shadow-sm hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isVerified
                          ? (isDarkMode ? 'bg-emerald-950/50 text-emerald-400' : 'bg-emerald-50 text-emerald-600')
                          : isRejected
                            ? (isDarkMode ? 'bg-rose-950/50 text-rose-400' : 'bg-rose-50 text-rose-600')
                            : (isDarkMode ? 'bg-amber-950/50 text-amber-400' : 'bg-amber-50 text-amber-600')
                      }`}>
                        {isVerified ? <CheckCircle2 className="w-5 h-5" /> : isRejected ? <XCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold truncate">{doc.fileName}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                            isVerified
                              ? (isDarkMode ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/60' : 'bg-emerald-50 text-emerald-600 border-emerald-200/60')
                              : isRejected
                                ? (isDarkMode ? 'bg-rose-950/50 text-rose-400 border-rose-800/60' : 'bg-rose-50 text-rose-600 border-rose-200/60')
                                : (isDarkMode ? 'bg-amber-950/50 text-amber-400 border-amber-800/60' : 'bg-amber-50 text-amber-600 border-amber-200/60')
                          }`}>
                            {doc.status.replace('_', ' ')}
                          </span>
                        </div>
                        <div className={`text-xs mt-0.5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                          <strong>{doc.userName}</strong> • {categoryLabel} • {(doc.fileSize / (1024 * 1024)).toFixed(2)} MB
                        </div>
                        {doc.notes && (
                          <p className={`text-[11px] mt-1 italic ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Review notes: &ldquo;{doc.notes}&rdquo;
                          </p>
                        )}
                        {doc.verifiedByEmail && (
                          <div className={`text-[10px] mt-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                            Reviewed by {doc.verifiedByEmail}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={doc.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          isDarkMode ? 'bg-slate-700/50 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Preview
                      </a>

                      {/* Verify / Reject buttons */}
                      {isPending && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setActionType('verified');
                              setReviewNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Verify
                          </button>
                          <button
                            onClick={() => {
                              setSelectedDoc(doc);
                              setActionType('rejected');
                              setReviewNotes('');
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Reject
                          </button>
                        </>
                      )}

                      {/* Allow re-verifying or rejecting already reviewed docs */}
                      {!isPending && (
                        <button
                          onClick={() => {
                            setSelectedDoc(doc);
                            setActionType(isVerified ? 'rejected' : 'verified');
                            setReviewNotes('');
                          }}
                          className={`text-xs underline font-medium ${isDarkMode ? 'text-slate-500 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                          Change status
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Review & Verification Confirmation Modal ───────────────────────── */}
      {selectedDoc && actionType && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl border p-6 space-y-4 ${
            isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-bold">
              {actionType === 'verified' ? 'Verify Compliance Document' : 'Reject Compliance Document'}
            </h3>
            <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              You are updating <strong>{selectedDoc.fileName}</strong> for <strong>{selectedDoc.userName}</strong>.
            </p>

            {actionError && (
              <div className="p-3 text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-xl">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold mb-1">
                {actionType === 'verified' ? 'Approval Notes (Optional)' : 'Reason for Rejection (Required)'}
              </label>
              <textarea
                rows={3}
                placeholder={actionType === 'verified' ? 'e.g. Verified against state database, valid through 2027.' : 'e.g. Missing signature on page 2, please re-sign and re-upload.'}
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                className={`w-full p-3 rounded-xl text-xs border ${
                  isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                } focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setSelectedDoc(null);
                  setActionType(null);
                }}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl text-xs font-semibold hover:bg-slate-800 text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handlePerformAction}
                disabled={isProcessing || (actionType === 'rejected' && !reviewNotes.trim())}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                  actionType === 'verified' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'
                } ${isProcessing ? 'opacity-50' : ''}`}
              >
                {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Confirm {actionType === 'verified' ? 'Verification' : 'Rejection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
