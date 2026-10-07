import type { DefectTypeId } from "@/lib/types";

/*
 * Simulated sealer-bead artwork, drawn in code (no camera image). Every
 * alert uses the same viewBox, framing and seam, so images compare directly
 * across the station, ticket and card screens.
 */

type Pt = { x: number; y: number };

const P0: Pt = { x: 28, y: 168 };
const C1: Pt = { x: 92, y: 168 };
const C2: Pt = { x: 112, y: 70 };
const P3: Pt = { x: 188, y: 62 };
const END: Pt = { x: 296, y: 58 };
const BEAD_PATH = "M28 168 C 92 168, 112 70, 188 62 L 296 58";
const SEAM = "M-8 168 L28 168 C 92 168, 112 70, 188 62 L328 57";
const FLANGE = "M-8 168 L28 168 C 92 168, 112 70, 188 62 L328 57 L328 -8 L-8 -8 Z";
const WELDS: [number, number][] = [[35, 143], [76, 112], [98, 88], [127, 62], [163, 43], [208, 37], [242, 36], [276, 35], [310, 33.5]];

const DEFECTS: Record<DefectTypeId, { dash: string; at: number; width: number; offset?: boolean; blob?: boolean }> = {
  BEAD_BREAK: { dash: "54 7 100", at: 57.5, width: 9 },
  BEAD_THIN: { dash: "100 0", at: 35, width: 4 },
  BEAD_OFFSET: { dash: "100 0", at: 72, width: 9, offset: true },
  BEAD_EXCESS: { dash: "100 0", at: 24, width: 9, blob: true },
  BEAD_MISSING: { dash: "38 30 100", at: 53, width: 9 },
};

function cubic(t: number): Pt {
  const u = 1 - t;
  return {
    x: u ** 3 * P0.x + 3 * u * u * t * C1.x + 3 * u * t * t * C2.x + t ** 3 * P3.x,
    y: u ** 3 * P0.y + 3 * u * u * t * C1.y + 3 * u * t * t * C2.y + t ** 3 * P3.y,
  };
}

/** Point at a percentage of the bead path's length (curve plus straight run). */
function pointAt(percent: number): Pt {
  const samples: Pt[] = Array.from({ length: 121 }, (_, i) => cubic(i / 120));
  samples.push(END);
  const segs = samples.slice(1).map((p, i) => Math.hypot(p.x - samples[i].x, p.y - samples[i].y));
  const total = segs.reduce((a, b) => a + b, 0);
  let target = (percent / 100) * total;
  for (let i = 0; i < segs.length; i++) {
    if (target <= segs[i]) {
      const r = target / segs[i];
      return { x: samples[i].x + (samples[i + 1].x - samples[i].x) * r, y: samples[i].y + (samples[i + 1].y - samples[i].y) * r };
    }
    target -= segs[i];
  }
  return END;
}

/** Lighting filter that turns a flat stroke into a rounded, matte PVC sealer bead. */
export function BeadLitFilter({ id }: { id: string }) {
  return (
        <filter id={id} x="-10%" y="-25%" width="120%" height="150%" colorInterpolationFilters="sRGB">
      <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves={1} seed={3} result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="wob" />
      <feGaussianBlur in="wob" stdDeviation="2.6" result="h0" />
      <feComponentTransfer in="h0" result="h"><feFuncA type="gamma" exponent=".7" /></feComponentTransfer>
      <feDiffuseLighting in="h" surfaceScale="4.5" diffuseConstant="1.3" lightingColor="#fff" result="diff">
        <feDistantLight azimuth="230" elevation="52" />
      </feDiffuseLighting>
      <feSpecularLighting in="h" surfaceScale="4.5" specularConstant=".32" specularExponent="11" lightingColor="#fffaf0" result="spec">
        <feDistantLight azimuth="230" elevation="46" />
      </feSpecularLighting>
      <feComposite in="wob" in2="diff" operator="arithmetic" k1="1" result="shaded" />
      <feComposite in="spec" in2="wob" operator="in" result="gloss" />
      <feComposite in="shaded" in2="gloss" operator="arithmetic" k2="1" k3=".7" result="lit" />
      <feComposite in="lit" in2="wob" operator="in" />
    </filter>
  );
}

