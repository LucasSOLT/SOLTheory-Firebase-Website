import React, { useState } from "react";
import { X, Clock, Edit2, Trash2, Plus, AlertCircle } from "lucide-react";
import { doc, deleteDoc } from "firebase/firestore";
import { useDarkMode } from "@/lib/useDarkMode";

interface TimesheetEntryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  date: string;
  entries: Array<{ id: string; [key: string]: any }>;
  onEdit: (entry: any) => void;
  onAdd: () => void;
  firestore: any;
}

function formatDuration(mins: number): string {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatMoney(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function TimesheetEntryDrawer({
  isOpen,
  onClose,
  userName,
  date,
  entries,
  onEdit,
  onAdd,
  firestore,
}: TimesheetEntryDrawerProps) {
  const isDarkMode = useDarkMode();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, "timesheet_entries", id));
      setDeletingId(null);
    } catch (error) {
      console.error("Failed to delete entry:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  // Safe date formatting, avoiding timezone shifts if the date string is YYYY-MM-DD
  const dateObj = new Date(date + "T00:00:00");
  const displayDate = isNaN(dateObj.getTime()) ? date : dateObj.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[80] transition-opacity" onClick={onClose} />
      <div 
        className={`fixed inset-y-0 right-0 w-full sm:w-[400px] shadow-2xl z-[90] flex flex-col transform transition-transform duration-300 ease-in-out translate-x-0 ${
          isDarkMode ? 'bg-slate-900 border-l border-slate-800' : 'bg-white border-l border-slate-200'
        }`}
      >
        <div className={`px-6 py-4 border-b flex items-center justify-between ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
          <div>
            <h2 className={`text-lg font-bold ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
              {userName}'s Entries
            </h2>
            <p className={`text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {displayDate}
            </p>
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {entries.length === 0 ? (
            <div className={`text-center py-10 rounded-xl border border-dashed ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
              <Clock className={`w-8 h-8 mx-auto mb-3 opacity-50 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <p className={`text-sm font-medium mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                No entries for this date
              </p>
              <button
                onClick={onAdd}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" /> Add Entry
              </button>
            </div>
          ) : (
            <>
              {entries.map((entry) => (
                <div 
                  key={entry.id} 
                  className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'} shadow-sm relative group`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className={`font-semibold text-sm ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>
                        {entry.customerName}
                      </h3>
                      <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        {entry.serviceName}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {deletingId === entry.id ? null : (
                        <>
                          <button
                            onClick={() => onEdit(entry)}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-slate-100 text-slate-400 hover:text-blue-600'}`}
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeletingId(entry.id)}
                            className={`p-1.5 rounded-md transition-colors ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-slate-100 text-slate-400 hover:text-red-600'}`}
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {deletingId === entry.id && (
                    <div className={`mt-3 p-3 rounded-lg border ${isDarkMode ? 'bg-red-900/20 border-red-900/50' : 'bg-red-50 border-red-100'} flex items-center justify-between`}>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 text-red-500" />
                        <span className="text-sm font-medium text-red-700 dark:text-red-400">Delete this entry?</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setDeletingId(null)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors"
                        >
                          No
                        </button>
                        <button 
                          onClick={() => handleDelete(entry.id)}
                          disabled={isDeleting}
                          className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors disabled:opacity-50"
                        >
                          {isDeleting ? '...' : 'Yes'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className={`mt-3 pt-3 border-t flex items-center gap-4 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                    <div>
                      <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Duration</span>
                      <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
                        {formatDuration(entry.durationMinutes)}
                      </span>
                    </div>
                    {entry.billableRate > 0 && (
                      <div>
                        <span className={`text-[10px] uppercase font-bold tracking-wider block mb-0.5 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>Rate</span>
                        <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                          {formatMoney(entry.billableRate)}/hr
                        </span>
                      </div>
                    )}
                  </div>

                  {entry.notes && (
                    <div className={`mt-3 text-xs italic ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                      "{entry.notes}"
                    </div>
                  )}
                </div>
              ))}
              
              <button
                onClick={onAdd}
                className={`w-full py-3 flex items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-colors ${
                  isDarkMode 
                    ? 'border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300 hover:border-slate-600' 
                    : 'border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Plus className="w-4 h-4" /> Add Another Entry
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
