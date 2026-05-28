'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function SolExplainedPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-indigo-400">SOL</span> Explained
        </h1>
        <p className="text-slate-400 text-lg">Explanation coming soon.</p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors mt-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
