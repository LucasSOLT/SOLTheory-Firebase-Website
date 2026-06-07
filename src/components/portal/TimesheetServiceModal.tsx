"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

interface TimesheetServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  firestore: any;
  orgDomain: string;
  userEmail: string;
  onSaved: () => void;
}

const TOPIC_OPTIONS = [
  "Web Development",
  "Mobile App Development",
  "UI/UX Design",
  "Graphic Design",
  "Graphic Illustration",
  "Brand Identity",
  "Video Production",
  "Photography",
  "Content Writing",
  "Copywriting",
  "Social Media Management",
  "SEO/SEM",
  "Digital Marketing",
  "Email Marketing",
  "Data Analysis",
  "Database Management",
  "Cloud Infrastructure",
  "IT Support",
  "Cybersecurity",
  "Project Management",
  "Business Consulting",
  "Financial Advisory",
  "Legal Services",
  "HR/Recruiting",
  "Training/Education",
  "Construction",
  "Landscaping",
  "Interior Design",
  "Event Planning",
  "Administrative Support",
];

export function TimesheetServiceModal({
  isOpen,
  onClose,
  firestore,
  orgDomain,
  userEmail,
  onSaved,
}: TimesheetServiceModalProps) {
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    setName("");
    setTopic("");
    setDescription("");
    setError("");
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Name is required.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addDoc(collection(firestore, "timesheet_services"), {
        name: trimmedName,
        topic,
        description: description.trim(),
        orgDomain,
        createdBy: userEmail,
        createdAt: serverTimestamp(),
      });

      setName("");
      setTopic("");
      setDescription("");
      onSaved();
      onClose();
    } catch (err) {
      console.error("Failed to save service:", err);
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Add New Service</h2>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              placeholder="Service name"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-shadow"
            />
            {error && (
              <p className="text-xs text-red-500 mt-1">{error}</p>
            )}
          </div>

          {/* Topic */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Topic
            </label>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-shadow"
            >
              <option value="">Select a topic...</option>
              {TOPIC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-green-200 focus:border-green-400 outline-none transition-shadow resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 pb-5 pt-2">
          <button
            onClick={handleClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
