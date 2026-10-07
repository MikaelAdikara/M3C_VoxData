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

  return (
    <svg viewBox="0 0 320 200" role="img" aria-label={`Illustration of a sealer bead on a door seam: ${label}`}>
      <defs>
        <radialGradient id={`${id}-heat`}>
          <stop offset="0" stopColor="#f2b705" stopOpacity=".95" />
          <stop offset=".45" stopColor="#f2b705" stopOpacity=".55" />
          <stop offset="1" stopColor="#f2b705" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-panel`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5a5a5a" />
          <stop offset="1" stopColor="#454545" />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id}-panel)`} />
      <path d="M0 120 C 70 120, 96 36, 180 30 L 320 26" fill="none" stroke="#6a6a6a" strokeWidth="1.5" />
      <path d={BEAD_PATH} fill="none" stroke="#2f2f2f" strokeWidth="16" strokeLinecap="round" />
      <path
        d={BEAD_PATH}
        fill="none"
        stroke="#d9d3c3"
        strokeWidth={d?.width ?? 9}
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={d?.dash ?? "100 0"}
        transform={d?.offset ? "translate(0 9)" : undefined}
      />
      {d?.blob && heat ? <ellipse cx={heat.x} cy={heat.y} rx="12" ry="8" fill="#d9d3c3" /> : null}
      {showHeat && heat ? (
        <g data-heat transform={`translate(${heat.x.toFixed(1)} ${heat.y.toFixed(1)})`}>
          <circle r="34" fill={`url(#${id}-heat)`} />
          <rect x="-26" y="-22" width="52" height="44" rx="3" fill="none" stroke="#f2b705" strokeWidth="2" strokeDasharray="5 4" />
        </g>
      ) : null}
    </svg>
  );
}
