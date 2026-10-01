// ============================================================================
// components/portal/DemoWatermark.tsx
//
// Persistent animated ribbon watermark for demo/personal accounts.
// Appears on the bottom-right of ALL dashboard pages.
// Cannot be dismissed. Small, subtle, mobile-responsive.
// ============================================================================

'use client';

import React from 'react';

/**
 * Floating demo watermark ribbon.
 * Renders a small, semi-transparent animated marquee at the bottom-right
 * corner of the viewport. Always visible, never dismissable.
 */
export function DemoWatermark() {
  return (
    <div
      className="fixed bottom-3 right-3 z-[9999] pointer-events-none select-none"
      aria-hidden="true"
    >
      <div
        className="overflow-hidden rounded-full px-4 py-1.5 max-w-[280px] sm:max-w-[340px]"
        style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(139,92,246,0.85))',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
        }}
      >
        <div className="flex whitespace-nowrap animate-marquee">
          <span className="text-[10px] sm:text-[11px] font-bold text-white/90 tracking-wide uppercase mr-8">
            ✦ DEMO MODE — Request an org invite from your admin ✦
          </span>
          <span className="text-[10px] sm:text-[11px] font-bold text-white/90 tracking-wide uppercase mr-8">
            ✦ DEMO MODE — Request an org invite from your admin ✦
          </span>
        </div>
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
