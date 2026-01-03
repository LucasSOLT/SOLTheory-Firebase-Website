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

    camera.position.set(0, 5, 20);

    // Earth
    const textureLoader = new THREE.TextureLoader();
    const earthTexture = textureLoader.load('https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg');
    const earthGeometry = new THREE.SphereGeometry(10, 64, 64);
    const earthMaterial = new THREE.MeshStandardMaterial({ map: earthTexture });
    const earth = new THREE.Mesh(earthGeometry, earthMaterial);
    scene.add(earth);

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

    robot.position.set(0, 0, 15);
    scene.add(robot);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambientLight);
    
    const sunLight = new THREE.DirectionalLight(0xffffff, 4);
    sunLight.position.set(10, 10, 10);
    scene.add(sunLight);

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

        // Rotate Earth for effect
        earth.rotation.y += delta * 0.02;

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
