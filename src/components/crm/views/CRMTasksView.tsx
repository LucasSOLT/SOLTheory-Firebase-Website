"use client";

import React, { useState, useMemo } from "react";
import { useCRMStore } from "@/stores/crm-store";
import type { CrmTask, Customer } from "@/stores/crm-store";
import { useTheme } from "@/components/ThemeProvider";
import {
  CheckSquare, Square, Plus, List, LayoutGrid, Calendar, Flag, User,
  Trash2, Clock, AlertTriangle, ChevronDown, Search, X, Check,
} from "lucide-react";

interface CRMTasksViewProps {
  customers: Customer[];
}

const PRIORITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  low: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-500 dark:text-slate-400", label: "Low" },
  medium: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-600 dark:text-blue-400", label: "Medium" },
  high: { bg: "bg-orange-50 dark:bg-orange-950/40", text: "text-orange-600 dark:text-orange-400", label: "High" },
  urgent: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-600 dark:text-red-400", label: "Urgent" },
};

const STATUS_LABELS: Record<string, string> = { todo: "To Do", in_progress: "In Progress", done: "Done" };

function isOverdue(dueDate: string, completed: boolean): boolean {
  if (completed) return false;
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function isToday(dueDate: string): boolean {
  if (!dueDate) return false;
  return dueDate.startsWith(new Date().toISOString().split("T")[0]);
}

export default function CRMTasksView({ customers }: CRMTasksViewProps) {
  const { isDarkMode } = useTheme();
  const tasks = useCRMStore(s => s.tasks);
  const addTask = useCRMStore(s => s.addTask);
  const updateTask = useCRMStore(s => s.updateTask);
  const deleteTask = useCRMStore(s => s.deleteTask);

  const [viewMode, setViewMode] = useState<"list" | "board">("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newPriority, setNewPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");

  const getContactName = (customerId: string) => {
    const c = customers.find(x => x.id === customerId);
    return c ? `${c.firstName} ${c.lastName}` : "";
  };

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    await addTask({
      title: newTitle.trim(),
      customerId: newCustomerId,
      contactName: getContactName(newCustomerId),
      dueDate: newDueDate,
      completed: false,
      status: "todo",
      priority: newPriority,
    });
    setNewTitle("");
    setNewCustomerId("");
    setNewDueDate("");
    setNewPriority("medium");
    setShowCreateForm(false);
  };

  const toggleComplete = (task: CrmTask) => {
    updateTask(task.id, {
      completed: !task.completed,
      status: task.completed ? "todo" : "done",
    });
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const name = getContactName(t.customerId).toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterStatus === "overdue") return isOverdue(t.dueDate, t.completed);
      if (filterStatus && (t.status || "todo") !== filterStatus) return false;
      return true;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus, customers]);

  const boardColumns = useMemo(() => ({
    todo: filteredTasks.filter(t => !t.completed && (t.status || "todo") === "todo" && !isOverdue(t.dueDate, t.completed)),
    in_progress: filteredTasks.filter(t => !t.completed && t.status === "in_progress"),
    done: filteredTasks.filter(t => t.completed || t.status === "done"),
    overdue: filteredTasks.filter(t => isOverdue(t.dueDate, t.completed)),
  }), [filteredTasks]);

  const cardBg = isDarkMode ? "bg-slate-900/80 border-slate-700/60" : "bg-[#faf8f3] border-[#ede8da]/80";

  const renderTaskRow = (task: CrmTask) => {
    const overdue = isOverdue(task.dueDate, task.completed);
    const today = isToday(task.dueDate);
    const pStyle = PRIORITY_STYLES[task.priority || "medium"];

    return (
      <tr
        key={task.id}
        className={`border-b transition-colors ${
          overdue ? (isDarkMode ? "bg-red-950/20 border-red-900/30" : "bg-red-50/40 border-red-100") :
          isDarkMode ? "border-slate-800 hover:bg-slate-800/50" : "border-slate-100 hover:bg-white/60"
        }`}
      >
        <td className="px-4 py-3 w-10">
          <button onClick={() => toggleComplete(task)} className="cursor-pointer">
            {task.completed
              ? <CheckSquare className="w-4 h-4 text-emerald-500" />
              : <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-indigo-400" />
            }
          </button>
        </td>
        <td className={`px-4 py-3 text-sm font-medium ${task.completed ? "line-through text-slate-400" : ""}`}>
          {task.title}
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {getContactName(task.customerId) || "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          {task.dueDate ? (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${
              overdue ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" :
              today ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400" :
              "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
            }`}>
              {overdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
              {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
          ) : <span className="text-xs text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${pStyle.bg} ${pStyle.text}`}>
            {pStyle.label}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {STATUS_LABELS[task.status || "todo"] || "To Do"}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={() => deleteTask(task.id)}
            className="w-6 h-6 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
    );
  };

  const renderBoardCard = (task: CrmTask) => {
    const pStyle = PRIORITY_STYLES[task.priority || "medium"];
    return (
      <div
        key={task.id}
        className={`p-3 rounded-xl border ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} shadow-sm hover:shadow-md transition-all cursor-pointer`}
      >
        <div className="flex items-start justify-between mb-2">
          <button onClick={() => toggleComplete(task)} className="mt-0.5 cursor-pointer">
            {task.completed
              ? <CheckSquare className="w-4 h-4 text-emerald-500" />
              : <Square className="w-4 h-4 text-slate-300 hover:text-indigo-400" />
            }
          </button>
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${pStyle.bg} ${pStyle.text}`}>
            {pStyle.label}
          </span>
        </div>
        <h4 className={`text-sm font-semibold mb-1.5 ${task.completed ? "line-through text-slate-400" : ""}`}>
          {task.title}
        </h4>
        {getContactName(task.customerId) && (
          <p className="text-[11px] text-slate-400 flex items-center gap-1 mb-2">
            <User className="w-3 h-3" />
            {getContactName(task.customerId)}
          </p>
        )}
        {task.dueDate && (
          <p className={`text-[11px] flex items-center gap-1 ${isOverdue(task.dueDate, task.completed) ? "text-red-500 font-semibold" : "text-slate-400"}`}>
            <Clock className="w-3 h-3" />
            {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Tasks</h2>
          <p className="text-xs text-slate-400">{tasks.length} total · {tasks.filter(t => !t.completed).length} open</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className={`flex rounded-lg border p-0.5 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}>
            <button onClick={() => setViewMode("list")} className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "list" ? (isDarkMode ? "bg-slate-600 text-white" : "bg-white text-slate-800 shadow-sm") : "text-slate-400"}`}>
              <List className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode("board")} className={`p-1.5 rounded-md transition-colors cursor-pointer ${viewMode === "board" ? (isDarkMode ? "bg-slate-600 text-white" : "bg-white text-slate-800 shadow-sm") : "text-slate-400"}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Task
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className={`rounded-xl border p-4 mb-4 ${cardBg} animate-in slide-in-from-top-2 fade-in duration-200`}>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title..."
              className={`flex-1 text-sm rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500' : 'bg-white border-slate-200 placeholder:text-slate-400'} focus:outline-none focus:ring-2 focus:ring-indigo-500/20`}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
            />
            <select
              value={newCustomerId}
              onChange={e => setNewCustomerId(e.target.value)}
              className={`text-xs rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
            >
              <option value="">No contact</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
              ))}
            </select>
            <input
              type="date"
              value={newDueDate}
              onChange={e => setNewDueDate(e.target.value)}
              className={`text-xs rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value as any)}
              className={`text-xs rounded-lg border px-3 py-2 ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Create
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className={`relative flex items-center rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
          <Search className="w-3.5 h-3.5 text-slate-400 ml-3" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className={`text-xs px-2 py-1.5 bg-transparent border-none outline-none w-40 ${isDarkMode ? 'text-white placeholder:text-slate-500' : 'placeholder:text-slate-400'}`}
          />
        </div>
        {["todo", "in_progress", "done", "overdue"].map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? "" : s)}
            className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer ${
              filterStatus === s
                ? "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800"
                : isDarkMode ? "border-slate-700 text-slate-400 hover:text-white hover:border-slate-600" : "border-slate-200 text-slate-500 hover:border-slate-300"
            }`}
          >
            {s === "overdue" ? "Overdue" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${isDarkMode ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-300'}`}>
              <CheckSquare className="w-7 h-7" />
            </div>
            <h3 className={`text-sm font-semibold mb-1 ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>No tasks found</h3>
            <p className="text-xs text-slate-400">Create a task to get started</p>
          </div>
        ) : viewMode === "list" ? (
          <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
            <table className="w-full">
              <thead>
                <tr className={isDarkMode ? "bg-slate-800/50" : "bg-slate-50/80"}>
                  <th className="px-4 py-2.5 w-10" />
                  <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Title</th>
                  <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Contact</th>
                  <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Due</th>
                  <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Priority</th>
                  <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`}>Status</th>
                  <th className="px-4 py-2.5 w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map(renderTaskRow)}
              </tbody>
            </table>
          </div>
        ) : (
          /* Board View */
          <div className="flex gap-4 h-full overflow-x-auto pb-4">
            {(["todo", "in_progress", "done", "overdue"] as const).map(col => {
              const colTasks = boardColumns[col] || [];
              const colConfig: Record<string, { label: string; color: string }> = {
                todo: { label: "To Do", color: "bg-blue-500" },
                in_progress: { label: "In Progress", color: "bg-amber-500" },
                done: { label: "Done", color: "bg-emerald-500" },
                overdue: { label: "Overdue", color: "bg-red-500" },
              };
              const { label, color } = colConfig[col];
              return (
                <div key={col} className={`flex-1 min-w-[260px] flex flex-col rounded-xl border ${isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200/60'}`}>
                  <div className={`p-3 border-b flex items-center gap-2 ${isDarkMode ? 'border-slate-800' : 'border-slate-200/60'}`}>
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{label}</span>
                    <span className="text-[10px] text-slate-400 ml-auto bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-full font-medium">{colTasks.length}</span>
                  </div>
                  <div className="flex-1 p-3 space-y-3 overflow-y-auto">
                    {colTasks.map(renderBoardCard)}
                    {colTasks.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">No tasks</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
