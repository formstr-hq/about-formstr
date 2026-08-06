import { useRef, useMemo, useEffect, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  MeshTransmissionMaterial,
  useGLTF,
  useAnimations,
  ContactShadows,
  Text3D,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { smoothstep, band, clamp01 } from "./useHeroScroll";

/* ------------------------------------------------------------------ */
/* Brand palette + constants                                           */
/* ------------------------------------------------------------------ */

const BRAND = {
  orange: "#ff5c00",
  orangeLight: "#ff8a00",
  amber: "#ffb020",
  coldBlue: "#4a6fa5",
};

const APPS = [
  { id: "formstr", name: "Formstr", color: "#ff5c00" },
  { id: "pages", name: "Pages", color: "#10b981" },
  { id: "pollerama", name: "Pollerama", color: "#f43f5e" },
  { id: "drive", name: "Drive", color: "#8b5cf6" },
  { id: "calendar", name: "Calendar", color: "#3b82f6" },
];

const GROUND = -1.5;
const ROBOT_URL = "/RobotExpressive.glb";
const FONT_URL = "/fonts/brand.typeface.json";
useGLTF.preload(ROBOT_URL);

// Coarse-pointer / small-screen device (the HeroScene chunk is client-only, so
// window is available). Drives touch/perf tweaks: no cursor parallax, lighter
// shadows/transmission, and a pulled-back camera for portrait framing.
const IS_MOBILE =
  typeof window !== "undefined" &&
  (window.matchMedia?.("(pointer: coarse)").matches || window.innerWidth < 820);

// Celebration = a disco "point": one arm up to the sky, the other low and
// across — an unmistakable, joyful pose (rig axes: Z abducts out to the side,
// X flexes forward toward the camera). Live-tunable via window.__pose.
const POSE = {
  upZ: -2.4, // raised arm: up-and-out toward the sky, tilted forward to clear
  upX: 1.3, //  the dome so it reads clearly
  dnZ: 0.5, // lowered arm: down-and-out (the low diagonal)
  dnX: 0.2,
  upBend: 0.06, // raised forearm nearly straight → a clean "point"
  dnBend: 0.95, // lowered forearm bent toward the hip
};

// Debug: load with #posecheck to freeze the celebration (no orbs, no jump,
// held at full raise) so the arm pose can be inspected cleanly; also exposes
// window.__pose for live tuning in the console.
const DEBUG_POSE =
  typeof window !== "undefined" && window.location.hash.includes("posecheck");
if (DEBUG_POSE) {
  (window as unknown as { __pose: typeof POSE }).__pose = POSE;
}

/* ================================================================== */
/* The subject — a rigged robot that sits trapped, then walks free    */
/* and celebrates. Animation state is driven by scroll progress.      */
/* ================================================================== */

function RobotCharacter({
  progressRef,
  pointerRef,
}: {
  progressRef: { current: number };
  pointerRef: { current: { x: number; y: number } };
}) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(ROBOT_URL);
  const { actions } = useAnimations(animations, group);
  const currentClip = useRef<string>("");

  // Give the robot's materials a little environment response so it reads
  // as a polished product render rather than flat plastic.
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false;
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat && "envMapIntensity" in mat) {
          mat.envMapIntensity = 1.1;
        }
      }
    });
  }, [scene]);

  const fadeTo = useCallback(
    (name: string) => {
      if (currentClip.current === name) return;
      const next = actions[name];
      if (!next) return;
      const prev = currentClip.current ? actions[currentClip.current] : null;
      next.reset().setEffectiveWeight(1).fadeIn(0.4).play();
      if (prev) prev.fadeOut(0.4);
      currentClip.current = name;
    },
    [actions],
  );

  // Continuity of the pacing motion into the walk-out.
  const paceX = useRef(0);
  const paceYaw = useRef(Math.PI / 2);
  // Upper/lower arm bones, posed manually for the sustained "hands up" finish.
  const armL = useRef<THREE.Object3D | null>(null);
  const armR = useRef<THREE.Object3D | null>(null);
  const foreL = useRef<THREE.Object3D | null>(null);
  const foreR = useRef<THREE.Object3D | null>(null);
  const head = useRef<THREE.Object3D | null>(null);
  // Head-follow spring state.
  const headYaw = useRef(0);
  const headYawV = useRef(0);
  const headPitch = useRef(0);
  const headPitchV = useRef(0);

  useEffect(() => {
    // GLTFLoader strips dots from node names, so "UpperArm.L" → "UpperArmL".
    scene.traverse((o) => {
      const n = o.name;
      const bone = o as THREE.Bone;
      if (/upperarm/i.test(n)) {
        if (/l$/i.test(n)) armL.current = o;
        else if (/r$/i.test(n)) armR.current = o;
      } else if (/lowerarm/i.test(n)) {
        if (/l$/i.test(n)) foreL.current = o;
        else if (/r$/i.test(n)) foreR.current = o;
      } else if (n === "Head" && bone.isBone) {
        head.current = o;
      }
    });
  }, [scene]);

  // Start pacing the moment the clips are ready.
  useEffect(() => {
    if (actions["Walking"]) {
      actions["Walking"].play();
      currentClip.current = "Walking";
    }
  }, [actions]);

  useFrame((state) => {
    const p = progressRef.current;
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    const celebrating = p >= 0.7;

    if (p < 0.47) {
      // ---- Act 1: pacing back and forth in the cell ----
      fadeTo("Walking");
      const x = Math.sin(t * 0.8) * 0.82;
      const dir = Math.cos(t * 0.8); // +ve = moving right
      // forward(yaw) = (sinΘ, 0, cosΘ); yaw 0 faces the camera. ±0.9 keeps
      // forward.z > 0 (facing us) while forward.x matches the walk direction.
      const yaw = dir >= 0 ? 0.9 : -0.9;
      paceX.current = x;
      paceYaw.current = yaw;
      g.position.set(x, GROUND, 0.4);
      g.rotation.y = yaw;
    } else {
      // ---- freed: turn, walk out to centre-front, then celebrate ----
      const out = smoothstep(0.5, 0.8, p);
      // Idle base under the celebration so the raised-arm pose reads as a
      // held cheer rather than a frozen dance frame.
      fadeTo(celebrating ? "Idle" : "Walking");
      // A little celebratory hop: lifts off, then rests on the ground between
      // jumps (max(0, sin) gives the pause; the rest of the cycle is grounded).
      const hop =
        celebrating && !DEBUG_POSE ? Math.max(0, Math.sin(t * 3.0)) * 0.22 : 0;
      g.position.set(
        THREE.MathUtils.lerp(paceX.current, 0, out),
        GROUND + hop,
        THREE.MathUtils.lerp(0.4, 1.15, out),
      );
      // Turn to face the camera (yaw 0) as it walks out.
      g.rotation.y = THREE.MathUtils.lerp(
        paceYaw.current,
        0,
        smoothstep(0.47, 0.64, p),
      );
    }

    // Override the arms only while celebrating (raise > 0), so the Walking/
    // Idle clips still drive them the rest of the time. This runs after
    // drei's mixer update, so it blends from the live clip pose toward a
    // clean overhead cheer: upper arms up-and-out, forearms straightened.
    const raise = smoothstep(0.72, 0.84, p);
    if (raise > 0.001) {
      const L = THREE.MathUtils.lerp;
      const sway = Math.sin(t * 2.4) * 0.06; // gentle life in the held pose
      // Disco point: robot's RIGHT arm (armR) up to the sky, LEFT arm (armL)
      // low across the body. Blended from the live Idle pose so it eases in.
      if (armR.current) {
        const r = armR.current.rotation;
        r.z = L(r.z, POSE.upZ - sway, raise);
        r.x = L(r.x, POSE.upX, raise);
        r.y = L(r.y, 0, raise);
      }
      if (armL.current) {
        const r = armL.current.rotation;
        r.z = L(r.z, POSE.dnZ, raise);
        r.x = L(r.x, POSE.dnX, raise);
        r.y = L(r.y, 0, raise);
      }
      // raised forearm nearly straight (a clean point); lowered forearm bent in
      if (foreR.current) foreR.current.rotation.set(L(0, POSE.upBend, raise), 0, 0);
      if (foreL.current) foreL.current.rotation.set(L(0, POSE.dnBend, raise), 0, 0);
    }

    // Head follows the cursor via an under-damped spring: controllable, but
    // with a little playful overshoot/wobble. Absolute (no accumulation).
    if (head.current && p >= 0.6) {
      const ptr = pointerRef.current;
      // Desktop follows the cursor; mobile has no cursor, so the head does a
      // gentle autonomous "looking around" sway instead of chasing touch.
      const ty = IS_MOBILE ? Math.sin(t * 0.7) * 0.28 : ptr.x * 0.5;
      const tx = IS_MOBILE ? Math.sin(t * 0.9) * 0.1 : -ptr.y * 0.28;
      headYawV.current = (headYawV.current + (ty - headYaw.current) * 0.14) * 0.78;
      headYaw.current += headYawV.current;
      headPitchV.current =
        (headPitchV.current + (tx - headPitch.current) * 0.14) * 0.78;
      headPitch.current += headPitchV.current;
      head.current.rotation.y = headYaw.current;
      head.current.rotation.x = headPitch.current;
      head.current.rotation.z = Math.sin(t * 1.7) * 0.04; // gentle idle tilt
    }
  });

  return <primitive ref={group} object={scene} scale={0.46} />;
}

