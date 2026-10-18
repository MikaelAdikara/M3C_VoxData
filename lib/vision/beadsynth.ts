/**
 * TypeScript twin of ml/beadsynth.py: renders one synthetic sealer-bead camera crop
 * from a small parameter set. Same formulas and the same integer-hash noise, so the
 * browser shows the model exactly the kind of image it was trained and evaluated on.
 * Parity is checked in beadsynth.test.ts against ml/results/parity_fixture.json.
 */

export const BEAD_W = 256;
export const BEAD_H = 96;

export type BeadDefectType = "missing" | "break" | "thin" | "offset" | "excess";

export const DEFECT_IDS: Record<BeadDefectType, string> = {
  missing: "BEAD_MISSING",
  break: "BEAD_BREAK",
  thin: "BEAD_THIN",
  offset: "BEAD_OFFSET",
  excess: "BEAD_EXCESS",
};

export interface BeadDefect {
  type: BeadDefectType | "none";
  x0?: number;
  length?: number;
  severity?: number;
}

export interface BeadParams {
  seam: number;
  seed: number;
  gain: number;
  gradX: number;
  gradY: number;
  light: number;
  noise: number;
  shiftX: number;
  shiftY: number;
  widthScale: number;
  sealerTone: number;
  glare: number;
  glareX: number;
  glareY: number;
  glareR: number;
  defect: BeadDefect;
}

export function seamId(i: number): string {
  const side = i < 4 || (i >= 8 && i < 12) ? "L" : "R";
  const part = i < 8 ? "door" : "roof";
  return `seam-${side}-${part}-${String(i + 1).padStart(2, "0")}`;
}

export function seamGeometry(i: number) {
  const roof = i >= 8;
  return {
    width0: (roof ? 12 : 9) + (i % 4) * 0.75,
    amp: (roof ? 1.5 : 6) + (i % 3) * 1.5,
    period: (roof ? 300 : 170) + (i % 4) * 30,
    phase: i * 0.9,
    slope: ((i % 5) - 2) * 0.03,
    panel: 0.4 + (i % 4) * 0.035,
  };
}

/** Same bit operations as hash01 in ml/beadsynth.py, mapped to [0, 1). */
export function hash01(x: number, y: number, seed: number, k: number): number {
  let h = (Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca77)) >>> 0;
  h = (h ^ Math.imul(seed, 0xc2b2ae3d) ^ Math.imul(k, 0x27d4eb2f)) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h = (h ^ (h >>> 12)) >>> 0;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h = (h ^ (h >>> 15)) >>> 0;
  return h / 4294967296;
}

function seedPhase(seed: number, k: number): number {
  return hash01(k, 7, seed, 99) * 2 * Math.PI;
}

