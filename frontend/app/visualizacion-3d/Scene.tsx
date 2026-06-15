"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

const NUM_ATTACKERS = 8;

/* Paletas duales — la escena se reconstruye cuando cambia isDark.
   Oscuro: ámbar/rojo brillante sobre negro, glow alto, estrellas blancas.
   Claro: tonos burnt (amber-800 / red-900) sobre papel, glow bajado,
   estrellas grises y shield más opaco para no perderse. Linear-style. */
const PALETTE_DARK = {
  ACCENT: 0xd18400,
  ALERT: 0xff4108,
  base: 0x18181b,
  stars: 0xffffff,
  starsOpacity: 0.85,
  gridSecondary: 0x27272a,
  shieldOpacity: 0.18,
  ambientIntensity: 0.35,
  dirIntensity: 0.6,
  emissiveIntensity: 0.25,
  attackerEmissive: 1.5,
} as const;

const PALETTE_LIGHT = {
  ACCENT: 0x92400e,        // amber-800
  ALERT: 0x7f1d1d,         // red-900
  base: 0x52525b,          // neutral-600 — silueta industrial sin ser negro
  stars: 0x71717a,         // zinc-500 — puntos grises tipo polvo
  starsOpacity: 0.4,
  gridSecondary: 0xd4d4d4, // neutral-300
  shieldOpacity: 0.35,     // ámbar muted necesita más opacidad sobre blanco
  ambientIntensity: 0.7,   // más luz general
  dirIntensity: 0.4,
  emissiveIntensity: 0.08, // glow casi imperceptible
  attackerEmissive: 0.5,
} as const;

export default function AttackScene({
  assetType = null,
  isDark = true,
}: {
  assetType?: "server" | "workstation" | "camera" | null;
  isDark?: boolean;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const P = isDark ? PALETTE_DARK : PALETTE_LIGHT;
    const ACCENT = P.ACCENT;
    const ALERT = P.ALERT;

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

    scene.add(new THREE.AmbientLight(0xffffff, P.ambientIntensity));
    const dir = new THREE.DirectionalLight(0xffffff, P.dirIntensity);
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
      color: P.stars,
      size: 0.06,
      transparent: true,
      opacity: P.starsOpacity,
    });
    scene.add(new THREE.Points(starsGeo, starsMat));

    // ---- Asset core (geometry driven by assetType prop) ----
    const serverGroup = new THREE.Group();
    scene.add(serverGroup);

    const baseMat = new THREE.MeshStandardMaterial({
      color: P.base,
      metalness: 0.85,
      roughness: 0.25,
      emissive: ACCENT,
      emissiveIntensity: P.emissiveIntensity,
    });
    const edgeMat = new THREE.LineBasicMaterial({ color: ACCENT });
    const glowMat = (opacity: number) =>
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity });

    if (assetType === "workstation") {
      // ── Secure Terminal / Workstation ──
      const screenGeo = new THREE.BoxGeometry(3.4, 2.1, 0.18);
      serverGroup.add(new THREE.Mesh(screenGeo, baseMat));
      serverGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(screenGeo), edgeMat));
      // Screen face glow
      const face = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 1.7), glowMat(0.22));
      face.position.set(0, 0, 0.1);
      serverGroup.add(face);
      // Stand column
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, 0.25), baseMat);
      stand.position.set(0, -1.6, 0);
      serverGroup.add(stand);
      // Base plate
      const baseGeo = new THREE.BoxGeometry(2.0, 0.12, 0.7);
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.set(0, -2.2, 0.2);
      serverGroup.add(base);
      serverGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(baseGeo), edgeMat));

    } else if (assetType === "camera") {
      // ── CCTV Hub / IP Camera ──
      const bodyGeo = new THREE.CylinderGeometry(0.55, 0.62, 2.4, 20);
      const bodyMesh = new THREE.Mesh(bodyGeo, baseMat);
      bodyMesh.rotation.z = Math.PI / 2;
      serverGroup.add(bodyMesh);
      serverGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), edgeMat));
      // Lens dome
      const lensGeo = new THREE.SphereGeometry(0.6, 20, 12, 0, Math.PI);
      const lens = new THREE.Mesh(
        lensGeo,
        new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.45, wireframe: true })
      );
      lens.rotation.z = -Math.PI / 2;
      lens.position.set(1.3, 0, 0);
      serverGroup.add(lens);
      // Lens cap ring
      const capGeo = new THREE.TorusGeometry(0.6, 0.06, 8, 24);
      const cap = new THREE.Mesh(capGeo, new THREE.MeshBasicMaterial({ color: ACCENT }));
      cap.rotation.z = Math.PI / 2;
      cap.position.set(1.28, 0, 0);
      serverGroup.add(cap);
      // Mount bracket
      const mountGeo = new THREE.BoxGeometry(0.5, 1.3, 0.12);
      const mount = new THREE.Mesh(mountGeo, baseMat);
      mount.position.set(0, -1.0, 0);
      serverGroup.add(mount);
      serverGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(mountGeo), edgeMat));

    } else {
      // ── Default: Central Rack / Server ──
      const boxGeo = new THREE.BoxGeometry(2.2, 3, 2.2);
      serverGroup.add(new THREE.Mesh(boxGeo, baseMat));
      serverGroup.add(new THREE.LineSegments(new THREE.EdgesGeometry(boxGeo), edgeMat));
      // Rack panel LEDs
      [-1, -0.2, 0.6].forEach((y) => {
        const panel = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), glowMat(0.35));
        panel.position.set(0, y, 1.11);
        serverGroup.add(panel);
      });
    }

    const corePoint = new THREE.PointLight(ACCENT, 2.5, 6);
    serverGroup.add(corePoint);

    // ---- Shield ----
    const shield = new THREE.Mesh(
      new THREE.SphereGeometry(3.2, 48, 48),
      new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: P.shieldOpacity,
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
          emissiveIntensity: P.attackerEmissive,
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
    const grid = new THREE.GridHelper(40, 40, ACCENT, P.gridSecondary);
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
  }, [assetType, isDark]);

  return (
    <div
      ref={mountRef}
      className="h-full w-full"
      style={{ touchAction: "none", cursor: "grab" }}
    />
  );
}