/* ================================================================== */
/* The monitor running "Prison Docs" — the subject's work, held        */
/* hostage. Stands at the back of the cell, screen facing the camera.  */
/* ================================================================== */

const WARN = "#ff4d2e"; // "compromised" warning red-orange

function CompromisedScreen({ progress }: { progress: number }) {
  const glow = band(-1, 0, 0.42, 0.52, progress); // on while trapped
  const visible = 1 - smoothstep(0.58, 0.72, progress); // powers off as robot exits
  if (visible < 0.02) return null;

  const SCREEN_W = 1.9;
  const SCREEN_H = 1.15;
  const cy = 1.62; // screen centre height above GROUND
  const zface = 0.03; // just in front of the panel

  // three faux document rows, each padlocked
  const rows = [0.02, -0.22, -0.46];

  return (
    <group position={[0, GROUND, -0.4]} scale={[1, visible, 1]}>
      {/* stand */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 1.0, 16]} />
        <meshStandardMaterial color="#0f1319" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.34, 0.34, 0.05, 24]} />
        <meshStandardMaterial color="#0f1319" metalness={0.8} roughness={0.4} />
      </mesh>
      {/* bezel */}
      <mesh position={[0, cy, -0.04]} castShadow>
        <boxGeometry args={[SCREEN_W + 0.12, SCREEN_H + 0.12, 0.08]} />
        <meshPhysicalMaterial
          color="#0b0e13"
          metalness={0.85}
          roughness={0.3}
          clearcoat={0.8}
          envMapIntensity={1.1}
        />
      </mesh>
      {/* screen panel */}
      <mesh position={[0, cy, 0]}>
        <planeGeometry args={[SCREEN_W, SCREEN_H]} />
        <meshStandardMaterial
          color="#0a0e15"
          emissive="#0a0e15"
          emissiveIntensity={0.5 * glow}
          roughness={0.4}
        />
      </mesh>

      {/* ---- app UI ---- */}
      {/* title bar */}
      <mesh position={[0, cy + SCREEN_H / 2 - 0.16, zface - 0.005]}>
        <planeGeometry args={[SCREEN_W - 0.12, 0.22]} />
        <meshStandardMaterial
          color="#150a08"
          emissive={WARN}
          emissiveIntensity={0.28 * glow}
        />
      </mesh>
      {/* warning dot on the title bar */}
      <mesh position={[-SCREEN_W / 2 + 0.18, cy + SCREEN_H / 2 - 0.16, zface]}>
        <circleGeometry args={[0.045, 20]} />
        <meshStandardMaterial color={WARN} emissive={WARN} emissiveIntensity={1.6 * glow} />
      </mesh>
      {/* app name */}
      <group position={[-SCREEN_W / 2 + 0.32, cy + SCREEN_H / 2 - 0.225, zface]}>
        <Text3D font={FONT_URL} size={0.13} height={0.01} curveSegments={4}>
          Prison Docs
          <meshStandardMaterial color="#ffd9cf" emissive={WARN} emissiveIntensity={0.9 * glow} />
        </Text3D>
      </group>

      {/* document rows, each locked */}
      {rows.map((ry, i) => (
        <group key={i} position={[0, cy + ry, zface]}>
          {/* padlock chip */}
          <mesh position={[-SCREEN_W / 2 + 0.22, 0, 0]}>
            <planeGeometry args={[0.14, 0.14]} />
            <meshStandardMaterial color={WARN} emissive={WARN} emissiveIntensity={1.1 * glow} />
          </mesh>
          {/* doc title line */}
          <mesh position={[0.08, 0.03, 0]}>
            <planeGeometry args={[SCREEN_W - 0.7, 0.05]} />
            <meshStandardMaterial color="#5b6472" emissive="#5b6472" emissiveIntensity={0.5 * glow} />
          </mesh>
          {/* doc sub line */}
          <mesh position={[-0.06, -0.06, 0]}>
            <planeGeometry args={[SCREEN_W - 1.0, 0.04]} />
            <meshStandardMaterial color="#39404c" emissive="#39404c" emissiveIntensity={0.4 * glow} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ================================================================== */
/* The cage — bars in a ring with a door that the key swings open     */
/* ================================================================== */

const CAGE_RADIUS = 1.4;
const CAGE_BARS = 14;
const CAGE_DOOR_BARS = 4;
const CAGE_H = 2.0;

function CageBarMaterial({ opacity }: { opacity: number }) {
  return (
    <meshPhysicalMaterial
      color="#c2cede"
      metalness={1}
      roughness={0.22}
      clearcoat={1}
      envMapIntensity={1.5}
      transparent
      opacity={opacity}
    />
  );
}

function Cage({ progress }: { progress: number }) {
  // The cage exists in act 1, the door swings once the key turns (act 2),
  // then the whole cage sinks/fades as the subject walks free (act 3).
  const visible = 1 - smoothstep(0.62, 0.78, progress);
  const opacity = visible * 0.96;
  const doorOpen = smoothstep(0.44, 0.58, progress);
  const sink = (1 - visible) * 0.4;

  const barGeo = useMemo(
    () => new THREE.CylinderGeometry(0.03, 0.03, CAGE_H, 10),
    [],
  );

  const { fixed, door, hinge } = useMemo(() => {
    const fixedBars: [number, number, number][] = [];
    const doorBars: [number, number, number][] = [];
    for (let i = 0; i < CAGE_BARS; i++) {
      const a = (i / CAGE_BARS) * Math.PI * 2;
      // centre the door wedge around +Z (a ≈ PI/2), facing the camera
      const frontDelta = Math.abs(
        ((a - Math.PI / 2 + Math.PI) % (Math.PI * 2)) - Math.PI,
      );
      const pos: [number, number, number] = [
        Math.cos(a) * CAGE_RADIUS,
        0,
        Math.sin(a) * CAGE_RADIUS,
      ];
      if (frontDelta < (CAGE_DOOR_BARS / CAGE_BARS) * Math.PI)
        doorBars.push(pos);
      else fixedBars.push(pos);
    }
    // hinge at one edge of the door wedge so it swings outward
    const hingeAngle = Math.PI / 2 - (CAGE_DOOR_BARS / CAGE_BARS) * Math.PI;
    const h: [number, number, number] = [
      Math.cos(hingeAngle) * CAGE_RADIUS,
      0,
      Math.sin(hingeAngle) * CAGE_RADIUS,
    ];
    return { fixed: fixedBars, door: doorBars, hinge: h };
  }, []);

  if (visible < 0.02) return null;

  const rings = [-0.85, -0.28, 0.28, 0.85];

  return (
    <group position={[0, GROUND + CAGE_H / 2 - sink, 0.2]}>
      {fixed.map((b, i) => (
        <mesh key={i} geometry={barGeo} position={b}>
          <CageBarMaterial opacity={opacity} />
        </mesh>
      ))}
      {rings.map((y) => (
        <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[CAGE_RADIUS, 0.025, 10, 48]} />
          <CageBarMaterial opacity={opacity} />
        </mesh>
      ))}
      {/* swinging door — hinged group rotates open as the key turns */}
      <group position={hinge} rotation={[0, -doorOpen * Math.PI * 0.75, 0]}>
        {door.map((b, i) => (
          <mesh
            key={i}
            geometry={barGeo}
            position={[b[0] - hinge[0], b[1] - hinge[1], b[2] - hinge[2]]}
          >
            <CageBarMaterial opacity={opacity} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ================================================================== */
/* ACT 1 — cold glass towers as the "rented" backdrop                 */
/* ================================================================== */

function GlassTower({
  position,
  height,
  act1,
}: {
  position: [number, number, number];
  height: number;
  act1: number;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.7, height, 0.7]} />
        <meshPhysicalMaterial
          color="#10151d"
          roughness={0.08}
          metalness={0.95}
          clearcoat={1}
          clearcoatRoughness={0.1}
          envMapIntensity={1.2}
          transparent
          opacity={0.9 * act1}
        />
      </mesh>
      <mesh position={[0, 0, 0.361]}>
        <planeGeometry args={[0.66, height * 0.96]} />
        <meshStandardMaterial
          color={BRAND.coldBlue}
          emissive={BRAND.coldBlue}
          emissiveIntensity={0.4 * act1}
          transparent
          opacity={0.4 * act1}
          roughness={0.4}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(0.7, height, 0.7)]} />
        <lineBasicMaterial color="#7fa3d4" transparent opacity={0.45 * act1} />
      </lineSegments>
    </group>
  );
}

function Act1Backdrop({ progress }: { progress: number }) {
  const act1 = band(-1, 0, 0.4, 0.5, progress);
  const towers = useMemo(
    () =>
      [
        { pos: [-4.6, -1, -4], h: 6.5 },
        { pos: [4.6, -0.5, -4.5], h: 7.5 },
        { pos: [-3.6, -1.5, -1.5], h: 5 },
        { pos: [3.8, -1.2, -1.8], h: 5.5 },
        { pos: [-6, -0.8, -2], h: 6.4 },
        { pos: [6, -1.4, -2], h: 4.8 },
      ] as { pos: [number, number, number]; h: number }[],
    [],
  );
  if (act1 < 0.01) return null;
  return (
    <group>
      {towers.map((t, i) => (
        <GlassTower key={i} position={t.pos} height={t.h} act1={act1} />
      ))}
    </group>
  );
}

/* ================================================================== */
/* ACT 2 — THE KEY: travels to the lock and turns                     */
/* ================================================================== */

/* The Formstr gear-flower asterisk — the brand mark, rebuilt in 3D. Used as
   the "✱" in the "form✱" wordmark engraved on the key. Centred at the origin. */
function FormstrMark({ glow }: { glow: number }) {
  const petals = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      arr.push([Math.cos(a) * 0.3, Math.sin(a) * 0.3]);
    }
    return arr;
  }, []);

  const orange = {
    color: BRAND.orange,
    metalness: 1,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.8,
    emissive: BRAND.orange,
    emissiveIntensity: 0.3 * glow,
  } as const;
  const gold = {
    color: BRAND.amber,
    metalness: 1,
    roughness: 0.18,
    clearcoat: 1,
    envMapIntensity: 1.8,
    emissive: BRAND.amber,
    emissiveIntensity: 0.3 * glow,
  } as const;

  return (
    <group>
      {/* central hub */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.17, 40]} />
        <meshPhysicalMaterial {...orange} />
      </mesh>
      {/* six lobes */}
      {petals.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.16, 0.16, 0.15, 28]} />
          <meshPhysicalMaterial {...orange} />
        </mesh>
      ))}
      {/* three asterisk spokes, raised on top */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, 0, 0.07]} rotation={[0, 0, (i * Math.PI) / 3]}>
          <capsuleGeometry args={[0.06, 0.72, 6, 16]} />
          <meshPhysicalMaterial {...gold} />
        </mesh>
      ))}
      {/* glowing orange centre dot */}
      <mesh position={[0, 0, 0.15]}>
        <sphereGeometry args={[0.1, 24, 24]} />
        <meshStandardMaterial
          color={BRAND.orange}
          emissive={BRAND.orange}
          emissiveIntensity={2 * Math.max(0.35, glow)}
        />
      </mesh>
    </group>
  );
}

