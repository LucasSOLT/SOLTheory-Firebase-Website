'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

export default function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const prevPathname = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      setIsVisible(true);
      setProgress(80);

      const timer = setTimeout(() => {
        setProgress(100);
        setTimeout(() => {
          setIsVisible(false);
          setProgress(0);
        }, 300);
      }, 200);

      return () => clearTimeout(timer);
    }
  }, [pathname]);

  if (!isVisible && progress === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 99999,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #6366f1)',
          backgroundSize: '200% 100%',
          animation: progress < 100 ? 'shimmer 1.5s infinite' : 'none',
          transition:
            progress === 0
              ? 'none'
              : 'width 0.4s ease-out, opacity 0.3s ease',
          opacity: isVisible ? 1 : 0,
          boxShadow:
            '0 0 10px rgba(99, 102, 241, 0.5), 0 0 5px rgba(139, 92, 246, 0.3)',
          borderRadius: '0 2px 2px 0',
        }}
      />
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}
