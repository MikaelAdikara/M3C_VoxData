/* Shared shell for the Learning Line mockup: top bar, abnormality trail,
   phone tab bar, footer, role switcher, toast and the bead illustration.
   Static mockup only; all data is simulated (docs/SEED_DATA.md). */

const SCREENS = [
  { id: "station", href: "station.html", label: "Station", icon: "ph-monitor" },
  { id: "shift-board", href: "shift-board.html", label: "Shift board", icon: "ph-squares-four" },
  { id: "kaizen", href: "kaizen.html", label: "Kaizen", icon: "ph-clipboard-text" },
  { id: "knowledge", href: "knowledge.html", label: "Knowledge", icon: "ph-books" },
  { id: "metrics", href: "metrics.html", label: "Metrics", icon: "ph-chart-line" },
];

const ROLES = [
  { id: "operator", label: "Operator · st-04", home: "station.html" },
  { id: "team-leader", label: "Team leader", home: "shift-board.html" },
  { id: "engineer", label: "Engineer", home: "kaizen.html" },
  { id: "senior-expert", label: "Senior expert", home: "knowledge.html" },
  { id: "management", label: "Management", home: "metrics.html" },
];

const TRAIL = [
  { id: "detected", step: "Detected", who: "Camera · model v1.3", icon: "ph-camera" },
  { id: "operator", step: "Operator", who: "Confirms at st-04", icon: "ph-hand-pointing", tone: "caution" },
  { id: "team-leader", step: "Team leader", who: "Stop, contain or continue", icon: "ph-users-three", tone: "caution" },
  { id: "kaizen", step: "Kaizen ticket", who: "Engineer writes the A3", icon: "ph-clipboard-text" },
  { id: "card", step: "Validated card", who: "Senior expert validates", icon: "ph-seal-check" },
];

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function renderTrail(current, toneOverride) {
  const idx = current === "done" ? TRAIL.length : TRAIL.findIndex((s) => s.id === current);
  const items = TRAIL.map((s, i) => {
    const state = i < idx ? "done" : i === idx ? "now" : "next";
    const icon = state === "done" ? "ph-check" : s.icon;
    const tone = state === "now" && toneOverride ? toneOverride : s.tone;
    return `<li data-state="${state}" ${tone ? `data-tone="${tone}"` : ""} ${state === "now" ? 'aria-current="step"' : ""}>
      <span class="trail__dot"><i class="ph-bold ${icon}" aria-hidden="true"></i></span>
      <span class="trail__text"><span class="trail__step">${s.step}</span><span class="trail__who">${s.who}</span></span>
    </li>`;
  }).join("");
  return `<nav class="trail" aria-label="Abnormality trail: K2-27-031487, bead break at st-04"><ol>${items}</ol></nav>`;
}

function mountShell() {
  const body = document.body;
  const screen = body.dataset.screen;
  const role = body.dataset.role;
  const trail = body.dataset.trail;

  const nav = SCREENS.map((s) =>
    `<a href="${s.href}" ${s.id === screen ? 'aria-current="page"' : ""}><i class="ph ${s.icon}" aria-hidden="true"></i><span>${s.label}</span></a>`
  ).join("");

  const roleOptions = ROLES.map((r) =>
    `<option value="${r.id}" ${r.id === role ? "selected" : ""}>${r.label}</option>`
  ).join("");

  const top = el(`
    <header class="topbar">
      <div class="topbar__inner">
        <div class="brand"><span class="brand__name">Learning Line</span><span class="brand__site">K2-Body · Karawang II</span></div>
        <nav class="nav" aria-label="Screens">${nav}</nav>
        <div class="topbar__end">
          <label class="role"><i class="ph ph-user-circle" aria-hidden="true"></i><span class="sr-only">Role</span><select id="role">${roleOptions}</select></label>
          <div class="clock" aria-label="Shift clock"><div class="clock__time num" id="clock">08:42</div><div class="clock__shift">Shift A</div></div>
        </div>
      </div>
    </header>`);
  body.prepend(top);
  if (trail) top.after(el(renderTrail(trail, body.dataset.trailTone)));

  const tabs = SCREENS.map((s) =>
    `<a href="${s.href}" ${s.id === screen ? 'aria-current="page"' : ""}><i class="ph ${s.icon}" aria-hidden="true"></i>${s.label}</a>`
  ).join("");
  body.append(el(`<nav class="tabbar" aria-label="Screens">${tabs}</nav>`));
  body.append(el(`<footer class="footer">Concept prototype · simulated data · not connected to TMMIN systems</footer>`));
  body.append(el(`<div class="toast" role="status" aria-live="polite" hidden><i class="ph-bold ph-check-circle" aria-hidden="true"></i><span></span></div>`));

  document.getElementById("role").addEventListener("change", (e) => {
    const r = ROLES.find((x) => x.id === e.target.value);
    if (r) location.href = r.home;
  });
}

let toastTimer;
function toast(msg) {
  const t = document.querySelector(".toast");
  t.querySelector("span").textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

function setTrail(current, tone) {
  const old = document.querySelector(".trail");
  if (!old) return;
  const fresh = el(renderTrail(current, tone));
  old.replaceWith(fresh);
}

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
function beadSVG(type = "BEAD_BREAK", opts = {}) {
  const d = DEFECTS[type] || DEFECTS.BEAD_BREAK;
  const id = `b${beadSeq++}`;
  const label = opts.label !== false;
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

function tickClock() {
  const c = document.getElementById("clock");
  if (!c) return;
  let m = 42;
  setInterval(() => { m = (m + 1) % 60; c.textContent = `08:${String(m).padStart(2, "0")}`; }, 60000);
}

document.addEventListener("DOMContentLoaded", () => {
  mountShell();
  document.querySelectorAll("[data-bead-slot]").forEach((slot) => {
    slot.innerHTML = beadSVG(slot.dataset.beadSlot) + (slot.dataset.label !== "off" ? '<span class="bead__tag">Illustration · simulated</span>' : "");
  });
  placeBeads();
  tickClock();
  document.dispatchEvent(new CustomEvent("shell:ready"));
});

window.LL = { toast, setTrail, beadSVG, placeBeads };
