"use client";

import { useState } from 'react';

export function SolTheoryLogoText() {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    setIsExpanded(!isExpanded);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave} className="relative">
      <span className="font-nunito text-2xl tracking-wider text-foreground font-bold">
        {isExpanded ? 'SOL Theory' : 'SOL'}
      </span>
    </div>
  );
}
