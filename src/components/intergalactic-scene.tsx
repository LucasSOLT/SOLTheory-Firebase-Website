"use client";

import { useRef, useEffect } from 'react';
import * as THREE from 'three';

export function IntergalacticScene() {
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

    camera.position.z = 5;

    // Starfield
    const starVertices = [];
    for (let i = 0; i < 10000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 0.5) * 2000;
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Robot model (simple representation)
    const robot = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.4 });
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x833ab4 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), bodyMaterial);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), bodyMaterial);
    head.position.y = 0.6;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMaterial);
    eye.position.set(0, 0.65, 0.25);

    robot.add(body);
    robot.add(head);
    robot.add(eye);
    scene.add(robot);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    // Controls
    const keys: { [key: string]: boolean } = {};
    const onKeyDown = (event: KeyboardEvent) => { keys[event.code] = true; };
    const onKeyUp = (event: KeyboardEvent) => { keys[event.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const moveSpeed = 0.1;
    const rotationSpeed = 0.05;

    // Animation loop
    const animate = () => {
        requestAnimationFrame(animate);

        // Robot movement
        if (keys['KeyW'] || keys['ArrowUp']) robot.translateZ(-moveSpeed);
        if (keys['KeyS'] || keys['ArrowDown']) robot.translateZ(moveSpeed);
        if (keys['KeyA'] || keys['ArrowLeft']) robot.rotateY(rotationSpeed);
        if (keys['KeyD'] || keys['ArrowRight']) robot.rotateY(-rotationSpeed);

        // Camera follows robot
        const robotPosition = new THREE.Vector3();
        robot.getWorldPosition(robotPosition);
        const cameraOffset = new THREE.Vector3(0, 2, 5);
        const cameraPosition = cameraOffset.applyMatrix4(robot.matrixWorld);
        
        camera.position.lerp(cameraPosition, 0.1);
        camera.lookAt(robotPosition);

        // Rotate stars
        stars.rotation.x += 0.0001;
        stars.rotation.y += 0.0001;

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
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        if (currentMount) {
            currentMount.removeChild(renderer.domElement);
        }
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
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0" />;
}
