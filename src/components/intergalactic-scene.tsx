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
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 2000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    currentMount.appendChild(renderer.domElement);

    camera.position.set(0, 2, 8);

    // Starfield
    const starVertices = [];
    for (let i = 0; i < 15000; i++) {
        const x = (Math.random() - 0.5) * 2000;
        const y = (Math.random() - 0.5) * 2000;
        const z = (Math.random() - 2) * 1000;
        starVertices.push(x, y, z);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starVertices, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.2 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // Robot model
    const robot = new THREE.Group();
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.2 });
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x833ab4, emissive: 0x833ab4, emissiveIntensity: 2 });
    
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 32), bodyMaterial);
    robot.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 32, 32), bodyMaterial);
    head.position.y = 0.6;
    robot.add(head);
    
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), eyeMaterial);
    eye.position.set(0, 0.65, 0.25);
    robot.add(eye);

    scene.add(robot);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 2);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0xffffff, 2, 100);
    pointLight.position.set(2, 4, 6);
    scene.add(pointLight);

    const eyeLight = new THREE.PointLight(0x833ab4, 5, 5);
    eye.add(eyeLight);

    // Controls
    const keys: { [key: string]: boolean } = {};
    const onKeyDown = (event: KeyboardEvent) => { keys[event.code] = true; };
    const onKeyUp = (event: KeyboardEvent) => { keys[event.code] = false; };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    const moveSpeed = 0.15;
    const rotationSpeed = 0.05;

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
        requestAnimationFrame(animate);
        const delta = clock.getDelta();

        // Robot movement
        if (keys['KeyW'] || keys['ArrowUp']) robot.translateZ(-moveSpeed);
        if (keys['KeyS'] || keys['ArrowDown']) robot.translateZ(moveSpeed);
        if (keys['KeyA'] || keys['ArrowLeft']) robot.rotateY(rotationSpeed);
        if (keys['KeyD'] || keys['ArrowRight']) robot.rotateY(-rotationSpeed);

        // Floating animation
        robot.position.y = Math.sin(clock.getElapsedTime() * 0.5) * 0.1;

        // Camera follows robot smoothly
        const robotPosition = new THREE.Vector3();
        robot.getWorldPosition(robotPosition);
        
        const cameraOffset = new THREE.Vector3(0, 2, 6);
        cameraOffset.applyQuaternion(robot.quaternion);
        const cameraPosition = robotPosition.clone().add(cameraOffset);
        
        camera.position.lerp(cameraPosition, 0.05);
        camera.lookAt(robotPosition);

        // Rotate stars for parallax effect
        stars.position.z += delta * 0.5;
        if(stars.position.z > 500) stars.position.z = -500;

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
        if (currentMount && renderer.domElement) {
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