function TheKey({ progress }: { progress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const act2 = band(0.32, 0.42, 0.54, 0.62, progress);

  // Classic key silhouette: a round ring bow, a slim shaft, and cut teeth.
  const geos = useMemo(() => {
    const ext = {
      steps: 1,
      depth: 0.16,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 6,
    };

    // ring bow (the head you'd hang on a keyring)
    const bow = new THREE.Shape();
    bow.absarc(0, 1.06, 0.5, 0, Math.PI * 2, false);
    const bowHole = new THREE.Path();
    bowHole.absarc(0, 1.06, 0.31, 0, Math.PI * 2, true);
    bow.holes.push(bowHole);

    // a collar linking the bow to the shaft
    const collar = new THREE.Shape();
    collar.moveTo(-0.1, 0.62);
    collar.lineTo(0.1, 0.62);
    collar.lineTo(0.14, 0.5);
    collar.lineTo(-0.14, 0.5);
    collar.closePath();

    // slim shaft
    const shaft = new THREE.Shape();
    shaft.moveTo(-0.14, 0.54);
    shaft.lineTo(0.14, 0.54);
    shaft.lineTo(0.14, -1.2);
    shaft.lineTo(-0.14, -1.2);
    shaft.closePath();

    // teeth cut into the bottom-right edge
    const bit = new THREE.Shape();
    bit.moveTo(0.14, -1.15);
    bit.lineTo(0.44, -1.15);
    bit.lineTo(0.44, -0.98);
    bit.lineTo(0.28, -0.98);
    bit.lineTo(0.28, -0.82);
    bit.lineTo(0.42, -0.82);
    bit.lineTo(0.42, -0.66);
    bit.lineTo(0.14, -0.66);
    bit.closePath();

    const list = [
      new THREE.ExtrudeGeometry(bow, ext),
      new THREE.ExtrudeGeometry(collar, ext),
      new THREE.ExtrudeGeometry(shaft, ext),
      new THREE.ExtrudeGeometry(bit, ext),
    ];
    list.forEach((g) => g.translate(0, 0, -0.08));
    return list;
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const p = progress;
    // approach: fly in from lower-left toward the cage door lock (front, +Z)
    const approach = smoothstep(0.34, 0.46, p);
    const x = THREE.MathUtils.lerp(-3.2, 0, approach);
    const y =
      THREE.MathUtils.lerp(-1.0, GROUND + 0.9, approach) + Math.sin(t) * 0.03;
    const z = THREE.MathUtils.lerp(3.6, 1.62, approach);
    groupRef.current.position.set(x, y, z);
    // turn the key in the lock (act 2 climax), then it has done its job
    const turn = smoothstep(0.46, 0.56, p);
    groupRef.current.rotation.z = turn * Math.PI * 0.5;
    groupRef.current.rotation.y = (1 - approach) * 0.6;
  });

  if (act2 < 0.01) return null;

  return (
    <group ref={groupRef} scale={0.42}>
      {/* ---- the key body: ring bow + shaft + teeth, orange metal ---- */}
      {geos.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshPhysicalMaterial
            color={BRAND.orange}
            metalness={1}
            roughness={0.15}
            clearcoat={1}
            clearcoatRoughness={0.08}
            envMapIntensity={1.8}
            emissive={BRAND.orange}
            emissiveIntensity={0.28 * act2}
          />
        </mesh>
      ))}

      {/* ---- the Formstr asterisk, set inside the ring as a brand emblem ---- */}
      <group position={[0, 1.06, 0.01]} scale={0.44}>
        <FormstrMark glow={act2} />
      </group>

      {/* ---- "form*" engraved down the shaft (light so it actually reads) ---- */}
      <group position={[-0.1, 0.34, 0.12]} rotation={[0, 0, -Math.PI / 2]}>
        <Text3D
          font={FONT_URL}
          size={0.2}
          height={0.03}
          bevelEnabled
          bevelThickness={0.006}
          bevelSize={0.006}
          bevelSegments={2}
          curveSegments={5}
        >
          form*
          <meshStandardMaterial
            color="#fff1de"
            metalness={0.4}
            roughness={0.35}
            emissive="#ffb060"
            emissiveIntensity={0.25}
          />
        </Text3D>
      </group>
    </group>
  );
}

