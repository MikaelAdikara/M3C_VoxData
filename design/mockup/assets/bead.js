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

/* Lighting filter that turns a flat stroke into a rounded, matte sealer bead. */
function beadLitFilter(fid) {
  return `<filter id="${fid}" x="-10%" y="-25%" width="120%" height="150%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="1" seed="3" result="n"/>
        <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="wob"/>
        <feGaussianBlur in="wob" stdDeviation="2.6" result="h0"/>
        <feComponentTransfer in="h0" result="h"><feFuncA type="gamma" exponent=".7"/></feComponentTransfer>
        <feDiffuseLighting in="h" surfaceScale="4.5" diffuseConstant="1.3" lighting-color="#fff" result="diff">
          <feDistantLight azimuth="230" elevation="52"/>
        </feDiffuseLighting>
        <feSpecularLighting in="h" surfaceScale="4.5" specularConstant=".32" specularExponent="11" lighting-color="#fffaf0" result="spec">
          <feDistantLight azimuth="230" elevation="46"/>
        </feSpecularLighting>
        <feComposite in="wob" in2="diff" operator="arithmetic" k1="1" result="shaded"/>
        <feComposite in="spec" in2="wob" operator="in" result="gloss"/>
        <feComposite in="shaded" in2="gloss" operator="arithmetic" k2="1" k3=".7" result="lit"/>
        <feComposite in="lit" in2="wob" operator="in"/>
      </filter>`;
}

let beadSeq = 0;
/* Close-up of a door hem seam as the fixed station camera sees it:
   two overlapping steel sheets, spot welds on the flange, a press line and a
   pilot hole on the outer panel. The sealer bead is lit by an SVG lighting
   filter so it reads as a rounded, extruded bead lying on the seam. */
const SEAM = "M-8 168 L28 168 C 92 168, 112 70, 188 62 L328 57";
const FLANGE = "M-8 168 L28 168 C 92 168, 112 70, 188 62 L328 57 L328 -8 L-8 -8 Z";
const WELDS = [[35, 143], [76, 112], [98, 88], [127, 62], [163, 43], [208, 37], [242, 36], [276, 35], [310, 33.5]];

function beadSVG(type = "BEAD_BREAK") {
  const d = DEFECTS[type] || DEFECTS.BEAD_BREAK;
  const id = `b${beadSeq++}`;
  const welds = WELDS.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5.5" fill="url(#${id}-weld)"/>`).join("");
  return `
  <svg viewBox="0 0 320 200" role="img" aria-label="Illustration of a sealer bead on a door hem seam, ${type.replace("_", " ").toLowerCase()}${d.clean ? "" : ", suspect region highlighted"}" data-bead="${id}" data-at="${d.at}">
    <defs>
      <linearGradient id="${id}-outer" x1="0" y1="0" x2=".35" y2="1">
        <stop offset="0" stop-color="#6d7277"/><stop offset=".6" stop-color="#5a5e63"/><stop offset="1" stop-color="#46494d"/>
      </linearGradient>
      <linearGradient id="${id}-flange" x1="0" y1="0" x2=".5" y2="1">
        <stop offset="0" stop-color="#9ba0a5"/><stop offset=".55" stop-color="#868b90"/><stop offset="1" stop-color="#73787d"/>
      </linearGradient>
      <radialGradient id="${id}-weld" cx=".42" cy=".38" r=".62">
        <stop offset="0" stop-color="#6d7176"/><stop offset=".7" stop-color="#7f8489"/><stop offset=".86" stop-color="#5c6065"/><stop offset="1" stop-color="#8e9398" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${id}-vig" cx=".5" cy=".45" r=".75">
        <stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/>
      </radialGradient>
      <radialGradient id="${id}-heat">
        <stop offset="0" stop-color="#f2b705" stop-opacity=".55"/>
        <stop offset=".45" stop-color="#f2b705" stop-opacity=".38"/>
        <stop offset="1" stop-color="#f2b705" stop-opacity="0"/>
      </radialGradient>
      <filter id="${id}-brushed" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".9 .035" numOctaves="2" seed="7"/>
        <feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .55 0"/>
      </filter>
      <filter id="${id}-soft" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
      ${beadLitFilter(`${id}-lit`)}
    </defs>

    <!-- outer panel with a press line and a pilot hole -->
    <rect x="-8" y="-8" width="336" height="216" fill="url(#${id}-outer)"/>
    <path d="M24 214 C 80 204, 140 150, 193 108 L330 104" fill="none" stroke="#3b3e42" stroke-width="2.2" opacity=".75"/>
    <path d="M24 216 C 80 206, 140 152, 193 110 L330 106" fill="none" stroke="#8a8f94" stroke-width="1.2" opacity=".6"/>
    <ellipse cx="262" cy="152" rx="11" ry="9" fill="#26282b"/>
    <path d="M251.5 154 A 11 9 0 0 0 272.8 150.5" fill="none" stroke="#a3a8ad" stroke-width="1.4" opacity=".8"/>

    <!-- flange sheet on top, casting a short shadow onto the outer panel -->
    <path d="${SEAM}" fill="none" stroke="#000" stroke-width="5" opacity=".55" transform="translate(1 3.5)" filter="url(#${id}-soft)"/>
    <path d="${FLANGE}" fill="url(#${id}-flange)"/>
    ${welds}
    <path d="${SEAM}" fill="none" stroke="#c4c8cc" stroke-width="1" opacity=".7" transform="translate(0 -1)"/>
    <rect x="-8" y="-8" width="336" height="216" filter="url(#${id}-brushed)" opacity=".16" style="mix-blend-mode: multiply"/>

    <!-- sealer bead: contact shadow, then the lit bead -->
    <g ${d.offset ? 'transform="translate(0 10)"' : ""}>
      <path d="${BEAD_PATH}" fill="none" stroke="#000" stroke-width="${d.w + 3}" stroke-linecap="round" opacity=".5"
        pathLength="100" stroke-dasharray="${d.dash}" transform="translate(1.5 3)" filter="url(#${id}-soft)"/>
      <g filter="url(#${id}-lit)">
        <path data-bead-path d="${BEAD_PATH}" fill="none" stroke="#cbc2ab" stroke-width="${d.w + 2.5}" stroke-linecap="round"
          pathLength="100" stroke-dasharray="${d.dash}"/>
        ${d.blob ? `<g data-blob></g>` : ""}
      </g>
    </g>

    <rect width="320" height="200" fill="url(#${id}-vig)" pointer-events="none"/>
    ${d.clean ? "" : `<g data-heat><circle r="34" fill="url(#${id}-heat)"/><rect x="-26" y="-22" width="52" height="44" rx="3" fill="none" stroke="#f2b705" stroke-width="2" stroke-dasharray="5 4"/></g>`}
  </svg>`;
}

function placeBeads(root = document) {
  root.querySelectorAll("svg[data-bead]").forEach((svg) => {
    const path = svg.querySelector("[data-bead-path]") || svg.querySelectorAll("path")[2];
    const at = parseFloat(svg.dataset.at);
    const len = path.getTotalLength();
    const p = path.getPointAtLength((at / 100) * len);
    const heat = svg.querySelector("[data-heat]");
    if (heat) heat.setAttribute("transform", `translate(${p.x} ${p.y})`);
    const blob = svg.querySelector("[data-blob]");
    if (blob) blob.innerHTML = `<ellipse cx="${p.x}" cy="${p.y}" rx="15" ry="10" fill="#cbc2ab"/>`;
  });
}

window.LLBead = { beadSVG, placeBeads, beadLitFilter };
