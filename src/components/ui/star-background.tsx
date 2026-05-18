'use client';

import { useEffect, useState } from 'react';

export function StarBackground() {
  const [stars, setStars] = useState<{ id: number; left: string; top: string; size: number; delay: number; duration: number }[]>([]);

  useEffect(() => {
    // Generate sparse stars — CSS-only animation for zero JS overhead
    const generatedStars = Array.from({ length: 40 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 1.5 + 0.8,
      delay: Math.random() * 8,
      duration: Math.random() * 6 + 4,
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none mix-blend-screen">
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)]"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animation: `star-twinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes star-twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