/* ================================================================== */
/* ACT 3 — OWNED: graph floor, hub bloom, glass app constellation     */
/* ================================================================== */

function GraphFloor({ act3 }: { act3: number }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const size = 16;
    for (let i = -size; i <= size; i++) {
      pts.push(new THREE.Vector3(i, 0, -size), new THREE.Vector3(i, 0, size));
      pts.push(new THREE.Vector3(-size, 0, i), new THREE.Vector3(size, 0, i));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, []);
  return (
    <group position={[0, GROUND - 0.02, 0]}>
      <lineSegments geometry={geo}>
        <lineBasicMaterial
          color={BRAND.orange}
          transparent
          opacity={0.14 * act3}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function Hub({ act3 }: { act3: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.z += d * 0.22;
  });
  const petals = useMemo(() => {
    const arr: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      arr.push([Math.cos(a) * 0.34, Math.sin(a) * 0.34]);
    }
    return arr;
  }, []);
  return (
    <group ref={ref} position={[0, GROUND + 1.9, 0.1]} scale={0.7}>
      <mesh>
        <sphereGeometry args={[0.26, 48, 48]} />
        <meshStandardMaterial
          color={BRAND.orange}
          emissive={BRAND.orange}
          emissiveIntensity={2.4 * act3}
          roughness={0.25}
          metalness={0.3}
        />
      </mesh>
      {petals.map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <sphereGeometry args={[0.16, 32, 32]} />
          <meshPhysicalMaterial
            color={BRAND.orangeLight}
            metalness={1}
            roughness={0.18}
            clearcoat={1}
            envMapIntensity={1.6}
            emissive={BRAND.orangeLight}
            emissiveIntensity={0.9 * act3}
          />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[0.74, 0.011, 10, 96]} />
        <meshStandardMaterial
          color={BRAND.amber}
          emissive={BRAND.amber}
          emissiveIntensity={2.2 * act3}
        />
      </mesh>
    </group>
  );
}

