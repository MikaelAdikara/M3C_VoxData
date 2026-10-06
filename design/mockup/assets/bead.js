/* Sealer bead illustration shared by the prototype screens and the landing page.
   Simulated artwork; not a camera image. */

/* Bead illustration. Same viewBox, framing and seam on every screen so
   images compare directly (alert, ticket, card). */
const BEAD_PATH = "M28 168 C 92 168, 112 70, 188 62 L 296 58";
const DEFECTS = {
  BEAD_BREAK: { dash: "54 7 100", at: 57.5, w: 9 },
  BEAD_THIN: { dash: "100 0", at: 35, w: 4 },
  BEAD_OFFSET: { dash: "100 0", at: 72, w: 9, offset: true },
  BEAD_EXCESS: { dash: "100 0", at: 24, w: 9, blob: true },
  BEAD_MISSING: { dash: "38 30 100", at: 53, w: 9 },
  NONE: { dash: "100 0", at: 50, w: 9, clean: true },
};

let beadSeq = 0;
function beadSVG(type = "BEAD_BREAK") {
  const d = DEFECTS[type] || DEFECTS.BEAD_BREAK;
  const id = `b${beadSeq++}`;
  return `
  <svg viewBox="0 0 320 200" role="img" aria-label="Illustration of a sealer bead on a door seam, ${type.replace("_", " ").toLowerCase()}${d.clean ? "" : ", suspect region highlighted"}" data-bead="${id}" data-at="${d.at}">
    <defs>
      <radialGradient id="${id}-heat">
        <stop offset="0" stop-color="#f2b705" stop-opacity=".95"/>
        <stop offset=".45" stop-color="#f2b705" stop-opacity=".55"/>
        <stop offset="1" stop-color="#f2b705" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}-panel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5a5a5a"/><stop offset="1" stop-color="#454545"/>
      </linearGradient>
    </defs>
    <rect width="320" height="200" fill="url(#${id}-panel)"/>
    <path d="M0 120 C 70 120, 96 36, 180 30 L 320 26" fill="none" stroke="#6a6a6a" stroke-width="1.5"/>
    <path d="${BEAD_PATH}" fill="none" stroke="#2f2f2f" stroke-width="16" stroke-linecap="round"/>
    <path d="${BEAD_PATH}" fill="none" stroke="#d9d3c3" stroke-width="${d.w}" stroke-linecap="round"
      pathLength="100" stroke-dasharray="${d.dash}" ${d.offset ? 'transform="translate(0 9)"' : ""}/>
    ${d.blob ? `<g data-blob></g>` : ""}
    ${d.clean ? "" : `<g data-heat><circle r="34" fill="url(#${id}-heat)"/><rect x="-26" y="-22" width="52" height="44" rx="3" fill="none" stroke="#f2b705" stroke-width="2" stroke-dasharray="5 4"/></g>`}
  </svg>`;
}

function placeBeads(root = document) {
  root.querySelectorAll("svg[data-bead]").forEach((svg) => {
    const path = svg.querySelectorAll("path")[2];
    const at = parseFloat(svg.dataset.at);
    const len = path.getTotalLength();
    const p = path.getPointAtLength((at / 100) * len);
    const heat = svg.querySelector("[data-heat]");
    if (heat) heat.setAttribute("transform", `translate(${p.x} ${p.y})`);
    const blob = svg.querySelector("[data-blob]");
    if (blob) blob.innerHTML = `<ellipse cx="${p.x}" cy="${p.y}" rx="12" ry="8" fill="#d9d3c3"/>`;
  });
}

window.LLBead = { beadSVG, placeBeads };
