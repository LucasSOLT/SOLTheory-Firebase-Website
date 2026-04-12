'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function StarBackground() {
  const [stars, setStars] = useState<{ id: number; left: string; top: string; size: number; delay: number; duration: number; xMove: number; yMove: number }[]>([]);

  useEffect(() => {
    // Generate scattered, very small stars
    const generatedStars = Array.from({ length: 200 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 1.8 + 1, // 1px to 2.8px
      delay: Math.random() * 10,
      duration: Math.random() * 100 + 150, // Between 150s and 250s (very slow)
      xMove: (Math.random() - 0.5) * 80, // Move quietly
      yMove: (Math.random() - 0.5) * 80,
    }));
    setStars(generatedStars);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none mix-blend-screen">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white shadow-[0_0_4px_1px_rgba(255,255,255,0.6)]"
          style={{
            left: star.left,
            top: star.top,
            width: `${star.size}px`,
            height: `${star.size}px`,
          }}
          animate={{
            x: [0, star.xMove, 0],
            y: [0, star.yMove, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: star.duration,
            repeat: Infinity,
            ease: "linear",
            delay: star.delay,
            opacity: {
              duration: star.duration / 4,
              repeat: Infinity,
              ease: "easeInOut",
              delay: star.delay
            }
          }}
        />
      ))}
    </div>
  );
}
