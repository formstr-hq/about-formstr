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

function Robot({ pointer }: { pointer: { current: { x: number; y: number } } }) {
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

  // Wave hello once, then settle into idle.
  useEffect(() => {
    const wave = actions.Wave;
    const idle = actions.Idle;
    if (!wave || !idle) return;
    wave.reset().setLoop(THREE.LoopOnce, 1);
    // Hold the last wave frame until idle fades in (otherwise the arm snaps
    // down for a frame). three.js only exposes this as a mutable property.
    // eslint-disable-next-line react-hooks/immutability
    wave.clampWhenFinished = true;
    wave.play();
    const onDone = () => {
      idle.reset().fadeIn(0.4).play();
      wave.fadeOut(0.4);
    };
    mixer.addEventListener("finished", onDone);
    return () => mixer.removeEventListener("finished", onDone);
  }, [actions, mixer]);

  // The head turns toward the cursor, clamped so it never looks backwards.
  useFrame(() => {
    const h = head.current;
    if (!h) return;
    const { x, y } = pointer.current;
    h.rotation.y = THREE.MathUtils.lerp(h.rotation.y, THREE.MathUtils.clamp(x, -1, 1) * 0.55, 0.08);
    h.rotation.x = THREE.MathUtils.lerp(h.rotation.x, THREE.MathUtils.clamp(-y, -1, 1) * 0.25, 0.08);
  });

  return <primitive ref={group} object={scene} scale={0.5} position={[0, -1.2, 0]} rotation={[0, -0.35, 0]} />;
}

export default function AgentScene({
  active,
  onReady,
  onLost,
}: {
  active: boolean;
  onReady: () => void;
  /** The WebGL context died (GPU reset, driver crash…): the figure falls back to its still. */
  onLost: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });

  // Track the cursor relative to the figure, so the robot looks at it from
  // anywhere on the page.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = host.current?.getBoundingClientRect();
      if (!r) return;
      pointer.current.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      pointer.current.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

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
        <Robot pointer={pointer} />
      </Canvas>
    </div>
  );
}
