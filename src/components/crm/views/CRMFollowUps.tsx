"use client";

import React, { useState, useMemo } from "react";
import { useCRMStore } from "@/stores/crm-store";
import type { CrmTask, Customer } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  Phone, Mail, Calendar, FileText, MessageSquare, UserCheck, Coffee,
  Plus, Clock, AlertTriangle, Check, ChevronDown, Search, X, User,
  ArrowRight, MoreHorizontal, PhoneCall, Send, CalendarPlus,
} from "lucide-react";

interface CRMFollowUpsProps {
  customers: Customer[];
}

/* ─── Follow-up types unique to contact relationship management ─── */
const FOLLOW_UP_TYPES = [
  { id: "call", label: "Call", icon: Phone, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "email", label: "Email", icon: Mail, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "meeting", label: "Meeting", icon: Calendar, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "proposal", label: "Send Proposal", icon: FileText, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "check_in", label: "Check-in", icon: Coffee, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "message", label: "Message", icon: MessageSquare, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
  { id: "onboard", label: "Onboard", icon: UserCheck, color: "text-slate-600 dark:text-slate-300", bg: "bg-slate-100 dark:bg-slate-800" },
] as const;

type FollowUpType = typeof FOLLOW_UP_TYPES[number]["id"];

const URGENCY_LABELS: Record<string, { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-400 border-red-200 dark:border-red-800" },
  high: { label: "High", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
  medium: { label: "Normal", className: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700" },
  low: { label: "Low", className: "bg-slate-50 text-slate-400 dark:bg-slate-800/50 dark:text-slate-500 border-slate-100 dark:border-slate-800" },
};

function isOverdue(dueDate: string, completed: boolean): boolean {
  if (completed || !dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isToday(dueDate: string): boolean {
  if (!dueDate) return false;
  return dueDate.startsWith(new Date().toISOString().split("T")[0]);
}

function isThisWeek(dueDate: string): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return d >= start && d < end;
}

function getRelativeDate(dueDate: string): string {
  if (!dueDate) return "";
  const d = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff <= 7) return `In ${diff} days`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CRMFollowUps({ customers }: CRMFollowUpsProps) {
  const { isDarkMode } = useTheme();
  const tasks = useCRMStore(s => s.tasks);
  const addTask = useCRMStore(s => s.addTask);
  const updateTask = useCRMStore(s => s.updateTask);
  const deleteTask = useCRMStore(s => s.deleteTask);
  const addActivity = useCRMStore(s => s.addActivity);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterView, setFilterView] = useState<"all" | "overdue" | "today" | "this_week" | "upcoming">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [newType, setNewType] = useState<FollowUpType>("call");
  const [newNote, setNewNote] = useState("");

  const getContact = (customerId: string) => customers.find(x => x.id === customerId);
  const getContactName = (customerId: string) => {
    const c = getContact(customerId);
    return c ? `${c.firstName} ${c.lastName}` : "Unknown";
  };

  // Only show contact-linked tasks (follow-ups are always about a contact)
  const followUps = useMemo(() => {
    return tasks.filter(t => t.customerId);
  }, [tasks]);

  const filteredFollowUps = useMemo(() => {
    let items = followUps;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      items = items.filter(t => {
        const name = getContactName(t.customerId).toLowerCase();
        return t.title.toLowerCase().includes(q) || name.includes(q);
      });
    }

    switch (filterView) {
      case "overdue":
        return items.filter(t => isOverdue(t.dueDate, t.completed));
      case "today":
        return items.filter(t => !t.completed && isToday(t.dueDate));
      case "this_week":
        return items.filter(t => !t.completed && isThisWeek(t.dueDate));
      case "upcoming":
        return items.filter(t => !t.completed);
      default:
        return items;
    }
  }, [followUps, searchQuery, filterView, customers]);

  // Group by contact for the grouped view
  const groupedByContact = useMemo(() => {
    const map = new Map<string, CrmTask[]>();
    for (const task of filteredFollowUps) {
      if (!map.has(task.customerId)) map.set(task.customerId, []);
      map.get(task.customerId)!.push(task);
    }
    // Sort: contacts with overdue items first, then by count
    return Array.from(map.entries()).sort(([aId, aTasks], [bId, bTasks]) => {
      const aOverdue = aTasks.some(t => isOverdue(t.dueDate, t.completed));
      const bOverdue = bTasks.some(t => isOverdue(t.dueDate, t.completed));
      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;
      return bTasks.length - aTasks.length;
    });
  }, [filteredFollowUps]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newCustomerId) return;
    const contactName = getContactName(newCustomerId);
    await addTask({
      title: newTitle.trim(),
      customerId: newCustomerId,
      contactName,
      dueDate: newDueDate,
      completed: false,
      status: "todo",
      priority: newPriority,
      description: newNote || undefined,
    });
    // Auto-log activity
    await addActivity({
      customerId: newCustomerId,
      type: "task",
      content: `Follow-up scheduled: ${newTitle.trim()}${newDueDate ? ` (due ${new Date(newDueDate).toLocaleDateString()})` : ""}`,
      createdBy: "user",
    });
    setNewTitle("");
    setNewCustomerId("");
    setNewDueDate("");
    setNewPriority("medium");
    setNewType("call");
    setNewNote("");
    setShowCreateForm(false);
  };

  const handleComplete = async (task: CrmTask) => {
    updateTask(task.id, { completed: true, status: "done" });
    // Auto-log completion activity
    await addActivity({
      customerId: task.customerId,
      type: "task",
      content: `✅ Follow-up completed: ${task.title}`,
      createdBy: "user",
    });
  };

  // Stats
  const overdueCount = followUps.filter(t => isOverdue(t.dueDate, t.completed)).length;
  const todayCount = followUps.filter(t => !t.completed && isToday(t.dueDate)).length;
  const openCount = followUps.filter(t => !t.completed).length;

  const cardBg = isDarkMode ? "bg-slate-900/80 border-slate-700/60" : "bg-[#faf8f3] border-[#ede8da]/80";

  const getTypeConfig = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("call") || lower.includes("phone")) return FOLLOW_UP_TYPES[0];
    if (lower.includes("email") || lower.includes("send")) return FOLLOW_UP_TYPES[1];
    if (lower.includes("meeting") || lower.includes("meet")) return FOLLOW_UP_TYPES[2];
    if (lower.includes("proposal") || lower.includes("quote")) return FOLLOW_UP_TYPES[3];
    if (lower.includes("check") || lower.includes("touch base")) return FOLLOW_UP_TYPES[4];
    if (lower.includes("message") || lower.includes("text") || lower.includes("dm")) return FOLLOW_UP_TYPES[5];
    if (lower.includes("onboard")) return FOLLOW_UP_TYPES[6];
    return FOLLOW_UP_TYPES[0]; // default to call
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Follow-Ups</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track what you need to do next with each contact
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          New Follow-Up
        </button>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center gap-3 mb-4">
        {overdueCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs font-bold text-red-600 dark:text-red-400">{overdueCount} overdue</span>
          </div>
        )}
        {todayCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{todayCount} due today</span>
          </div>
        )}
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
          <span className="text-xs font-medium text-slate-400">{openCount} open</span>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className={`rounded-xl border p-5 mb-5 ${cardBg} animate-in slide-in-from-top-2 fade-in duration-200`}>
          <h3 className={`text-sm font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>Schedule Follow-Up</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            {/* Contact (required) */}
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>Contact *</label>
              <select
                value={newCustomerId}
                onChange={e => setNewCustomerId(e.target.value)}
                className={`w-full text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
              >
                <option value="">Select a contact...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}{c.company ? ` — ${c.company}` : ""}</option>
                ))}
              </select>
            </div>
            {/* Type */}
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>Type</label>
              <div className="flex flex-wrap gap-1.5">
                {FOLLOW_UP_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setNewType(type.id)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer ${
                        newType === type.id
                          ? `${type.bg} ${type.color} border-current`
                          : isDarkMode ? "border-slate-700 text-slate-400 hover:border-slate-600" : "border-slate-200 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      {type.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div className="sm:col-span-1">
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>What to do</label>
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. Call to discuss proposal..."
                className={`w-full text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-400'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className={`w-full text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
              />
            </div>
            <div>
              <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>Priority</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as any)}
                className={`w-full text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
              >
                <option value="low">Low</option>
                <option value="medium">Normal</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          {/* Optional note */}
          <div className="mb-4">
            <label className={`text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} mb-1 block`}>Note (optional)</label>
            <input
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Any context for this follow-up..."
              className={`w-full text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-400'} focus:outline-none`}
            />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={() => setShowCreateForm(false)} className={`px-3 py-2 rounded-lg text-xs font-medium ${isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-700'} cursor-pointer`}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newCustomerId}
              className="px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Schedule Follow-Up
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`relative flex items-center rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
          <Search className="w-3.5 h-3.5 text-slate-400 ml-3" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by contact or task..."
            className={`text-xs px-2 py-1.5 bg-transparent border-none outline-none w-48 ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'placeholder:text-slate-400'}`}
          />
        </div>
        {(["all", "overdue", "today", "this_week", "upcoming"] as const).map(f => {
          const labels: Record<string, string> = { all: "All", overdue: "Overdue", today: "Today", this_week: "This Week", upcoming: "Open" };
          return (
            <button
              key={f}
              onClick={() => setFilterView(f)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
                filterView === f
                  ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                  : isDarkMode ? "border-slate-700 text-slate-400 hover:text-white hover:border-slate-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {labels[f]}
              {f === "overdue" && overdueCount > 0 && (
                <span className="ml-1 text-[9px] bg-red-500 text-white px-1 rounded-full">{overdueCount}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content — Grouped by Contact */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {groupedByContact.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-300'}`}>
              <CalendarPlus className="w-7 h-7" />
            </div>
            <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>No follow-ups yet</h3>
            <p className="text-xs text-slate-400 text-center max-w-xs">Schedule a call, email, or meeting with a contact to start tracking your follow-ups.</p>
          </div>
        ) : (
          groupedByContact.map(([customerId, contactTasks]) => {
            const contact = getContact(customerId);
            if (!contact) return null;
            const hasOverdue = contactTasks.some(t => isOverdue(t.dueDate, t.completed));
            const openTasks = contactTasks.filter(t => !t.completed);
            const completedTasks = contactTasks.filter(t => t.completed);

            return (
              <div key={customerId} className={`rounded-xl border overflow-hidden transition-all ${
                hasOverdue
                  ? isDarkMode ? "border-red-800/50 bg-red-950/10" : "border-red-200 bg-red-50/20"
                  : cardBg
              }`}>
                {/* Contact header */}
                <div className={`flex items-center gap-3 p-4 border-b ${isDarkMode ? 'border-slate-800/60' : 'border-slate-100/80'}`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isDarkMode ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                    {contact.firstName?.[0]}{contact.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                      {contact.firstName} {contact.lastName}
                    </h3>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      {contact.company && <span className="truncate">{contact.company}</span>}
                      {contact.company && contact.email && <span>·</span>}
                      {contact.email && <span className="truncate">{contact.email}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>
                      {openTasks.length} open
                    </span>
                    {hasOverdue && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400 border border-red-200 dark:border-red-800">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                {/* Follow-up items */}
                <div className="divide-y divide-slate-100/60 dark:divide-slate-800/40">
                  {openTasks.map(task => {
                    const overdue = isOverdue(task.dueDate, task.completed);
                    const typeConfig = getTypeConfig(task.title);
                    const Icon = typeConfig.icon;
                    const urgency = URGENCY_LABELS[task.priority || "medium"];

                    return (
                      <div
                        key={task.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors group ${
                          overdue
                            ? isDarkMode ? "bg-red-950/15" : "bg-red-50/30"
                            : isDarkMode ? "hover:bg-slate-800/30" : "hover:bg-white/40"
                        }`}
                      >
                        {/* Complete button */}
                        <button
                          onClick={() => handleComplete(task)}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                            overdue
                              ? "border-red-400 hover:bg-red-500 hover:border-red-500"
                              : isDarkMode ? "border-slate-600 hover:bg-emerald-500 hover:border-emerald-500" : "border-slate-300 hover:bg-emerald-500 hover:border-emerald-500"
                          } hover:text-white`}
                          title="Mark as done"
                        >
                          <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>

                        {/* Type icon */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.bg}`}>
                          <Icon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{task.description}</p>
                          )}
                        </div>

                        {/* Priority */}
                        <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${urgency.className}`}>
                          {urgency.label}
                        </span>

                        {/* Due date */}
                        {task.dueDate && (
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                            overdue ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" :
                            isToday(task.dueDate) ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" :
                            isDarkMode ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                          }`}>
                            {overdue && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
                            {getRelativeDate(task.dueDate)}
                          </span>
                        )}

                        {/* Delete */}
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Completed items (collapsed) */}
                  {completedTasks.length > 0 && (
                    <div className="px-4 py-2">
                      <button
                        onClick={() => setExpandedId(expandedId === customerId ? null : customerId)}
                        className={`text-[11px] font-medium flex items-center gap-1.5 cursor-pointer ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                      >
                        <ChevronDown className={`w-3 h-3 transition-transform ${expandedId === customerId ? 'rotate-180' : ''}`} />
                        {completedTasks.length} completed
                      </button>
                      {expandedId === customerId && (
                        <div className="mt-2 space-y-1">
                          {completedTasks.map(task => (
                            <div key={task.id} className="flex items-center gap-3 py-1.5 pl-2 opacity-50">
                              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                              <span className="text-xs line-through text-slate-400 truncate">{task.title}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
