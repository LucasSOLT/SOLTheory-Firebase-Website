export default function DashboardLoading() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#ffffff",
      }}
    >
      <p
        style={{
          fontSize: "13px",
          fontWeight: 500,
          letterSpacing: "0.15em",
          textTransform: "uppercase" as const,
          marginBottom: "28px",
          color: "rgba(79, 70, 229, 0.6)",
          animation: "loadCubeTextPulse 2s ease-in-out infinite",
        }}
      >
        Loading
      </p>
      <div className="load-cube-scene">
        <div className="load-cube">
          <div className="load-cube-face load-cf-front" />
          <div className="load-cube-face load-cf-back" />
          <div className="load-cube-face load-cf-right" />
          <div className="load-cube-face load-cf-left" />
          <div className="load-cube-face load-cf-top" />
          <div className="load-cube-face load-cf-bottom" />
        </div>
      </div>
      <style>{`
        @keyframes loadCubeTextPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        .load-cube-scene { width: 56px; height: 56px; perspective: 400px; }
        .load-cube {
          width: 100%; height: 100%; position: relative;
          transform-style: preserve-3d;
          animation: loadCubeRotate 6s ease-in-out infinite;
        }
        .load-cube-face {
          position: absolute; width: 56px; height: 56px; border-radius: 10px;
          border: 1.5px solid rgba(129, 140, 248, 0.3);
          background: linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(129,140,248,0.1) 50%, rgba(167,139,250,0.15) 100%);
          box-shadow: inset 0 0 20px rgba(99,102,241,0.06), 0 0 15px rgba(99,102,241,0.05);
        }
        .load-cf-front  { transform: translateZ(28px); }
        .load-cf-back   { transform: rotateY(180deg) translateZ(28px); }
        .load-cf-right  { transform: rotateY(90deg) translateZ(28px); }
        .load-cf-left   { transform: rotateY(-90deg) translateZ(28px); }
        .load-cf-top    { transform: rotateX(90deg) translateZ(28px); }
        .load-cf-bottom { transform: rotateX(-90deg) translateZ(28px); }
        @keyframes loadCubeRotate {
          0%, 10%   { transform: rotateX(-25deg) rotateY(0deg); }
          15%, 25%  { transform: rotateX(-25deg) rotateY(90deg); }
          30%, 40%  { transform: rotateX(-25deg) rotateY(180deg); }
          45%, 55%  { transform: rotateX(-25deg) rotateY(270deg); }
          60%, 70%  { transform: rotateX(-25deg) rotateY(360deg) rotateZ(5deg); }
          75%, 85%  { transform: rotateX(-25deg) rotateY(450deg) rotateZ(0deg); }
          90%, 100% { transform: rotateX(-25deg) rotateY(540deg); }
        }
      `}</style>
    </div>
  );
}
