/* The Line: K2-Body as an engineer's scale model.
   Body-in-white on skids indexes station to station, one andon tower per
   station, and the team leader's decision is visible on the line itself.
   Static mockup; all data simulated. Time is compressed for the demo. */

/* Loaded as a classic script so the mockup also works when opened straight
   from disk (file://), where Chrome blocks module files. three.js itself comes
   from the CDN through the page's import map. */
(async () => {
const THREE = await import("three");
const { OrbitControls } = await import("three/addons/controls/OrbitControls.js");

/* ---------- Data (mockup copy of the shift-board state) ---------- */
const STATIONS = [
  { id: "st-01", name: "Sealer 01", kind: "sealer", c: 1, r: 0, o: 0 },
  { id: "st-02", name: "Sealer 02", kind: "sealer", c: 1, r: 3, o: 0, state: "review" },
  { id: "st-03", name: "Body 03", kind: "body", c: 0, r: 1, o: 0 },
  { id: "st-04", name: "Sealer 04", kind: "sealer", c: 3, r: 0, o: 1, state: "andon" },
  { id: "st-05", name: "Body 05", kind: "body", c: 2, r: 1, o: 0 },
  { id: "st-06", name: "Body 06", kind: "body", c: 0, r: 0, o: 0 },
  { id: "paint-bm", name: "Paint body map", kind: "paint", c: 1, r: 0, o: 0 },
  { id: "final-01", name: "Final inspection", kind: "final", c: 1, r: 0, o: 0 },
];
const PITCH = 6.4;                       // world units between stations
const X0 = -((STATIONS.length - 1) * PITCH) / 2;
const xAt = (slot) => X0 + slot * PITCH;
const CYCLE = 7;                         // seconds per compressed takt
const MOVE = 1.5;                        // seconds of indexing inside a takt
const FLAGGED = "K2-27-031487";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const stage = document.getElementById("stage");
const canvas = document.getElementById("line-canvas");
const labelsEl = document.getElementById("line-labels");

/* ---------- Theme palette (read once per theme change) ---------- */
const PALETTES = {
  light: { exposure: 1.05, flag: 0xf7d46a, fog: 0xdedede, floor: 0xd9d9d9, grid: 0x9a9a9a, lane: 0xc7c7c7, solid: 0xf3f3f3, body: 0xf7f7f7, edge: 0x3a3a3a, edgeOpacity: 0.55, steel: 0xb9b9b9, lampOff: 0xcfcfcf, hemiSky: 0xffffff, hemiGround: 0xbdbdbd, sun: 1.6, hemi: 1.15 },
  dark:  { exposure: 1.85, flag: 0xb08a1c, fog: 0x2c2e31, floor: 0x3a3d41, grid: 0x6a6d72, lane: 0x45484d, solid: 0x55585d, body: 0x666a70, edge: 0xdedede, edgeOpacity: 0.3, steel: 0x777b81, lampOff: 0x5f6266, hemiSky: 0xc9ced6, hemiGround: 0x2a2c2f, sun: 1.3, hemi: 1.05 },
};
const LAMP = { red: 0xeb0a1e, yellow: 0xf2b705, green: 0x1fae55, blue: 0x2f86d6 };
const isDark = () => (document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")) === "dark";

/* ---------- Renderer ---------- */
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
} catch {
  stage.dataset.fallback = "true";
}

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdedede, 60, 150);
const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 400);
const HOME = { pos: new THREE.Vector3(-38, 22, 34), target: new THREE.Vector3(-1, 0, -2) };
const INTRO_FROM = new THREE.Vector3(-70, 52, 84);
const camQ = new URLSearchParams(location.search).get("cam") || stage.dataset.home;
if (camQ) { const n = camQ.split(",").map(Number); HOME.pos.set(n[0], n[1], n[2]); HOME.target.set(n[3], n[4], n[5]); }

const materials = {};
const edgeMats = [];
function mat(key, color, extra = {}) {
  materials[key] = new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.05, ...extra });
  return materials[key];
}

function withEdges(mesh, threshold = 28) {
  const m = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
  edgeMats.push(m);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, threshold), m);
  mesh.add(lines);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/* glow sprite for lit lamps */
const glowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
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

