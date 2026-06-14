"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const ACCENT = 0xd18400;
const ALERT = 0xff4108;
const NUM_ATTACKERS = 8;

export default function AttackScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      50,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200
    );
    const camRadius = 14;
    let camTheta = Math.PI / 4;
    let camPhi = Math.PI / 3;
    let camDistance = camRadius;
    const updateCamera = () => {
      camera.position.x = camDistance * Math.sin(camPhi) * Math.cos(camTheta);
      camera.position.y = camDistance * Math.cos(camPhi);
      camera.position.z = camDistance * Math.sin(camPhi) * Math.sin(camTheta);
      camera.lookAt(0, 0, 0);
    };
    updateCamera();

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const dir = new THREE.DirectionalLight(0xffffff, 0.6);
    dir.position.set(5, 8, 5);
    scene.add(dir);

    // ---- Stars ----
    const starsGeo = new THREE.BufferGeometry();
    const starsCount = 2500;
    const starsPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount; i++) {
      const r = 40 + Math.random() * 40;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starsPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starsPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      starsPos[i * 3 + 2] = r * Math.cos(phi);
    }
    starsGeo.setAttribute("position", new THREE.BufferAttribute(starsPos, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.06,
      transparent: true,
      opacity: 0.85,
    });
    scene.add(new THREE.Points(starsGeo, starsMat));

    // ---- Server core ----
    const serverGroup = new THREE.Group();
    scene.add(serverGroup);

    const boxGeo = new THREE.BoxGeometry(2.2, 3, 2.2);
    const boxMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.85,
      roughness: 0.25,
      emissive: ACCENT,
      emissiveIntensity: 0.25,
    });
    serverGroup.add(new THREE.Mesh(boxGeo, boxMat));

    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(boxGeo),
      new THREE.LineBasicMaterial({ color: ACCENT })
    );
    serverGroup.add(edges);

    [-1, -0.2, 0.6].forEach((y) => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.4),
        new THREE.MeshBasicMaterial({
          color: ACCENT,
          transparent: true,
          opacity: 0.35,
        })
      );
      panel.position.set(0, y, 1.11);
      serverGroup.add(panel);
    });

    const corePoint = new THREE.PointLight(ACCENT, 2.5, 6);
    serverGroup.add(corePoint);

    // ---- Shield ----
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 48, 48),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.18,
        wireframe: true,
      })
    );
    scene.add(shield);

    // ---- Attackers ----
    type AttackerData = {
      node: THREE.Mesh;
      light: THREE.PointLight;
      beam: THREE.Mesh;
      impact: THREE.Mesh;
      direction: THREE.Vector3;
      length: number;
      phase: number;
      origin: THREE.Vector3;
    };
    const attackers: AttackerData[] = [];
    const attackerDistance = 8;

    for (let i = 0; i < NUM_ATTACKERS; i++) {
      const angleY = (i / NUM_ATTACKERS) * Math.PI * 2;
      const angleX = (i % 2 === 0 ? 1 : -1) * (Math.PI / 8) + (i / NUM_ATTACKERS) * 0.3;
      const origin = new THREE.Vector3(
        attackerDistance * Math.cos(angleY) * Math.cos(angleX),
        attackerDistance * Math.sin(angleX),
        attackerDistance * Math.sin(angleY) * Math.cos(angleX)
      );

      const node = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshStandardMaterial({
          color: ALERT,
          emissive: ALERT,
          emissiveIntensity: 1.5,
          metalness: 0.4,
          roughness: 0.35,
        })
      );
      node.position.copy(origin);
      scene.add(node);

      const light = new THREE.PointLight(ALERT, 0.8, 3);
      light.position.copy(origin);
      scene.add(light);

      const direction = origin.clone().normalize();
      const length = origin.length();

      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.025, length, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: ALERT, transparent: true, opacity: 0 })
      );
      const midpoint = direction.clone().multiplyScalar(length / 2);
      beam.position.copy(midpoint);
      beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
      scene.add(beam);

      const impact = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 16, 16),
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 })
      );
      scene.add(impact);

      attackers.push({
        node,
        light,
        beam,
        impact,
        direction,
        length,
        phase: i * 0.8,
        origin,
      });
    }

    // ---- Ground grid ----
    const grid = new THREE.GridHelper(40, 40, ACCENT, 0x27272a);
    grid.position.y = -3.5;
    scene.add(grid);

    // ---- Interaction: drag rotate + wheel zoom ----
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      camTheta -= dx * 0.005;
      camPhi = Math.max(0.2, Math.min(Math.PI - 0.2, camPhi - dy * 0.005));
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {}
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      camDistance = Math.max(8, Math.min(20, camDistance + e.deltaY * 0.01));
    };
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    // ---- Resize ----
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // ---- Animation loop ----
    const clock = new THREE.Clock();
    let frameId = 0;
    const animate = () => {
      const t = clock.getElapsedTime();

      serverGroup.rotation.y = t * 0.35;

      const shieldPulse = 1 + Math.sin(t * 2) * 0.06;
      shield.scale.setScalar(shieldPulse);
      (shield.material as THREE.MeshBasicMaterial).opacity = 0.15 + Math.sin(t * 2) * 0.05;

      attackers.forEach((a) => {
        const localT = t + a.phase;
        const pulse = (Math.sin(localT * 1.8) + 1) / 2;
        const active = pulse > 0.55;

        const float = Math.sin(localT * 1.4) * 0.25;
        a.node.position.set(
          a.origin.x + Math.sin(localT * 0.8) * 0.15,
          a.origin.y + float,
          a.origin.z + Math.cos(localT * 0.8) * 0.15
        );
        a.node.rotation.x = localT * 1.2;
        a.node.rotation.y = localT * 0.9;
        a.light.position.copy(a.node.position);

        (a.beam.material as THREE.MeshBasicMaterial).opacity = active ? 0.65 * pulse : 0;

        const impactScale = active ? 0.4 + pulse * 0.6 : 0.001;
        a.impact.scale.setScalar(impactScale);
        (a.impact.material as THREE.MeshBasicMaterial).opacity = active ? pulse : 0;
      });

      if (!dragging) {
        camTheta += 0.0015;
      }
      updateCamera();

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    // ---- Cleanup ----
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointercancel", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry?.dispose();
        const m = (obj as THREE.Mesh).material as
          | THREE.Material
          | THREE.Material[]
          | undefined;
        if (Array.isArray(m)) m.forEach((mat) => mat.dispose());
        else m?.dispose();
      });
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="h-full w-full"
      style={{ touchAction: "none", cursor: "grab" }}
    />
  );
}
