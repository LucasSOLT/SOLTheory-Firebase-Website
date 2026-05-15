"use client";

import { useCRMStore } from "@/stores/crm-store";
import { X } from "lucide-react";

export function ToastContainer() {
  const { toasts, dismissToast } = useCRMStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm animate-in slide-in-from-right duration-300 ${
            toast.type === "success"
              ? "bg-white/95 border-emerald-200 text-slate-800"
              : toast.type === "error"
                ? "bg-white/95 border-red-200 text-slate-800"
                : "bg-white/95 border-[#E5E7EB] text-slate-800"
          }`}
          style={{
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => dismissToast(toast.id)}
            className="w-5 h-5 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer shrink-0"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <style jsx>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}
