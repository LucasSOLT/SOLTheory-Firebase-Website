"use client";

import React, { useState, useEffect, useCallback } from "react";
import { X, Clock, ChevronDown, Plus, Calendar } from "lucide-react";
import { collection, addDoc, onSnapshot, serverTimestamp, query, where, orderBy } from "firebase/firestore";
import { TimesheetCustomerModal } from "./TimesheetCustomerModal";
import { TimesheetServiceModal } from "./TimesheetServiceModal";
import { logActivity } from "@/lib/activity-logger";

interface TimesheetUser {
  name: string;
  initials: string;
  color: string;
}

interface TimesheetEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  firestore: any;
  orgDomain: string;
  userEmail: string;
  users: TimesheetUser[];
  onSaved: () => void;
  prefillDate?: string;
  prefillUser?: string;
}

interface CustomerDoc {
  id: string;
  name: string;
  topic: string;
  description: string;
}

interface ServiceDoc {
  id: string;
  name: string;
  topic: string;
  description: string;
}

function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const EMPTY_FORM = {
  userName: "",
  customerName: "",
  serviceName: "",
  billableEnabled: false,
  billableRate: "",
  startDate: todayString(),
  durationHours: "",
  durationMinutes: "",
  notes: "",
};

export function TimesheetEntryModal({
  isOpen,
  onClose,
  firestore,
  orgDomain,
  userEmail,
  users,
  onSaved,
  prefillDate,
  prefillUser,
}: TimesheetEntryModalProps) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveDropdownOpen, setSaveDropdownOpen] = useState(false);

  // Customer / Service state
  const [customers, setCustomers] = useState<CustomerDoc[]>([]);
  const [services, setServices] = useState<ServiceDoc[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // Dropdown open states
  const [nameDropdownOpen, setNameDropdownOpen] = useState(false);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [serviceDropdownOpen, setServiceDropdownOpen] = useState(false);

  // Listen to customers
  useEffect(() => {
    if (!firestore || !orgDomain) return;
    const q = query(
      collection(firestore, "timesheet_customers"),
      where("orgDomain", "==", orgDomain)
    );
    const unsub = onSnapshot(q, (snap: any) => {
      const docs: CustomerDoc[] = [];
      snap.forEach((d: any) => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => a.name.localeCompare(b.name));
      setCustomers(docs);
    }, (err: any) => { console.error('[Timesheet] Customer listener error:', err); });
    return () => unsub();
  }, [firestore, orgDomain]);

  // Listen to services
  useEffect(() => {
    if (!firestore || !orgDomain) return;
    const q = query(
      collection(firestore, "timesheet_services"),
      where("orgDomain", "==", orgDomain)
    );
    const unsub = onSnapshot(q, (snap: any) => {
      const docs: ServiceDoc[] = [];
      snap.forEach((d: any) => docs.push({ id: d.id, ...d.data() }));
      docs.sort((a, b) => a.name.localeCompare(b.name));
      setServices(docs);
    }, (err: any) => { console.error('[Timesheet] Service listener error:', err); });
    return () => unsub();
  }, [firestore, orgDomain]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        ...EMPTY_FORM,
        startDate: prefillDate || todayString(),
        userName: prefillUser || "",
      });
      setErrors({});
      setSaveDropdownOpen(false);
      setSaveError("");
    }
  }, [isOpen, prefillDate, prefillUser]);

  const updateField = (field: string, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.userName) errs.userName = "Required";
    if (!form.customerName) errs.customerName = "Required";
    if (!form.serviceName) errs.serviceName = "Required";
    if (!form.startDate) errs.startDate = "Required";
    const h = parseInt(form.durationHours) || 0;
    const m = parseInt(form.durationMinutes) || 0;
    if (h === 0 && m === 0) errs.duration = "Enter a duration";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const saveEntry = async (): Promise<boolean> => {
    if (!validate()) return false;
    setSaving(true);
    setSaveError("");
    try {
      const h = parseInt(form.durationHours) || 0;
      const m = parseInt(form.durationMinutes) || 0;
      const totalMinutes = h * 60 + m;
      await addDoc(collection(firestore, "timesheet_entries"), {
        userName: form.userName,
        userEmail: userEmail,
        orgDomain: orgDomain,
        customerName: form.customerName,
        serviceName: form.serviceName,
        billableRate: form.billableEnabled ? parseFloat(form.billableRate) || 0 : null,
        startDate: form.startDate,
        durationMinutes: totalMinutes,
        notes: form.notes,
        createdAt: serverTimestamp(),
        createdBy: userEmail,
      });
      onSaved();
      logActivity(firestore, 'timesheet_entry_created', { email: userEmail, displayName: form.userName }, `Logged ${form.durationHours || 0}h ${form.durationMinutes || 0}m for ${form.customerName} on ${form.startDate}`);
      return true;
    } catch (e) {
      console.error("Failed to save timesheet entry:", e);
      setSaveError("Failed to save entry. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const ok = await saveEntry();
    if (ok) onClose();
  };

  const handleSaveAndNew = async () => {
    const ok = await saveEntry();
    if (ok) {
      setForm({ ...EMPTY_FORM });
      setErrors({});
    }
    setSaveDropdownOpen(false);
  };

  const handleSaveAndCopy = async () => {
    const ok = await saveEntry();
    if (ok) {
      // Keep form as-is (copy behavior)
    }
    setSaveDropdownOpen(false);
  };

  const handleSaveAndClose = async () => {
    const ok = await saveEntry();
    if (ok) onClose();
    setSaveDropdownOpen(false);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center overflow-y-auto">
        <div
          className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl my-8 mx-4 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-slate-500" />
              </div>
              <h2 className="text-base font-bold text-slate-800">Single day entry</h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-col md:flex-row flex-1 min-h-[420px]">
            {/* Left Column - Form Fields */}
            <div className="w-full md:w-[260px] p-6 border-r border-slate-100 space-y-4 shrink-0">
              {/* Name */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setNameDropdownOpen(!nameDropdownOpen); setCustomerDropdownOpen(false); setServiceDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm bg-white transition-colors text-left ${
                      errors.userName ? "border-red-300 focus:ring-red-200" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className={form.userName ? "text-slate-800 font-medium" : "text-slate-400"}>
                      {form.userName || "Select name"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {nameDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setNameDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 max-h-48 overflow-y-auto">
                        {users.map((u) => (
                          <button
                            key={u.name}
                            onClick={() => { updateField("userName", u.name); setNameDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors flex items-center gap-2.5 ${
                              form.userName === u.name ? "bg-green-50 text-green-700 font-semibold" : "text-slate-700"
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                              style={{ backgroundColor: u.color }}
                            >
                              {u.initials}
                            </div>
                            {u.name}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {errors.userName && <p className="text-[10px] text-red-500 font-medium mt-0.5">{errors.userName}</p>}
              </div>

              {/* Customers */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Customers <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setCustomerDropdownOpen(!customerDropdownOpen); setNameDropdownOpen(false); setServiceDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm bg-white transition-colors text-left ${
                      errors.customerName ? "border-red-300" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className={form.customerName ? "text-slate-800 font-medium" : "text-slate-400"}>
                      {form.customerName || "Select customer"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {customerDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setCustomerDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 max-h-48 overflow-y-auto">
                        {customers.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-400 italic">No customers yet</div>
                        )}
                        {customers.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => { updateField("customerName", c.name); setCustomerDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                              form.customerName === c.name ? "bg-green-50 text-green-700 font-semibold" : "text-slate-700"
                            }`}
                          >
                            {c.name}
                            {c.topic && <span className="ml-2 text-[10px] text-slate-400">{c.topic}</span>}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button
                            onClick={() => { setCustomerDropdownOpen(false); setShowCustomerModal(true); }}
                            className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors font-medium flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add new customer
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {errors.customerName && <p className="text-[10px] text-red-500 font-medium mt-0.5">{errors.customerName}</p>}
              </div>

              {/* Service */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Service <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { setServiceDropdownOpen(!serviceDropdownOpen); setNameDropdownOpen(false); setCustomerDropdownOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm bg-white transition-colors text-left ${
                      errors.serviceName ? "border-red-300" : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className={form.serviceName ? "text-slate-800 font-medium" : "text-slate-400"}>
                      {form.serviceName || "Select service"}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  {serviceDropdownOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setServiceDropdownOpen(false)} />
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 max-h-48 overflow-y-auto">
                        {services.length === 0 && (
                          <div className="px-3 py-2 text-xs text-slate-400 italic">No services yet</div>
                        )}
                        {services.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => { updateField("serviceName", s.name); setServiceDropdownOpen(false); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${
                              form.serviceName === s.name ? "bg-green-50 text-green-700 font-semibold" : "text-slate-700"
                            }`}
                          >
                            {s.name}
                            {s.topic && <span className="ml-2 text-[10px] text-slate-400">{s.topic}</span>}
                          </button>
                        ))}
                        <div className="border-t border-slate-100 mt-1 pt-1">
                          <button
                            onClick={() => { setServiceDropdownOpen(false); setShowServiceModal(true); }}
                            className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 transition-colors font-medium flex items-center gap-1.5"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add new service
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {errors.serviceName && <p className="text-[10px] text-red-500 font-medium mt-0.5">{errors.serviceName}</p>}
              </div>

              {/* Billable */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.billableEnabled}
                    onChange={(e) => updateField("billableEnabled", e.target.checked)}
                    className="rounded text-green-600 focus:ring-green-200 border-slate-300 cursor-pointer"
                  />
                  <span className="text-[12px] font-semibold text-slate-600">Billable (per hour)</span>
                </label>
                {form.billableEnabled && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-sm text-slate-500 font-medium">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={form.billableRate}
                      onChange={(e) => updateField("billableRate", e.target.value)}
                      className="w-24 px-2.5 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-all"
                    />
                    <span className="text-[11px] text-slate-400 font-medium">/ hr</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Date, Duration, Notes */}
            <div className="flex-1 p-6 space-y-4">
              {/* Date and Duration Row */}
              <div className="flex items-end gap-6">
                {/* Start Date */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                    Start date <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => updateField("startDate", e.target.value)}
                      className={`px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-all pr-8 ${
                        errors.startDate ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                  </div>
                  {errors.startDate && <p className="text-[10px] text-red-500 font-medium mt-0.5">{errors.startDate}</p>}
                </div>

                {/* Duration */}
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                    Duration (hh:mm)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="24"
                      placeholder="hh"
                      value={form.durationHours}
                      onChange={(e) => updateField("durationHours", e.target.value)}
                      className={`w-16 px-2.5 py-2 border rounded-lg text-sm bg-white text-center focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-all ${
                        errors.duration ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                    <span className="text-slate-400 font-bold">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      placeholder="mm"
                      value={form.durationMinutes}
                      onChange={(e) => updateField("durationMinutes", e.target.value)}
                      className={`w-16 px-2.5 py-2 border rounded-lg text-sm bg-white text-center focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-all ${
                        errors.duration ? "border-red-300" : "border-slate-200"
                      }`}
                    />
                  </div>
                  {errors.duration && <p className="text-[10px] text-red-500 font-medium mt-0.5">{errors.duration}</p>}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Add any notes about this time entry..."
                  rows={8}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-all resize-none"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            <div className="flex items-center gap-3">
              {saveError && (
                <p className="text-xs text-red-500 font-medium animate-in fade-in duration-200">{saveError}</p>
              )}
              <button
                onClick={onClose}
                className="text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* Save (outline) */}
              <button
                onClick={handleSave}
                disabled={saving}
                className="h-9 px-4 rounded-lg border-2 border-green-600 text-green-700 text-sm font-semibold hover:bg-green-50 transition-colors disabled:opacity-50"
              >
                Save
              </button>

              {/* Save and... (filled + dropdown) */}
              <div className="relative flex">
                <button
                  onClick={handleSaveAndNew}
                  disabled={saving}
                  className="h-9 px-4 rounded-l-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save and new"}
                </button>
                <button
                  onClick={() => setSaveDropdownOpen(!saveDropdownOpen)}
                  className="h-9 px-2 rounded-r-lg bg-green-700 hover:bg-green-800 text-white border-l border-green-500 transition-colors"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>

                {saveDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setSaveDropdownOpen(false)} />
                    <div className="absolute bottom-full right-0 mb-1 bg-white border border-slate-200 rounded-xl shadow-xl z-40 py-1 w-44 overflow-hidden">
                      <button
                        onClick={handleSaveAndNew}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Save and new
                      </button>
                      <button
                        onClick={handleSaveAndCopy}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Save and Copy
                      </button>
                      <button
                        onClick={handleSaveAndClose}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                      >
                        Save and Close
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modals */}
      <TimesheetCustomerModal
        isOpen={showCustomerModal}
        onClose={() => setShowCustomerModal(false)}
        firestore={firestore}
        orgDomain={orgDomain}
        userEmail={userEmail}
        onSaved={() => setShowCustomerModal(false)}
      />
      <TimesheetServiceModal
        isOpen={showServiceModal}
        onClose={() => setShowServiceModal(false)}
        firestore={firestore}
        orgDomain={orgDomain}
        userEmail={userEmail}
        onSaved={() => setShowServiceModal(false)}
      />
    </>
  );
}
