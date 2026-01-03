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

        // Spaceship
        const shipGroup = new THREE.Group();

        const bodyGeometry = new THREE.ConeGeometry(0.5, 2, 32);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 80 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.x = Math.PI / 2;
        shipGroup.add(body);

        const cockpitGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const cockpitMaterial = new THREE.MeshPhongMaterial({ color: 0x4d5ca3, shininess: 100, transparent: true, opacity: 0.8 });
        const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
        cockpit.position.y = 0.5;
        shipGroup.add(cockpit);

        const wingGeometry = new THREE.BoxGeometry(2.5, 0.1, 1);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, shininess: 50 });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-1, -0.3, 0);
        shipGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(1, -0.3, 0);
        shipGroup.add(rightWing);
        
        scene.add(shipGroup);
        shipGroup.rotation.y = -Math.PI / 8;
        shipGroup.rotation.x = -Math.PI / 12;

        // Stars
        const starsGeometry = new THREE.BufferGeometry();
        const starsMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.02 });
        const starVertices = [];
        for (let i = 0; i < 10000; i++) {
            const x = (Math.random() - 0.5) * 2000;
            const y = (Math.random() - 0.5) * 2000;
            const z = (Math.random() - 0.5) * 2000;
            if (x*x + y*y + z*z > 100*100) { // only add stars outside a certain radius to avoid them being inside the scene
                starVertices.push(x, y, z);
            }
        }
        starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
        const stars = new THREE.Points(starsGeometry, starsMaterial);
        scene.add(stars);


        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 2);
        scene.add(ambientLight);

        const pointLight = new THREE.PointLight(0xffffff, 1.5, 100);
        pointLight.position.set(5, 5, 5);
        scene.add(pointLight);
        
        const pointLight2 = new THREE.PointLight(0xaaaaff, 1, 100);
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

            const elapsedTime = clock.getElapsedTime();

            // floating animation
            shipGroup.position.y = Math.sin(elapsedTime * 0.5) * 0.2;
            shipGroup.position.x = Math.sin(elapsedTime * 0.3) * 0.1;

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
            mountRef.current?.removeChild(renderer.domElement);
        };
    }, []);

    return <div ref={mountRef} className="absolute inset-0 z-0 opacity-50" />;
};

export default InteractiveSpaceship;
