"use client";

import { useState, useCallback } from "react";
import { X, Send, Sparkles, Loader2, CheckCircle2 } from "lucide-react";
import { getAuthHeaders } from "@/lib/api-auth-client";
import { useUser } from "@/firebase/provider";

/* ── Panel Type Options ──────────────────────────────────── */

const PANEL_TYPES = [
  { id: "financial", label: "Financial Analytics", icon: "💰" },
  { id: "marketing", label: "Marketing & Engagement", icon: "📣" },
  { id: "operations", label: "Operations & Productivity", icon: "⚙️" },
  { id: "sales", label: "Sales & CRM", icon: "🤝" },
  { id: "grants", label: "Grants & Fundraising", icon: "🏆" },
  { id: "custom", label: "Other / Custom", icon: "✨" },
];

/* ── Component ─────────────────────────────────────────── */

export default function RequestBIPanelModal({
  isOpen,
  onClose,
  orgId,
  orgName,
  dk,
}: {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  orgName: string;
  dk: boolean;
}) {
  const { user } = useUser();
  const [title, setTitle] = useState("");
  const [panelType, setPanelType] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const resetForm = useCallback(() => {
    setTitle("");
    setPanelType("");
    setDescription("");
    setError("");
    setSent(false);
  }, []);

  const handleClose = useCallback(() => {
    if (!sending) {
      resetForm();
      onClose();
    }
  }, [sending, resetForm, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return setError("Please enter a panel title.");
    if (!panelType) return setError("Please select a panel type.");
    if (!description.trim()) return setError("Please describe what you'd like to see.");
    setError("");
    setSending(true);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/bi-panel-request", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          panelType,
          description: description.trim(),
          orgId,
          orgName,
          userEmail: user?.email || "",
          userName: user?.displayName || user?.email?.split("@")[0] || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit request.");
      }

      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSending(false);
    }
  }, [title, panelType, description, orgId, orgName, user]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={handleClose}
      >
        {/* Modal */}
        <div
          className={`w-full max-w-lg rounded-2xl shadow-2xl border overflow-hidden ${
            dk ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className={`flex items-center justify-between px-6 py-4 border-b ${
              dk ? "border-slate-700/60" : "border-slate-100"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className={`text-base font-bold ${dk ? "text-white" : "text-slate-900"}`}>
                  Request Custom Panel
                </h2>
                <p className={`text-[11px] ${dk ? "text-slate-500" : "text-slate-400"}`}>
                  We&apos;ll build it and add it to your dashboard
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                dk ? "hover:bg-slate-800 text-slate-500" : "hover:bg-slate-100 text-slate-400"
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {sent ? (
              /* Success state */
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h3 className={`text-lg font-bold ${dk ? "text-white" : "text-slate-900"}`}>
                  Request Submitted!
                </h3>
                <p className={`text-sm max-w-xs ${dk ? "text-slate-400" : "text-slate-500"}`}>
                  We&apos;ve received your custom panel request and will review it shortly.
                  You&apos;ll hear back from us soon!
                </p>
                <button
                  onClick={handleClose}
                  className="mt-3 px-5 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              /* Form */
              <>
                {/* Title */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>
                    Panel Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Donor Retention Analysis"
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none transition-colors ${
                      dk
                        ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Panel Type */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>
                    Type of Intelligence
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PANEL_TYPES.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPanelType(t.label)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                          panelType === t.label
                            ? dk
                              ? "bg-indigo-600/20 border-indigo-500/50 text-indigo-400"
                              : "bg-indigo-50 border-indigo-300 text-indigo-700"
                            : dk
                            ? "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                            : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                        }`}
                      >
                        <span className="text-base">{t.icon}</span>
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className={`block text-xs font-semibold uppercase tracking-wider mb-1.5 ${dk ? "text-slate-400" : "text-slate-500"}`}>
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what data, metrics, or visualizations you'd like to see on this panel..."
                    rows={4}
                    className={`w-full px-3.5 py-2.5 text-sm rounded-xl border outline-none transition-colors resize-none ${
                      dk
                        ? "bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                        : "bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500"
                    }`}
                  />
                </div>

                {/* Error */}
                {error && (
                  <p className="text-xs text-red-500 font-medium">{error}</p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          {!sent && (
            <div
              className={`flex items-center justify-end gap-3 px-6 py-4 border-t ${
                dk ? "border-slate-700/60" : "border-slate-100"
              }`}
            >
              <button
                onClick={handleClose}
                disabled={sending}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  dk
                    ? "text-slate-400 hover:bg-slate-800"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60 cursor-pointer"
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {sending ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
