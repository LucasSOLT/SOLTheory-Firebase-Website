'use client';

// ============================================================================
// SigningOrderConfigurator — Blueprint Editor UI for multi-party signing
//
// Phase 3, Step 3.2 (Onboarding Document System — APPROVED PLAN, Decision 3)
//
// A flowchart-style chain of signer cards. Each card picks WHO signs
// (the employee, the employee's assigned supervisor, or a specific org member
// from a searchable dropdown), an optional role label, which PDF fields that
// signer fills, and whether/where they draw a signature. Cards can be added,
// removed, and reordered (↑/↓ buttons or drag & drop). Signer 1 defaults to
// "Employee".
//
// Validation uses the same shared rules the server enforces
// (lib/signing-workflow.ts).
// ============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Search,
  Trash2,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { PdfFormContent, PdfFormField, SignerDefinition, SignerKind, SigningWorkflow } from '@/types/onboarding-templates';
import { fillableFieldNames, validateSigningWorkflow } from '@/lib/signing-workflow';

interface OrgMember {
  uid: string;
  email: string;
  displayName: string;
  role: string;
}

interface Props {
  content: PdfFormContent;
  onChange: (content: PdfFormContent) => void;
  isDarkMode: boolean;
  orgId?: string;
}

const newId = () => `sig_${Math.random().toString(36).slice(2, 10)}`;

const KIND_LABELS: Record<SignerKind, string> = {
  employee: 'Employee (whoever is assigned)',
  supervisor: "Employee's assigned supervisor",
  member: 'A specific person',
};

const DEFAULT_SIG_POS = { pageIndex: 0, x: 50, y: 50, width: 200, height: 60 };

function renumber(signers: SignerDefinition[]): SignerDefinition[] {
  return signers.map((s, i) => ({ ...s, order: i + 1 }));
}