/* ---------- Lights ---------- */
const hemi = new THREE.HemisphereLight(0xffffff, 0xbdbdbd, 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(-14, 30, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -34; sun.shadow.camera.right = 34;
sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
sun.shadow.camera.near = 1; sun.shadow.camera.far = 90;
sun.shadow.radius = 4;
sun.shadow.bias = -0.0004;
scene.add(sun);

/* ---------- Floor, zones, lane ---------- */
const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat("floor", 0xd9d9d9, { roughness: 1 }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const grid = new THREE.GridHelper(240, 120, 0x9a9a9a, 0x9a9a9a);
grid.material.transparent = true;
grid.material.opacity = 0.14;
grid.position.y = 0.002;
scene.add(grid);

const laneLen = (STATIONS.length + 1.6) * PITCH;
const lane = withEdges(new THREE.Mesh(new THREE.BoxGeometry(laneLen, 0.18, 3), mat("lane", 0xc7c7c7)));
lane.position.y = 0.09;
scene.add(lane);
// conveyor slats: one draw call
const slatGeo = new THREE.BoxGeometry(0.06, 0.02, 2.7);
const slats = new THREE.InstancedMesh(slatGeo, mat("slat", 0x9a9a9a), Math.floor(laneLen / 0.8));
for (let i = 0; i < slats.count; i++) {
  slats.setMatrixAt(i, new THREE.Matrix4().makeTranslation(-laneLen / 2 + 0.4 + i * 0.8, 0.19, 0));
}
scene.add(slats);

// floor zones drawn as thin outlines, like tape on a plant floor
const zoneMat = new THREE.LineDashedMaterial({ color: 0x000000, dashSize: 0.5, gapSize: 0.35, transparent: true, opacity: 0.35 });
edgeMats.push(zoneMat);
function zone(fromSlot, toSlot) {
  const x1 = xAt(fromSlot) - PITCH / 2 + 0.3, x2 = xAt(toSlot) + PITCH / 2 - 0.3, z = 4.6;
  const pts = [[x1, -z], [x2, -z], [x2, z], [x1, z], [x1, -z]].map(([x, zz]) => new THREE.Vector3(x, 0.01, zz));
  const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), zoneMat);
  l.computeLineDistances();
  scene.add(l);
}
zone(0, 5); zone(6, 6); zone(7, 7);

/* ---------- Stations ---------- */
const pickables = [];
const stationObjs = new Map();

function box(w, h, d, m) { return withEdges(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)); }
function cyl(r, h, m, seg = 20) { return withEdges(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m), 40); }

function andonTower() {
  const g = new THREE.Group();
  const pole = cyl(0.05, 1.1, materials.steel ?? mat("steel", 0xb9b9b9), 10);
  pole.position.y = 0.55;
  g.add(pole);
  const lamps = {};
  ["blue", "green", "yellow", "red"].forEach((k, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0xcfcfcf, roughness: 0.4, transparent: true, opacity: 0.92, emissive: LAMP[k], emissiveIntensity: 0 });
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 24), m);
    lamp.position.y = 1.24 + i * 0.35;
    lamp.castShadow = true;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: LAMP[k], transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    glow.scale.set(2.2, 2.2, 1);
    lamp.add(glow);
    g.add(lamp);
    lamps[k] = { mesh: lamp, m, glow };
  });
  const cap = cyl(0.24, 0.06, materials.steel, 24);
  cap.position.y = 1.24 + 4 * 0.35 - 0.14;
  g.add(cap);
  return { group: g, lamps };
}

function sealerRobot() {
  const g = new THREE.Group();
  const base = cyl(0.42, 0.5, materials.solid, 24);
  base.position.y = 0.25;
  g.add(base);
  const turret = new THREE.Group();
  turret.position.y = 0.5;
  g.add(turret);
  const upper = box(0.32, 2.0, 0.32, materials.solid);
  upper.position.y = 1.0;
  turret.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = 2.0;
  turret.add(elbow);
  const fore = box(0.26, 0.26, 2.0, materials.solid);
  fore.position.z = 1.0;
  elbow.add(fore);
  const nozzle = cyl(0.06, 0.55, materials.steel, 10);
  nozzle.position.set(0, -0.3, 2.0);
  elbow.add(nozzle);
  elbow.rotation.x = 0.35;
  return { group: g, turret, elbow };
}

function camRig() {
  const g = new THREE.Group();
  const housing = box(0.34, 0.26, 0.56, materials.solid);
  g.add(housing);
  const coneGeo = new THREE.ConeGeometry(1.5, 3.4, 4, 1, true);
  coneGeo.translate(0, -1.7, 0);
  coneGeo.rotateY(Math.PI / 4);
  const cone = new THREE.Mesh(coneGeo, new THREE.MeshBasicMaterial({ color: LAMP.yellow, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }));
  g.add(cone);
  return { group: g, cone };
}

