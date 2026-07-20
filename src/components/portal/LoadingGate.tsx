"use client";

import React, { useState, useEffect } from "react";

/* ─────────────── 3D CUBE LOADING SCREEN ─────────────── */

interface LoadingGateProps {
  /** Minimum time (ms) to show the loading screen. Default: 3500ms */
  minDuration?: number;
  /** Whether auth/data is still loading */
  isLoading: boolean;
  /** Dark mode */
  isDarkMode: boolean;
  children: React.ReactNode;
}

export default function LoadingGate({
  minDuration = 3500,
  isLoading,
  isDarkMode,
  children,
}: LoadingGateProps) {
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [hasShown, setHasShown] = useState(false);

  // Check sessionStorage so the animation only plays once per session
  useEffect(() => {
    if (typeof window !== "undefined") {
      const shown = sessionStorage.getItem("loading_gate_shown");
      if (shown === "true") {
        setHasShown(true);
        setMinTimePassed(true);
        setIsHidden(true);
      }
    }
  }, []);

  // Start the minimum timer
  useEffect(() => {
    if (hasShown) return;
    const timer = setTimeout(() => {
      setMinTimePassed(true);
    }, minDuration);
    return () => clearTimeout(timer);
  }, [minDuration, hasShown]);

  // When both minTime has passed AND data is loaded, start fade out
  useEffect(() => {
    if (minTimePassed && !isLoading && !isHidden && !hasShown) {
      setIsFadingOut(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("loading_gate_shown", "true");
      }
      const fadeTimer = setTimeout(() => {
        setIsHidden(true);
      }, 600); // match CSS fade duration
      return () => clearTimeout(fadeTimer);
    }
  }, [minTimePassed, isLoading, isHidden, hasShown]);

  // If already shown this session, render children immediately
  if (hasShown) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Children render in background so they preload */}
      <div
        style={{
          position: isHidden ? "relative" : "fixed",
          top: 0, left: 0, width: "100%", height: "100%",
          visibility: isHidden ? "visible" : "hidden",
          zIndex: 0,
        }}
      >
        {children}
      </div>

      {/* Loading overlay */}
      {!isHidden && (
        <div
          className={`loading-gate-overlay ${isFadingOut ? "loading-gate-fadeout" : ""}`}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: isDarkMode
              ? "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)"
              : "linear-gradient(135deg, #f8f6f0 0%, #e8e4d8 50%, #f8f6f0 100%)",
            transition: "opacity 0.6s ease-out",
          }}
        >
          {/* Loading text */}
          <p
            className="loading-gate-text"
            style={{
              fontSize: "13px",
              fontWeight: 500,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "28px",
              color: isDarkMode ? "rgba(165, 180, 252, 0.8)" : "rgba(79, 70, 229, 0.7)",
            }}
          >
            Loading
          </p>

          {/* 3D Cube */}
          <div className="cube-scene">
            <div className="cube">
              <div className="cube-face cube-front" />
              <div className="cube-face cube-back" />
              <div className="cube-face cube-right" />
              <div className="cube-face cube-left" />
              <div className="cube-face cube-top" />
              <div className="cube-face cube-bottom" />
            </div>
          </div>

          {/* Progress bar */}
          <div
            style={{
              marginTop: "32px",
              width: "200px",
              height: "3px",
              borderRadius: "2px",
              overflow: "hidden",
              background: isDarkMode ? "rgba(99, 102, 241, 0.15)" : "rgba(99, 102, 241, 0.12)",
            }}
          >
            <div
              className="loading-gate-progress"
              style={{
                height: "100%",
                borderRadius: "2px",
                background: "linear-gradient(90deg, #6366f1, #818cf8, #a78bfa)",
                animationDuration: `${minDuration}ms`,
              }}
            />
          </div>
        </div>
      )}

      {/* Inline styles for the 3D cube — no external CSS file needed */}
      <style>{`
        .loading-gate-overlay {
          opacity: 1;
        }
        .loading-gate-fadeout {
          opacity: 0 !important;
          pointer-events: none;
        }

        .loading-gate-text {
          animation: textPulse 2s ease-in-out infinite;
        }
        @keyframes textPulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        /* ── Progress bar ── */
        .loading-gate-progress {
          animation: progressFill linear forwards;
          width: 0%;
        }
        @keyframes progressFill {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        /* ── 3D Cube Scene ── */
        .cube-scene {
          width: 64px;
          height: 64px;
          perspective: 400px;
        }

        .cube {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: cubeRotate 6s ease-in-out infinite;
        }

        .cube-face {
          position: absolute;
          width: 64px;
          height: 64px;
          border-radius: 10px;
          border: 1.5px solid rgba(129, 140, 248, 0.25);
          background: linear-gradient(135deg,
            rgba(99, 102, 241, 0.35) 0%,
            rgba(129, 140, 248, 0.2) 50%,
            rgba(167, 139, 250, 0.35) 100%
          );
          backdrop-filter: blur(4px);
          box-shadow:
            inset 0 0 20px rgba(99, 102, 241, 0.1),
            0 0 15px rgba(99, 102, 241, 0.08);
        }

        /* Position each face of the cube */
        .cube-front  { transform: translateZ(32px); }
        .cube-back   { transform: rotateY(180deg) translateZ(32px); }
        .cube-right  { transform: rotateY(90deg) translateZ(32px); }
        .cube-left   { transform: rotateY(-90deg) translateZ(32px); }
        .cube-top    { transform: rotateX(90deg) translateZ(32px); }
        .cube-bottom { transform: rotateX(-90deg) translateZ(32px); }

        /* Stepped rotation: rotate → pause → rotate → pause */
        @keyframes cubeRotate {
          0%, 10%   { transform: rotateX(0deg) rotateY(0deg); }
          15%, 25%  { transform: rotateX(0deg) rotateY(90deg); }
          30%, 40%  { transform: rotateX(0deg) rotateY(180deg); }
          45%, 55%  { transform: rotateX(0deg) rotateY(270deg); }
          60%, 70%  { transform: rotateX(90deg) rotateY(0deg); }
          75%, 85%  { transform: rotateX(-90deg) rotateY(0deg); }
          90%, 100% { transform: rotateX(0deg) rotateY(360deg); }
        }
      `}</style>
    </>
  );
}