export default function SigningOrderConfigurator({ content, onChange, isDarkMode, orgId }: Props) {
  const workflow: SigningWorkflow = content.signingWorkflow || { enabled: false, signers: [] };
  const signers = useMemo(() => [...workflow.signers].sort((a, b) => a.order - b.order), [workflow.signers]);
  const detected: PdfFormField[] = content.detectedFields || [];
  const fillable = useMemo(() => fillableFieldNames(detected), [detected]);
  const signatureFieldNames = useMemo(
    () => new Set(detected.filter((f) => f.type === 'signature').map((f) => f.name)),
    [detected],
  );

  // ── Org members for the "specific person" picker ──
  const firestore = useFirestore();
  const [members, setMembers] = useState<OrgMember[]>([]);
  useEffect(() => {
    if (!workflow.enabled || !orgId || !firestore) return;
    const unsub = onSnapshot(
      query(collection(firestore, `orgs/${orgId}/members`)),
      (snap) =>
        setMembers(
          snap.docs.map((d) => {
            const data = d.data();
            return { uid: d.id, email: data.email || '', displayName: data.displayName || '', role: (data.role as string) || 'user' };
          }),
        ),
      (err) => console.error('[SigningOrderConfigurator] Members fetch error:', err),
    );
    return () => unsub();
  }, [workflow.enabled, orgId, firestore]);

  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);

  const commit = (next: SignerDefinition[], enabled = workflow.enabled) =>
    onChange({ ...content, signingWorkflow: { enabled, signers: renumber(next) } });

  // Firestore rejects `undefined` values, so cleared keys are removed outright.
  const updateSigner = (id: string, patch: Partial<SignerDefinition>) =>
    commit(
      signers.map((s) => {
        if (s.id !== id) return s;
        const merged: Record<string, unknown> = { ...s, ...patch };
        for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k];
        return merged as unknown as SignerDefinition;
      }),
    );

  const toggleEnabled = (enabled: boolean) => {
    if (enabled && signers.length === 0) {
      // Signer 1 = Employee (inherits the single-signer settings), signer 2 = supervisor.
      commit(
        [
          {
            id: newId(),
            order: 1,
            kind: 'employee',
            label: 'Employee',
            fieldNames: [],
            requireSignature: content.requireSignature !== false,
            ...(content.signaturePosition ? { signaturePosition: content.signaturePosition } : {}),
          },
          { id: newId(), order: 2, kind: 'supervisor', label: 'Supervisor', fieldNames: [], requireSignature: true },
        ],
        true,
      );
      return;
    }
    commit(signers, enabled);
  };

  const addSigner = () =>
    commit([...signers, { id: newId(), order: signers.length + 1, kind: 'member', label: '', fieldNames: [], requireSignature: true }]);

  const removeSigner = (id: string) => commit(signers.filter((s) => s.id !== id));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= signers.length || from === to) return;
    const next = [...signers];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    commit(next);
  };

  const toggleField = (signer: SignerDefinition, name: string) => {
    const has = signer.fieldNames.includes(name);
    updateSigner(signer.id, { fieldNames: has ? signer.fieldNames.filter((n) => n !== name) : [...signer.fieldNames, name] });
  };

  // Which signer claims each field (first claimant wins — same rule as the server).
  const claimedBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of signers) for (const n of s.fieldNames) if (!map.has(n)) map.set(n, s.order);
    return map;
  }, [signers]);

  const problems = workflow.enabled ? validateSigningWorkflow({ enabled: true, signers }) : [];
  const warnings: string[] = [];
  if (workflow.enabled) {
    for (const s of signers) {
      const ownsSigField = s.fieldNames.some((n) => signatureFieldNames.has(n));
      if (s.requireSignature && !ownsSigField && !s.signaturePosition) {
        warnings.push(`Signer ${s.order} must sign but has no signature box — add a stamp position or give them a signature field.`);
      }
    }
    if (detected.length === 0) warnings.push('Detect the PDF fields first so you can assign them to signers.');
  }

  // ── Styles ──
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const input = `w-full p-2 text-xs rounded border outline-none focus:ring-2 focus:ring-indigo-500 ${
    isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300 text-slate-900'
  }`;
  const cardCls = `p-3 rounded-xl border space-y-3 ${isDarkMode ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`;

  return (
    <div className={`p-3 rounded-lg border space-y-3 ${isDarkMode ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
        <input
          type="checkbox"
          checked={workflow.enabled}
          onChange={(e) => toggleEnabled(e.target.checked)}
          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
        />
        <Users className="w-4 h-4 text-indigo-500" />
        Multiple signers (signing order)
      </label>
      {!workflow.enabled && (
        <p className={`text-[11px] ${muted}`}>
          Turn on to route this document from person to person — e.g. the employee fills it out, then HR and the supervisor countersign.
        </p>
      )}

      {workflow.enabled && (
        <>
          <ol className="space-y-2">
            {signers.map((s, idx) => {
              const member = members.find((m) => m.uid === s.memberUid);
              const filteredMembers = members.filter((m) => {
                const q = pickerSearch.trim().toLowerCase();
                return !q || m.displayName.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
              });
              const sigPos = s.signaturePosition || DEFAULT_SIG_POS;
              return (
                <li key={s.id}>
                  <div
                    className={`${cardCls} ${dragId === s.id ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={() => setDragId(s.id)}
                    onDragEnd={() => setDragId(null)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!dragId) return;
                      move(signers.findIndex((x) => x.id === dragId), idx);
                      setDragId(null);
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-2">
                      <GripVertical className={`w-4 h-4 cursor-grab ${muted}`} aria-hidden />
                      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        {s.order}
                      </span>
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}>
                          {s.kind === 'supervisor' ? <UserCheck className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {s.kind === 'employee' ? 'Employee' : s.kind === 'supervisor' ? 'Assigned Supervisor' : member?.displayName || s.memberName || 'Choose a person'}
                          </div>
                          <div className={`text-[10px] truncate ${muted}`}>
                            {s.label || (s.kind === 'member' ? member?.email || s.memberEmail || '' : KIND_LABELS[s.kind])}
                            {s.kind === 'member' && member?.role ? ` · ${member.role}` : ''}
                          </div>
                        </div>
                      </div>
                      <button type="button" title="Move up" onClick={() => move(idx, idx - 1)} disabled={idx === 0} className="p-1 rounded disabled:opacity-30 hover:bg-slate-500/10">
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Move down" onClick={() => move(idx, idx + 1)} disabled={idx === signers.length - 1} className="p-1 rounded disabled:opacity-30 hover:bg-slate-500/10">
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" title="Remove signer" onClick={() => removeSigner(s.id)} className="p-1 rounded text-rose-500 hover:bg-rose-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Who + label */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold mb-1">Who signs</label>
                        <select
                          value={s.kind}
                          onChange={(e) => {
                            const kind = e.target.value as SignerKind;
                            updateSigner(s.id, {
                              kind,
                              ...(kind !== 'member' ? { memberUid: undefined, memberEmail: undefined, memberName: undefined } : {}),
                            });
                          }}
                          className={input}
                        >
                          {(Object.keys(KIND_LABELS) as SignerKind[]).map((k) => (
                            <option key={k} value={k}>{KIND_LABELS[k]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold mb-1">Role label (optional)</label>
                        <input
                          type="text"
                          value={s.label || ''}
                          onChange={(e) => updateSigner(s.id, { label: e.target.value })}
                          placeholder="e.g. HR Director"
                          className={input}
                        />
                      </div>
                    </div>

                    {/* Specific person picker */}
                    {s.kind === 'member' && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenPicker(openPicker === s.id ? null : s.id);
                            setPickerSearch('');
                          }}
                          className={`${input} flex items-center justify-between text-left`}
                        >
                          <span className="truncate">
                            {member ? `${member.displayName || member.email} (${member.email})` : s.memberName || s.memberEmail || 'Search org members…'}
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                        </button>
                        {openPicker === s.id && (
                          <div className={`absolute z-20 mt-1 w-full rounded-lg border shadow-lg ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                            <div className="p-2 flex items-center gap-2 border-b border-slate-500/20">
                              <Search className={`w-3.5 h-3.5 ${muted}`} />
                              <input
                                autoFocus
                                value={pickerSearch}
                                onChange={(e) => setPickerSearch(e.target.value)}
                                placeholder="Name or email"
                                className="flex-1 bg-transparent text-xs outline-none"
                              />
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {filteredMembers.length === 0 && <div className={`p-3 text-xs ${muted}`}>No members found</div>}
                              {filteredMembers.map((m) => (
                                <button
                                  key={m.uid}
                                  type="button"
                                  onClick={() => {
                                    updateSigner(s.id, { memberUid: m.uid, memberEmail: m.email, memberName: m.displayName || m.email });
                                    setOpenPicker(null);
                                  }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-indigo-500/10 ${m.uid === s.memberUid ? 'font-bold' : ''}`}
                                >
                                  <div className="truncate">{m.displayName || m.email}</div>
                                  <div className={`text-[10px] truncate ${muted}`}>{m.email} · {m.role}</div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fields */}
                    {fillable.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold mb-1">
                          Fields this signer fills {s.kind === 'employee' ? <span className={muted}>(plus any field nobody else claims)</span> : null}
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                          {fillable.map((name) => {
                            const owner = claimedBy.get(name);
                            const mine = s.fieldNames.includes(name);
                            const takenByOther = owner !== undefined && owner !== s.order && !mine;
                            const conflict = mine && owner !== s.order;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => toggleField(s, name)}
                                disabled={takenByOther}
                                title={takenByOther ? `Assigned to signer ${owner}` : conflict ? `Also assigned to signer ${owner}` : name}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono border transition-colors disabled:cursor-not-allowed ${
                                  conflict
                                    ? 'border-rose-500 text-rose-500 bg-rose-500/10'
                                    : mine
                                      ? 'border-indigo-500 bg-indigo-600 text-white'
                                      : takenByOther
                                        ? `opacity-40 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`
                                        : isDarkMode ? 'border-slate-700 text-slate-300 hover:border-indigo-500' : 'border-slate-300 text-slate-700 hover:border-indigo-500'
                                }`}
                              >
                                {signatureFieldNames.has(name) ? '✍ ' : ''}{name}{takenByOther ? ` · ${owner}` : ''}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Signature */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={s.requireSignature}
                          onChange={(e) => updateSigner(s.id, { requireSignature: e.target.checked })}
                          className="w-3.5 h-3.5 rounded text-indigo-600"
                        />
                        Must draw a signature
                      </label>
                      {s.requireSignature && (
                        <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer">
                          <input
                            type="checkbox"
                            checked={!!s.signaturePosition}
                            onChange={(e) => updateSigner(s.id, { signaturePosition: e.target.checked ? DEFAULT_SIG_POS : undefined })}
                            className="w-3.5 h-3.5 rounded text-indigo-600"
                          />
                          Stamp the signature at a fixed spot (for PDFs without a signature field)
                        </label>
                      )}
                      {s.requireSignature && s.signaturePosition && (
                        <div className="grid grid-cols-5 gap-1.5">
                          {(['pageIndex', 'x', 'y', 'width', 'height'] as const).map((key) => (
                            <div key={key}>
                              <label className="block text-[9px] opacity-70">{key === 'pageIndex' ? 'Page (0-based)' : key === 'x' || key === 'y' ? `${key.toUpperCase()} (pt)` : key === 'width' ? 'Width' : 'Height'}</label>
                              <input
                                type="number"
                                value={sigPos[key]}
                                onChange={(e) => updateSigner(s.id, { signaturePosition: { ...sigPos, [key]: parseInt(e.target.value) || 0 } })}
                                className={input}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {idx < signers.length - 1 && (
                    <div className={`flex justify-center py-0.5 ${muted}`} aria-hidden>
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={addSigner}
            className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 border-dashed text-xs font-bold ${
              isDarkMode ? 'border-slate-700 text-slate-300 hover:border-indigo-500' : 'border-slate-300 text-slate-600 hover:border-indigo-500'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Add signer
          </button>

          {[...problems, ...warnings].length > 0 && (
            <ul className="space-y-1">
              {problems.map((p) => (
                <li key={p} className="flex items-start gap-1.5 text-[11px] font-semibold text-rose-500">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {p}
                </li>
              ))}
              {warnings.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-500">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" /> {w}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