function AppConstellation({
  act3,
  hoveredOrb,
  onHover,
  onSelect,
}: {
  act3: number;
  hoveredOrb: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.13;
  });
  const orbs = useMemo(() => {
    const radius = 2.5;
    return APPS.map((app, i) => {
      const a = (i / APPS.length) * Math.PI * 2 - Math.PI / 2;
      const pos = new THREE.Vector3(
        Math.cos(a) * radius,
        Math.sin(i * 1.3) * 0.65,
        Math.sin(a) * radius,
      );
      const line = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        pos,
      ]);
      return { app, pos, line };
    });
  }, []);
  return (
    <group ref={ref} position={[0, GROUND + 1.9, 0.1]}>
      {orbs.map(({ app, pos, line }) => {
        const hovered = hoveredOrb === app.id;
        return (
          <group key={app.id}>
            <lineSegments geometry={line}>
              <lineBasicMaterial
                color={app.color}
                transparent
                opacity={(hovered ? 0.75 : 0.3) * act3}
                depthWrite={false}
              />
            </lineSegments>
            {/* Enlarged invisible hit target — forgiving to tap on phones. */}
            <mesh
              position={pos}
              onPointerOver={(e) => {
                e.stopPropagation();
                onHover(app.id);
                document.body.style.cursor = "pointer";
              }}
              onPointerOut={() => {
                onHover(null);
                document.body.style.cursor = "";
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(app.id);
              }}
            >
              <sphereGeometry args={[IS_MOBILE ? 0.6 : 0.42, 16, 16]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
            <mesh position={pos} scale={hovered ? 1.55 : 1}>
              <sphereGeometry args={[0.22, 48, 48]} />
              <MeshTransmissionMaterial
                samples={IS_MOBILE ? 4 : 10}
                resolution={IS_MOBILE ? 512 : 1024}
                color={app.color}
                thickness={0.6}
                roughness={0.05}
                transmission={1}
                ior={1.45}
                chromaticAberration={0.04}
                anisotropy={0.2}
                distortion={0.1}
                distortionScale={0.2}
                temporalDistortion={0}
                envMapIntensity={1.5}
                emissive={app.color}
                emissiveIntensity={(hovered ? 0.6 : 0.15) * act3}
              />
            </mesh>
            <mesh position={pos} scale={hovered ? 1.55 : 1}>
              <sphereGeometry args={[0.09, 24, 24]} />
              <meshStandardMaterial
                color={app.color}
                emissive={app.color}
                emissiveIntensity={2 * act3}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Act3Owned({
  progress,
  hoveredOrb,
  onHover,
  onSelect,
}: {
  progress: number;
  hoveredOrb: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const act3 = smoothstep(0.62, 0.78, progress);
  if (act3 < 0.01) return null;
  return (
    <group>
      <GraphFloor act3={act3} />
      {!DEBUG_POSE && <Hub act3={act3} />}
      {!DEBUG_POSE && (
        <AppConstellation
          act3={act3}
          hoveredOrb={hoveredOrb}
          onHover={onHover}
          onSelect={onSelect}
        />
      )}
    </group>
  );
}

/* ================================================================== */
/* Camera rig — frames the subject through the three acts             */
/* ================================================================== */

function CameraRig({
  progressRef,
  pointerRef,
}: {
  progressRef: { current: number };
  pointerRef: { current: { x: number; y: number } };
}) {
  const { camera, size } = useThree();
  const targetRef = useRef(new THREE.Vector3());
  const lookRef = useRef(new THREE.Vector3());
  const curLookRef = useRef(new THREE.Vector3(0, GROUND + 0.6, 0));

  useFrame(() => {
    const p = progressRef.current;
    const ptr = pointerRef.current;
    const target = targetRef.current;
    const look = lookRef.current;

    // camera positions
    const A1 = new THREE.Vector3(0, GROUND + 1.55, 5.7); // cell: screen + pacing
    const A2 = new THREE.Vector3(0.45, GROUND + 1.1, 3.4); // push to the lock
    const A3 = new THREE.Vector3(0, GROUND + 1.4, 6.0); // eye-level: celebrate

    // look targets
    const L1 = new THREE.Vector3(0, GROUND + 1.15, -0.1);
    const L2 = new THREE.Vector3(0, GROUND + 0.9, 1.3);
    const L3 = new THREE.Vector3(0, GROUND + 1.35, 0.6);

    const t12 = smoothstep(0.24, 0.44, p);
    const t23 = smoothstep(0.58, 0.76, p);

    target.copy(A1).lerp(A2, t12).lerp(A3, t23);

    // Portrait/narrow screens have a tiny horizontal FOV, so push the camera
    // back along its view axis to fit the wide scene. fit = 1 on landscape,
    // rising as the aspect narrows.
    look.copy(L1).lerp(L2, t12).lerp(L3, t23);
    const aspect = size.width / Math.max(1, size.height);
    if (aspect < 1.35) {
      const fit = THREE.MathUtils.lerp(
        1,
        2.1,
        clamp01((1.35 - aspect) / 1.0),
      );
      target.z = look.z + (target.z - look.z) * fit;
      target.y = look.y + (target.y - look.y) * fit;
    }

    // Cursor parallax on desktop only; touch-drag shouldn't swing the camera.
    if (!IS_MOBILE) {
      target.x += ptr.x * 0.6;
      target.y += ptr.y * 0.3;
      look.x += ptr.x * 0.3;
    }
    camera.position.lerp(target, 0.06);

    curLookRef.current.lerp(look, 0.06);
    camera.lookAt(curLookRef.current);
  });

  return null;
}

function PointerTracker({
  pointerRef,
}: {
  pointerRef: { current: { x: number; y: number } };
}) {
  const { gl } = useThree();
  useEffect(() => {
    const el = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      pointerRef.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointerRef.current.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => el.removeEventListener("pointermove", onMove);
  }, [gl, pointerRef]);
  return null;
}

/* ================================================================== */
/* Scene composition                                                  */
/* ================================================================== */

function SceneContent({
  progressRef,
  pointerRef,
  hoveredOrb,
  onHoverOrb,
  onSelectOrb,
}: {
  progressRef: { current: number };
  pointerRef: { current: { x: number; y: number } };
  hoveredOrb: string | null;
  onHoverOrb: (id: string | null) => void;
  onSelectOrb: (id: string) => void;
}) {
  const [p, setP] = useState(0);
  const last = useRef(0);
  useFrame(() => {
    const n = progressRef.current;
    if (Math.abs(n - last.current) > 0.001) {
      last.current = n;
      setP(n);
    }
  });

  const bg = useMemo(() => {
    const cold = new THREE.Color("#0a0e15");
    const black = new THREE.Color("#050506");
    const warm = new THREE.Color("#0d0805");
    const c = cold.clone();
    c.lerp(black, smoothstep(0.2, 0.45, p));
    c.lerp(warm, smoothstep(0.6, 0.8, p));
    return c;
  }, [p]);

  return (
    <>
      <color attach="background" args={[bg.r, bg.g, bg.b]} />
      <fog attach="fog" args={[`#${bg.getHexString()}`, 8, 30]} />

      <ambientLight intensity={0.25} />
      <pointLight
        position={[0, 3, 5]}
        intensity={2.6}
        color={BRAND.orangeLight}
        distance={20}
      />
      <pointLight
        position={[-4, 1, -3]}
        intensity={0.8}
        color={BRAND.coldBlue}
        distance={16}
      />
      <spotLight
        position={[3, 7, 3]}
        intensity={1.8}
        color="#ffffff"
        angle={0.6}
        penumbra={0.9}
        distance={24}
        castShadow
      />

      <Environment files="/hdri/studio.hdr" environmentIntensity={0.7} />

      <Act1Backdrop progress={p} />
      <CompromisedScreen progress={p} />
      <Cage progress={p} />
      <RobotCharacter progressRef={progressRef} pointerRef={pointerRef} />
      <TheKey progress={p} />
      <Act3Owned
        progress={p}
        hoveredOrb={hoveredOrb}
        onHover={onHoverOrb}
        onSelect={onSelectOrb}
      />

      <ContactShadows
        position={[0, GROUND + 0.01, 0.4]}
        opacity={0.5}
        scale={12}
        blur={2.4}
        far={4}
        color="#000000"
      />

      <CameraRig progressRef={progressRef} pointerRef={pointerRef} />
      <PointerTracker pointerRef={pointerRef} />
    </>
  );
}

/* ================================================================== */
/* Exported Canvas                                                    */
/* ================================================================== */

export default function HeroScene({
  progressRef,
  pointerRef,
  hoveredOrb,
  onHoverOrb,
  onSelectOrb,
}: {
  progressRef: { current: number };
  pointerRef: { current: { x: number; y: number } };
  hoveredOrb: string | null;
  onHoverOrb: (id: string | null) => void;
  onSelectOrb: (id: string) => void;
}) {
  return (
    <Canvas
      dpr={IS_MOBILE ? [1, 1.75] : [1, 2]}
      shadows={!IS_MOBILE}
      gl={{
        antialias: !IS_MOBILE,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.1,
        outputColorSpace: THREE.SRGBColorSpace,
      }}
      camera={{ position: [0, 0.6, 6.4], fov: 48, near: 0.1, far: 60 }}
      style={{ position: "absolute", inset: 0 }}
    >
      <Suspense fallback={null}>
        <SceneContent
          progressRef={progressRef}
          pointerRef={pointerRef}
          hoveredOrb={hoveredOrb}
          onHoverOrb={onHoverOrb}
          onSelectOrb={onSelectOrb}
        />
        <EffectComposer>
          <Bloom
            luminanceThreshold={0.6}
            luminanceSmoothing={0.9}
            intensity={0.85}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.28} darkness={0.7} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