function buildStations() {
  STATIONS.forEach((s, i) => {
    const g = new THREE.Group();
    g.position.x = xAt(i);
    g.userData.id = s.id;

    // gantry: two posts and a header beam over the lane
    const postL = box(0.22, 3.6, 0.22, materials.steel); postL.position.set(-PITCH * 0.32, 1.8, -2.1);
    const postR = box(0.22, 3.6, 0.22, materials.steel); postR.position.set(-PITCH * 0.32, 1.8, 2.1);
    const beam = box(0.26, 0.26, 4.5, materials.steel); beam.position.set(-PITCH * 0.32, 3.6, 0);
    g.add(postL, postR, beam);

    const tower = andonTower();
    tower.group.position.set(-PITCH * 0.32, 3.73, -2.1);
    g.add(tower.group);

    let robot = null, cam = null;
    if (s.kind === "sealer") {
      robot = sealerRobot();
      robot.group.position.set(0.4, 0, -3.2);
      g.add(robot.group);
      cam = camRig();
      cam.group.position.set(-PITCH * 0.32 + 0.3, 3.35, 0.9);
      g.add(cam.group);
    } else if (s.kind === "body") {
      [-1, 1].forEach((side) => {
        const clamp = box(0.5, 1.5, 0.5, materials.solid);
        clamp.position.set(0.6, 0.75, side * 2.6);
        const arm = box(0.9, 0.18, 0.18, materials.steel);
        arm.position.set(0.6, 1.45, side * 2.2);
        g.add(clamp, arm);
      });
    } else if (s.kind === "paint") {
      const stand = cyl(0.06, 1.3, materials.steel, 10); stand.position.set(0.8, 0.65, 3.0);
      const tablet = box(0.9, 0.62, 0.06, materials.solid); tablet.position.set(0.8, 1.5, 3.0); tablet.rotation.x = -0.35;
      g.add(stand, tablet);
    } else if (s.kind === "final") {
      // inspection light tunnel
      [-1.4, 0, 1.4].forEach((dx) => {
        const arch = new THREE.Group();
        const l = box(0.14, 2.9, 0.14, materials.steel); l.position.set(0, 1.45, -2.2);
        const r = box(0.14, 2.9, 0.14, materials.steel); r.position.set(0, 1.45, 2.2);
        const t = box(0.14, 0.14, 4.54, materials.steel); t.position.set(0, 2.9, 0);
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 3.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.9 }));
        bar.position.set(0, 2.8, 0);
        arch.add(l, r, t, bar);
        arch.position.x = dx;
        g.add(arch);
      });
    }

    // invisible hit box makes the whole bay clickable
    const hit = new THREE.Mesh(new THREE.BoxGeometry(PITCH * 0.9, 4.6, 6.4), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 2.3;
    hit.userData.id = s.id;
    g.add(hit);
    pickables.push(hit);

    scene.add(g);
    stationObjs.set(s.id, { s, group: g, tower, robot, cam, label: null });
  });
}

/* ---------- Bodies on skids ---------- */
let bodyGeo;
function makeBodyGeometry() {
  const sh = new THREE.Shape();
  sh.moveTo(-2.2, 0.32);
  sh.lineTo(-1.82, 0.32);
  sh.absarc(-1.36, 0.32, 0.44, Math.PI, 0, true);
  sh.lineTo(0.95, 0.32);
  sh.absarc(1.4, 0.32, 0.44, Math.PI, 0, true);
  sh.lineTo(2.2, 0.32);
  sh.lineTo(2.26, 1.05);
  sh.lineTo(2.08, 1.58);
  sh.lineTo(-0.28, 1.66);
  sh.lineTo(-1.02, 1.08);
  sh.lineTo(-2.12, 0.92);
  sh.lineTo(-2.27, 0.58);
  sh.closePath();
  const win1 = new THREE.Path();
  win1.moveTo(-0.86, 1.1); win1.lineTo(-0.3, 1.52); win1.lineTo(0.55, 1.53); win1.lineTo(0.55, 1.1); win1.closePath();
  const win2 = new THREE.Path();
  win2.moveTo(0.72, 1.1); win2.lineTo(0.72, 1.53); win2.lineTo(1.92, 1.5); win2.lineTo(2.02, 1.1); win2.closePath();
  sh.holes.push(win1, win2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: 1.76, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1, curveSegments: 10 });
  g.translate(0, 0, -0.88);
  return g;
}

