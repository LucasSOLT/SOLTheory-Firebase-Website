// ============================================================================
// components/portal/DemoWatermark.tsx
//
// Inline animated demo mode ribbon for the mobile header bar.
// Replaces the org name text ("SOL Theory") for demo/personal accounts.
// Same purple gradient marquee aesthetic, now positioned inline in header.
// ============================================================================

'use client';

import React from 'react';

/**
 * Inline demo mode ribbon for the mobile top header bar.
 * Renders an animated marquee inside a compact pill shape.
 * NOT fixed positioned — meant to be placed inline in the header.
 */
export function DemoWatermark() {
  return (
    <div
      className="overflow-hidden rounded-full px-3 py-1 max-w-[180px] sm:max-w-[220px] select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))',
        boxShadow: '0 1px 8px rgba(99,102,241,0.25)',
      }}
      aria-hidden="true"
    >
      <div className="flex whitespace-nowrap animate-marquee">
        <span className="text-[9px] sm:text-[10px] font-bold text-white/90 tracking-wide uppercase mr-6">
          ✦ DEMO MODE — Request an org invite from your admin ✦
        </span>
        <span className="text-[9px] sm:text-[10px] font-bold text-white/90 tracking-wide uppercase mr-6">
          ✦ DEMO MODE — Request an org invite from your admin ✦
        </span>
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 12s linear infinite;
        }
      `}</style>
    </div>
  );
}
