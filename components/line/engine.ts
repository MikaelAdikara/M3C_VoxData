/*
 * The Line: K2-Body rendered as a lit plant scene (three.js, client only).
 * Bodies travel the way they do in a real plant: bare steel (body-in-white)
 * through the body stations, painted after the paint station, and finished
 * with glass and tyres at final inspection. Each station has an andon tower.
 * Station states come from getLineView(); body motion is presentation only
 * (there is no MES tracking), and time is compressed.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/* Car models adapted from CC BY models (see design/ASSETS.md): Urban '10 and Kiri '10
   by Daniel Zhabotinsky, Generic passenger car pack by Comrade1280. "body-*" is the bare
   shell, "car-*" the finished car with glass and tyres. Colour is ours: steel, the four
   achromatic paints, and caution yellow only for the body waiting on a decision. */
const VARIANTS = ["urban", "kiri", "van", "hatch"];
const MODEL_BASE = "/models";
/* white, silver, grey, black: the common car colours, all achromatic */
const PAINTS = [
  { color: 0xf1f1ee, metalness: 0.15 },
  { color: 0xb9bdc2, metalness: 0.7 },
  { color: 0x5b5f65, metalness: 0.55 },
  { color: 0x1c1e21, metalness: 0.45 },
];
const BAY_Z = 6.4;                         // repair bay beside the line, camera side

export type LineStationState = "running" | "yellow_andon" | "model_review" | "contained" | "stopped";
export interface EngineStation { id: string; name: string; type: "sealer" | "body" | "paint" | "final_inspection" }
export interface EngineState {
  stations: Record<string, LineStationState>;
  line: "running" | "stopped";
  flagged: { bodyId: string; stationId: string; note: string } | null;
  selected: string | null;
}
export interface LineEngine {
  setState(s: EngineState): void;
  setPaused(p: boolean): void;
  resetView(): void;
  dispose(): void;
}

const PITCH = 6.4;
const CYCLE = 7;
const MOVE = 1.5;
const LAMP = { red: 0xeb0a1e, yellow: 0xf2b705, green: 0x1fae55, blue: 0x2f86d6 } as const;
type LampKey = keyof typeof LAMP;

const PALETTE = {
  light: { exposure: 0.82, env: 0.5, fog: 0xd9dadb, floor: 0xbcbfc2, grid: 0x7d8085, gridOpacity: 0.08, mark: 0xf4f4f4, lane: 0x6b7076, slat: 0x464a50, solid: 0xe9e9e6, steel: 0x8f9398, biw: 0xa9aeb4, lampOff: 0xbdbdbd, hemiSky: 0xffffff, hemiGround: 0xa9abad, sun: 2.4, hemi: 0.45 },
  dark: { exposure: 1.25, env: 0.55, fog: 0x2c2e31, floor: 0x3b3e42, grid: 0x6a6d72, gridOpacity: 0.09, mark: 0x8a8d91, lane: 0x55595e, slat: 0x34373b, solid: 0xbfc1c2, steel: 0x6f7378, biw: 0x9ea3a9, lampOff: 0x55585c, hemiSky: 0xc9ced6, hemiGround: 0x26282b, sun: 1.8, hemi: 0.5 },
};

