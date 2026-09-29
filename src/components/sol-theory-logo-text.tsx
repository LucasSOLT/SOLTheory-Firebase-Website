"use client";

import { cn } from "@/lib/utils";

interface SolTheoryLogoTextProps {
  className?: string;
}

export function SolTheoryLogoText({ className }: SolTheoryLogoTextProps = {}) {
  return (
    <div className="relative">
      <span className={cn("font-nunito text-2xl tracking-wider text-white font-bold", className)}>
        SOL
      </span>
    </div>
  );
}
