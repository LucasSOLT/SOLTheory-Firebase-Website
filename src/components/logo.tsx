import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      aria-label="SOL Theory Logo"
      {...props}
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: 'hsl(var(--accent))', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      <path
        fill="none"
        stroke="url(#logo-gradient)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M30,75 C10,50 40,20 50,30 S90,50 70,75 C60,85 40,85 30,75 M50,30 C50,55 50,55 50,80"
      />
    </svg>
  );
}
