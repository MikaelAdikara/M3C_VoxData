/* eslint-disable @typescript-eslint/ban-ts-comment -- plain JS module shared with the v2 video and mockup */
// @ts-nocheck
/* Shared with design/mockup/assets/plantStory.js and the v2 video; keep in sync. */
/*
 * Scroll story for the web ("See it on the floor"): one progress value p (0..1) → plant3d state.
 * Framework-free and pure: the same p and t always give the same state. Shared by the mockup
 * (design/mockup/plant.html) and the app (components/plant/PlantStory.tsx).
 */
export const CHAPTERS = [
  { id: "plant", kicker: "Karawang II · K2 body line", title: "One line, every abnormality",
    body: "About 175,000 cars a year leave Karawang. Nearly one in three operators say they often override the alerts." },
  { id: "late", kicker: "Today", title: "Found late, lesson lost",
    body: "A bad sealer bead travels on, station after station. It is found at final inspection, and the lesson leaves with the shift." },
  { id: "sense", kicker: "Shift loop · minutes", tone: "caution", title: "The camera sees it",
    body: "A repurposed CCTV checks every bead. It learned only from good beads, so it flags the one that looks different, and shows where." },
  { id: "decide", kicker: "Shift loop · minutes", tone: "caution", title: "People decide",
    body: "The operator who made it confirms. A yellow andon calls the team leader, who decides. The system never stops the line." },
  { id: "learn", kicker: "Kaizen + Launch loops", tone: "safe", title: "The line learns",
    body: "Three repeats open a Kaizen ticket. A senior expert validates the fix, and yokoten carries the new standard to every sealer doing the same job." },
  { id: "scale", kicker: "Implementation", title: "Start small, scale by gate",
    body: "Phase 1 proves it on one sealer line at Karawang II (Rp9.2 bn). Gate 1 decides before both lines, then final assembly." },
];

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const io3 = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const seg = (u, a, b) => io3(clamp01((u - a) / (b - a)));

/** camera keys per chapter: [from preset, to preset] blended over the chapter */
const CAMS = [["aerial", "hallK2"], ["line", "finalInspection"], ["sealerCell", "sealerCell"], ["operator", "tlWalk"], ["office", "yokoten"], ["yokoten", "rollout"]];

export function storyState(p, t, plant) {
  const n = CHAPTERS.length;
  const x = clamp01(p) * n;
  const c = Math.min(n - 1, Math.floor(x));
  const u = x - c;                                     // 0..1 inside the chapter
  const P = plant.presets;
  const [a, b] = CAMS[c];
  // first 15% of a chapter blends from the previous chapter's end camera, then travels a → b
  const prevEnd = c > 0 ? P[CAMS[c - 1][1]] : P[a];
  const camIn = plant.lerpCam(prevEnd, P[a], seg(u, 0, 0.15));
  const cam = plant.lerpCam(camIn, P[b], seg(u, 0.15, 0.95));
  const s = { t, cam, flow: 3.55 + t * 0.05, stations: {}, routes: {}, people: {} };
  switch (c) {
    case 0:
      s.roof = 1 - seg(u, 0.45, 0.9); s.focus = 0.3 * (1 - u); break;
    case 1:
      s.routes.defect = { k: seg(u, 0.1, 0.8), pulse: true }; s.flow = 3.3 + 1.6 * seg(u, 0.1, 0.8); break;
    case 2:
      s.flow = 3.55; s.bead = seg(u, 0.05, 0.45); s.cone = { station: "st-04", k: seg(u, 0.3, 0.6) };
      s.tablet = u > 0.75 ? "alert" : "idle"; s.focus = 0.25; break;
    case 3:
      s.flow = 3.55; s.bead = 1; s.cone = { station: "st-04", k: 1 };
      s.tablet = u > 0.2 ? "confirmed" : "alert"; s.people.operatorTap = seg(u, 0.05, 0.2) * (1 - seg(u, 0.3, 0.4));
      if (u > 0.25) s.stations["st-04"] = "yellow_andon";
      s.people.tl = seg(u, 0.3, 0.75); s.routes.shift = { k: seg(u, 0.1, 0.8), pulse: true };
      if (u > 0.75) s.flagged = { station: "st-04", bay: seg(u, 0.78, 0.98) };
      break;
    case 4:
      s.routes.kaizen = { k: seg(u, 0.0, 0.35), pulse: true }; s.people.engineer = seg(u, 0.2, 0.5); s.people.expert = seg(u, 0.35, 0.6);
      s.routes.launch = { k: seg(u, 0.45, 0.95), pulse: true }; s.card = seg(u, 0.45, 0.95);
      if (u > 0.75) s.stations["st-02"] = "validated";
      if (u > 0.85) s.stations["st-01"] = "validated";
      break;
    default:
      s.phase = 3 * seg(u, 0.1, 0.9); break;
  }
  return { state: s, chapter: c, u };
}
