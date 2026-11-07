/* eslint-disable @typescript-eslint/ban-ts-comment -- plain JS module shared with the v2 video and mockup */
// @ts-nocheck
/* Shared with the v2 video (video-production/learning-line-v2/assets/plant3d.js); keep the two in sync. */
/*
 * plant3d.js — white clay architectural model of the Karawang car-body plant.
 *
 * Deterministic: no clock, no rAF, no Math.random. The same state always
 * renders the same pixels, so a HyperFrames timeline (or any web page) can
 * seek freely by calling render(state).
 *
 *   import { createPlant } from "./assets/plant3d.js";
 *   const plant = await createPlant(canvas, { width: 1920, height: 1080 });
 *   plant.render({ t, flow, cam: plant.presets.sealerCell, routes: { shift: 1 } });
 *
 * See video-production/learning-line-v2/assets/PLANT3D.md for the full state reference.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { HorizontalTiltShiftShader } from "three/examples/jsm/shaders/HorizontalTiltShiftShader.js";
import { VerticalTiltShiftShader } from "three/examples/jsm/shaders/VerticalTiltShiftShader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ constants */

export const STATIONS = [
  { id: "st-01", type: "sealer" }, { id: "st-02", type: "sealer" }, { id: "st-03", type: "body" },
  { id: "st-04", type: "sealer" }, { id: "st-05", type: "body" }, { id: "st-06", type: "body" },
  { id: "paint-bm", type: "paint" }, { id: "final-01", type: "final_inspection" },
];
const K1_STATIONS = ["k1-01", "k1-02", "k1-03", "k1-04", "k1-05", "k1-06"];
const VARIANTS = ["urban", "kiri", "van", "hatch"];
const PITCH = 6.4;
const MOVE = 0.3;                       // fraction of a takt cycle spent travelling
const N = STATIONS.length;
const xAt = (slot) => -((N - 1) * PITCH) / 2 + slot * PITCH;
const K1Z = -33, K1N = K1_STATIONS.length;
const k1xAt = (slot) => -((K1N - 1) * PITCH) / 2 + slot * PITCH;
const BAY_Z = 7.2;

export const COLORS = { yellow: 0xf2b705, blue: 0x0066b1, green: 0x1a7a3d, red: 0xeb0a1e };
const C = {
  bg: 0xe4e4e4, slab: 0xe9e9e7, slabSide: 0xd9d9d7, road: 0xd8d7d4, mark: 0xfbfbfa,
  floor: 0xe3e3e1, aisle: 0xcacac8, clay: 0xf4f4f2, clay2: 0xe9e9e7, clay3: 0xdcdcda,
  // v3 premium look: screen-space sky gradient (top cool → horizon warm) and sage clay trees
  skyTop: 0xe2e5e9, skyBottom: 0xf1efeb, tree: 0xa9b8a0, trunk: 0xd8d2c4,
  window: 0xcfd1d3, biw: 0xa7abb0, lampOff: 0xd6d6d4, lane: 0xc9cbcd, slat: 0xb3b6b9,
};

/* small helpers */
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, k) => a + (b - a) * k;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------------------ layout */

const HALL_K2 = { x0: -34, x1: 34, z0: -11, z1: 15 };
const HALL_K1 = { x0: -34, x1: 34, z0: -45, z1: -21 };
const HALL_FA = { x0: 42, x1: 64, z0: -34, z1: 4 };
const OFFICE = { x0: -62, x1: -48, z0: 0, z1: 13, h: 7.6 };

const ST04 = xAt(3);
const ANDON_X = ST04 - PITCH * 0.32;   // gantry line of a station
const TABLET = [ST04 + 3.0, 0, 3.7];
const OPERATOR = [ST04 + 3.6, 0, 4.7];   // clear of the repair-bay lane (flagged body spans ST04 ± 2.3)
const TL_DESK = [-13.5, 0, 10.2];
const ENGINEER = [-44.2, 0, 8.6];
const EXPERT = [-42.4, 0, 10.2];
const KAIZEN_BOARD = [-43.0, 0, 5.4];

/** Camera shots, tuned for 16:9. */
export const PRESETS = {
  aerial: { pos: [-58, 140, 112], target: [0, 0, -8], fov: 28 },
  campus: { pos: [-118, 66, 104], target: [-2, 0, -8], fov: 26 },
  hallK2: { pos: [-40, 36, 46], target: [-1, 0, -1], fov: 28 },
  line: { pos: [-34, 17, 34], target: [1, 0.5, 0.5], fov: 27 },
  sealerCell: { pos: [-9.6, 7.4, 11.8], target: [-2.4, 1.6, 1.4], fov: 30 },
  operator: { pos: [-5.5, 3.6, 12.5], target: [-0.4, 1.4, 3.2], fov: 24 },
  tlWalk: { pos: [-24, 10, 22], target: [-7, 0.8, 5], fov: 27 },
  repairBay: { pos: [-15, 10, 21], target: [-3.0, 1.6, 4.6], fov: 28 },
  finalInspection: { pos: [9.5, 7.5, 15.5], target: [22.0, 2.2, 0.5], fov: 28 },
  office: { pos: [-37.5, 11, 25], target: [-44, 1.4, 7.5], fov: 30 },
  yokoten: { pos: [-68, 44, 42], target: [-25, 0, -11], fov: 28 },
  rollout: { pos: [-62, 98, 96], target: [12, 0, -17], fov: 28 },
  closing: { pos: [-92, 30, 74], target: [-2, 2, -8], fov: 22 },
};

/* ------------------------------------------------------------------ body tracking (pure, no scene needed) */

/** Continuous line offset: a body with serial n sits at slot position n + lineP(flow). */
function lineP(flow, stopped = false) {
  const cyc = Math.floor(flow), ph = flow - cyc;
  return stopped ? cyc : cyc - 1 + easeInOut(clamp01(ph / MOVE));
}
const BODY_TOP = 2.0;
/** K2 serial of the body that sits at station index idx when flow == atFlow. */
const serialAt = (idx, atFlow) => Math.round(idx - lineP(atFlow));
/**
 * World position [x, y, z] (y = roof height) of the defect body: the K2 body that sat at st-04 when
 * flow == state.defect.startFlow, at the current state.flow. Follows it all the way to final-01 and beyond
 * (past final-01 the body leaves the line; the position keeps extrapolating along x).
 */
export function defectBodyPos(state = {}) {
  const flow = state.flow ?? 0;
  const start = state.defect?.startFlow ?? flow;
  const n = serialAt(3, start);
  return [xAt(n + lineP(flow, !!state.stopped)), BODY_TOP, 0];
}

/* ------------------------------------------------------------------ factory */