export function BeadIllustration({
  defect,
  id,
  showHeat = true,
}: {
  defect: DefectTypeId | null;
  /** Unique per instance; used for SVG gradient ids. */
  id: string;
  showHeat?: boolean;
}) {
  const d = defect ? DEFECTS[defect] : null;
  const heat = d ? pointAt(d.at) : null;
  const label = defect ? defect.replace("BEAD_", "bead ").toLowerCase() : "bead, no defect";

  const sid = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const w = (d?.width ?? 9) + 2.5;
  const dash = d?.dash ?? "100 0";

  /* Close-up of a door hem seam as the fixed station camera sees it: two
     overlapping steel sheets, spot welds on the flange, a press line and a
     pilot hole. SVG lighting filters make the bead read as matte PVC sealer. */
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={`Illustration of a sealer bead on a door hem seam: ${label}`}>
      <defs>
        <linearGradient id={`${sid}-outer`} x1="0" y1="0" x2=".35" y2="1">
          <stop offset="0" stopColor="#6d7277" /><stop offset=".6" stopColor="#5a5e63" /><stop offset="1" stopColor="#46494d" />
        </linearGradient>
        <linearGradient id={`${sid}-flange`} x1="0" y1="0" x2=".5" y2="1">
          <stop offset="0" stopColor="#9ba0a5" /><stop offset=".55" stopColor="#868b90" /><stop offset="1" stopColor="#73787d" />
        </linearGradient>
        <radialGradient id={`${sid}-weld`} cx=".42" cy=".38" r=".62">
          <stop offset="0" stopColor="#6d7176" /><stop offset=".7" stopColor="#7f8489" /><stop offset=".86" stopColor="#5c6065" /><stop offset="1" stopColor="#8e9398" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${sid}-vig`} cx=".5" cy=".45" r=".75">
          <stop offset=".55" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".38" />
        </radialGradient>
        <radialGradient id={`${sid}-heat`}>
          <stop offset="0" stopColor="#f2b705" stopOpacity=".55" />
          <stop offset=".45" stopColor="#f2b705" stopOpacity=".38" />
          <stop offset="1" stopColor="#f2b705" stopOpacity="0" />
        </radialGradient>
        <filter id={`${sid}-soft`} x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2" /></filter>
        <BeadLitFilter id={`${sid}-lit`} />
      </defs>

      <rect x="-8" y="-8" width="336" height="216" fill={`url(#${sid}-outer)`} />
      <path d="M24 214 C 80 204, 140 150, 193 108 L330 104" fill="none" stroke="#3b3e42" strokeWidth="2.2" opacity=".75" />
      <path d="M24 216 C 80 206, 140 152, 193 110 L330 106" fill="none" stroke="#8a8f94" strokeWidth="1.2" opacity=".6" />
      <ellipse cx="262" cy="152" rx="11" ry="9" fill="#26282b" />
      <path d="M251.5 154 A 11 9 0 0 0 272.8 150.5" fill="none" stroke="#a3a8ad" strokeWidth="1.4" opacity=".8" />

      <path d={SEAM} fill="none" stroke="#000" strokeWidth="5" opacity=".55" transform="translate(1 3.5)" filter={`url(#${sid}-soft)`} />
      <path d={FLANGE} fill={`url(#${sid}-flange)`} />
      {WELDS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={`url(#${sid}-weld)`} />)}
      <path d={SEAM} fill="none" stroke="#c4c8cc" strokeWidth="1" opacity=".7" transform="translate(0 -1)" />

      <g transform={d?.offset ? "translate(0 10)" : undefined}>
        <path d={BEAD_PATH} fill="none" stroke="#000" strokeWidth={w + 0.5} strokeLinecap="round" opacity=".5"
          pathLength={100} strokeDasharray={dash} transform="translate(1.5 3)" filter={`url(#${sid}-soft)`} />
        <g filter={`url(#${sid}-lit)`}>
          <path d={BEAD_PATH} fill="none" stroke="#cbc2ab" strokeWidth={w} strokeLinecap="round" pathLength={100} strokeDasharray={dash} />
          {d?.blob && heat ? <ellipse cx={heat.x} cy={heat.y} rx="15" ry="10" fill="#cbc2ab" /> : null}
        </g>
      </g>

      <rect width="320" height="200" fill={`url(#${sid}-vig)`} pointerEvents="none" />
      {showHeat && heat ? (
        <g data-heat transform={`translate(${heat.x.toFixed(1)} ${heat.y.toFixed(1)})`}>
          <circle r="34" fill={`url(#${sid}-heat)`} />
          <rect x="-26" y="-22" width="52" height="44" rx="3" fill="none" stroke="#f2b705" strokeWidth="2" strokeDasharray="5 4" />
        </g>
      ) : null}
    </svg>
  );
}
