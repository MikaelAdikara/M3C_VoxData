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
        <a class="brand" href="index.html" aria-label="Learning Line cover page"><span class="brand__name">Learning Line</span><span class="brand__site">K2-Body · Karawang II</span></a>
        <nav class="nav" aria-label="Screens">${nav}</nav>
        <div class="topbar__end">
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Switch to dark mode"><i class="ph-bold ph-moon" aria-hidden="true"></i></button>
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

  if (window.LLTheme) window.LLTheme.sync();

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