const bodies = [];
let bodySerial = 31484;              // K2-27-031484 enters first; 031487 sits at st-04
function newBody(slot) {
  const id = `K2-27-0${bodySerial++}`;
  const g = new THREE.Group();
  const shell = withEdges(new THREE.Mesh(bodyGeo, materials.body), 24);
  shell.position.y = 0.28;
  g.add(shell);
  [-0.62, 0.62].forEach((z) => {
    const rail = box(4.7, 0.1, 0.16, materials.steel);
    rail.position.set(0, 0.24, z);
    g.add(rail);
  });
  g.position.set(xAt(slot), 0.18, 0);
  scene.add(g);
  const b = { id, slot, group: g, shell, tag: null };
  bodies.push(b);
  return b;
}

/* ---------- Labels (HTML, projected) ---------- */
function mountLabels() {
  labelsEl.innerHTML = "";
  stationObjs.forEach((o) => {
    const el = document.createElement("div");
    el.className = "line-label";
    el.dataset.id = o.s.id;
    labelsEl.append(el);
    o.label = el;
  });
}
function labelHTML(o) {
  const st = o.s.state;
  const chip = st === "andon" ? '<em data-tone="caution">Yellow andon</em>'
    : st === "stopped" ? '<em data-tone="stop">Line stopped</em>'
    : st === "review" ? '<em data-tone="instruct">Model review</em>'
    : st === "contained" ? '<em>Contained</em>' : "";
  return `<b>${o.s.id}</b>${chip}`;
}
const tagEl = document.createElement("div");
tagEl.className = "line-tag";
labelsEl.after(tagEl);

/* ---------- State and decisions ---------- */
const state = { selected: "st-04", line: "running", paused: reduce.matches, flaggedNote: "Waiting for team leader" };

function lampsFor(o) {
  const st = o.s.state;
  if (state.line === "stopped" && o.s.id === "st-04") return { red: 1 };
  if (st === "andon") return { yellow: 1, green: 0.35 };
  if (st === "review") return { blue: 1, green: 0.35 };
  if (st === "contained") return { yellow: 0.5, green: 0.35 };
  return { green: 0.35 };
}

function applyLamps(t) {
  stationObjs.forEach((o) => {
    const on = lampsFor(o);
    Object.entries(o.tower.lamps).forEach(([k, l]) => {
      let v = on[k] ?? 0;
      // only the lamp that needs a person breathes; steady when motion is paused
      if (v === 1 && (k === "yellow" || k === "red") && !state.paused) v = 0.72 + 0.28 * Math.sin(t * 4.2);
      l.m.emissiveIntensity = v * 2.4;
      l.m.color.setHex(v > 0 ? 0xffffff : current.lampOff);
      l.glow.material.opacity = v > 0.5 ? v * 0.85 : v * 0.3;
    });
  });
}

let current = PALETTES.light;
function applyTheme() {
  current = isDark() ? PALETTES.dark : PALETTES.light;
  scene.fog.color.setHex(current.fog);
  materials.floor.color.setHex(current.floor);
  materials.lane.color.setHex(current.lane);
  materials.solid.color.setHex(current.solid);
  materials.body.color.setHex(current.body);
  flagMat.color.setHex(current.flag);
  materials.steel.color.setHex(current.steel);
  materials.slat.color.setHex(current.steel);
  grid.material.color.setHex(current.grid);
  edgeMats.forEach((m) => { m.color.setHex(current.edge); m.opacity = m === zoneMat ? current.edgeOpacity * 0.7 : current.edgeOpacity; });
  hemi.color.setHex(current.hemiSky);
  hemi.groundColor.setHex(current.hemiGround);
  hemi.intensity = current.hemi;
  sun.intensity = current.sun;
  if (renderer) renderer.toneMappingExposure = current.exposure;
  requestRender();
}

function select(id, { fromCanvas = false } = {}) {
  state.selected = id;
  stationObjs.forEach((o) => {
    const on = o.s.id === id;
    o.label.dataset.selected = on;
    if (o.cam) o.cam.cone.material.opacity = on ? 0.12 : 0;
  });
  if (controls && narrow()) flyTo(framing(id));
  document.dispatchEvent(new CustomEvent("line:select", { detail: { id, fromCanvas } }));
  requestRender();
}

