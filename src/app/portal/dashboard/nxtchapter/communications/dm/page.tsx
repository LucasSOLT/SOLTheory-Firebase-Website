"use client";

import { useState, useEffect } from "react";
import { DMChat } from "@/components/communications/DMChat";

export default function DMPage() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  useEffect(() => {
    const t = localStorage.getItem('insight_theme');
    setIsDarkMode(t === 'dark');
    const handleStorage = () => {
      setIsDarkMode(localStorage.getItem('insight_theme') === 'dark');
    };
    window.addEventListener('storage', handleStorage);
    const interval = setInterval(handleStorage, 500);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="h-full w-full flex flex-col pt-2 max-w-7xl mx-auto space-y-4 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className={`text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-3 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Mensajes Directos
          </h1>
          <p className={`text-sm max-w-2xl font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            Comunícate de forma segura a través de la red de la plataforma.
          </p>
        </div>
      </div>
      <div className="flex-1 pb-10 min-h-0">
        <DMChat />
      </div>
    </div>
  );
}
