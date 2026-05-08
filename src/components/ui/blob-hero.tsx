"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, MeshDistortMaterial, Float, ContactShadows } from "@react-three/drei";
import { Suspense, useRef, useState, useEffect } from "react";
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
    const targetX = state.pointer.y * 0.5;
    const targetY = state.pointer.x * 0.5;
    meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetX, 0.05);
    meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetY, 0.05);
  });

  return (
    <Float speed={1.5} rotationIntensity={1.5} floatIntensity={2}>
      <mesh ref={meshRef} scale={1.8}>
        {/* Max subdivision for ultra-smooth surface */}
        <icosahedronGeometry args={[1, 512]} />
        <MeshDistortMaterial
          color="#080810"
          envMapIntensity={3}
          clearcoat={1}
          clearcoatRoughness={0.02}
          metalness={0.95}
          roughness={0.02}
          distort={0.4}
          speed={2}
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

export function BlobHero() {
  const [ready, setReady] = useState(false);

  return (
    <div className="absolute inset-0 w-full h-full z-0 pointer-events-none">
      {/* CSS placeholder shown instantly while Three.js loads */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-700"
        style={{ opacity: ready ? 0 : 1, pointerEvents: 'none' }}
      >
        <div
          className="rounded-full"
          style={{
            width: '280px',
            height: '280px',
            background: 'radial-gradient(circle at 38% 38%, #1a1a2e 0%, #0a0a0b 55%, #000 100%)',
            boxShadow: '0 0 80px 20px rgba(192,38,211,0.08), 0 0 120px 40px rgba(79,70,229,0.06)',
            filter: 'blur(1px)',
          }}
        />
      </div>

      {/* High-fidelity Three.js canvas */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      >
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[2, 4]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            stencil: false,
            depth: true,
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
            <ContactShadows position={[0, -2.5, 0]} opacity={0.4} scale={10} blur={2.5} far={4} color="#c026d3" />
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
