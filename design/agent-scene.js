// Fig. 3: the agent. One robot, lit like a product shot, on the dark agents
// section. It waves once when it scrolls into view, then idles and tracks the
// cursor. No HDR, no post-processing: procedural RoomEnvironment lighting and a
// gradient-disc shadow. The render loop runs only while the figure is visible.
// Plain three.js for the design preview; the real build ports it to R3F.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";

const host = document.getElementById("agent-canvas");
const size = () => [host.clientWidth, host.clientHeight];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(...size());
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.9;

const camera = new THREE.PerspectiveCamera(30, size()[0] / size()[1], 0.1, 50);
camera.position.set(0, 0.9, 7.2);
camera.lookAt(0, 0.55, 0);

const key = new THREE.DirectionalLight(0xffffff, 2.2);
key.position.set(-3, 5, 4);
scene.add(key);
const rim = new THREE.DirectionalLight(0xffffff, 1.4);
rim.position.set(4, 3, -4);
scene.add(rim);

// contact shadow: a radial gradient disc, no shadow maps
const disc = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(0,0,0,0.55)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
})();
const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
  new THREE.MeshBasicMaterial({ map: disc, transparent: true, depthWrite: false }));
shadow.rotation.x = -Math.PI / 2;
shadow.position.y = -1.19;
scene.add(shadow);

let mixer, head, clip;
const q = new URLSearchParams(location.search);
const frozen = q.has("pose");

new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load("./assets/robot.glb", (gltf) => {
  const robot = gltf.scene;
  robot.scale.setScalar(0.5);
  robot.position.y = -1.2;
  robot.rotation.y = -0.35;
  robot.traverse((o) => {
    if (o.isMesh) {
      // repaint the stock yellow robot: porcelain shell, graphite joints, ink visor
      const m = o.material;
      const paint = { Main: 0xeeeeec, Grey: 0x6b6b68, Black: 0x0b0b0c }[m.name];
      if (paint !== undefined) m.color.setHex(paint);
      m.roughness = 0.42;
    }
    if (o.isBone && o.name === "Head") head = o;
  });
  scene.add(robot);
  mixer = new THREE.AnimationMixer(robot);
  clip = (n) => mixer.clipAction(gltf.animations.find((a) => a.name === n));
  if (frozen) {
    clip(q.get("pose")).play();
    mixer.setTime(Number(q.get("t") ?? 0.6));
  } else {
    clip("Idle").play();
  }
  document.documentElement.dataset.agentReady = "1";
});

// wave once, the first time the figure scrolls into view
let waved = false;
function wave() {
  if (waved || !mixer || frozen) return;
  waved = true;
  const w = clip("Wave");
  w.reset().setLoop(THREE.LoopOnce, 1);
  w.clampWhenFinished = true;
  w.fadeIn(0.3).play();
  clip("Idle").fadeOut(0.3);
  mixer.addEventListener("finished", () => {
    clip("Idle").reset().fadeIn(0.4).play();
    w.fadeOut(0.4);
  });
}

const pointer = { x: 0, y: 0 };
addEventListener("pointermove", (e) => {
  const r = host.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}, { passive: true });

const clock = new THREE.Clock();
function frame() {
  const d = clock.getDelta();
  if (mixer && !frozen) mixer.update(d);
  if (head) {
    head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, THREE.MathUtils.clamp(pointer.x, -1, 1) * 0.55, 0.08);
    head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, THREE.MathUtils.clamp(-pointer.y, -1, 1) * 0.25, 0.08);
  }
  renderer.render(scene, camera);
}

// only animate while visible
new IntersectionObserver(([e]) => {
  if (e.isIntersecting) { renderer.setAnimationLoop(frame); setTimeout(wave, 250); }
  else renderer.setAnimationLoop(null);
}, { rootMargin: "80px" }).observe(host);

addEventListener("resize", () => {
  renderer.setSize(...size());
  camera.aspect = size()[0] / size()[1];
  camera.updateProjectionMatrix();
});
