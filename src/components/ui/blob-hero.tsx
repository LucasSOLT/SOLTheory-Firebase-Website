"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, MeshDistortMaterial, Float } from "@react-three/drei";
import { Suspense, useRef, useState, useEffect, Component, type ReactNode } from "react";
import * as THREE from "three";

interface BlobConfig {
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
  floatSpeed: number;
  floatIntensity: number;
  rotationIntensity: number;
  distort: number;
  speed: number;
  // Material
  color: string;
  emissive: string;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  envMapIntensity: number;
}

function ShinyBlob({
  onReady,
  config,
}: {
  onReady?: () => void;
  config: BlobConfig;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasSignaled = useRef(false);

  useFrame((state) => {
    if (!meshRef.current) return;
    if (!hasSignaled.current && onReady) {
      hasSignaled.current = true;
      onReady();
    }
    const targetX = state.pointer.y * 0.2;
    const targetY = state.pointer.x * 0.2;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(
      meshRef.current.rotation.x,
      targetX,
      0.015
    );
    meshRef.current.rotation.y = THREE.MathUtils.lerp(
      meshRef.current.rotation.y,
      targetY,
      0.015
    );
  });

  return (
    <Float
      speed={config.floatSpeed}
      rotationIntensity={config.rotationIntensity}
      floatIntensity={config.floatIntensity}
    >
      <mesh
        ref={meshRef}
        scale={config.scale}
        position={config.position}
        rotation={config.rotation}
      >
        <sphereGeometry args={[1, 96, 96]} />
        <MeshDistortMaterial
          color={config.color}
          emissive={config.emissive}
          emissiveIntensity={config.emissiveIntensity}
          envMapIntensity={config.envMapIntensity}
          clearcoat={config.clearcoat}
          clearcoatRoughness={config.clearcoatRoughness}
          metalness={config.metalness}
          roughness={config.roughness}
          distort={config.distort}
          speed={config.speed}
        />
      </mesh>
    </Float>
  );
}

// Configure renderer tone mapping after mount
function RendererConfig() {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.2;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);
  return null;
}

// Error boundary to catch Three.js / WebGL crashes
class BlobErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.warn(
      "[BlobHero] Three.js error caught, falling back to CSS:",
      error.message
    );
  }
  render() {
    if (this.state.hasError) {
      return null; // Graceful silent fallback on desktop
    }
    return this.props.children;
  }
}

// Three blob configurations for desktop — each has a unique color identity
const BLOB_CONFIGS: BlobConfig[] = [
  {
    // Top-right — smallest (muted warm red / rose-grey)
    // Tilted right for off-kilter effect
    position: [2.5, 1.4, -0.5],
    rotation: [0.3, -0.4, 0.25],
    scale: 0.65,
    floatSpeed: 0.8,
    floatIntensity: 1.0,
    rotationIntensity: 0.6,
    distort: 0.22,
    speed: 0.6,
    color: "#150d12",
    emissive: "#993344",
    emissiveIntensity: 0.035,
    metalness: 0.65,
    roughness: 0.25,
    clearcoat: 0.5,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.2,
  },
  {
    // Middle/top-left — biggest (hero blob, muted purple-grey / amethyst)
    // No tilt — classic centered hero
    position: [-2.2, 0.3, 0],
    rotation: [0, 0, 0],
    scale: 1.25,
    floatSpeed: 0.5,
    floatIntensity: 1.2,
    rotationIntensity: 0.8,
    distort: 0.20,
    speed: 0.4,
    color: "#0e0b18",
    emissive: "#5c3d8f",
    emissiveIntensity: 0.03,
    metalness: 0.82,
    roughness: 0.1,
    clearcoat: 0.8,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.6,
  },
  {
    // Bottom-left — medium (muted ocean blue-grey / steel teal)
    // Tilted left for off-kilter effect
    position: [-0.5, -1.4, -0.3],
    rotation: [-0.2, 0.35, -0.3],
    scale: 0.85,
    floatSpeed: 0.6,
    floatIntensity: 0.9,
    rotationIntensity: 0.7,
    distort: 0.25,
    speed: 0.5,
    color: "#0b1118",
    emissive: "#2d6680",
    emissiveIntensity: 0.035,
    metalness: 0.68,
    roughness: 0.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
    envMapIntensity: 1.3,
  },
];

export function BlobHero() {
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render Canvas on client to prevent SSR hydration errors
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    // Hidden on mobile — completely removed from DOM to avoid clipping/overflow issues
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none hidden md:flex items-center justify-center">
      {/* High-fidelity Three.js canvas with 3 blobs — only rendered client-side */}
      {mounted && (
        <BlobErrorBoundary>
          <div
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <Canvas
              camera={{ position: [0, 0, 5.5], fov: 50 }}
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
                if (!gl.getContext()) {
                  console.warn("[BlobHero] WebGL context unavailable");
                }
              }}
            >
              <RendererConfig />

              {/* Ambient fill */}
              <ambientLight intensity={0.3} />

              {/* Key lights — warm and cool accents */}
              <directionalLight
                position={[10, 10, 5]}
                intensity={1.2}
                color="#c026d3"
              />
              <directionalLight
                position={[-10, -10, -5]}
                intensity={1.2}
                color="#4f46e5"
              />

              {/* Rim lights for edge definition — color-matched */}
              <pointLight
                position={[5, 2, -4]}
                intensity={0.6}
                color="#f87171"
                distance={18}
              />
              <pointLight
                position={[-5, 3, -3]}
                intensity={0.5}
                color="#a78bfa"
                distance={18}
              />
              <pointLight
                position={[-2, -4, -2]}
                intensity={0.5}
                color="#38bdf8"
                distance={18}
              />

              {/* Top fill for subtle highlight on crown */}
              <pointLight
                position={[0, 8, 3]}
                intensity={0.3}
                color="#ffffff"
                distance={25}
              />

              <Suspense fallback={null}>
                {/* Render all 3 blobs — only the first signals ready */}
                {BLOB_CONFIGS.map((config, i) => (
                  <ShinyBlob
                    key={i}
                    config={config}
                    onReady={i === 0 ? () => setReady(true) : undefined}
                  />
                ))}
                <Environment preset="city" />
              </Suspense>
            </Canvas>
          </div>
        </BlobErrorBoundary>
      )}
    </div>
  );
}