const TAPER: Record<BeadDefectType, number> = { missing: 1, break: 1, thin: 4, offset: 8, excess: 4 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Smallest deviation that counts as a defect in this synthetic setup (ml/beadsynth.py limit_severity). */
export function limitSeverity(type: BeadDefectType, seam: number): { length: number; severity: number } {
  const w0 = seamGeometry(seam).width0;
  switch (type) {
    case "missing":
      return { length: 24, severity: 0 };
    case "break":
      return { length: 4, severity: 0 };
    case "thin":
      return { length: 20, severity: 0.6 };
    case "offset":
      return { length: 30, severity: 0.5 * w0 + 2 };
    case "excess":
      return { length: 15, severity: 1.5 };
  }
}

/**
 * Render to RGBA bytes (BEAD_W x BEAD_H x 4). `erase` and `add` are optional brush
 * masks (0..1 per pixel) from the editor: erase blends toward bare panel, add toward sealer.
 */
export function renderBead(
  p: BeadParams,
  edits?: { erase?: Float32Array; add?: Float32Array },
): Uint8ClampedArray {
  const W = BEAD_W;
  const H = BEAD_H;
  const g = seamGeometry(p.seam);
  const d = p.defect;
  const widthFactor = new Float64Array(W);
  const offset = new Float64Array(W);
  const c0 = new Float64Array(W);
  const half = new Float64Array(W);
  const p1 = seedPhase(p.seed, 1);
  const p2 = seedPhase(p.seed, 2);
  const p3 = seedPhase(p.seed, 3);

  for (let x = 0; x < W; x++) {
    let t = 0;
    if (d.type !== "none") {
      const x0 = d.x0 ?? 0;
      const len = d.length ?? 0;
      const taper = TAPER[d.type];
      t = clamp((x - x0) / taper, 0, 1) * clamp((x0 + len - x) / taper, 0, 1);
    }
    widthFactor[x] = 1;
    if (d.type === "missing" || d.type === "break") widthFactor[x] = 1 - t;
    else if (d.type === "thin") widthFactor[x] = 1 - t * (1 - (d.severity ?? 1));
    else if (d.type === "excess") widthFactor[x] = 1 + t * ((d.severity ?? 1) - 1);
    else if (d.type === "offset") offset[x] = t * (d.severity ?? 0);
    c0[x] =
      H / 2 +
      p.shiftY +
      g.slope * (x - W / 2) +
      g.amp * Math.sin((2 * Math.PI * (x + p.shiftX)) / g.period + g.phase);
    half[x] = (g.width0 * p.widthScale * widthFactor[x] * (1 + 0.04 * Math.sin(0.19 * x + p3))) / 2;
  }

  const out = new Uint8ClampedArray(W * H * 4);
  const panelTint = [0.97, 0.99, 1.04];
  const beadTint = [1.02, 1.0, 0.95];
  const s6 = Math.sqrt(6);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const c = c0[x] + offset[x];
      const hw = half[x];
      const dy = y - c;
      const dist = Math.abs(dy);
      let cov = clamp(hw - dist + 0.5, 0, 1);
      const safe = Math.max(hw, 1e-3);
      const r = clamp(dist / safe, 0, 1);
      let hgt = Math.sqrt(1 - r * r);
      const side = clamp(dy / safe, -1, 1);
      let bead = p.sealerTone * (0.72 + 0.28 * hgt) + 0.1 * Math.exp(-(((side - 0.45 * p.light) / 0.28) ** 2)) * hgt;

      let panel = g.panel * (1 + p.gradX * (x / W - 0.5) * 2 + p.gradY * (y / H - 0.5) * 2);
      panel += 0.012 * Math.sin(0.045 * x + p1) * Math.sin(0.06 * y + p2);
      panel -= 0.1 * Math.exp(-(((y - c0[x]) / 1.1) ** 2));
      const edge = Math.max(dist - hw, 0);
      panel -= 0.06 * Math.exp(-((edge / 2) ** 2)) * Math.min(hw / 2, 1);

      const i = y * W + x;
      if (edits?.erase && edits.erase[i] > 0) cov *= 1 - edits.erase[i];
      if (edits?.add && edits.add[i] > 0) {
        // Added sealer: a flat, slightly domed blob of the same material.
        const a = edits.add[i];
        hgt = Math.max(hgt, 0.6 * a);
        bead = p.sealerTone * (0.72 + 0.28 * hgt);
        cov = cov + (1 - cov) * a;
      }

      let glare = 0;
      if (p.glare > 0) {
        glare = p.glare * Math.exp(-((x - p.glareX) ** 2 + (y - p.glareY) ** 2) / (2 * p.glareR * p.glareR));
      }
      for (let ch = 0; ch < 3; ch++) {
        const mix = panel * panelTint[ch] * (1 - cov) + bead * beadTint[ch] * cov;
        const u = hash01(x, y, p.seed, 2 * ch) + hash01(x, y, p.seed, 2 * ch + 1) - 1;
        const v = p.gain * mix + glare + u * p.noise * s6;
        out[i * 4 + ch] = clamp(Math.floor(v * 255 + 0.5), 0, 255);
      }
      out[i * 4 + 3] = 255;
    }
  }
  return out;
}

/** RGBA bytes -> NCHW float32 in [0, 1], the model's input layout. */
export function toModelInput(rgba: Uint8ClampedArray): Float32Array {
  const n = BEAD_W * BEAD_H;
  const out = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    out[i] = rgba[i * 4] / 255;
    out[n + i] = rgba[i * 4 + 1] / 255;
    out[2 * n + i] = rgba[i * 4 + 2] / 255;
  }
  return out;
}

/** A neutral starting point: seam's nominal geometry, mid lighting, low noise. */
export function nominalParams(seam: number, seed = 20261018): BeadParams {
  return {
    seam,
    seed,
    gain: 1,
    gradX: 0.05,
    gradY: -0.05,
    light: 0.3,
    noise: 0.012,
    shiftX: 0,
    shiftY: 0,
    widthScale: 1,
    sealerTone: 0.82,
    glare: 0,
    glareX: 128,
    glareY: 30,
    glareR: 8,
    defect: { type: "none" },
  };
}