export async function createPlant(canvas, opts = {}) {
  const W = opts.width ?? 1920, H = opts.height ?? 1080;
  const PR = opts.pixelRatio ?? 1;
  const base = opts.modelBase ?? "assets/models";
  const useAO = opts.ao ?? true, useDOF = opts.dof ?? true;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(PR);
  renderer.setSize(W, H, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  // subtle vertical gradient behind the model: cool upper sky, warmer and lighter at the horizon/bottom
  const skyTex = (() => {
    const S = 256, data = new Uint8Array(2 * S * 4);
    // hex values are sRGB; keep them raw (no linear conversion) because the texture is tagged sRGB
    const top = new THREE.Color().setHex(C.skyTop, THREE.LinearSRGBColorSpace), bot = new THREE.Color().setHex(C.skyBottom, THREE.LinearSRGBColorSpace), c = new THREE.Color();
    for (let y = 0; y < S; y++) {
      const v = y / (S - 1);                 // 0 = bottom row, 1 = top row
      c.copy(bot).lerp(top, smooth(v * 1.15 - 0.05));
      for (let x = 0; x < 2; x++) {
        const i = (y * 2 + x) * 4;
        data[i] = Math.round(c.r * 255); data[i + 1] = Math.round(c.g * 255); data[i + 2] = Math.round(c.b * 255); data[i + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, 2, S);
    t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  })();
  scene.background = skyTex;
  scene.fog = new THREE.Fog(new THREE.Color(C.skyTop).lerp(new THREE.Color(C.skyBottom), 0.6), 200, 600);
  const camera = new THREE.PerspectiveCamera(28, W / H, 0.5, 900);

  /* lights: warm key sun (~5200 K) + cool sky fill, warm bounce from the ground */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.26;
  const hemi = new THREE.HemisphereLight(0xe4ecf8, 0xcbc7c0, 0.64);
  const sun = new THREE.DirectionalLight(0xfff5e9, 1.95);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 12;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.03;
  const SUN_DIR = new THREE.Vector3(-0.62, 1.0, -0.22).normalize();
  scene.add(hemi, sun, sun.target);

  /* materials */
  const clayMat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.0, ...extra });
  const M = {
    slab: clayMat(C.slab), slabSide: clayMat(C.slabSide), road: clayMat(C.road), mark: clayMat(C.mark),
    floor: clayMat(C.floor), aisle: clayMat(C.aisle), clay: clayMat(C.clay), clay2: clayMat(C.clay2), clay3: clayMat(C.clay3),
    window: clayMat(C.window, { roughness: 0.55, metalness: 0.05 }),
    steel: clayMat(0xdfe1e3, { roughness: 0.7, metalness: 0.1 }),
    lane: clayMat(C.lane, { roughness: 0.6, metalness: 0.25 }), slat: clayMat(C.slat, { roughness: 0.6, metalness: 0.3 }),
    biw: new THREE.MeshStandardMaterial({ color: C.biw, roughness: 0.42, metalness: 0.55 }),
    shellWhite: new THREE.MeshStandardMaterial({ color: 0xf3f3f1, roughness: 0.38, metalness: 0.05 }),
    glass: new THREE.MeshStandardMaterial({ color: 0xa9adb2, roughness: 0.2, metalness: 0.2 }),
    tyre: clayMat(0x8d9094), trim: clayMat(0xc4c6c8),
    flag: new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.45, metalness: 0.15 }),
    person: clayMat(0xf6f5f3), helmet: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    robot: clayMat(0xf6f6f4, { roughness: 0.75 }), joint: clayMat(0xc9cbcd, { roughness: 0.6, metalness: 0.15 }),
    bead: new THREE.MeshStandardMaterial({ color: 0xfff3cf, roughness: 0.35, emissive: 0x6b5a22 }),
    roof: clayMat(0xf3f2ef, { transparent: false }),
    tree: clayMat(C.tree, { roughness: 0.95 }), trunk: clayMat(C.trunk),
  };
  const shadowed = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
  const mesh = (g, m, cast = true) => shadowed(new THREE.Mesh(g, m), cast);
  const box = (w, h, d, m) => mesh(new THREE.BoxGeometry(w, h, d), m);
  const cyl = (r, h, m, seg = 20) => mesh(new THREE.CylinderGeometry(r, r, h, seg), m);

  /* static geometry is merged per material for speed */
  const statics = new Map();
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(1, 1, 1), _p = new THREE.Vector3();
  function addStatic(geo, mat, x, y, z, ry = 0, cast = true) {
    _p.set(x, y, z); _q.setFromEuler(_e.set(0, ry, 0));
    _m4.compose(_p, _q, _s);
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.clearGroups();
    g.applyMatrix4(_m4);
    for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k);
    const key = mat.uuid + (cast ? "c" : "n");
    if (!statics.has(key)) statics.set(key, { mat, cast, list: [] });
    statics.get(key).list.push(g);
  }
  const sBox = (w, h, d, mat, x, y, z, ry = 0, cast = true) => addStatic(new THREE.BoxGeometry(w, h, d), mat, x, y, z, ry, cast);
  const sCyl = (r, h, mat, x, y, z, seg = 16) => addStatic(new THREE.CylinderGeometry(r, r, h, seg), mat, x, y, z);
  function flushStatics(parent) {
    statics.forEach(({ mat, cast, list }) => {
      const merged = mergeGeometries(list, false);
      const m = mesh(merged, mat, cast);
      parent.add(m);
    });
    statics.clear();
  }

  /* soft glow sprite: white RGB everywhere, alpha falloff (no dark fringes) */
  const glowTex = (() => {
    const S = 64, data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2);
      const a = Math.pow(clamp01(1 - d), 2.2);
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const t = new THREE.DataTexture(data, S, S);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  })();
  /* soft floor pool: broad radial falloff, full alpha at the centre, 0 at the edge, no rim */
  const poolTex = (() => {
    const S = 128, data = new Uint8Array(S * S * 4);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const d = Math.min(1, Math.hypot(x + 0.5 - S / 2, y + 0.5 - S / 2) / (S / 2));
      const a = Math.pow(1 - d * d, 2.2);
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const t = new THREE.DataTexture(data, S, S);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  })();
  const poolGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMesh = (color, size, y = 0.11) => {
    const m = new THREE.Mesh(poolGeo, new THREE.MeshBasicMaterial({ map: poolTex, color, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.scale.set(size, 1, size); m.position.y = y; m.userData.noAO = true; m.renderOrder = 3; m.userData.size = size;
    return m;
  };
  const glowSprite = (color, size) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, opacity: 0, fog: false }));
    sp.scale.set(size, size, 1);
    sp.userData.noAO = true;
    sp.renderOrder = 5;
    return sp;
  };

  /* ================================================================ ground */
  const world = new THREE.Group();
  scene.add(world);
  {
    const sx0 = -76, sx1 = 80, sz0 = -60, sz1 = 46, r = 10;
    const shape = new THREE.Shape();
    shape.moveTo(sx0 + r, sz0); shape.lineTo(sx1 - r, sz0); shape.quadraticCurveTo(sx1, sz0, sx1, sz0 + r);
    shape.lineTo(sx1, sz1 - r); shape.quadraticCurveTo(sx1, sz1, sx1 - r, sz1); shape.lineTo(sx0 + r, sz1);
    shape.quadraticCurveTo(sx0, sz1, sx0, sz1 - r); shape.lineTo(sx0, sz0 + r); shape.quadraticCurveTo(sx0, sz0, sx0 + r, sz0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: true, bevelThickness: 0.6, bevelSize: 0.6, bevelSegments: 4, curveSegments: 24 });
    geo.rotateX(Math.PI / 2);           // extrude goes down (-y), shape xy -> xz
    geo.translate(0, -0.6, 0);
    const slab = mesh(geo, [M.slab, M.slabSide], false);
    slab.receiveShadow = true;
    world.add(slab);
    // big shadow catcher under the slab, same colour as the background
    const under = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.08 }));
    under.rotation.x = -Math.PI / 2; under.position.y = -3.4; under.receiveShadow = true;
    world.add(under);
  }
  // roads (flat decals) + dashed lane marks
  const roadStrip = (x0, x1, z0, z1) => {
    sBox(x1 - x0, 0.04, z1 - z0, M.road, (x0 + x1) / 2, 0.02, (z0 + z1) / 2, 0, false);
    const horiz = x1 - x0 > z1 - z0;
    const len = horiz ? x1 - x0 : z1 - z0;
    for (let s = 1.5; s < len - 1.5; s += 4.2) {
      if (horiz) sBox(2.2, 0.02, 0.18, M.mark, x0 + s, 0.05, (z0 + z1) / 2, 0, false);
      else sBox(0.18, 0.02, 2.2, M.mark, (x0 + x1) / 2, 0.05, z0 + s, 0, false);
    }
  };
  roadStrip(-70, 74, -19.5, -14.5);     // between the halls
  roadStrip(-70, 38, 18.5, 23.5);       // south road
  roadStrip(36, 41, -56, 42);           // east spine
  roadStrip(-42, -37, -56, 42);         // west spine (office side)
  roadStrip(-70, 74, -55, -50.5);       // north road
  // crossings: zebra marks
  for (let i = 0; i < 6; i++) sBox(0.7, 0.02, 4.2, M.mark, -33 + i * 1.3, 0.05, 21, 0, false);

  /* ================================================================ halls */
  function hall(h, doors, roofTeeth) {
    const g = new THREE.Group();
    const T = 0.45, WH = 1.7, CH = 6.6;
    const southCols = [];
    const w = h.x1 - h.x0, d = h.z1 - h.z0, cx = (h.x0 + h.x1) / 2, cz = (h.z0 + h.z1) / 2;
    sBox(w, 0.06, d, M.floor, cx, 0.03, cz, 0, false);
    // wall runs with door gaps: doors = [{side:"n"|"s"|"e"|"w", a, b}]
    const run = (side) => {
      const horiz = side === "n" || side === "s";
      const fixed = side === "n" ? h.z0 : side === "s" ? h.z1 : side === "w" ? h.x0 : h.x1;
      const lo = horiz ? h.x0 : h.z0, hi = horiz ? h.x1 : h.z1;
      const gaps = doors.filter((dd) => dd.side === side).sort((a, b) => a.a - b.a);
      let cur = lo;
      const seg = (a, b) => {
        if (b - a < 0.05) return;
        if (horiz) sBox(b - a, WH, T, M.clay, (a + b) / 2, WH / 2, fixed);
        else sBox(T, WH, b - a, M.clay, fixed, WH / 2, (a + b) / 2);
      };
      gaps.forEach((gp) => { seg(cur, gp.a); cur = gp.b; });
      seg(cur, hi);
      // columns along the wall
      for (let p = lo; p <= hi + 0.01; p += 8.5) {
        const inGap = gaps.some((gp) => p > gp.a - 0.3 && p < gp.b + 0.3);
        if (inGap) continue;
        if (side === "s") southCols.push([Math.min(p, hi), fixed]);
        else if (horiz) sBox(0.7, CH, 0.7, M.clay, Math.min(p, hi), CH / 2, fixed);
        else sBox(0.7, CH, 0.7, M.clay, fixed, CH / 2, Math.min(p, hi));
      }
    };
    ["n", "s", "e", "w"].forEach(run);
    // aisle lane marks on the floor
    sBox(w - 4, 0.02, 0.14, M.aisle, cx, 0.07, h.z1 - 3.2, 0, false);
    sBox(w - 4, 0.02, 0.14, M.aisle, cx, 0.07, h.z0 + 3.2, 0, false);
    // removable sawtooth roof
    const roof = new THREE.Group();
    const teeth = roofTeeth ?? Math.round(w / 6.5);
    const tw = w / teeth;
    const tri = new THREE.Shape();
    tri.moveTo(0, 0); tri.lineTo(tw, 0); tri.lineTo(tw, 2.0); tri.lineTo(tw - 0.5, 2.0); tri.lineTo(0, 0);
    const toothGeo = new THREE.ExtrudeGeometry(tri, { depth: d + 0.8, bevelEnabled: false });
    const roofList = [];
    for (let i = 0; i < teeth; i++) {
      const tg = toothGeo.clone(); tg.translate(h.x0 + i * tw, CH + 0.35, h.z0 - 0.4);
      roofList.push(tg.index ? tg.toNonIndexed() : tg);
    }
    const slabGeo = new THREE.BoxGeometry(w + 0.8, 0.35, d + 0.8).toNonIndexed();
    slabGeo.translate(cx, CH + 0.18, cz);
    roofList.push(slabGeo);
    southCols.forEach(([x, z]) => { const cg = new THREE.BoxGeometry(0.7, CH, 0.7).toNonIndexed(); cg.translate(x, CH / 2, z); roofList.push(cg); });
    roofList.forEach((rg) => { rg.clearGroups(); for (const k of Object.keys(rg.attributes)) if (!["position", "normal", "uv"].includes(k)) rg.deleteAttribute(k); });
    const roofMat = M.roof.clone();
    const roofMesh = mesh(mergeGeometries(roofList, false), roofMat);
    roof.add(roofMesh);
    g.add(roof);
    world.add(g);
    return { group: g, roof, roofMat };
  }
  const hallK2 = hall(HALL_K2, [
    { side: "w", a: -8.5, b: -3.5 }, { side: "n", a: -15.5, b: -9.5 }, { side: "s", a: 20, b: 30 }, { side: "e", a: -3, b: 3 },
  ]);
  const hallK1 = hall(HALL_K1, [{ side: "s", a: -15.5, b: -9.5 }, { side: "e", a: -3, b: 3 }, { side: "w", a: -36, b: -31 }]);
  const hallFA = hall(HALL_FA, [{ side: "w", a: -18, b: -10 }, { side: "s", a: 46, b: 52 }], 4);

  /* other campus blocks: office, press shop, paint shop, utilities */
  {
    const o = OFFICE, cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, w = o.x1 - o.x0, d = o.z1 - o.z0;
    sBox(w, o.h, d, M.clay, cx, o.h / 2, cz);
    // window bands
    for (let f = 0; f < 2; f++) {
      const y = 1.9 + f * 3.4;
      sBox(w + 0.08, 1.15, d - 1.2, M.window, cx, y, cz, 0, false);
      sBox(w - 1.2, 1.15, d + 0.08, M.window, cx, y, cz, 0, false);
      for (let i = 0; i < 6; i++) sBox(0.22, 1.2, d + 0.16, M.clay, o.x0 + 1.4 + i * 2.25, y, cz, 0, false);
    }
    sBox(w + 0.6, 0.35, d + 0.6, M.clay2, cx, o.h + 0.17, cz);
    sBox(3.2, 1.2, 2.4, M.clay2, cx - 2.5, o.h + 0.9, cz - 2);
    sBox(2.0, 0.9, 2.0, M.clay2, cx + 3, o.h + 0.8, cz + 2);
    // entrance canopy facing east
    sBox(1.4, 0.25, 4.5, M.clay, o.x1 + 0.6, 3.0, cz);
    // kaizen plaza: paved pad + board
    sBox(9, 0.05, 12, M.clay2, -42.6, 0.03, 7.5, 0, false);
  }
  sBox(18, 9.5, 20, M.clay, -55, 4.75, -36);                 // press shop
  sBox(16, 1.2, 18, M.clay2, -55, 10.1, -36);
  sBox(20, 11, 14, M.clay, 54, 5.5, -44);                    // paint shop
  for (let i = 0; i < 3; i++) sCyl(0.55, 4, M.clay2, 47 + i * 3, 13, -44);
  sCyl(2.2, 3.5, M.clay, -66, 13.5, -48); sCyl(0.5, 12, M.clay2, -66, 6, -48);   // water tower
  sBox(5, 3, 4, M.clay, -66, 1.5, 21);                        // guard house
  sBox(8, 0.25, 6, M.clay2, -66, 3.4, 21);
  sBox(10, 4, 7, M.clay, 68, 2, -14);                         // utility block
  // final assembly interior: short line of finished cars + inspection arches
  sBox(3, 0.18, 32, M.lane, 53, 0.09, -15);
  for (let i = 0; i < 3; i++) {
    const z = -6 - i * 1.6;
    sBox(0.14, 2.9, 0.14, M.steel, 50.8, 1.45, z); sBox(0.14, 2.9, 0.14, M.steel, 55.2, 1.45, z); sBox(4.54, 0.14, 0.14, M.steel, 53, 2.9, z);
  }

  /* parking + trees */
  const rnd = mulberry32(1337);
  const parkSlots = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) {
    const x = 44.5 + c * 2.6, z = 14 + r * 7;
    sBox(0.1, 0.02, 4.6, M.mark, x - 1.3, 0.05, z, 0, false);
    if (rnd() < 0.78) parkSlots.push([x, z, r % 2 ? Math.PI / 2 : -Math.PI / 2]);
  }
  sBox(25, 0.04, 22, M.road, 55, 0.02, 21, 0, false);
  const treePts = [];
  for (let x = -66; x < 34; x += 5.2) treePts.push([x + rnd() * 1.2, 26.5 + rnd() * 1.4]);
  for (let z = -46; z < 40; z += 5.4) treePts.push([-71 + rnd(), z + rnd() * 1.4]);
  for (let z = -46; z < 12; z += 5.8) treePts.push([75 + rnd(), z + rnd()]);
  for (let x = 44; x < 70; x += 4.5) treePts.push([x + rnd(), 37 + rnd()]);
  for (let x = -66; x < 74; x += 6.5) treePts.push([x + rnd(), -57.5 + rnd() * 0.5]);
  [[-48, -6], [-44, -9], [70, 30], [-62, -10], [-66, -2]].forEach((p) => treePts.push(p));
  {
    const n = treePts.length;
    const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), M.tree, n);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.2, 1, 8), M.trunk, n);
    const m4 = new THREE.Matrix4();
    treePts.forEach(([x, z], i) => {
      const r = 1.15 + rnd() * 0.6;
      m4.makeScale(r, r * 1.02, r).setPosition(x, 1.1 + r, z);
      crown.setMatrixAt(i, m4);
      m4.makeScale(1, 1.4, 1).setPosition(x, 0.7, z);
      trunk.setMatrixAt(i, m4);
    });
    [crown, trunk].forEach((im) => { im.castShadow = true; im.receiveShadow = true; world.add(im); });
  }

  /* ================================================================ lines */
  const loader = new GLTFLoader();
  function principalYaw(root) {
    root.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    let n = 0, mx = 0, mz = 0, cxx = 0, czz = 0, cxz = 0;
    const pts = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.getAttribute("position");
      for (let i = 0; i < pos.count; i += 7) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push([v.x, v.z]); mx += v.x; mz += v.z; n++; }
    });
    if (!n) return 0;
    mx /= n; mz /= n;
    for (const [x, z] of pts) { cxx += (x - mx) ** 2; czz += (z - mz) ** 2; cxz += (x - mx) * (z - mz); }
    return 0.5 * Math.atan2(2 * cxz, cxx - czz);
  }
  function normalise(gltf, len = 4.5) {
    const src = gltf.scene;
    src.rotation.y = principalYaw(src);
    const pivot = new THREE.Group();
    pivot.add(src);
    pivot.updateMatrixWorld(true);
    const s1 = new THREE.Box3().setFromObject(pivot).getSize(new THREE.Vector3());
    pivot.scale.setScalar(len / s1.x);
    pivot.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(pivot);
    const c = bb.getCenter(new THREE.Vector3());
    src.position.sub(new THREE.Vector3(c.x, bb.min.y - 0.32, c.z).divideScalar(pivot.scale.x));
    src.traverse((o) => { if (o.isMesh) o.userData.role = o.material?.name || "paint"; });
    return pivot;
  }
  const [shellsRaw, carsRaw] = await Promise.all([
    Promise.all(VARIANTS.map((v) => loader.loadAsync(`${base}/body-${v}.glb`))),
    Promise.all(VARIANTS.map((v) => loader.loadAsync(`${base}/car-${v}.glb`))),
  ]);
  const shells = shellsRaw.map((g) => normalise(g));
  const cars = carsRaw.map((g) => normalise(g));
  const carMat = (role, kind) => {
    if (/glass|window/i.test(role)) return M.glass;
    if (/tyre|tire|wheel|rubber/i.test(role)) return M.tyre;
    if (/trim|black|chrome|light|lamp/i.test(role)) return M.trim;
    return kind;
  };
  function dress(src, paint, cast = true) {
    const s = src.clone(true);
    s.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = cast; o.receiveShadow = true;
      o.material = paint === M.biw || paint === M.flag ? paint : carMat(o.userData.role ?? "", paint);
    });
    return s;
  }
  const skid = () => {
    const g = new THREE.Group();
    [-0.62, 0.62].forEach((z) => { const rail = box(4.7, 0.1, 0.16, M.steel); rail.position.set(0, 0.24, z); g.add(rail); });
    return g;
  };

  // bead path per variant: ray-cast onto the roof edge facing the robot (-z side)
  const ray = new THREE.Raycaster();
  const beadCurves = shells.map((sh) => {
    sh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(sh);
    const meshes = []; sh.traverse((o) => o.isMesh && meshes.push(o));
    const zLine = bb.max.z * 0.4, pts = [];
    let lastY = bb.max.y - 0.05;
    for (let i = 0; i <= 28; i++) {
      const x = lerp(bb.min.x * 0.32, bb.max.x * 0.22, i / 28);
      ray.set(new THREE.Vector3(x, bb.max.y + 2, zLine), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(meshes, false)[0];
      const y = hit && hit.point.y > bb.min.y + (bb.max.y - bb.min.y) * 0.84 ? hit.point.y + 0.012 : lastY;
      lastY = y;
      pts.push(new THREE.Vector3(x, y, zLine));
    }
    return new THREE.CatmullRomCurve3(pts);
  });
  const beadGeos = beadCurves.map((c) => new THREE.TubeGeometry(c, 120, 0.075, 8, false));
  // defect seams: roof-edge + door-line seams per variant, for the shell (stages 0/1) and the finished car (stage 2)
  function seamCurvesFor(sh) {
    sh.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(sh);
    const meshes = []; sh.traverse((o) => o.isMesh && meshes.push(o));
    const top = bb.max.y, h = bb.max.y - bb.min.y;
    const roof = [], side = [];
    let lastY = top - 0.05, lastZ = bb.max.z * 0.9;
    const yS = bb.min.y + h * 0.4;
    for (let i = 0; i <= 28; i++) {
      const x = lerp(bb.min.x * 0.32, bb.max.x * 0.22, i / 28);
      ray.set(new THREE.Vector3(x, top + 2, bb.max.z * 0.4), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObjects(meshes, false)[0];
      lastY = hit && hit.point.y > bb.min.y + h * 0.84 ? hit.point.y + 0.012 : lastY;
      roof.push(new THREE.Vector3(x, lastY, bb.max.z * 0.4));
    }
    for (let i = 0; i <= 32; i++) {
      const x = lerp(bb.min.x * 0.8, bb.max.x * 0.8, i / 32);
      ray.set(new THREE.Vector3(x, yS, bb.max.z + 2), new THREE.Vector3(0, 0, -1));
      const hit = ray.intersectObjects(meshes, false)[0];
      lastZ = hit && hit.point.z > bb.max.z * 0.6 ? hit.point.z + 0.015 : lastZ;
      side.push(new THREE.Vector3(x, yS, lastZ));
    }
    return [new THREE.CatmullRomCurve3(roof), new THREE.CatmullRomCurve3(side)];
  }
  const seamShell = shells.map(seamCurvesFor), seamCar = cars.map(seamCurvesFor);

  /* andon tower */
  function andonTower(parent, x, z) {
    const tower = new THREE.Group();
    tower.position.set(x, 3.73, z);
    const pole = cyl(0.05, 1.1, M.steel, 10); pole.position.y = 0.55; tower.add(pole);
    const lamps = {};
    ["blue", "green", "yellow", "red"].forEach((k, li) => {
      const m = new THREE.MeshStandardMaterial({ color: C.lampOff, roughness: 0.4, emissive: 0x000000 });
      const lamp = mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.3, 24), m);
      lamp.position.y = 1.24 + li * 0.34;
      const glow = glowSprite(COLORS[k], 2.4);
      lamp.add(glow);
      tower.add(lamp);
      lamps[k] = { m, glow };
    });
    const cap = cyl(0.2, 0.08, M.clay, 24); cap.position.y = 1.24 + 4 * 0.34 - 0.13; tower.add(cap);
    parent.add(tower);
    return lamps;
  }

  /* 6-axis sealer robot (nested groups, analytic IK) */
  const L1 = 2.1, L2 = 1.9, TOOL = 0.55, SH_Y = 1.15;
  function makeRobot(parent, x, z) {
    const root = new THREE.Group(); root.position.set(x, 0, z);
    const ped = cyl(0.55, 0.35, M.clay2, 28); ped.position.y = 0.175; root.add(ped);
    const baseC = cyl(0.42, 0.45, M.robot, 28); baseC.position.y = 0.57; root.add(baseC);
    const j1 = new THREE.Group(); j1.position.y = 0.8; root.add(j1);
    const turret = cyl(0.36, 0.38, M.robot, 24); turret.position.y = 0.17; j1.add(turret);
    const shoulderHousing = box(0.62, 0.5, 0.5, M.robot); shoulderHousing.position.y = 0.38; j1.add(shoulderHousing);
    const j2 = new THREE.Group(); j2.position.y = SH_Y - 0.8; j1.add(j2);
    const jc = cyl(0.25, 0.7, M.joint, 20); jc.rotation.z = Math.PI / 2; j2.add(jc);
    const upper = mesh(new THREE.CapsuleGeometry(0.19, L1 - 0.3, 6, 14), M.robot);
    upper.rotation.x = Math.PI / 2; upper.position.z = L1 / 2; j2.add(upper);
    const j3 = new THREE.Group(); j3.position.z = L1; j2.add(j3);
    const ec = cyl(0.21, 0.56, M.joint, 20); ec.rotation.z = Math.PI / 2; j3.add(ec);
    const j4 = new THREE.Group(); j3.add(j4);
    const fore = mesh(new THREE.CapsuleGeometry(0.15, L2 - 0.28, 6, 14), M.robot);
    fore.rotation.x = Math.PI / 2; fore.position.z = L2 / 2; j4.add(fore);
    const j5 = new THREE.Group(); j5.position.z = L2; j4.add(j5);
    const wc = mesh(new THREE.SphereGeometry(0.15, 16, 12), M.joint); j5.add(wc);
    const j6 = new THREE.Group(); j5.add(j6);
    const flange = cyl(0.11, 0.12, M.robot, 16); flange.rotation.x = Math.PI / 2; flange.position.z = 0.12; j6.add(flange);
    const gun = box(0.12, 0.22, 0.3, M.joint); gun.position.set(0, 0.05, 0.3); j6.add(gun);
    const nozzle = cyl(0.03, 0.22, M.steel, 10); nozzle.rotation.x = Math.PI / 2; nozzle.position.z = TOOL - 0.1; j6.add(nozzle);
    const tip = new THREE.Object3D(); tip.position.z = TOOL; j6.add(tip);
    const glow = glowSprite(COLORS.yellow, 0.9); glow.position.z = TOOL + 0.02; j6.add(glow);
    const tipDot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshBasicMaterial({ color: COLORS.yellow }));
    tipDot.position.z = TOOL; tipDot.userData.noAO = true; j6.add(tipDot);
    parent.add(root);
    const _w = new THREE.Vector3(), _l = new THREE.Vector3();
    function aim(worldTarget, roll = 0) {
      root.updateMatrixWorld(true);
      _l.copy(worldTarget); root.worldToLocal(_l);
      const wrist = _l.clone(); wrist.y += TOOL;
      j1.rotation.y = Math.atan2(wrist.x, wrist.z);
      const r = Math.hypot(wrist.x, wrist.z), h = wrist.y - SH_Y;
      const d = Math.min(Math.hypot(r, h), (L1 + L2) * 0.995);
      const a2 = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
      const phi = Math.atan2(h, r) + Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
      const phi2 = phi - (Math.PI - a2);
      j2.rotation.x = -phi;
      j3.rotation.x = Math.PI - a2;
      j4.rotation.z = roll * 0.3;
      j5.rotation.x = Math.PI / 2 + phi2;
      j6.rotation.z = roll;
    }
    return { root, aim, glow, tipDot, tip };
  }

  /* person (clay) */
  function makePerson(parent, { helmet = true, scale = 1, vest = false } = {}) {
    const g = new THREE.Group();
    const body = new THREE.Group(); g.add(body);
    const legs = [-0.12, 0.12].map((x) => {
      const hip = new THREE.Group(); hip.position.set(x, 0.86, 0);
      const leg = mesh(new THREE.CapsuleGeometry(0.085, 0.66, 4, 10), M.person); leg.position.y = -0.42; hip.add(leg);
      body.add(hip); return hip;
    });
    const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), vest ? M.clay3 : M.person);
    torso.position.y = 1.2; torso.scale.set(1, 1, 0.75); body.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.13, 18, 14), M.person); head.position.y = 1.62; body.add(head);
    if (helmet) {
      const hm = mesh(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), M.helmet);
      hm.position.y = 1.65; body.add(hm);
      const brim = cyl(0.17, 0.02, M.helmet, 18); brim.position.y = 1.655; body.add(brim);
    }
    const arms = [-1, 1].map((sd) => {
      const sh = new THREE.Group(); sh.position.set(sd * 0.27, 1.43, 0);
      const arm = mesh(new THREE.CapsuleGeometry(0.065, 0.5, 4, 10), M.person); arm.position.y = -0.3; sh.add(arm);
      sh.rotation.z = sd * 0.08;
      body.add(sh); return sh;
    });
    g.scale.setScalar(scale);
    parent.add(g);
    return { g, body, legs, arms, head };
  }

  /* station tablet with painted CanvasTexture */
  const tabCanvas = document.createElement("canvas");
  tabCanvas.width = 512; tabCanvas.height = 320;
  const tabTex = new THREE.CanvasTexture(tabCanvas);
  tabTex.colorSpace = THREE.SRGBColorSpace; tabTex.anisotropy = 8;
  let tabKey = null;
  function paintTablet(st) {
    const mode = typeof st === "string" ? st : st?.mode ?? "idle";
    const ovr = mode === "override" || mode === "overridden";
    const label = (typeof st === "object" && st?.text) || (mode === "alert" || ovr ? "ALERT st-04" : mode === "confirmed" ? "CONFIRMED" : mode === "review" ? "MODEL REVIEW" : "st-04  RUNNING");
    const key = mode + "|" + label;
    if (key === tabKey) return;
    tabKey = key;
    const g = tabCanvas.getContext("2d");
    g.fillStyle = "#f7f7f5"; g.fillRect(0, 0, 512, 320);
    const accent = mode === "alert" ? "#f2b705" : mode === "confirmed" ? "#1a7a3d" : mode === "review" ? "#0066b1" : ovr ? "#a3a6a9" : "#c9cbcd";
    g.fillStyle = accent; g.fillRect(0, 0, 512, 92);
    g.fillStyle = mode === "alert" ? "#1b1b1b" : ovr ? "#eceded" : "#ffffff";
    g.font = "bold 50px Helvetica, Arial, sans-serif"; g.textBaseline = "middle";
    g.fillText(label, 28, 48);
    if (ovr) {
      // dismissed alert: struck header, greyed lines, "OVERRIDDEN" stamp
      const w = g.measureText(label).width;
      g.strokeStyle = "#5c5f62"; g.lineWidth = 6; g.lineCap = "round";
      g.beginPath(); g.moveTo(22, 50); g.lineTo(34 + w, 46); g.stroke();
      g.fillStyle = "#e6e7e8";
      for (let i = 0; i < 2; i++) g.fillRect(28, 124 + i * 40, 250 - i * 70, 16);
      g.fillStyle = "#55585b"; g.font = "bold 46px Helvetica, Arial, sans-serif";
      const ow = g.measureText("OVERRIDDEN").width;
      g.strokeStyle = "#6b6e71"; g.lineWidth = 5; g.strokeRect(28, 206, ow + 36, 82);
      g.fillText("OVERRIDDEN", 46, 249);
      g.strokeStyle = "#8e9194"; g.lineWidth = 9;
      g.beginPath(); g.arc(438, 196, 44, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(407, 165); g.lineTo(469, 227); g.stroke();
      tabTex.needsUpdate = true;
      return;
    }
    g.fillStyle = "#d9dadb";
    for (let i = 0; i < 3; i++) g.fillRect(28, 128 + i * 46, 300 - i * 60, 18);
    if (mode === "confirmed") {
      g.strokeStyle = "#1a7a3d"; g.lineWidth = 18; g.lineCap = "round";
      g.beginPath(); g.moveTo(370, 210); g.lineTo(410, 250); g.lineTo(480, 160); g.stroke();
    } else if (mode === "alert") {
      g.fillStyle = "#f2b705"; g.beginPath(); g.moveTo(425, 140); g.lineTo(485, 250); g.lineTo(365, 250); g.closePath(); g.fill();
      g.fillStyle = "#1b1b1b"; g.fillRect(419, 172, 12, 44); g.fillRect(419, 226, 12, 12);
    }
    tabTex.needsUpdate = true;
  }

  /* build both lines */
  function buildLine({ z, count, xs, ids, types, simple }) {
    const lineG = new THREE.Group(); world.add(lineG);
    const laneLen = (count + 1.6) * PITCH;
    const x0 = (xs(0) + xs(count - 1)) / 2;
    sBox(laneLen, 0.18, 3, M.lane, x0, 0.09, z, 0, true);
    for (let s = 0; s < laneLen / 0.8; s++) sBox(0.06, 0.02, 2.7, M.slat, x0 - laneLen / 2 + 0.4 + s * 0.8, 0.19, z, 0, false);
    // zone marks
    const zone = (a, b) => {
      const x1 = xs(a) - PITCH / 2 + 0.3, x2 = xs(b) + PITCH / 2 - 0.3, zz = 4.6, wv = 0.1;
      sBox(x2 - x1, 0.02, wv, M.aisle, (x1 + x2) / 2, 0.07, z - zz, 0, false); sBox(x2 - x1, 0.02, wv, M.aisle, (x1 + x2) / 2, 0.07, z + zz, 0, false);
      sBox(wv, 0.02, 2 * zz, M.aisle, x1, 0.07, z, 0, false); sBox(wv, 0.02, 2 * zz, M.aisle, x2, 0.07, z, 0, false);
    };
    if (simple) zone(0, count - 1); else { zone(0, 5); zone(6, 6); zone(7, 7); }
    const objs = ids.map((id, i) => {
      const type = types[i];
      const sx = xs(i), gx = sx - PITCH * 0.32;
      sBox(0.22, 3.6, 0.22, M.steel, gx, 1.8, z - 2.1); sBox(0.22, 3.6, 0.22, M.steel, gx, 1.8, z + 2.1); sBox(0.26, 0.26, 4.5, M.steel, gx, 3.6, z);
      const lamps = andonTower(lineG, gx, z + 2.1);
      const o = { id, i, type, x: sx, gx, lamps, z };
      if (type === "sealer") {
        o.robot = makeRobot(lineG, sx + 0.2, z - 3.0);
        if (!simple) {
          const camG = new THREE.Group();
          camG.add(box(0.36, 0.26, 0.6, M.clay));
          const lens = cyl(0.09, 0.1, M.joint, 12); lens.rotation.x = Math.PI / 2; lens.position.z = 0.33; camG.add(lens);
          camG.position.set(gx + 0.3, 3.32, z + 0.9);
          lineG.add(camG);
          const coneGeo = new THREE.ConeGeometry(1.7, 3.1, 4, 1, true);
          coneGeo.translate(0, -1.55, 0); coneGeo.rotateY(Math.PI / 4);
          {
            // per-vertex alpha: strongest at the camera (apex), fading toward the floor end; no rim lines
            const pa = coneGeo.getAttribute("position"), col = new Float32Array(pa.count * 4);
            for (let vi = 0; vi < pa.count; vi++) { const a = lerp(1, 0.3, clamp01(-pa.getY(vi) / 3.1)); col.set([1, 1, 1, a], vi * 4); }
            coneGeo.setAttribute("color", new THREE.BufferAttribute(col, 4));
          }
          const coneMat = new THREE.MeshBasicMaterial({ color: COLORS.yellow, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false });
          const cone = new THREE.Mesh(coneGeo, coneMat);
          cone.userData.noAO = true; cone.renderOrder = 4;
          cone.position.copy(camG.position); cone.position.y -= 0.15;
          cone.rotation.z = 0.32; cone.rotation.x = 0.18;
          lineG.add(cone);
          o.cone = { cone, coneMat, edgeMat: new THREE.LineBasicMaterial() };   // edgeMat kept for compatibility; no rim lines are drawn
        }
      } else if (type === "body") {
        [-1, 1].forEach((sd) => { sBox(0.5, 1.5, 0.5, M.clay, sx + 0.6, 0.75, z + sd * 2.6); sBox(0.9, 0.18, 0.18, M.steel, sx + 0.6, 1.45, z + sd * 2.2); });
      } else if (type === "paint") {
        sBox(2.4, 3.4, 0.25, M.clay2, sx, 1.7, z - 3.0);
        sBox(0.14, 3.4, 4.4, M.clay, sx - 2.2, 1.7, z);
      } else if (type === "final_inspection") {
        [-1.4, 0, 1.4].forEach((dx) => {
          sBox(0.14, 2.9, 0.14, M.steel, sx + dx, 1.45, z - 2.2); sBox(0.14, 2.9, 0.14, M.steel, sx + dx, 1.45, z + 2.2); sBox(0.14, 0.14, 4.54, M.steel, sx + dx, 2.9, z);
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 3.8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 }));
          bar.position.set(sx + dx, 2.8, z); lineG.add(bar);
        });
      }
      return o;
    });
    // bodies by serial
    const bodies = new Map();
    function bodyFor(n) {
      let b = bodies.get(n);
      if (b) return b;
      const g = skid();
      const variant = ((n % 4) + 4) % 4;
      const stageObjs = (simple ? [0] : [0, 1, 2]).map((st) => {
        const s = st === 2 ? dress(cars[variant], M.shellWhite) : dress(shells[variant], st === 0 ? M.biw : M.shellWhite);
        g.add(s); return s;
      });
      const bead = new THREE.Mesh(beadGeos[variant], M.bead);
      bead.castShadow = false; bead.visible = false; bead.position.y = 0;
      // shells were normalised with skid offset inside; bead coords are in that same frame
      g.add(bead);
      g.position.y = 0.18;
      lineG.add(g);
      b = { g, stages: stageObjs, variant, bead };
      bodies.set(n, b);
      return b;
    }
    return { lineG, objs, bodies, bodyFor, xs, z, count, simple };
  }
  const K2 = buildLine({ z: 0, count: N, xs: xAt, ids: STATIONS.map((s) => s.id), types: STATIONS.map((s) => s.type) });
  const K1 = buildLine({ z: K1Z, count: K1N, xs: k1xAt, ids: K1_STATIONS, types: ["sealer", "sealer", "body", "sealer", "body", "body"], simple: true });

  // flagged body + repair bay
  const flaggedBody = skid();
  flaggedBody.add(dress(shells[2], M.flag));
  flaggedBody.position.y = 0.18;
  world.add(flaggedBody);
  const bayMark = new THREE.Group();
  {
    const w = 0.12, sx = 6.0, sz = 3.4;
    [[0, -sz / 2, sx, w], [0, sz / 2, sx, w], [-sx / 2, 0, w, sz], [sx / 2, 0, w, sz]].forEach(([cx, cz, a, c]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(a, 0.02, c), new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.8 }));
      m.position.set(cx, 0.075, cz); m.receiveShadow = true; bayMark.add(m);
    });
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.9), new THREE.MeshStandardMaterial({ color: COLORS.yellow, roughness: 0.8 }));
      m.position.set(-2.6 + i * 0.85, 0.075, sz / 2 - 0.5); m.rotation.y = 0.7; bayMark.add(m);
    }
  }
  bayMark.position.set(ST04, 0, BAY_Z);
  world.add(bayMark);
  sBox(6.6, 0.5, 0.25, M.clay2, ST04, 0.25, BAY_Z + 2.3);      // bay back barrier

  // st-04 tablet stand
  const tabletG = new THREE.Group();
  tabletG.position.set(...TABLET);
  tabletG.rotation.y = -0.75;
  {
    const stand = cyl(0.05, 1.25, M.steel, 10); stand.position.y = 0.62; tabletG.add(stand);
    const foot = cyl(0.28, 0.05, M.clay2, 20); foot.position.y = 0.025; tabletG.add(foot);
    const bezel = box(0.86, 0.58, 0.05, M.clay3); bezel.position.y = 1.36; bezel.rotation.x = -0.45; tabletG.add(bezel);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.475), new THREE.MeshBasicMaterial({ map: tabTex, toneMapped: false }));
    screen.position.set(0, 1.36, 0); screen.rotation.x = -0.45; screen.translateZ(0.027);
    tabletG.add(screen);
  }
  world.add(tabletG);
  // TL desk
  sBox(1.8, 0.08, 0.9, M.clay, TL_DESK[0], 0.76, TL_DESK[2]);
  sBox(0.08, 0.76, 0.8, M.clay2, TL_DESK[0] - 0.8, 0.38, TL_DESK[2]); sBox(0.08, 0.76, 0.8, M.clay2, TL_DESK[0] + 0.8, 0.38, TL_DESK[2]);
  sBox(0.7, 0.45, 0.05, M.clay3, TL_DESK[0], 1.08, TL_DESK[2] - 0.25);
  // kaizen board
  sBox(2.6, 1.5, 0.12, M.clay, KAIZEN_BOARD[0], 1.5, KAIZEN_BOARD[2]);
  sBox(0.08, 0.8, 0.08, M.clay2, KAIZEN_BOARD[0] - 1.1, 0.4, KAIZEN_BOARD[2]); sBox(0.08, 0.8, 0.08, M.clay2, KAIZEN_BOARD[0] + 1.1, 0.4, KAIZEN_BOARD[2]);
  for (let i = 0; i < 3; i++) sBox(0.6, 0.4, 0.03, M.clay3, KAIZEN_BOARD[0] - 0.8 + i * 0.8, 1.6, KAIZEN_BOARD[2] + 0.07);

  /* people */
  const people = {
    operator: makePerson(world, {}),
    tl: makePerson(world, { vest: true }),
    engineer: makePerson(world, { helmet: false }),
    expert: makePerson(world, { helmet: false, vest: true }),
  };
  people.operator.g.position.set(...OPERATOR); people.operator.g.rotation.y = Math.atan2(TABLET[0] - OPERATOR[0], TABLET[2] - OPERATOR[2]);
  people.engineer.g.position.set(...ENGINEER); people.engineer.g.rotation.y = Math.atan2(KAIZEN_BOARD[0] - ENGINEER[0], KAIZEN_BOARD[2] - ENGINEER[2]);
  people.expert.g.position.set(...EXPERT); people.expert.g.rotation.y = Math.atan2(KAIZEN_BOARD[0] - EXPERT[0], KAIZEN_BOARD[2] - EXPERT[2]);
  // extra background workers (static, clay)
  [[-20, 4.2, 0.5], [12, -4.3, 3.0], [-8, -36.8, 3.1], [5, -29.2, 0.2], [50, -20, 1.5], [17.5, 3.9, 2.6]].forEach(([x, z, ry]) => {
    const p = makePerson(world, {}); p.g.position.set(x, 0, z); p.g.rotation.y = ry;
  });
  const TL_PATH = [[TL_DESK[0], TL_DESK[2] - 1.0], [TL_DESK[0] + 0.5, 6.2], [ST04 - 1.0, 6.0], [OPERATOR[0] + 1.4, OPERATOR[2] + 0.3]];
  const tlPath = polyPath(TL_PATH, 1.4);

  /* ambient walkers (state.crowd): narrow closed loops along aisles and outside paths.
     None of them touches the st-04 repair-bay lane, the operator spot, the TL walk or a conveyor. */
  const loopH = (x0, x1, z, w = 0.7) => polyPath([[x0, z - w / 2], [x1, z - w / 2], [x1, z + w / 2], [x0, z + w / 2]], 0.34, true);
  const loopV = (z0, z1, x, w = 0.7) => polyPath([[x - w / 2, z0], [x - w / 2, z1], [x + w / 2, z1], [x + w / 2, z0]], 0.34, true);
  const WALK = {
    k2North: loopH(-28, 28, -7.0), k2SouthW: loopH(-30, -17, 13.4), k2SouthE: loopH(5, 30, 13.4), k2Mid: loopH(7, 28, 5.8, 0.6),
    k1North: loopH(-28, 28, -41.0), fa: loopV(-30, 0, 62), outS: loopH(-30, 30, 17.0), outN: loopH(-28, 30, -48.0),
  };
  // ordered so a partial crowd is spread over the campus
  const walkers = [
    ["k2North", 0.00, 1.05, {}], ["k1North", 0.20, 1.00, { vest: true }], ["outS", 0.10, 1.10, { helmet: false }],
    ["k2SouthE", 0.35, 0.95, {}], ["fa", 0.60, 1.00, { vest: true }], ["k2Mid", 0.15, 0.90, {}],
    ["outN", 0.70, 1.05, { helmet: false, vest: true }], ["k2North", 0.52, 1.00, { vest: true }], ["k1North", 0.68, 1.08, {}],
    ["k2SouthW", 0.40, 1.00, { vest: true }], ["outS", 0.58, 0.95, { helmet: false, vest: true }],
  ].map(([key, off, speed, o], i) => ({ p: makePerson(world, o), path: WALK[key], off, speed, ph: i * 1.37 }));

  /* AGVs + moving cars */
  const agvGeo = new THREE.BoxGeometry(1.5, 0.32, 0.95);
  const agvs = [];
  const agvLoops = [
    { path: polyPath([[-30, 12], [30, 12], [30, 9], [-30, 9]], 1.2, true), n: 3, speed: 1.6, y: 0 },
    { path: polyPath([[-30, -24], [30, -24], [30, -27], [-30, -27]], 1.2, true), n: 2, speed: 1.4, y: 0 },
    { path: polyPath([[-60, -16], [60, -16]], 0, false), n: 3, speed: 2.2, y: 0, pingpong: true },
    { path: polyPath([[47, -30], [59, -30], [59, 0], [47, 0]], 1.5, true), n: 2, speed: 1.3, y: 0 },
    // v3 extra AGVs (scaled by state.crowd) along the north walls of both halls
    { path: polyPath([[-28, -9.9], [28, -9.9], [28, -8.9], [-28, -8.9]], 0.45, true), n: 2, speed: 1.5, y: 0, extra: true },
    { path: polyPath([[-28, -43.9], [28, -43.9], [28, -43.0], [-28, -43.0]], 0.42, true), n: 1, speed: 1.3, y: 0, extra: true },
  ];
  agvLoops.forEach((L, li) => {
    for (let i = 0; i < L.n; i++) {
      const g = new THREE.Group();
      const b = mesh(agvGeo, M.clay3); b.position.y = 0.2; g.add(b);
      const crate = box(0.9, 0.5, 0.7, M.clay); crate.position.y = 0.61; if ((i + li) % 2) g.add(crate);
      world.add(g);
      agvs.push({ g, L, off: i / L.n });
    }
  });
  const movingCars = [];
  const carRoute = polyPath([[44, 21], [38.5, 21], [38.5, 21.2], [-20, 21.2], [-39.5, 21.2], [-39.5, 30], [-39.5, 45]], 2.5, false);
  for (let i = 0; i < 5; i++) {
    const c = dress(cars[i % 4], i % 2 ? M.clay : M.clay2);
    c.scale.multiplyScalar(0.95);
    world.add(c);
    movingCars.push({ g: c, off: i * 0.19 });
  }
  parkSlots.forEach(([x, z, ry], i) => {
    const c = dress(cars[i % 4], i % 3 === 0 ? M.clay2 : M.clay);
    c.position.set(x, -0.3, z); c.rotation.y = ry;
    world.add(c);
  });
  // finished cars inside final assembly
  for (let i = 0; i < 5; i++) {
    const c = dress(cars[(i + 1) % 4], M.shellWhite);
    c.position.set(53, -0.14, -28 + i * 5.4); c.rotation.y = Math.PI / 2;
    world.add(c);
  }

  /* final-assembly andon towers (lit by phase 3 and by the ending wave) */
  const faObjs = [[56.0, -5.0], [56.0, -15.0], [56.0, -24.0]].map(([x, z], i) => {
    sBox(0.16, 3.75, 0.16, M.steel, x, 1.87, z);
    return { id: `fa-0${i + 1}`, x, z, lamps: andonTower(world, x, z) };
  });

  flushStatics(world);

  /* defect seam: red glowing roof seam + roof glow + soft floor glow, carried by one K2 body */
  const defectG = new THREE.Group();
  const seamMat = new THREE.MeshBasicMaterial({ color: COLORS.red, toneMapped: false, transparent: true, opacity: 1, side: THREE.DoubleSide, fog: false });
  const seamGroup = ([roofC, sideC]) => {
    const g = new THREE.Group();
    const geos = [new THREE.TubeGeometry(roofC, 96, 0.038, 8, false), new THREE.TubeGeometry(sideC, 96, 0.03, 8, false)];
    geos.forEach((geo) => [1, -1].forEach((sz) => {              // both sides of the body (mirrored in z)
      const m = new THREE.Mesh(geo, seamMat); m.scale.z = sz; m.userData.noAO = true; m.renderOrder = 5; g.add(m);
    }));
    const sprites = [];
    [[roofC, [0.15, 0.5, 0.85], 0.8], [sideC, [0.1, 0.37, 0.63, 0.9], 0.65]].forEach(([c, us, size]) => us.forEach((u) => [1, -1].forEach((sz) => {
      const p = c.getPointAt(u);
      const sp = glowSprite(COLORS.red, size); sp.position.set(p.x, p.y + 0.03, p.z * sz); g.add(sp); sprites.push(sp);
    })));
    g.userData.sprites = sprites;
    g.visible = false;
    defectG.add(g);
    return g;
  };
  const seams = seamShell.map(seamGroup), seamsCar = seamCar.map(seamGroup);
  const defectFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTex, color: COLORS.red, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false }));
  defectFloor.scale.set(8.6, 1, 6.4); defectFloor.position.y = 0.05;   // just above the conveyor slats
  defectFloor.userData.noAO = true; defectFloor.renderOrder = 4;
  defectG.add(defectFloor);
  defectG.visible = false;
  world.add(defectG);

  /* ================================================================ routes */
  // polyline with filleted corners -> evenly sampled points with arc length
  function polyPath(pts, radius = 2, closed = false) {
    const P = pts.map((p) => new THREE.Vector2(p[0], p[1]));
    if (closed) P.push(P[0].clone());
    const out = [];
    const arcPts = (a, b, c, r) => {
      const v1 = a.clone().sub(b).normalize(), v2 = c.clone().sub(b).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, v1.dot(v2))));
      if (ang < 0.01 || ang > Math.PI - 0.01 || r <= 0) return [b.clone()];
      const lenA = a.distanceTo(b), lenC = c.distanceTo(b);
      const t = Math.min(r / Math.tan(ang / 2), lenA * 0.48, lenC * 0.48);
      const p1 = b.clone().add(v1.clone().multiplyScalar(t)), p2 = b.clone().add(v2.clone().multiplyScalar(t));
      const res = [];
      for (let i = 0; i <= 10; i++) { const k = i / 10; const q = p1.clone().multiplyScalar((1 - k) ** 2).add(b.clone().multiplyScalar(2 * k * (1 - k))).add(p2.clone().multiplyScalar(k * k)); res.push(q); }
      return res;
    };
    out.push(P[0].clone());
    for (let i = 1; i < P.length - 1; i++) out.push(...arcPts(P[i - 1], P[i], P[i + 1], radius));
    if (closed && P.length > 2) { const fin = arcPts(P[P.length - 2], P[0], P[1], radius); out.push(...fin); out.shift(); out.unshift(fin[fin.length - 1].clone()); }
    else out.push(P[P.length - 1].clone());
    // resample at 0.25 spacing
    const lens = [0];
    for (let i = 1; i < out.length; i++) lens.push(lens[i - 1] + out[i].distanceTo(out[i - 1]));
    const total = lens[lens.length - 1];
    const samples = [];
    const step = 0.25, n = Math.max(2, Math.ceil(total / step));
    let j = 0;
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total;
      while (j < lens.length - 2 && lens[j + 1] < s) j++;
      const seg = lens[j + 1] - lens[j] || 1;
      samples.push(out[j].clone().lerp(out[j + 1], (s - lens[j]) / seg));
    }
    const at = (s) => {
      s = Math.min(total, Math.max(0, s));
      const f = (s / total) * n, i = Math.min(n - 1, Math.floor(f));
      const a = samples[i], b = samples[i + 1];
      const p = a.clone().lerp(b, f - i);
      const dir = b.clone().sub(a).normalize();
      return { x: p.x, z: p.y, dx: dir.x, dz: dir.y };
    };
    return { samples, total, at, closed };
  }

  // floor height under a route: lifts over the conveyors
  const routeY = (x, z) => {
    const overK2 = Math.abs(z) < 1.75 && x > -31 && x < 31;
    const overK1 = Math.abs(z - K1Z) < 1.75 && x > -26 && x < 26;
    return overK2 || overK1 ? 0.31 : 0.09;
  };

  const ribbonVS = /* glsl */`
    attribute float aU; attribute float aV; attribute vec2 aN;
    uniform float uOuter;
    varying float vU; varying float vV;
    void main(){
      vU = aU; vV = aV;
      vec3 p = position + vec3(aN.x, 0.0, aN.y) * aV * uOuter;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }`;
  const ribbonFS = /* glsl */`
    uniform vec3 uColor; uniform float uHead; uniform float uCore; uniform float uOuter; uniform float uOpacity;
    uniform float uPhase; uniform float uPulse; uniform float uStart; uniform float uSpacing;
    varying float vU; varying float vV;
    void main(){
      float head = uHead; float st = uStart;
      if (head <= st + 0.001) discard;
      float du = vU < st ? st - vU : (vU > head ? vU - head : 0.0);
      float dv = abs(vV) * uOuter;
      float d = length(vec2(du, dv));
      float aa = max(fwidth(d), 0.002) * 1.2;
      float core = 1.0 - smoothstep(uCore - aa, uCore + aa, d);
      float g = 1.0 - smoothstep(uCore, uOuter, d);
      float glow = g * g * 0.32;
      float rim = smoothstep(uCore * 0.55, uCore, d) * core;
      float band = fract((vU - uPhase) / uSpacing);
      float pulse = uPulse * smoothstep(0.0, 0.12, band) * (1.0 - smoothstep(0.12, 0.3, band));
      vec3 col = mix(uColor, vec3(1.0), pulse * 0.38);
      col = mix(col, uColor * 0.82, rim * 0.5);
      float a = max(core, glow) * uOpacity;
      if (a < 0.003) discard;
      gl_FragColor = vec4(col, a);
      #include <colorspace_fragment>
    }`;
  function makeRibbon(path, color, width = 0.55, yFn = routeY, yOff = 0) {
    const core = width / 2, outer = core * 1.8;
    const S = path.samples, n = S.length;
    const pos = [], aU = [], aV = [], aN = [], idx = [];
    const total = path.total;
    // extend at both ends so round caps fit
    const ext = (p, d, k) => new THREE.Vector2(p.x + d.x * k, p.y + d.y * k);
    const d0 = S[1].clone().sub(S[0]).normalize(), d1 = S[n - 1].clone().sub(S[n - 2]).normalize();
    const E = outer * 5;
    const pts = [ext(S[0], d0, -E), ...S, ext(S[n - 1], d1, E)];
    const us = [-E];
    for (let i = 0; i < n; i++) us.push((i / (n - 1)) * total);
    us.push(total + E);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const t = b.clone().sub(a).normalize();
      const nx = -t.y, nz = t.x;
      const p = pts[i];
      const y = yFn(p.x, p.y) + yOff;
      pos.push(p.x, y, p.y, p.x, y, p.y);
      aN.push(nx, nz, nx, nz);
      aU.push(us[i], us[i]); aV.push(1, -1);
      if (i < pts.length - 1) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aU", new THREE.Float32BufferAttribute(aU, 1));
    geo.setAttribute("aV", new THREE.Float32BufferAttribute(aV, 1));
    geo.setAttribute("aN", new THREE.Float32BufferAttribute(aN, 2));
    geo.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      vertexShader: ribbonVS, fragmentShader: ribbonFS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: { uColor: { value: new THREE.Color(color) }, uHead: { value: 0 }, uStart: { value: 0 }, uCore: { value: core }, uOuter: { value: outer }, uOpacity: { value: 1 }, uPhase: { value: 0 }, uPulse: { value: 0 }, uSpacing: { value: 8 } },
    });
    const m = new THREE.Mesh(geo, mat);
    m.userData.noAO = true; m.renderOrder = 3; m.frustumCulled = false; m.visible = false;
    world.add(m);
    return { mesh: m, mat, path, core, outer };
  }

  // route geometry (x, z on the floor)
  const R = {
    defect: [polyPath([[ST04, 2.35], [xAt(7) + 2.6, 2.35], [xAt(7) + 2.6, 0.2]], 1.6)],
    shift: [polyPath([[ANDON_X + 0.35, 1.35], [OPERATOR[0] - 0.6, 3.1], [OPERATOR[0] - 0.3, 5.2], [ANDON_X + 0.4, 3.0], [TL_DESK[0] + 1.6, 8.6], [TL_DESK[0] + 1.6, 4.8], [ANDON_X - 0.7, 1.7]], 1.0, true)],
    kaizen: [polyPath([[ST04 - 0.5, 6.2], [-25, 6.2], [-31, 0.5], [-31, -6], [-36, -6], [-39.5, -2.5], [-39.5, 3], [-41, 7.6]], 3.0)],
    launch: [
      polyPath([[-41.5, 9.2], [-37.5, 9.2], [-36.5, -7.2], [-31, -7.2], [xAt(0), -7.2], [xAt(0), -4.6]], 3.0),
      polyPath([[xAt(0), -7.2], [xAt(1), -7.2], [xAt(1), -4.6]], 1.4),
      polyPath([[xAt(1), -7.2], [-12.5, -7.2], [-12.5, -27], [k1xAt(0), -27], [k1xAt(0), K1Z + 4.6]], 3.0),
      polyPath([[k1xAt(0), -27], [k1xAt(3), -27], [k1xAt(3), K1Z + 4.6]], 1.6),
    ],
  };
  const ROUTE_COL = { defect: COLORS.red, shift: COLORS.yellow, kaizen: COLORS.blue, launch: COLORS.green };
  // windows: each sub-path draws inside [a,b] of the route's progress
  const WINDOWS = { defect: [[0, 1]], shift: [[0, 1]], kaizen: [[0, 1]], launch: [[0, 0.5], [0.42, 0.62], [0.55, 0.9], [0.82, 1]] };
  const ribbons = {};
  Object.keys(R).forEach((k) => { ribbons[k] = R[k].map((p, i) => ({ ...makeRibbon(p, ROUTE_COL[k], k === "shift" ? 0.42 : 0.62), win: WINDOWS[k][i] })); });

  // phase outlines around halls + station rings
  const hallLoop = (h, pad = 1.2) => polyPath([[h.x0 - pad, h.z0 - pad], [h.x1 + pad, h.z0 - pad], [h.x1 + pad, h.z1 + pad], [h.x0 - pad, h.z1 + pad]], 3, true);
  const phaseOutlines = [hallLoop(HALL_K2), hallLoop(HALL_K1), hallLoop(HALL_FA)].map((p) => makeRibbon(p, COLORS.green, 0.5, () => 0.08));   // v3: never shown (no edge lines)
  // v3 phase marker: a very soft green wash over each hall floor with feathered edges
  const featherTex = (() => {
    const S = 128, data = new Uint8Array(S * S * 4), f = 0.16;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const u = (x + 0.5) / S, v = (y + 0.5) / S;
      const a = smooth(Math.min(u, 1 - u) / f) * smooth(Math.min(v, 1 - v) / f);
      const i = (y * S + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255; data[i + 3] = Math.round(a * 255);
    }
    const t = new THREE.DataTexture(data, S, S);
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  })();
  const hallTints = [HALL_K2, HALL_K1, HALL_FA].map((h) => {
    const pad = 3;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(h.x1 - h.x0 + 2 * pad, h.z1 - h.z0 + 2 * pad).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: featherTex, color: COLORS.green, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    m.position.set((h.x0 + h.x1) / 2, 0.075, (h.z0 + h.z1) / 2);
    m.userData.noAO = true; m.renderOrder = 2; m.visible = false;
    world.add(m);
    return m;
  });
  const ringGeo = new THREE.RingGeometry(2.7, 3.0, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const mkRing = (x, z) => {
    const m = poolMesh(COLORS.green, 9.0);   // soft filled pool (no outline ring), just above the conveyor slats
    m.position.set(x, 0.215, z); m.userData.noAO = true; m.renderOrder = 3; world.add(m); return m;
  };
  const phaseRings = [
    K2.objs.map((o) => mkRing(o.x, 0)),
    K1.objs.map((o) => mkRing(o.x, K1Z)),
    [mkRing(53, -6), mkRing(53, -15), mkRing(53, -24)],
  ];

  // ending wave: every station (K2, K1, final assembly) ordered by distance from st-04
  const waveStations = [
    ...K2.objs.map((o) => ({ id: o.id, x: o.x, z: 0 })),
    ...K1.objs.map((o) => ({ id: o.id, x: o.x, z: K1Z })),
    ...faObjs.map((o) => ({ id: o.id, x: 53, z: o.z })),
  ];
  {
    const dmax = Math.max(...waveStations.map((w) => Math.hypot(w.x - ST04, w.z)));
    waveStations.forEach((w) => {
      w.th = 0.8 * Math.hypot(w.x - ST04, w.z) / dmax;
      w.ring = poolMesh(COLORS.green, 1, 0.12);            // resting pool
      w.ring.position.set(w.x, 0.22, w.z); w.ring.renderOrder = 4; w.ring.visible = false;
      w.edge = poolMesh(COLORS.green, 1, 0.11);            // expanding filled pulse (not a ring)
      w.edge.position.set(w.x, 0.215, w.z); w.edge.renderOrder = 4; w.edge.visible = false;
      world.add(w.ring, w.edge);
    });
  }
  const waveReached = new Set();
  let waveGlow = 1;            // wave-lit lamps get bigger glows on wide shots so the sweep reads from the aerial

  // escaping-defect marker (red pin with a floor pulse)
  const pin = new THREE.Group();
  {
    const red = new THREE.MeshStandardMaterial({ color: COLORS.red, roughness: 0.5 });
    const head = mesh(new THREE.SphereGeometry(0.42, 24, 16), red); head.position.y = 2.6; pin.add(head);
    const pt = mesh(new THREE.ConeGeometry(0.3, 0.9, 20), red); pt.rotation.x = Math.PI; pt.position.y = 2.05; pin.add(pt);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff })); dot.position.set(0, 2.62, 0.33); pin.add(dot);
  }
  const pulseRings = [0, 1].map(() => {
    const m = poolMesh(COLORS.red, 2.2, 0.02);   // soft filled pulse (no outline ring)
    m.userData.noAO = true; m.renderOrder = 4; pin.add(m); return m;
  });
  pin.visible = false;
  world.add(pin);

  // knowledge card (glass)
  const cardCanvas = document.createElement("canvas");
  cardCanvas.width = 512; cardCanvas.height = 320;
  {
    const g = cardCanvas.getContext("2d");
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    g.clearRect(0, 0, 512, 320);
    // plain solid plate: no rim, no icon
    rr(4, 4, 504, 312, 30); g.fillStyle = "#f1f1ef"; g.fill();
    g.textBaseline = "alphabetic";
    g.fillStyle = "#1a7a3d"; g.font = "bold 30px Helvetica, Arial, sans-serif";
    if ("letterSpacing" in g) g.letterSpacing = "3px";
    g.fillText("VALIDATED STANDARD", 40, 82);
    if ("letterSpacing" in g) g.letterSpacing = "0px";
    g.fillStyle = "#252525"; g.font = "bold 62px Helvetica, Arial, sans-serif";
    g.fillText("KC-SEAL-051 r2", 40, 162);
    g.fillStyle = "#dcdcda"; g.fillRect(40, 206, 380, 14); g.fillRect(40, 238, 280, 14);
  }
  const cardTex = new THREE.CanvasTexture(cardCanvas); cardTex.colorSpace = THREE.SRGBColorSpace; cardTex.anisotropy = 8;
  const card = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.625), new THREE.MeshBasicMaterial({ map: cardTex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, fog: false }));
  card.userData.noAO = true; card.renderOrder = 6; card.visible = false;
  const cardShadow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: glowTex, color: 0x000000, transparent: true, opacity: 0.12, depthWrite: false }));
  cardShadow.userData.noAO = true; cardShadow.visible = false;
  // the card is drawn in an overlay pass after GTAO so background AO never darkens the plate
  const overlay = new THREE.Scene();
  overlay.add(card);
  world.add(cardShadow);
  // one continuous smooth path: office -> st-01 -> st-02 -> north door -> K1 line (no branch jump)
  const cardPath = (() => {
    const pts = [[-41.5, 9.2], [-38.2, 8.8], [-36.9, 3.0], [-36.5, -4.6], [-33.4, -7.3], [-26.4, -7.4], [xAt(0), -4.8],
      [(xAt(0) + xAt(1)) / 2, -6.9], [xAt(1), -4.8], [-13.4, -7.4], [-12.5, -11.0], [-12.5, -20.0], [-13.0, -25.6], [k1xAt(0), K1Z + 4.6]];
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, "centripetal");
    const total = curve.getLength(), n = Math.ceil(total / 0.25);
    const samples = curve.getSpacedPoints(n).map((v) => new THREE.Vector2(v.x, v.z));
    const at = (d) => {
      d = Math.min(total, Math.max(0, d));
      const f = (d / total) * n, i = Math.min(n - 1, Math.floor(f));
      const a = samples[i], b = samples[i + 1], p = a.clone().lerp(b, f - i), dir = b.clone().sub(a).normalize();
      return { x: p.x, z: p.y, dx: dir.x, dz: dir.y };
    };
    return { samples, total, at, closed: false };
  })();

  /* ================================================================ post */
  const rt = new THREE.WebGLRenderTarget(W * PR, H * PR, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(PR);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  let gtao = null;
  if (useAO) {
    const realRandom = Math.random;
    Math.random = mulberry32(42);                  // GTAO's denoise noise must be seeded
    try { gtao = new GTAOPass(scene, camera, W * PR, H * PR); } finally { Math.random = realRandom; }
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 1.0;
    gtao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 1.6, scale: 1.15, samples: 12, distanceFallOff: 1.0 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    const origHide = gtao._overrideVisibility.bind(gtao);
    gtao._overrideVisibility = function () {
      origHide();
      scene.traverse((o) => { if (o.visible && (o.userData.noAO || o.isSprite)) { o.visible = false; this._visibilityCache.push(o); } });
    };
    composer.addPass(gtao);
  }
  const overlayPass = new RenderPass(overlay, camera);
  overlayPass.clear = false; overlayPass.clearDepth = true;
  composer.addPass(overlayPass);
  // tilt-shift with a sharp band around the focus line (r) and a soft ramp to full blur (px per tap = amt)
  const tiltShader = (dir) => ({
    uniforms: { tDiffuse: { value: null }, amt: { value: 0 }, r: { value: 0.5 }, band: { value: 0.1 }, soft: { value: 0.32 }, texel: { value: new THREE.Vector2(dir === "h" ? 1 / (W * PR) : 0, dir === "v" ? 1 / (H * PR) : 0) } },
    vertexShader: HorizontalTiltShiftShader.vertexShader,
    fragmentShader: /* glsl */`
      uniform sampler2D tDiffuse; uniform float amt; uniform float r; uniform float band; uniform float soft; uniform vec2 texel;
      varying vec2 vUv;
      void main() {
        float k = smoothstep(band, band + soft, abs(vUv.y - r));
        vec2 o = texel * amt * k;
        vec4 sum = texture2D(tDiffuse, vUv) * 0.1633;
        sum += (texture2D(tDiffuse, vUv - o) + texture2D(tDiffuse, vUv + o)) * 0.1531;
        sum += (texture2D(tDiffuse, vUv - 2.0 * o) + texture2D(tDiffuse, vUv + 2.0 * o)) * 0.12245;
        sum += (texture2D(tDiffuse, vUv - 3.0 * o) + texture2D(tDiffuse, vUv + 3.0 * o)) * 0.0918;
        sum += (texture2D(tDiffuse, vUv - 4.0 * o) + texture2D(tDiffuse, vUv + 4.0 * o)) * 0.051;
        gl_FragColor = sum;
      }`,
  });
  const tiltH = new ShaderPass(tiltShader("h")), tiltV = new ShaderPass(tiltShader("v"));
  tiltH.enabled = tiltV.enabled = false;
  if (useDOF) { composer.addPass(tiltH); composer.addPass(tiltV); }
  composer.addPass(new OutputPass());

  /* ================================================================ render */
  const v3 = new THREE.Vector3(), tgt = new THREE.Vector3();
  const lampsFor = (st) => (st === "stopped" ? { red: 1 } : st === "yellow_andon" ? { yellow: 1, green: 0.3 } : st === "model_review" ? { blue: 1, green: 0.3 } : st === "validated" ? { green: 1 } : st === "off" ? {} : { green: 0.3 });
  const offCol = new THREE.Color(C.lampOff), tmpCol = new THREE.Color();
  const routeVal = (v) => (v == null ? null : typeof v === "number" ? { k: v } : v);

  function updateLine(L, s, flow, t, defaults) {
    const cyc = Math.floor(flow), ph = flow - cyc;
    const k = s.stopped ? 0 : easeInOut(clamp01(ph / MOVE));
    const dwell = s.stopped || ph >= MOVE;
    const live = new Set();
    const flagIdx = L === K2 && s.flagged ? Math.max(0, STATIONS.findIndex((x) => x.id === s.flagged.station)) : -1;
    const paintIdx = 6, finalIdx = 7;
    let atSt04 = null;
    for (let slot = -1; slot <= L.count; slot++) {
      const n = slot - cyc;
      const pos = s.stopped ? slot : slot - 1 + k;
      if (pos < -1.05 || pos > L.count - 0.05) continue;
      const b = L.bodyFor(n);
      live.add(n);
      b.g.visible = !(flagIdx >= 0 && Math.abs(pos - flagIdx) < 0.5);
      b.g.position.set(L.xs(pos), 0.18, L.z);
      const stSlot = dwell || k >= 1 ? slot : slot - 1;
      const stage = L.simple ? 0 : stSlot >= finalIdx ? 2 : stSlot >= paintIdx ? 1 : 0;
      b.stages.forEach((m, i) => { m.visible = i === stage; });
      b.bead.visible = false;
      if (L === K2 && Math.abs(pos - 3) < 0.02) atSt04 = b;
    }
    L.bodies.forEach((b, n) => { if (!live.has(n)) b.g.visible = false; });

    const pulse = 0.78 + 0.22 * Math.sin(t * 4.2);
    L.objs.forEach((o) => {
      // robots: bead motion at st-04, seekable sway elsewhere
      if (o.robot) {
        let bk;
        if (L === K2 && o.id === "st-04" && s.bead != null && atSt04 && b4visible(atSt04)) bk = clamp01(s.bead);
        const variant = L === K2 && o.id === "st-04" && atSt04 ? atSt04.variant : (o.i % 4);
        const curve = beadCurves[variant];
        if (bk != null) {
          const p = curve.getPointAt(Math.max(0.0001, bk));
          v3.set(o.x + p.x, 0.18 + p.y, L.z + p.z);
          o.robot.aim(v3, bk * 6.0);
          atSt04.bead.visible = bk > 0.002;
          atSt04.bead.geometry.setDrawRange(0, Math.floor(bk * 120) * 8 * 6);
          o.robot.glow.material.opacity = bk > 0 && bk < 1 ? 0.85 : 0.0;
          o.robot.tipDot.visible = bk > 0 && bk < 1;
        } else {
          const active = !s.stopped && dwell;
          const sw = active ? Math.sin(t * 0.9 + o.i * 1.7) : -0.6;
          const u = 0.5 + 0.42 * sw;
          const p = curve.getPointAt(clamp01(u));
          v3.set(o.x + p.x, 0.18 + p.y + (active ? 0.05 : 0.9), L.z + p.z - (active ? 0 : 0.8));
          o.robot.aim(v3, t * 0.8 + o.i);
          o.robot.glow.material.opacity = 0;
          o.robot.tipDot.visible = false;
        }
      }
      const waved = waveReached.has(o.id);
      applyLamps(o.lamps, waved ? "validated" : s.stations?.[o.id] ?? defaults(o), pulse, waved ? waveGlow : 1);
      if (o.cone) {
        const on2 = s.cone && s.cone.station === o.id ? clamp01(s.cone.k ?? 1) : 0;
        o.cone.coneMat.opacity = 0.3 * on2;
        o.cone.edgeMat.opacity = 0.75 * on2;
        o.cone.cone.visible = on2 > 0;
        o.cone.cone.scale.set(1, 0.3 + 0.7 * on2, 1);
      }
    });
    return atSt04;
  }
  const b4visible = (b) => b.g.visible;
  function applyLamps(lamps, st, pulse, glowScale = 1) {
    const on = lampsFor(st);
    Object.keys(lamps).forEach((key) => {
      let val = on[key] ?? 0;
      if (val === 1 && (key === "yellow" || key === "red")) val = pulse;
      const lit = val > 0.5;
      const col = tmpCol.setHex(COLORS[key]);
      lamps[key].m.color.copy(offCol).lerp(col, lit ? 1 : val * 0.8);
      lamps[key].m.emissive.copy(col).multiplyScalar(lit ? 0.9 * val : 0);
      lamps[key].glow.material.opacity = lit ? 0.75 * val : 0;
      lamps[key].glow.scale.setScalar((lit ? 2.6 : 1.6) * glowScale);
    });
  }

  function setCamera(cam) {
    camera.fov = cam.fov ?? 28;
    camera.position.set(...cam.pos);
    tgt.set(...cam.target);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    const dist = camera.position.distanceTo(tgt);
    camera.near = Math.max(0.2, dist * 0.02);
    camera.far = dist * 6 + 400;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    scene.fog.near = dist * 1.25 + 30;
    scene.fog.far = dist * 4.5 + 220;
    // shadow frustum follows the camera target
    const half = Math.min(120, Math.max(14, dist * 0.75));
    sun.target.position.copy(tgt);
    sun.position.copy(tgt).addScaledVector(SUN_DIR, 220);
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 50, far: 420 });
    sun.shadow.camera.updateProjectionMatrix();
    if (gtao) gtao.updateGtaoMaterial({ radius: Math.min(6.5, Math.max(0.6, dist * 0.032)) });
    return dist;
  }

  function render(s = {}) {
    const t = s.t ?? 0;
    const cam = s.cam ?? PRESETS.hallK2;
    const camDist = setCamera(cam);
    const ws = Math.min(3.2, Math.max(1, camDist / 62));
    const flow = s.flow ?? 0;
    const phase = s.phase ?? 0;

    // roofs
    const roofs = typeof s.roof === "object" && s.roof ? s.roof : { k1: s.roof ?? 0, k2: s.roof ?? 0, fa: s.roof ?? 0 };
    [[hallK1, roofs.k1], [hallK2, roofs.k2], [hallFA, roofs.fa]].forEach(([h, v]) => {
      const k = clamp01(v ?? 0);
      h.roof.visible = k > 0.001;
      h.roof.position.y = (1 - smooth(k)) * 16;
      h.roofMat.transparent = k < 0.999;
      h.roofMat.opacity = smooth(k);
      h.roofMat.depthWrite = k > 0.5;
      h.roof.children[0].castShadow = k > 0.999;
      h.roof.children[0].userData.noAO = k < 0.999;
    });

    // ending wave: which stations it has reached (overrides `stations`)
    const wk = s.wave ? clamp01(typeof s.wave === "number" ? s.wave : s.wave.k ?? 0) : 0;
    waveReached.clear();
    waveGlow = Math.min(2.4, Math.max(1, ws * 0.85));
    waveStations.forEach((w) => {
      const q = wk > 0 ? clamp01((wk - w.th) / 0.2) : 0;
      const hit = wk > 0 && wk >= w.th;
      if (hit) waveReached.add(w.id);
      const sc = Math.min(1.8, Math.max(1, ws * 0.7));
      w.ring.visible = hit;                      // soft green pool: flashes on the flip, then stays faintly lit
      w.edge.visible = hit && q < 1;             // soft filled glow that expands and fades
      if (hit) {
        const e = 1 - (1 - q) * (1 - q);
        const r = (6.5 + 1.5 * e) * sc;
        w.ring.scale.set(r, 1, r);
        w.ring.material.opacity = 0.26 + 0.12 * Math.sin(Math.PI * Math.min(1, q));
        const pr = (3 + 11 * e) * sc;
        w.edge.scale.set(pr, 1, pr);
        w.edge.material.opacity = 0.4 * (1 - q) * (1 - q);
      }
    });

    // lines
    const atSt04 = updateLine(K2, s, flow, t, () => (s.stopped ? "stopped" : phase >= 1 ? "validated" : "running"));
    updateLine(K1, { stations: s.stations, stopped: false }, flow * 0.9 + 0.35, t, () => (phase >= 2 ? "validated" : "running"));

    // flagged body slide-out
    flaggedBody.visible = !!s.flagged;
    bayMark.visible = !!s.flagged;
    if (s.flagged) {
      const fi = Math.max(0, STATIONS.findIndex((x) => x.id === s.flagged.station));
      const bz = BAY_Z * easeInOut(clamp01(s.flagged.bay ?? 0));
      flaggedBody.position.set(xAt(fi), 0.18, bz);
      bayMark.position.set(xAt(fi), 0, BAY_Z);
    }

    // final-assembly towers
    {
      const pulseFA = 0.78 + 0.22 * Math.sin(t * 4.2);
      faObjs.forEach((o) => { const w = waveReached.has(o.id); applyLamps(o.lamps, w ? "validated" : s.stations?.[o.id] ?? (phase >= 3 ? "validated" : "running"), pulseFA, w ? waveGlow : 1); });
    }

    // defect body: red seam + glows ride the body that sat at st-04 at defect.startFlow
    {
      const dk = s.defect ? clamp01(s.defect.k ?? 1) : 0;
      let b = null;
      if (dk > 0) {
        b = K2.bodies.get(serialAt(3, s.defect.startFlow ?? flow)) ?? null;
        if (b && !b.g.visible) b = null;
      }
      defectG.visible = !!b;
      if (b) {
        defectG.position.copy(b.g.position);
        const fl = 0.86 + 0.14 * Math.sin(t * 5.0);
        const isCar = b.stages[2]?.visible;
        [seams, seamsCar].forEach((arr, ai) => arr.forEach((g, i) => {
          g.visible = i === b.variant && (ai === 1) === !!isCar;
          if (g.visible) g.userData.sprites.forEach((sp) => { sp.material.opacity = 0.32 * dk * fl; });
        }));
        seamMat.opacity = dk;
        defectFloor.material.opacity = 0.55 * dk * (0.9 + 0.1 * Math.sin(t * 5.0));
      }
    }

    // tablet
    paintTablet(s.tablet ?? "idle");

    // people
    const P = s.people ?? {};
    const bob = (p, ph) => { p.body.position.y = Math.sin(t * 1.6 + ph) * 0.012; p.head.rotation.y = Math.sin(t * 0.5 + ph) * 0.15; };
    bob(people.operator, 0); bob(people.engineer, 1.3); bob(people.expert, 2.1);
    {
      const tap = clamp01(P.operatorTap ?? 0);
      people.operator.arms[1].rotation.x = -1.15 * smooth(tap) - 0.05;
      people.operator.arms[0].rotation.x = -0.15 * smooth(tap);
      const tlK = clamp01(P.tl ?? 0);
      const d = tlK * tlPath.total;
      const a = tlPath.at(d);
      people.tl.g.position.set(a.x, 0, a.z);
      people.tl.g.rotation.y = tlK > 0 && tlK < 1 ? Math.atan2(a.dx, a.dz) : tlK >= 1 ? Math.atan2(OPERATOR[0] - a.x, OPERATOR[2] - a.z) : Math.PI;
      const moving = tlK > 0.001 && tlK < 0.999;
      const sw = moving ? Math.sin(d * 3.4) * 0.5 : 0;
      people.tl.legs[0].rotation.x = sw; people.tl.legs[1].rotation.x = -sw;
      people.tl.arms[0].rotation.x = -sw * 0.7; people.tl.arms[1].rotation.x = sw * 0.7;
      people.tl.body.position.y = moving ? Math.abs(Math.cos(d * 3.4)) * 0.04 : Math.sin(t * 1.6 + 0.7) * 0.012;
      const eng = clamp01(P.engineer ?? 0);
      people.engineer.arms[1].rotation.x = -1.3 * smooth(eng) + Math.sin(t * 2) * 0.08 * eng;
      const ex = clamp01(P.expert ?? 0);
      people.expert.arms[0].rotation.x = -0.9 * smooth(ex);
      people.expert.head.rotation.x = Math.sin(t * 2.4) * 0.12 * ex;
    }

    // AGVs + cars (seekable by t)
    const crowd = clamp01(s.crowd ?? 1);
    const extraAgvs = agvs.filter((a) => a.L.extra);
    agvs.forEach((a) => {
      const L = a.L, total = L.path.total;
      if (L.extra) { a.g.visible = crowd * extraAgvs.length > extraAgvs.indexOf(a) + 0.5; if (!a.g.visible) return; }
      let s0 = ((t * L.speed) / total + a.off) % 1;
      if (L.pingpong) s0 = 1 - Math.abs(1 - 2 * s0);
      const p = L.path.at(s0 * total);
      a.g.position.set(p.x, 0.04, p.z);
      a.g.rotation.y = Math.atan2(p.dx, p.dz) + Math.PI / 2;
    });
    walkers.forEach((w, i) => {
      const p = w.p;
      p.g.visible = crowd * walkers.length > i + 0.5;
      if (!p.g.visible) return;
      const d = (((t * w.speed) + w.off * w.path.total) % w.path.total + w.path.total) % w.path.total;
      const a = w.path.at(d);
      p.g.position.set(a.x, 0, a.z);
      p.g.rotation.y = Math.atan2(a.dx, a.dz);
      const g = t * w.speed * 3.4 + w.ph;
      const sw = Math.sin(g) * 0.5;
      p.legs[0].rotation.x = sw; p.legs[1].rotation.x = -sw;
      p.arms[0].rotation.x = -sw * 0.7; p.arms[1].rotation.x = sw * 0.7;
      p.body.position.y = Math.abs(Math.cos(g)) * 0.04;
    });
    movingCars.forEach((c) => {
      const s0 = ((t * 2.6) / carRoute.total + c.off) % 1;
      const p = carRoute.at(s0 * carRoute.total);
      c.g.position.set(p.x, -0.3, p.z);
      c.g.rotation.y = Math.atan2(p.dx, p.dz) - Math.PI / 2;
      c.g.visible = s0 > 0.02 && s0 < 0.97;
    });

    // routes
    const routes = s.routes ?? {};
    Object.keys(ribbons).forEach((key) => {
      const rv = routeVal(routes[key]);
      ribbons[key].forEach((rb) => {
        if (!rv || rv.k <= 0) { rb.mesh.visible = false; return; }
        const [a, b] = rb.win;
        const local = clamp01((rv.k - a) / (b - a));
        rb.mesh.visible = local > 0;
        const total = rb.path.total;
        const closed = rb.path.closed;
        rb.mat.uniforms.uStart.value = 0;
        rb.mat.uniforms.uHead.value = (closed ? local : smooth(local)) * total;
        rb.mat.uniforms.uOpacity.value = rv.opacity ?? 1;
        rb.mat.uniforms.uPulse.value = rv.pulse === false ? 0 : 1;
        rb.mat.uniforms.uPhase.value = t * 3.2 * ws;
        rb.mat.uniforms.uCore.value = rb.core * ws; rb.mat.uniforms.uOuter.value = rb.outer * ws;
        rb.mat.uniforms.uSpacing.value = 9 * ws;
      });
    });
    // escaping-defect pin rides the head of the defect route
    const dv = routeVal(routes.defect);
    pin.visible = !!dv && dv.k > 0.01;
    if (pin.visible) {
      const p = R.defect[0].at(smooth(clamp01(dv.k)) * R.defect[0].total);
      pin.position.set(p.x, 0.1, p.z);
      pin.children[0].position.y = 2.6 + Math.sin(t * 3) * 0.1;
      pulseRings.forEach((r, i) => { const q = (t * 0.8 + i * 0.5) % 1; const sz = 2.2 * (0.6 + q * 2.4); r.scale.set(sz, 1, sz); r.material.opacity = 0.38 * (1 - q) * (1 - q); r.position.y = 0.02; });
    }

    // knowledge card along the launch route
    const ck = s.card;
    card.visible = cardShadow.visible = ck != null && ck > 0 && ck < 1;
    if (card.visible) {
      const p = cardPath.at(smooth(ck) * cardPath.total);
      const hY = 3.2 + Math.sin(ck * Math.PI) * 1.2 + Math.sin(t * 2) * 0.08;
      card.position.set(p.x, hY, p.z);
      card.quaternion.copy(camera.quaternion);
      card.scale.setScalar(Math.min(2.6, ws));
      const fade = Math.min(1, ck * 12, (1 - ck) * 12);
      card.material.opacity = fade;
      cardShadow.position.set(p.x, 0.1, p.z);
      cardShadow.material.opacity = 0.14 * fade;
    }

    // rollout phases
    [0, 1, 2].forEach((i) => {
      const k = smooth(clamp01(phase - i));
      phaseOutlines[i].mesh.visible = false;
      hallTints[i].visible = k > 0;
      hallTints[i].material.opacity = 0.14 * k;
      phaseRings[i].forEach((r, j) => {
        const kk = smooth(clamp01((phase - i) * 1.6 - j * 0.08));
        r.visible = kk > 0; r.material.opacity = 0.34 * kk;
        const sz = r.userData.size * (0.85 + 0.15 * kk); r.scale.set(sz, 1, sz);
      });
    });

    // tilt-shift miniature focus
    const focus = s.focus ?? 0;
    tiltH.enabled = tiltV.enabled = useDOF && focus > 0;
    if (tiltH.enabled) {
      // focus line at the target's screen height
      const fy = 1 - (project(cam.target).y / H);
      const amt = clamp01(focus) * 7.0 * PR * (H / 1080);
      [tiltH, tiltV].forEach((ps) => { ps.uniforms.amt.value = amt; ps.uniforms.r.value = fy; ps.uniforms.band.value = 0.1; ps.uniforms.soft.value = 0.34; });
    }

    composer.render();
  }

  /** Screen position (canvas px) of a world point, for HTML labels. */
  function project(p, y, z) {
    const arr = Array.isArray(p) ? p : [p, y, z];
    v3.set(arr[0], arr[1], arr[2]).project(camera);
    return { x: ((v3.x + 1) / 2) * W, y: ((1 - v3.y) / 2) * H, visible: v3.z < 1 && v3.z > -1 && Math.abs(v3.x) <= 1.05 && Math.abs(v3.y) <= 1.05 };
  }

  /** Camera blend: orbits around a lerped target (log-distance), not a straight line. */
  function lerpCam(a, b, k) {
    const ta = new THREE.Vector3(...a.target), tb = new THREE.Vector3(...b.target);
    const oa = new THREE.Vector3(...a.pos).sub(ta), ob = new THREE.Vector3(...b.pos).sub(tb);
    const sa = new THREE.Spherical().setFromVector3(oa), sb = new THREE.Spherical().setFromVector3(ob);
    let dTheta = sb.theta - sa.theta;
    if (dTheta > Math.PI) dTheta -= 2 * Math.PI; if (dTheta < -Math.PI) dTheta += 2 * Math.PI;
    const r = Math.exp(lerp(Math.log(sa.radius), Math.log(sb.radius), k));
    const sp = new THREE.Spherical(r, lerp(sa.phi, sb.phi, k), sa.theta + dTheta * k);
    const t = ta.clone().lerp(tb, k);
    const pos = new THREE.Vector3().setFromSpherical(sp).add(t);
    return { pos: pos.toArray(), target: t.toArray(), fov: lerp(a.fov ?? 28, b.fov ?? 28, k) };
  }

  const anchors = {
    st04Andon: [ANDON_X, 5.9, 2.1],
    st04Tablet: [TABLET[0], 1.75, TABLET[2]],
    st04Camera: [ANDON_X + 0.3, 3.5, 0.9],
    st04Robot: [ST04 + 0.2, 3.4, -3.0],
    finalInspection: [xAt(7), 3.4, 0],
    repairBay: [ST04, 2.6, BAY_Z],
    tlDesk: [TL_DESK[0], 1.6, TL_DESK[2]],
    operator: [OPERATOR[0], 2.0, OPERATOR[2]],
    office: [(OFFICE.x0 + OFFICE.x1) / 2, OFFICE.h + 2, (OFFICE.z0 + OFFICE.z1) / 2],
    kaizenBoard: [KAIZEN_BOARD[0], 2.6, KAIZEN_BOARD[2]],
    hallK1: [0, 8.5, (HALL_K1.z0 + HALL_K1.z1) / 2],
    hallK2: [0, 8.5, (HALL_K2.z0 + HALL_K2.z1) / 2],
    finalAssembly: [(HALL_FA.x0 + HALL_FA.x1) / 2, 8.5, (HALL_FA.z0 + HALL_FA.z1) / 2],
    parking: [55, 2, 24],
  };
  STATIONS.forEach((st, i) => { anchors[st.id] = [xAt(i), 2.6, 0]; });
  K1_STATIONS.forEach((id, i) => { anchors[id] = [k1xAt(i), 2.6, K1Z]; });
  faObjs.forEach((o) => { anchors[o.id] = [o.x, 5.9, o.z]; });

  /**
   * World position [x, y, z] (roof height) at `flow` of the body that sat at `stationId` when flow == atFlow
   * (default: flow itself, i.e. the body nearest that station right now). K2 ids, K1 ids (k1-xx, using the K1
   * line's own flow*0.9+0.35 timing) are supported; unknown ids return the hallK2 anchor.
   */
  function bodyAt(stationId, flow = 0, atFlow = flow) {
    let i = STATIONS.findIndex((x) => x.id === stationId);
    if (i >= 0) return [xAt(serialAt(i, atFlow) + lineP(flow)), BODY_TOP, 0];
    i = K1_STATIONS.indexOf(stationId);
    if (i >= 0) { const f = flow * 0.9 + 0.35, f0 = atFlow * 0.9 + 0.35; return [k1xAt(Math.round(i - lineP(f0)) + lineP(f)), BODY_TOP, K1Z]; }
    return anchors.hallK2.slice();
  }

  return { render, project, anchors, presets: PRESETS, lerpCam, stations: STATIONS, renderer, scene, camera, colors: COLORS, defectBodyPos, bodyAt };
}