function decide(kind) {
  const st04 = stationObjs.get("st-04").s;
  if (kind === "stop") { state.line = "stopped"; st04.state = "stopped"; state.flaggedNote = `Held for repair at ${flaggedAt() ?? "st-04"}`; }
  if (kind === "restart") { state.line = "running"; st04.state = undefined; state.flaggedNote = "Repaired · recheck at final-01"; }
  if (kind === "contain") { st04.state = "contained"; state.flaggedNote = "Contained · check at final-01"; }
  if (kind === "continue") { st04.state = undefined; state.flaggedNote = "Continue with check at final-01"; }
  stationObjs.forEach((o) => { o.label.innerHTML = labelHTML(o); });
  document.dispatchEvent(new CustomEvent("line:state", { detail: { line: state.line } }));
  requestRender();
}

/* ---------- Animation ---------- */
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 4);
let clockStart = performance.now();
let cycleT = MOVE + 0.4;         // seconds into current takt; start in a dwell
let lastNow = performance.now();
let introT = reduce.matches ? 1 : 0;
let bodiesDone = 68;           // ES Appendix D: about 300 per shift; 08:42 at takt 1.5 min

function stepLine(dt) {
  if (state.line !== "running" || state.paused) return;
  cycleT += dt;
  if (cycleT >= CYCLE) {
    cycleT -= CYCLE;
    bodies.forEach((b) => { b.slot += 1; });
    for (let i = bodies.length - 1; i >= 0; i--) {
      if (bodies[i].slot > STATIONS.length) { scene.remove(bodies[i].group); bodies.splice(i, 1); }
    }
    newBody(-1);
    bodiesDone += 1;
    document.dispatchEvent(new CustomEvent("line:takt", { detail: { bodiesDone } }));
  }
}

function placeBodies(t) {
  const moving = state.line === "running" && cycleT < MOVE;
  const k = moving ? easeInOut(cycleT / MOVE) : 0;
  bodies.forEach((b) => {
    // bodies sit at slot during dwell and slide to slot+1 during the first MOVE seconds of the next takt
    const from = b.slot - 1;
    const x = moving ? xAt(from + k) : xAt(b.slot);
    b.group.position.x = x;
  });
  // robot sweeps while a body dwells in a sealer bay
  stationObjs.forEach((o, id) => {
    if (!o.robot) return;
    const dwelling = !moving && state.line === "running" && !state.paused;
    const phase = dwelling ? (cycleT - MOVE) / (CYCLE - MOVE) : 0;
    o.robot.turret.rotation.y = dwelling ? -0.55 + Math.sin(phase * Math.PI) * 1.1 : -0.55;
    o.robot.elbow.rotation.x = 0.35 + (dwelling ? Math.sin(phase * Math.PI * 2) * 0.08 : 0);
  });
}