const isDark = () =>
  (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

export function createLineEngine(opts: {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  labels: HTMLElement;
  tag: HTMLElement;
  stations: EngineStation[];
  interactive?: boolean;
  /** Camera position and target, for the landing hero framing. */
  home?: { pos: [number, number, number]; target: [number, number, number] };
  /** Fraction of the stage height the scene moves down (room for a headline). */
  shiftY?: number;
  onSelect?: (id: string) => void;
  /** Override the body model URLs (the static mockup serves them from another path). */
  modelBase?: string;
}): LineEngine | null {
  const { stage, canvas, labels, tag, stations } = opts;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const X0 = -((stations.length - 1) * PITCH) / 2;
  const xAt = (slot: number) => X0 + slot * PITCH;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xdedede, 60, 150);
  const fog = scene.fog as THREE.Fog;
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 400);
  const HOME = opts.home
    ? { pos: new THREE.Vector3(...opts.home.pos), target: new THREE.Vector3(...opts.home.target) }
    : { pos: new THREE.Vector3(-38, 22, 34), target: new THREE.Vector3(-1, 0, -2) };
  const interactive = opts.interactive ?? true;

  /* ---------- materials (physically based, lit by a room environment) ---------- */
  const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, ...extra });
  const phys = (color: number, extra: THREE.MeshPhysicalMaterialParameters = {}) =>
    new THREE.MeshPhysicalMaterial({ color, ...extra });
  const M = {
    floor: std(0xcfd1d3, { roughness: 0.5 }),
    mark: std(0xffffff, { roughness: 0.6 }),
    lane: std(0x7b8086, { metalness: 0.6, roughness: 0.42 }),
    slat: std(0x50555b, { metalness: 0.5, roughness: 0.5 }),
    solid: std(0xf0f0ed, { roughness: 0.35, metalness: 0.05 }),
    steel: std(0xa7abb0, { metalness: 0.55, roughness: 0.38 }),
    biw: phys(0xb7bcc1, { metalness: 0.85, roughness: 0.3 }),
    paint: PAINTS.map((p) => phys(p.color, { metalness: p.metalness, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 })),
    glass: phys(0x0d1013, { metalness: 0.1, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.9 }),
    light: phys(0xe6e8ea, { metalness: 0.2, roughness: 0.1, clearcoat: 1 }),
    trim: std(0x222325, { roughness: 0.65 }),
    tyre: std(0x151515, { roughness: 0.92 }),
    flag: phys(0xf2b705, { metalness: 0.25, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 }),
  };

  function solid<T extends THREE.Mesh>(mesh: T): T {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
  const box = (w: number, h: number, d: number, m: THREE.Material) => solid(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m));
  const cyl = (r: number, h: number, m: THREE.Material, seg = 20) => solid(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m));

  const glowTex = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.25, "rgba(255,255,255,.55)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();

  /* ---------- lights ---------- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  const hemi = new THREE.HemisphereLight(0xffffff, 0xbdbdbd, 0.55);
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-14, 30, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -34, right: 34, top: 16, bottom: -16, near: 1, far: 90 });
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  scene.add(hemi, sun);

  /* ---------- floor, lane, zones ---------- */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), M.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const grid = new THREE.GridHelper(240, 60, 0x9a9a9a, 0x9a9a9a);
  const gridMat = grid.material as THREE.LineBasicMaterial;
  gridMat.transparent = true;
  gridMat.opacity = 0.07;
  grid.position.y = 0.002;
  scene.add(floor, grid);

  const laneLen = (stations.length + 1.6) * PITCH;
  const lane = box(laneLen, 0.18, 3, M.lane);
  lane.position.y = 0.09;
  scene.add(lane);
  const slats = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.02, 2.7), M.slat, Math.floor(laneLen / 0.8));
  for (let i = 0; i < slats.count; i++) slats.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-laneLen / 2 + 0.4 + i * 0.8, 0.19, 0));
  scene.add(slats);

  // painted walkway lines on the floor, like tape around each work zone
  const zone = (from: number, to: number) => {
    const x1 = xAt(from) - PITCH / 2 + 0.3, x2 = xAt(to) + PITCH / 2 - 0.3, z = 4.6, w = 0.09;
    const strip = (cx: number, cz: number, sx: number, sz: number) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), M.mark);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.006, cz);
      m.receiveShadow = true;
      scene.add(m);
    };
    strip((x1 + x2) / 2, -z, x2 - x1, w);
    strip((x1 + x2) / 2, z, x2 - x1, w);
    strip(x1, 0, w, 2 * z);
    strip(x2, 0, w, 2 * z);
  };
  const lastBody = stations.findLastIndex((s) => s.type === "sealer" || s.type === "body");
  zone(0, lastBody);
  stations.forEach((s, i) => { if (i > lastBody) zone(i, i); });

  /* ---------- stations ---------- */
  interface Lamp { m: THREE.MeshStandardMaterial; glow: THREE.Sprite }
  interface StationObj { s: EngineStation; group: THREE.Group; lamps: Record<LampKey, Lamp>; robot?: { turret: THREE.Group; elbow: THREE.Group }; cone?: THREE.Mesh; label: HTMLDivElement }
  const objs = new Map<string, StationObj>();
  const pickables: THREE.Object3D[] = [];

  stations.forEach((s, i) => {
    const g = new THREE.Group();
    g.position.x = xAt(i);
    const gx = -PITCH * 0.32;
    const postL = box(0.22, 3.6, 0.22, M.steel); postL.position.set(gx, 1.8, -2.1);
    const postR = box(0.22, 3.6, 0.22, M.steel); postR.position.set(gx, 1.8, 2.1);
    const beam = box(0.26, 0.26, 4.5, M.steel); beam.position.set(gx, 3.6, 0);
    g.add(postL, postR, beam);

    // four-lamp andon tower, red on top
    const tower = new THREE.Group();
    tower.position.set(gx, 3.73, -2.1);
    const pole = cyl(0.05, 1.1, M.steel, 10); pole.position.y = 0.55;
    tower.add(pole);
    const lamps = {} as Record<LampKey, Lamp>;
    (["blue", "green", "yellow", "red"] as LampKey[]).forEach((k, li) => {
      const m = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.4, transparent: true, opacity: 0.92, emissive: LAMP[k], emissiveIntensity: 0 });
      const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 24), m);
      lamp.position.y = 1.24 + li * 0.35;
      lamp.castShadow = true;
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: LAMP[k], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
      glow.scale.set(2.2, 2.2, 1);
      lamp.add(glow);
      tower.add(lamp);
      lamps[k] = { m, glow };
    });
    g.add(tower);

    let robot: StationObj["robot"];
    let cone: THREE.Mesh | undefined;
    if (s.type === "sealer") {
      const base = cyl(0.42, 0.5, M.solid, 24); base.position.y = 0.25;
      const turret = new THREE.Group(); turret.position.y = 0.5;
      const upper = box(0.32, 2.0, 0.32, M.solid); upper.position.y = 1.0;
      const elbow = new THREE.Group(); elbow.position.y = 2.0; elbow.rotation.x = 0.35;
      const fore = box(0.26, 0.26, 2.0, M.solid); fore.position.z = 1.0;
      const nozzle = cyl(0.06, 0.55, M.steel, 10); nozzle.position.set(0, -0.3, 2.0);
      elbow.add(fore, nozzle); turret.add(upper, elbow);
      const rg = new THREE.Group(); rg.add(base, turret); rg.position.set(0.4, 0, -3.2);
      g.add(rg);
      robot = { turret, elbow };
      const cam = new THREE.Group();
      cam.add(box(0.34, 0.26, 0.56, M.solid));
      const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 4, 1, true);
      coneGeo.translate(0, -1.7, 0);
      coneGeo.rotateY(Math.PI / 4);
      cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: LAMP.yellow, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      cam.add(cone);
      cam.position.set(gx + 0.3, 3.35, 0.9);
      g.add(cam);
    } else if (s.type === "body") {
      [-1, 1].forEach((side) => {
        const clamp = box(0.5, 1.5, 0.5, M.solid); clamp.position.set(0.6, 0.75, side * 2.6);
        const arm = box(0.9, 0.18, 0.18, M.steel); arm.position.set(0.6, 1.45, side * 2.2);
        g.add(clamp, arm);
      });
    } else if (s.type === "paint") {
      const stand = cyl(0.06, 1.3, M.steel, 10); stand.position.set(0.8, 0.65, 3.0);
      const tablet = box(0.9, 0.62, 0.06, M.solid); tablet.position.set(0.8, 1.5, 3.0); tablet.rotation.x = -0.35;
      g.add(stand, tablet);
    } else {
      [-1.4, 0, 1.4].forEach((dx) => {
        const arch = new THREE.Group();
        const l = box(0.14, 2.9, 0.14, M.steel); l.position.set(0, 1.45, -2.2);
        const r = box(0.14, 2.9, 0.14, M.steel); r.position.set(0, 1.45, 2.2);
        const t = box(0.14, 0.14, 4.54, M.steel); t.position.set(0, 2.9, 0);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 3.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
        bar.position.set(0, 2.8, 0);
        arch.add(l, r, t, bar);
        arch.position.x = dx;
        g.add(arch);
      });
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(PITCH * 0.9, 4.6, 6.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 2.3;
    hit.userData.id = s.id;
    g.add(hit);
    pickables.push(hit);
    scene.add(g);

    const label = document.createElement("div");
    label.className = "line-label";
    label.dataset.id = s.id;
    labels.append(label);
    objs.set(s.id, { s, group: g, lamps, robot, cone, label });
  });

  /* ---------- bodies on skids ---------- */
  const bodyGeo = (() => {
    const sh = new THREE.Shape();
    sh.moveTo(-2.2, 0.32);
    sh.lineTo(-1.82, 0.32);
    sh.absarc(-1.36, 0.32, 0.44, Math.PI, 0, true);
    sh.lineTo(0.95, 0.32);
    sh.absarc(1.4, 0.32, 0.44, Math.PI, 0, true);
    sh.lineTo(2.2, 0.32); sh.lineTo(2.26, 1.05); sh.lineTo(2.08, 1.58); sh.lineTo(-0.28, 1.66);
    sh.lineTo(-1.02, 1.08); sh.lineTo(-2.12, 0.92); sh.lineTo(-2.27, 0.58);
    sh.closePath();
    const w1 = new THREE.Path(); w1.moveTo(-0.86, 1.1); w1.lineTo(-0.3, 1.52); w1.lineTo(0.55, 1.53); w1.lineTo(0.55, 1.1); w1.closePath();
    const w2 = new THREE.Path(); w2.moveTo(0.72, 1.1); w2.lineTo(0.72, 1.53); w2.lineTo(1.92, 1.5); w2.lineTo(2.02, 1.1); w2.closePath();
    sh.holes.push(w1, w2);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 10 });
    geo.translate(0, 0, -0.88);
    return geo;
  })();

  const paintIdx = stations.findIndex((s) => s.type === "paint");
  const finalIdx = stations.findIndex((s) => s.type === "final_inspection");
  /** 0 bare steel, 1 painted, 2 finished car. */
  const stageOf = (slot: number) => (finalIdx >= 0 && slot >= finalIdx ? 2 : paintIdx >= 0 && slot >= paintIdx ? 1 : 0);

  let shells: THREE.Group[] = [];     // bare body per variant
  let cars: THREE.Group[] = [];       // finished car per variant
  let serial = 0;

  interface Body { slot: number; group: THREE.Group; shell: THREE.Object3D; variant: number; stage: number; flagged: boolean }
  const bodies: Body[] = [];
  let parked: (Body & { t: number }) | null = null;   // flagged body held in the repair bay

  function makeShell(variant: number, stage: number): THREE.Object3D {
    const src = stage === 2 ? cars : shells;
    if (src.length) {
      const shell = src[variant % src.length].clone(true);
      shell.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      return shell;
    }
    const shell = solid(new THREE.Mesh(bodyGeo, M.biw));
    shell.position.y = 0.28;
    return shell;
  }
  function paintShell(b: Body) {
    const paint = M.paint[b.variant % M.paint.length];
    b.shell.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const role = (m.userData.role as string | undefined) ?? "paint";
      if (role === "glass") m.material = M.glass;
      else if (role === "light") m.material = M.light;
      else if (role === "trim") m.material = M.trim;
      else if (role === "tyre") m.material = M.tyre;
      else m.material = b.flagged ? M.flag : b.stage === 0 ? M.biw : paint;
    });
  }
  function setStage(b: Body, stage: number) {
    if (b.stage === stage && b.shell) return;
    b.stage = stage;
    if (b.shell) b.group.remove(b.shell);
    b.shell = makeShell(b.variant, stage);
    b.group.add(b.shell);
    paintShell(b);
  }

  function newBody(slot: number) {
    const g = new THREE.Group();
    const variant = serial++;
    [-0.62, 0.62].forEach((z) => { const rail = box(4.7, 0.1, 0.16, M.steel); rail.position.set(0, 0.24, z); g.add(rail); });
    g.position.set(xAt(slot), 0.18, 0);
    scene.add(g);
    const b = { slot, group: g, shell: null as unknown as THREE.Object3D, variant, stage: -1, flagged: false } as Body;
    setStage(b, stageOf(slot));
    bodies.push(b);
    return b;
  }
  stations.forEach((_, i) => { if (i !== 5) newBody(i); });

  // repair bay outline beside the line
  const bayMark = new THREE.Group();
  {
    const w = 0.09, sx = 5.6, sz = 3.2;
    [[0, -sz / 2, sx, w], [0, sz / 2, sx, w], [-sx / 2, 0, w, sz], [sx / 2, 0, w, sz]].forEach(([cx, cz, a, c]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(a, c), M.mark);
      m.rotation.x = -Math.PI / 2;
      m.position.set(cx, 0.007, cz);
      bayMark.add(m);
    });
    bayMark.visible = false;
    scene.add(bayMark);
  }

  /** Yaw that turns a model's long side (principal axis on the floor) onto +x. */
  function principalYaw(root: THREE.Object3D) {
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let n = 0, mx = 0, mz = 0, cxx = 0, czz = 0, cxz = 0;
    const pts: [number, number][] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const pos = m.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld);
        pts.push([v.x, v.z]); mx += v.x; mz += v.z; n++;
      }
    });
    if (!n) return 0;
    mx /= n; mz /= n;
    for (const [x, z] of pts) { cxx += (x - mx) ** 2; czz += (z - mz) ** 2; cxz += (x - mx) * (z - mz); }
    return 0.5 * Math.atan2(2 * cxz, cxx - czz);
  }

  /** Lay a loaded model along +x, 4.5 long, sitting on the skid; tag meshes with their role. */
  function normalise(gltf: { scene: THREE.Group }) {
    const src = gltf.scene;
    src.rotation.y = principalYaw(src);
    const pivot = new THREE.Group();
    pivot.add(src);
    pivot.updateMatrixWorld(true);
    const s1 = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3());
    pivot.scale.setScalar(4.5 / s1.x);
    pivot.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(pivot);
    const c = bb.getCenter(new THREE.Vector3());
    src.position.sub(new THREE.Vector3(c.x, bb.min.y - 0.32, c.z).divideScalar(pivot.scale.x));
    src.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) m.userData.role = (m.material as THREE.Material).name || "paint";
    });
    return pivot;
  }

  // Load the models; until they arrive (or if they fail) the drawn body stays.
  async function loadModels() {
    try {
      const loader = new GLTFLoader();
      const base = opts.modelBase ?? MODEL_BASE;
      const [b, c] = await Promise.all([
        Promise.all(VARIANTS.map((v) => loader.loadAsync(`${base}/body-${v}.glb`))),
        Promise.all(VARIANTS.map((v) => loader.loadAsync(`${base}/car-${v}.glb`))),
      ]);
      if (disposed) return;
      shells = b.map(normalise);
      // bare shells are one material: steel or paint
      shells.forEach((sh) => sh.traverse((o) => { if ((o as THREE.Mesh).isMesh) o.userData.role = "paint"; }));
      cars = c.map(normalise);
      [...bodies, ...(parked ? [parked] : [])].forEach((body) => { const st = body.stage; body.stage = -1; setStage(body, st); });
      needsRender = true;
    } catch {
      /* keep the drawn bodies */
    }
  }

  let disposed = false;

  /* ---------- state ---------- */
  let state: EngineState = { stations: {}, line: "running", flagged: null, selected: null };
  let paused = reduce;
  let cycleT = MOVE + 0.4;
  let introT = reduce ? 1 : 0;
  let needsRender = true;
  let visible = true;
  let current = PALETTE.light;

  function lampsFor(id: string): Partial<Record<LampKey, number>> {
    const st = state.stations[id] ?? "running";
    if (st === "stopped") return { red: 1 };
    if (st === "yellow_andon") return { yellow: 1, green: 0.35 };
    if (st === "model_review") return { blue: 1, green: 0.35 };
    if (st === "contained") return { yellow: 0.5, green: 0.35 };
    return { green: 0.35 };
  }
  function labelHTML(id: string) {
    const st = state.stations[id] ?? "running";
    const chip = st === "yellow_andon" ? '<em data-tone="caution">Yellow andon</em>'
      : st === "stopped" ? '<em data-tone="stop">Line stopped</em>'
      : st === "model_review" ? '<em data-tone="instruct">Model review</em>'
      : st === "contained" ? "<em>Contained</em>" : "";
    return `<b>${id}</b>${chip}`;
  }

  function applyTheme() {
    current = isDark() ? PALETTE.dark : PALETTE.light;
    fog.color.setHex(current.fog);
    M.floor.color.setHex(current.floor);
    M.mark.color.setHex(current.mark);
    M.lane.color.setHex(current.lane);
    M.slat.color.setHex(current.slat);
    M.solid.color.setHex(current.solid);
    M.steel.color.setHex(current.steel);
    M.biw.color.setHex(current.biw);
    gridMat.color.setHex(current.grid);
    gridMat.opacity = current.gridOpacity;
    hemi.color.setHex(current.hemiSky);
    hemi.groundColor.setHex(current.hemiGround);
    hemi.intensity = current.hemi;
    sun.intensity = current.sun;
    scene.environmentIntensity = current.env;
    renderer.toneMappingExposure = current.exposure;
    needsRender = true;
  }

  /* ---------- camera and controls ---------- */
  const narrow = () => stage.clientWidth / stage.clientHeight < 1.25;
  function framing(id = state.selected) {
    if (!narrow() || !id) return HOME;
    const x = xAt(Math.max(0, stations.findIndex((s) => s.id === id)));
    return { pos: new THREE.Vector3(x - 15, 13, 17), target: new THREE.Vector3(x + 1.5, 1, -0.5) };
  }
  const introFrom = () => (narrow() ? framing().pos.clone().add(new THREE.Vector3(-14, 16, 18)) : new THREE.Vector3(-70, 52, 84));
  let fly: { fromP: THREE.Vector3; fromT: THREE.Vector3; toP: THREE.Vector3; toT: THREE.Vector3; t: number } | null = null;

  const controls = new OrbitControls(camera, canvas);
  const controlsAllowed = interactive && matchMedia("(pointer: fine)").matches;
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, enableZoom: false, minPolarAngle: 0.45, maxPolarAngle: 1.2, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.6 });
  controls.enabled = controlsAllowed && introT === 1;
  controls.addEventListener("change", () => { needsRender = true; });

  function flyTo(f: { pos: THREE.Vector3; target: THREE.Vector3 }) {
    if (reduce || introT < 1) { camera.position.copy(f.pos); controls.target.copy(f.target); needsRender = true; return; }
    fly = { fromP: camera.position.clone(), fromT: controls.target.clone(), toP: f.pos.clone(), toT: f.target.clone(), t: 0 };
  }

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 50 : w / h < 1.7 ? 37 : 30;
    if (opts.shiftY && !narrow()) camera.setViewOffset(w, h, 0, -h * opts.shiftY, w, h);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  /* ---------- picking ---------- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: [number, number] | null = null;
  const toNdc = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables, false)[0];
  };
  const onDown = (e: PointerEvent) => { down = [e.clientX, e.clientY]; };
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const hit = toNdc(e);
    if (hit) opts.onSelect?.(hit.object.userData.id as string);
  };
  const onMove = (e: PointerEvent) => {
    if (e.buttons) return;
    const hit = toNdc(e);
    canvas.style.cursor = hit ? "pointer" : controls.enabled ? "grab" : "default";
    objs.forEach((o) => { o.label.dataset.hover = String(hit?.object.userData.id === o.s.id); });
  };
  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointermove", onMove);

  /* ---------- loop ---------- */
  const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 4);
  const v = new THREE.Vector3();
  const t0 = performance.now();
  let last = t0;
  let raf = 0;

  function step(dt: number) {
    if (state.line !== "running" || paused) return;
    cycleT += dt;
    if (cycleT >= CYCLE) {
      cycleT -= CYCLE;
      bodies.forEach((b) => { b.slot += 1; });
      for (let i = bodies.length - 1; i >= 0; i--) {
        if (bodies[i].slot > stations.length) { scene.remove(bodies[i].group); bodies.splice(i, 1); }
      }
      newBody(-1);
    }
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    const t = (now - t0) / 1000;
    const animating = !paused || introT < 1 || !!fly || (!!parked && parked.t < 1);
    if (introT < 1) {
      introT = Math.min(1, introT + dt / 2.2);
      const f = framing();
      camera.position.lerpVectors(introFrom(), f.pos, easeOut(introT));
      controls.target.copy(f.target);
      if (introT === 1) controls.enabled = controlsAllowed;
    } else if (fly) {
      fly.t = Math.min(1, fly.t + dt / 0.9);
      const k = easeInOut(fly.t);
      camera.position.lerpVectors(fly.fromP, fly.toP, k);
      controls.target.lerpVectors(fly.fromT, fly.toT, k);
      if (fly.t === 1) fly = null;
    }
    step(dt);
    if (!interactive && introT === 1 && !fly && !paused) {
      // a slow drift keeps a non-interactive hero alive without asking for input
      const f = framing();
      const off = f.pos.clone().sub(f.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 0.12) * 0.07);
      camera.position.copy(f.target).add(off);
    }
    const changed = controls.update();
    if (!animating && !changed && !needsRender) return;

    const moving = state.line === "running" && cycleT < MOVE && !paused;
    const k = moving ? easeInOut(cycleT / MOVE) : 0;
    bodies.forEach((b) => {
      b.group.position.x = moving ? xAt(b.slot - 1 + k) : xAt(b.slot);
      if (!moving) setStage(b, stageOf(b.slot));   // paint and final fit happen inside the station
    });
    if (parked && parked.t < 1) {
      parked.t = reduce ? 1 : Math.min(1, parked.t + dt / 1.2);
      parked.group.position.z = BAY_Z * easeInOut(parked.t);
    }
    objs.forEach((o) => {
      if (o.robot) {
        const dwell = !moving && state.line === "running" && !paused;
        const ph = dwell ? (cycleT - MOVE) / (CYCLE - MOVE) : 0;
        o.robot.turret.rotation.y = dwell ? -0.55 + Math.sin(ph * Math.PI) * 1.1 : -0.55;
      }
      const on = lampsFor(o.s.id);
      (Object.keys(o.lamps) as LampKey[]).forEach((key) => {
        let val = on[key] ?? 0;
        if (val === 1 && (key === "yellow" || key === "red") && !paused) val = 0.72 + 0.28 * Math.sin(t * 4.2);
        o.lamps[key].m.emissiveIntensity = val * 2.4;
        o.lamps[key].m.color.setHex(val > 0 ? 0xffffff : current.lampOff);
        o.lamps[key].glow.material.opacity = val > 0.5 ? val * 0.85 : val * 0.3;
      });
    });

    const w = stage.clientWidth, h = stage.clientHeight;
    objs.forEach((o) => {
      v.set(o.group.position.x - PITCH * 0.32, 6.0, -2.1).project(camera);
      o.label.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      o.label.style.visibility = v.z < 1 ? "visible" : "hidden";
    });
    const fb = parked;
    if (fb && state.flagged) {
      v.set(fb.group.position.x, 2.8, fb.group.position.z).project(camera);
      tag.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
      tag.hidden = false;
    } else tag.hidden = true;

    renderer.render(scene, camera);
    needsRender = false;
  }

  /* ---------- wiring ---------- */
  applyTheme();
  resize();
  camera.position.copy(introT === 1 ? framing().pos : introFrom());
  controls.target.copy(framing().target);
  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; needsRender = true; });
  io.observe(stage);
  const mo = new MutationObserver(applyTheme);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", applyTheme);
  raf = requestAnimationFrame(frame);
  void loadModels();

  return {
    setState(next) {
      const prevSel = state.selected;
      const prevFlag = state.flagged?.bodyId;
      state = next;
      objs.forEach((o) => {
        o.label.innerHTML = labelHTML(o.s.id);
        o.label.dataset.selected = String(o.s.id === next.selected);
        if (o.cone) (o.cone.material as THREE.MeshBasicMaterial).opacity = o.s.id === next.selected ? 0.12 : 0;
      });
      // The flagged body leaves the line into the repair bay beside the station where it was
      // detected, and waits there; the line keeps running. Position is presentation only.
      if (next.flagged?.bodyId !== prevFlag) {
        if (parked) { scene.remove(parked.group); parked = null; bayMark.visible = false; }
        if (next.flagged) {
          const idx = Math.max(0, stations.findIndex((s) => s.id === next.flagged!.stationId));
          const i = bodies.findIndex((x) => x.slot === idx);
          const b = i >= 0 ? bodies.splice(i, 1)[0] : (() => { const nb = newBody(idx); bodies.pop(); return nb; })();
          b.group.position.x = xAt(idx);
          b.flagged = true;
          paintShell(b);
          parked = Object.assign(b, { t: reduce ? 1 : 0 });
          if (reduce) b.group.position.z = BAY_Z;
          bayMark.position.set(xAt(idx), 0, BAY_Z);
          bayMark.visible = true;
        }
      }
      tag.innerHTML = next.flagged ? `<span class="mono">${next.flagged.bodyId}</span><span>${next.flagged.note}</span>` : "";
      if (next.selected !== prevSel && narrow()) flyTo(framing(next.selected));
      needsRender = true;
    },
    setPaused(p) { paused = p; needsRender = true; },
    resetView() { flyTo(framing()); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect(); mo.disconnect();
      mq.removeEventListener("change", applyTheme);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointermove", onMove);
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose?.();
      });
      glowTex.dispose();
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      labels.innerHTML = "";
    },
  };
}
