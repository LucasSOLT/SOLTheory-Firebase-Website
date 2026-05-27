"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, MeshDistortMaterial, Float } from "@react-three/drei";
import { Suspense, useRef, useState, useEffect, Component, type ReactNode } from "react";
import * as THREE from "three";

function ShinyBlackBlob({ onReady }: { onReady: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasSignaled = useRef(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (!hasSignaled.current) {
      hasSignaled.current = true;
      onReady();
    }
    const targetX = state.pointer.y * 0.3;
    const targetY = state.pointer.x * 0.3;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetX, 0.02);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetY, 0.02);
  });

  return (
    <Float speed={0.6} rotationIntensity={0.8} floatIntensity={1.2}>
      <mesh ref={meshRef} scale={1.8}>
        {/* sphereGeometry has uniform vertex distribution — no spikes */}
        <sphereGeometry args={[1, 128, 128]} />
        <MeshDistortMaterial
          color="#080810"
          envMapIntensity={3}
          clearcoat={1}
          clearcoatRoughness={0.02}
          metalness={0.95}
          roughness={0.02}
          distort={0.18}
          speed={0.4}
        />
      </mesh>
    </Float>
  );
}

// Separate component to configure the renderer after mount
function RendererConfig() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

// CSS-only fallback blob (used when Three.js fails or hasn't loaded)
function CSSBlob({ size = 280 }: { size?: number }) {
  return (
    <div
      className="rounded-full animate-pulse"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: 'radial-gradient(circle at 38% 38%, #1a1a2e 0%, #0a0a0b 55%, #000 100%)',
        boxShadow: '0 0 80px 20px rgba(192,38,211,0.08), 0 0 120px 40px rgba(79,70,229,0.06)',
        filter: 'blur(1px)',
      }}
    />
  );
}

// Error boundary to catch Three.js / WebGL crashes
class BlobErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn("[BlobHero] Three.js error caught, falling back to CSS:", error.message);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <CSSBlob size={240} />
        </div>
      );
    }
    return this.props.children;
  }
}

export function BlobHero() {
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render Canvas on client to prevent SSR hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none flex items-center justify-center">
      {/* CSS placeholder — always visible until Three.js is ready */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
        style={{ opacity: ready ? 0 : 1, pointerEvents: 'none' }}
      >
        <CSSBlob size={typeof window !== 'undefined' && window.innerWidth < 768 ? 200 : 280} />
      </div>

      {/* High-fidelity Three.js canvas — only rendered client-side */}
      {mounted && (
        <BlobErrorBoundary>
          <div
            className="absolute inset-0 md:top-[15%] md:bottom-[15%] md:left-[20%] md:right-[10%] transition-opacity duration-700 scale-[0.55] md:scale-100 origin-center"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <Canvas
              camera={{ position: [0, 0, 5], fov: 45 }}
              dpr={[1, 1.5]}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: "high-performance",
                stencil: false,
                depth: true,
                failIfMajorPerformanceCaveat: false,
              }}
              onCreated={({ gl }) => {
                // Ensure WebGL context is valid
                if (!gl.getContext()) {
                  console.warn("[BlobHero] WebGL context unavailable");
                }
              }}
            >
              <RendererConfig />

              {/* Ambient fill */}
              <ambientLight intensity={0.4} />

              {/* Key lights — fuchsia/indigo accent */}
              <directionalLight position={[10, 10, 5]} intensity={1.5} color="#c026d3" />
              <directionalLight position={[-10, -10, -5]} intensity={1.5} color="#4f46e5" />

              {/* Rim lights for edge definition */}
              <pointLight position={[5, 0, -5]} intensity={0.8} color="#818cf8" distance={20} />
              <pointLight position={[-5, 3, -3]} intensity={0.6} color="#e879f9" distance={20} />

              {/* Top fill for subtle highlight on crown */}
              <pointLight position={[0, 8, 3]} intensity={0.4} color="#ffffff" distance={25} />

              <Suspense fallback={null}>
                <ShinyBlackBlob onReady={() => setReady(true)} />
                <Environment preset="city" />
              </Suspense>
            </Canvas>
          </div>
        </BlobErrorBoundary>
      )}
    </div>
  );
}