const v = new THREE.Vector3();
function placeLabels() {
  const w = stage.clientWidth, h = stage.clientHeight;
  stationObjs.forEach((o) => {
    v.set(o.group.position.x - PITCH * 0.32, 6.0, -2.1).project(camera);
    const visible = v.z < 1;
    o.label.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    o.label.style.visibility = visible ? "visible" : "hidden";
  });
  const fb = bodies.find((b) => b.id === FLAGGED);
  if (fb) {
    v.set(fb.group.position.x, 2.6, 0).project(camera);
    tagEl.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -100%)`;
    tagEl.innerHTML = `<span class="mono">${FLAGGED}</span><span>${state.flaggedNote}</span>`;
    tagEl.hidden = false;
    fb.shell.children[0].material = flagEdge;
    fb.shell.material = flagMat;
  } else tagEl.hidden = true;
}
const flagEdge = new THREE.LineBasicMaterial({ color: 0x6b4f00, transparent: true, opacity: 0.8 });
const flagMat = new THREE.MeshStandardMaterial({ color: 0xf7d46a, roughness: 0.55 });

/* Wide stages show the whole line; narrow ones follow the chosen station. */
let fly = null;
const narrow = () => stage.clientWidth / stage.clientHeight < 1.25;
function framing(id = state.selected) {
  if (!narrow()) return HOME;
  const x = xAt(STATIONS.findIndex((s) => s.id === id));
  return { pos: new THREE.Vector3(x - 15, 13, 17), target: new THREE.Vector3(x + 1.5, 1, -0.5) };
}
function introFrom() {
  return narrow() ? framing().pos.clone().add(new THREE.Vector3(-14, 16, 18)) : INTRO_FROM;
}
function flyTo(f) {
  if (reduce.matches || introT < 1) { camera.position.copy(f.pos); controls.target.copy(f.target); requestRender(); return; }
  fly = { fromP: camera.position.clone(), fromT: controls.target.clone(), toP: f.pos.clone(), toT: f.target.clone(), t: 0 };
}

let needsRender = true;
let visible = true;
function requestRender() { needsRender = true; }

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastNow) / 1000);
  lastNow = now;
  if (!visible || document.hidden || !renderer) return;
  const t = (now - clockStart) / 1000;
  const animating = !state.paused || introT < 1 || !!fly;

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
  stepLine(dt);
  if (!interactive && introT === 1 && !fly && !state.paused) {
    const f = framing();
    const a = Math.sin(t * 0.12) * 0.07;
    const off = f.pos.clone().sub(f.target).applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    camera.position.copy(f.target).add(off);
  }
  const changed = controls.update();
  if (!animating && !changed && !needsRender) return;
  placeBodies(t);
  applyLamps(t);
  placeLabels();
  renderer.render(scene, camera);
  needsRender = false;
}

/* ---------- Setup ---------- */
mat("solid", 0xf3f3f3);
mat("steel", 0xb9b9b9, { metalness: 0.3, roughness: 0.6 });
mat("body", 0xf7f7f7, { roughness: 0.55 });

let controls;
const interactive = stage.dataset.interactive !== "false";
const controlsAllowed = interactive && matchMedia("(pointer: fine)").matches;
const viewShift = Number(stage.dataset.shift || 0);   // fraction of width the scene moves right
const viewShiftY = Number(stage.dataset.shiftY || 0); // fraction of height the scene moves down

function resize() {
  const w = stage.clientWidth, h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // keep the whole line in frame on narrow stages
  camera.fov = w / h < 1.2 ? 50 : w / h < 1.7 ? 37 : 30;
  if ((viewShift || viewShiftY) && !narrow()) camera.setViewOffset(w, h, -w * viewShift, -h * viewShiftY, w, h);
  else camera.clearViewOffset();
  camera.updateProjectionMatrix();
  requestRender();
}

function init() {
  if (!renderer) return;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  bodyGeo = makeBodyGeometry();
  buildStations();
  for (let s = 0; s < STATIONS.length; s++) if (s !== 5) newBody(s);   // one empty bay reads as a real line
  // K2-27-031487 must sit at st-04 (slot 3)
  bodies.forEach((b) => { b.id = `K2-27-0${31484 + 3 - b.slot + 3}`; });
  bodySerial = 31491;
  mountLabels();
  stationObjs.forEach((o) => { o.label.innerHTML = labelHTML(o); });

  controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minDistance = 24;
  controls.maxDistance = 95;
  controls.minPolarAngle = 0.45;
  controls.maxPolarAngle = 1.2;
  controls.minAzimuthAngle = -0.9;
  controls.maxAzimuthAngle = 0.6;
  controls.enabled = controlsAllowed && introT === 1;
  controls.addEventListener("change", requestRender);

  applyTheme();
  resize();
  camera.position.copy(introT === 1 ? framing().pos : introFrom());
  controls.target.copy(framing().target);
  new ResizeObserver(resize).observe(stage);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) requestRender(); }).observe(stage);
  new MutationObserver(applyTheme).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  // picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  canvas.addEventListener("pointerdown", (e) => { down = [e.clientX, e.clientY]; });
  canvas.addEventListener("pointerup", (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    if (hit) select(hit.object.userData.id, { fromCanvas: true });
  });
  canvas.addEventListener("pointermove", (e) => {
    if (e.buttons) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    canvas.style.cursor = hit ? "pointer" : controls.enabled ? "grab" : "default";
    stationObjs.forEach((o) => { o.label.dataset.hover = hit?.object.userData.id === o.s.id; });
  });

  select(state.selected);
  requestAnimationFrame(frame);
}

function resetView() { flyTo(framing()); }

function setPaused(p) { state.paused = p; requestRender(); }

init();

function flaggedAt() {
  const b = bodies.find((x) => x.id === FLAGGED);
  if (!b) return null;
  return b.slot >= 0 && b.slot < STATIONS.length ? STATIONS[b.slot].id : "past final-01";
}

window.LLLine = { select, decide, resetView, setPaused, state, STATIONS, flaggedAt, takt: () => ({ cycleT, CYCLE }) };
document.dispatchEvent(new CustomEvent("line:ready"));
})();
