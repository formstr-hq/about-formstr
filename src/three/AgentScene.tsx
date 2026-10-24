import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/* Fig. 2 — the agent. One robot, lit like a product shot: it waves   */
/* once when it first appears, then idles and follows the cursor.     */
/*                                                                    */
/* Kept deliberately cheap: a 160 KB meshopt model holding only the   */
/* two clips used here, procedural RoomEnvironment lighting (no HDR), */
/* a gradient-disc shadow (no shadow maps), no post-processing.       */
/* ------------------------------------------------------------------ */

const MODEL_URL = "/models/robot.glb";

/* Repaint the stock yellow robot: porcelain shell, graphite joints, ink visor. */
const PAINT: Record<string, number> = { Main: 0xeeeeec, Grey: 0x6b6b68, Black: 0x0b0b0c };

/* Procedural studio lighting, generated once when the canvas is created. */
function lightScene({ gl, scene }: { gl: THREE.WebGLRenderer; scene: THREE.Scene }) {
  const pmrem = new THREE.PMREMGenerator(gl);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
}

/* A soft contact shadow: a radial-gradient disc instead of shadow maps. */
function ContactShadow() {
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(0,0,0,0.55)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.19, 0]}>
      <planeGeometry args={[2.6, 2.6]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

function Robot({ attention }: { attention: Attention }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(MODEL_URL);
  const { actions, mixer } = useAnimations(animations, group);
  const head = useRef<THREE.Object3D | null>(null);

  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        const m = mesh.material as THREE.MeshStandardMaterial;
        const paint = PAINT[m.name];
        if (paint !== undefined) m.color.setHex(paint);
        m.roughness = 0.42;
      }
      if ((o as THREE.Bone).isBone && o.name === "Head") head.current = o;
    });
  }, [scene]);

  // Wave hello (twice, a touch slower than the clip, so it isn't missed on a
  // quick scroll), then settle into idle.
  //
  // It starts on the first frame actually drawn, not on mount: the scene is
  // mounted just before it scrolls into view but doesn't render until it's
  // on screen, and the first frame's delta covers that whole wait. Started on
  // mount, the mixer would fast-forward through the wave in one step.
  const greeted = useRef(false);
  useEffect(() => {
    const wave = actions.Wave;
    const idle = actions.Idle;
    if (!wave || !idle) return;
    const onDone = () => {
      idle.reset().fadeIn(0.4).play();
      wave.fadeOut(0.4);
    };
    mixer.addEventListener("finished", onDone);
    return () => mixer.removeEventListener("finished", onDone);
  }, [actions, mixer]);
  useFrame(() => {
    const wave = actions.Wave;
    if (greeted.current || !wave) return;
    greeted.current = true;
    wave.reset().setLoop(THREE.LoopRepeat, 2).setEffectiveTimeScale(0.85);
    // Hold the last wave frame until idle fades in (otherwise the arm snaps
    // down for a frame). three.js only exposes this as a mutable property.
    // eslint-disable-next-line react-hooks/immutability
    wave.clampWhenFinished = true;
    wave.play();
  });

  // Aim the head at whatever has its attention, as a small turn layered on
  // top of the Idle clip (which glances around on its own).
  //
  // three.js only writes an animated bone while the clip's value is changing,
  // and Idle holds the head still for long stretches. So the head's current
  // rotation is either a fresh pose from the clip, or exactly what we wrote
  // last frame. Re-basing only on a fresh pose keeps the aim from stacking up
  // frame after frame (stacking it is what made the head spin).
  const aim = useRef({ yaw: 0, pitch: 0 });
  const pose = useRef({
    base: new THREE.Quaternion(),
    written: new THREE.Quaternion(),
    turn: new THREE.Quaternion(),
    euler: new THREE.Euler(0, 0, 0, "YXZ"),
    wrote: false,
  });
  useFrame((_, delta) => {
    const h = head.current;
    if (!h) return;
    const { x, y } = attention.target();
    const a = aim.current;
    // Time-based damping: equally smooth at 60 Hz and 120 Hz.
    a.yaw = THREE.MathUtils.damp(a.yaw, THREE.MathUtils.clamp(x, -1, 1) * MAX_YAW, 5, delta);
    a.pitch = THREE.MathUtils.damp(a.pitch, THREE.MathUtils.clamp(-y, -1, 1) * MAX_PITCH, 5, delta);

    const p = pose.current;
    if (!p.wrote || !h.quaternion.equals(p.written)) p.base.copy(h.quaternion);
    p.turn.setFromEuler(p.euler.set(a.pitch, a.yaw, 0));
    h.quaternion.copy(p.base).multiply(p.turn);
    p.written.copy(h.quaternion);
    p.wrote = true;
  });

  return <primitive ref={group} object={scene} scale={0.5} position={[0, -1.2, 0]} rotation={[0, -0.35, 0]} />;
}

/** A point in the figure's own space: -1…1 left→right, -1…1 bottom→top. */
export type Point = { x: number; y: number };

/* What the robot is looking at: you, for a few seconds after you move the
   mouse or tap; otherwise whatever the page points it at (its thought). */
type Attention = { target: () => Point };

const WATCH_YOU_MS = 2500;
/* How far the head may turn toward its target: a glance, not a spin. */
const MAX_YAW = 0.55; // ≈ 30° left/right
const MAX_PITCH = 0.18; // ≈ 10° up/down

export default function AgentScene({
  active,
  gaze,
  onReady,
  onLost,
}: {
  active: boolean;
  /** Where to look when you're not interacting (the current thought bubble). */
  gaze: { current: Point | null };
  onReady: () => void;
  /** The WebGL context died (GPU reset, driver crash…): the figure falls back to its still. */
  onLost: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const you = useRef<Point & { at: number }>({ x: 0, y: 0, at: -Infinity });

  // Follow the mouse anywhere on the page, and on touch screens the last tap.
  // Touch moves are scrolls, not pointing, so they're ignored (following them
  // made the head jerk around as the page scrolled).
  useEffect(() => {
    const look = (e: PointerEvent) => {
      if (e.type === "pointermove" && e.pointerType === "touch") return;
      const r = host.current?.getBoundingClientRect();
      if (!r) return;
      you.current = {
        x: ((e.clientX - r.left) / r.width) * 2 - 1,
        y: -((e.clientY - r.top) / r.height) * 2 + 1,
        at: performance.now(),
      };
    };
    window.addEventListener("pointermove", look, { passive: true });
    window.addEventListener("pointerdown", look, { passive: true });
    return () => {
      window.removeEventListener("pointermove", look);
      window.removeEventListener("pointerdown", look);
    };
  }, []);

  const attention = useMemo<Attention>(
    () => ({
      target: () => {
        const y = you.current;
        if (performance.now() - y.at < WATCH_YOU_MS || !gaze.current) return y;
        return gaze.current;
      },
    }),
    [gaze],
  );

  return (
    <div ref={host} className="absolute inset-0">
      <Canvas
        frameloop={active ? "always" : "never"}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, toneMapping: THREE.NeutralToneMapping }}
        camera={{ position: [0, 0.9, 7.2], fov: 30 }}
        onCreated={({ camera, gl, scene }) => {
          gl.domElement.addEventListener("webglcontextlost", onLost, { once: true });
          lightScene({ gl, scene });
          camera.lookAt(0, 0.55, 0);
          requestAnimationFrame(onReady);
        }}
      >
        <directionalLight position={[-3, 5, 4]} intensity={2.2} />
        <directionalLight position={[4, 3, -4]} intensity={1.4} />
        <ContactShadow />
        <Robot attention={attention} />
      </Canvas>
    </div>
  );
}
