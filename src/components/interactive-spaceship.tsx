"use client";

import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

const InteractiveSpaceship: React.FC = () => {
    const mountRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!mountRef.current) return;

        // Scene
        const scene = new THREE.Scene();

        // Camera
        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 5;

        // Renderer
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);
        mountRef.current.appendChild(renderer.domElement);

        // Stars
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ 
            color: 0xffffff, 
            size: 0.08, 
            opacity: 0.9, 
            transparent: true,
            vertexColors: true
        });

        const starVertices = [];
        const starColors = [];
        const color = new THREE.Color();

        for (let i = 0; i < 40000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            if (x*x + y*y + z*z > 100*100) { // only add stars outside a certain radius
                starVertices.push(x, y, z);
                // Assign a color: mostly white, with some violet/blue
                if (Math.random() > 0.9) {
                    color.set(Math.random() > 0.5 ? 0xaa88ff : 0x88aaff);
                } else {
                    color.set(0xffffff);
                }
                starColors.push(color.r, color.g, color.b);
            }
        }
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        starsGeometry.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));

        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);


        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xaa88ff, 1, 100);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
        
        const pointLight2 = new THREE.PointLight(0x88aaff, 0.8, 100);
        pointLight2.position.set(-10, -5, -2);
        scene.add(pointLight2);

        // Mouse movement
        let mouseX = 0, mouseY = 0;
        const handleMouseMove = (event: MouseEvent) => {
            mouseX = (event.clientX - window.innerWidth / 2) / (window.innerWidth / 2);
            mouseY = (event.clientY - window.innerHeight / 2) / (window.innerHeight / 2);
        };
        document.addEventListener('mousemove', handleMouseMove);


        // Animation
        const clock = new THREE.Clock();
        const animate = () => {
            requestAnimationFrame(animate);

            // star movement
            stars.rotation.y += 0.0001;
            stars.rotation.x += 0.0001;

            // mouse follow
            camera.position.x += (mouseX * 2 - camera.position.x) * 0.02;
            camera.position.y += (-mouseY * 2 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);


            renderer.render(scene, camera);
        };
        animate();

        // Handle window resize
        const handleResize = () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        };
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('mousemove', handleMouseMove);
            if (mountRef.current && renderer.domElement) {
                mountRef.current.removeChild(renderer.domElement);
            }
        };
    }, []);

    return <div ref={mountRef} className="fixed inset-0 z-[-1]" />;
};

export default InteractiveSpaceship;
