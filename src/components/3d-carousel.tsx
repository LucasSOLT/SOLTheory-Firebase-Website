"use client";

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import type { ImagePlaceholder } from '@/lib/placeholder-images';

type ThreeDCarouselProps = {
  images: ImagePlaceholder[];
};

export function ThreeDCarousel({ images }: ThreeDCarouselProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const currentMount = mountRef.current;

    // Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    currentMount.appendChild(renderer.domElement);

    camera.position.z = 15;

    // Carousel group
    const carouselGroup = new THREE.Group();
    scene.add(carouselGroup);

    // Create image planes
    const textureLoader = new THREE.TextureLoader();
    const radius = 10;
    const angleStep = (Math.PI * 2) / images.length;

    images.forEach((image, index) => {
      const texture = textureLoader.load(image.imageUrl);
      const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      const geometry = new THREE.PlaneGeometry(6, 8); // Aspect ratio 3:4 from placeholder images
      const plane = new THREE.Mesh(geometry, material);

      const angle = index * angleStep;
      plane.position.x = radius * Math.sin(angle);
      plane.position.z = radius * Math.cos(angle);
      plane.lookAt(camera.position);

      carouselGroup.add(plane);
    });

    // Mouse movement
    const mouse = new THREE.Vector2();
    let targetRotation = 0;
    
    const onMouseMove = (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      targetRotation = mouse.x * Math.PI * 0.15;
    };
    window.addEventListener('mousemove', onMouseMove);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      // Lerp rotation for smooth effect
      carouselGroup.rotation.y += (targetRotation - carouselGroup.rotation.y) * 0.05;

      renderer.render(scene, camera);
    };
    animate();

    // Handle resize
    const onResize = () => {
      if (currentMount) {
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
      }
    };
    window.addEventListener('resize', onResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      if (currentMount) {
        currentMount.removeChild(renderer.domElement);
      }
      // Dispose of Three.js objects
      scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    };
  }, [images]);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
}
