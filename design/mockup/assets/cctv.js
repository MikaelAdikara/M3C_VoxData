/* CCTV module for the mockup: camera tiles, the procedural sealer scene,
   the wall, the shift timeline and camera health. Sample data only.

   Feed sources, in order of honesty:
     clip   real factory footage (Pexels, free licence), no detection boxes,
            because there is no per-frame annotation for it
     still  the simulated bead frame with its heatmap (the only feed with a box)
     scene  a procedural SVG of the sealer cell for cameras without footage */

const SHIFT = { start: 7 * 60, end: 15 * 60 + 30 }; // Shift A, minutes

const CAMERAS = [
  { id: "sealer-edge-01/cam-01", station: "st-01", name: "Sealer 01", source: "scene", state: "online", uptime: 99.6, lens: "2 days ago", model: "sealer-st01-v1.3" },
  { id: "sealer-edge-02/cam-01", station: "st-02", name: "Sealer 02", source: "scene", state: "attention", note: "Reflection on new grey sealer: 3 false alarms this shift, over budget", uptime: 97.8, lens: "6 days ago", model: "sealer-st02-v1.3", review: true },
  { id: "body-edge-03/cam-01", station: "st-03", name: "Body 03", source: "clip", clip: "body-weld-a", state: "online", uptime: 99.4, lens: "1 day ago", model: "body-st03-v1.1" },
  { id: "sealer-edge-04/cam-01", station: "st-04", name: "Sealer 04", source: "scene", state: "online", uptime: 99.8, lens: "1 day ago", model: "sealer-st04-v1.3", alert: { at: 8 * 60 + 42, label: "Bead break · seam-R-door-07 · 0.83 vs 0.61" } },
  { id: "body-edge-05/cam-01", station: "st-05", name: "Body 05", source: "clip", clip: "body-weld-b", state: "online", uptime: 99.1, lens: "3 days ago", model: "body-st05-v1.1" },
  { id: "body-edge-06/cam-01", station: "st-06", name: "Body 06", source: "scene", state: "offline", note: "No frames since 06:12; housing power check", uptime: 91.2, lens: "9 days ago", model: "body-st06-v1.1" },
  { id: "final-edge-01/cam-01", station: "final-01", name: "Final inspection", source: "clip", clip: "body-hall", state: "online", uptime: 99.5, lens: "2 days ago", model: "final-v1.0" },
];

/* Shift events per camera (sample). kind: alert | confirm | reject | stop | gap */
const EVENTS = [
  { cam: "sealer-edge-02/cam-01", at: 8 * 60 + 20, kind: "alert", label: "Alert · thin bead (reflection)" },
  { cam: "sealer-edge-02/cam-01", at: 8 * 60 + 21, kind: "reject", label: "Rejected: reflection" },
  { cam: "sealer-edge-02/cam-01", at: 8 * 60 + 21.5, kind: "reject", label: "Rejected: reflection" },
  { cam: "sealer-edge-02/cam-01", at: 8 * 60 + 22, kind: "reject", label: "Rejected: reflection (over budget)" },
  { cam: "sealer-edge-04/cam-01", at: 7 * 60 + 58, kind: "confirm", label: "Bead break confirmed" },
  { cam: "sealer-edge-04/cam-01", at: 8 * 60 + 21, kind: "confirm", label: "Bead break confirmed" },
  { cam: "sealer-edge-04/cam-01", at: 8 * 60 + 42, kind: "alert", label: "Bead break · 0.83 vs 0.61 · waiting for operator" },
  { cam: "body-edge-05/cam-01", at: 8 * 60 + 37, kind: "confirm", label: "Bead off path confirmed" },
  { cam: "body-edge-06/cam-01", at: 6 * 60 + 12, kind: "gap", label: "Recording gap from 06:12" },
];

const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.floor(m % 60)).padStart(2, "0")}`;

/* Seeded numbers so the mockup looks the same on every reload. */
function seeded(str) {
  let h = 2166136261;
  for (const c of str) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

/* Procedural sealer cell: a door panel moves through at takt, the nozzle lays
   the bead, the camera's view cone sweeps once per body. */
let sceneSeq = 0;
function sealerScene({ animated = true } = {}) {
  const id = `sc${sceneSeq++}`;
  return `
  <svg class="scene${animated ? " scene--live" : ""}" viewBox="0 0 320 180" role="img" aria-label="Simulated view of the sealer cell: a door panel passes the nozzle and the camera">
    <defs>
      <linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset="1" stop-color="#262626"/></linearGradient>
      <linearGradient id="${id}-panel" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#9ba0a5"/><stop offset=".6" stop-color="#7d8287"/><stop offset="1" stop-color="#63676c"/></linearGradient>
      ${beadLitFilter(`${id}-lit`)}
    </defs>
    <rect width="320" height="180" fill="url(#${id}-bg)"/>
    <g opacity=".35" stroke="#6a6a6a" stroke-width="1">
      <path d="M0 150 H320"/><path d="M0 160 H320"/>
      ${Array.from({ length: 12 }, (_, i) => `<path d="M${i * 30} 150 v10"/>`).join("")}
    </g>
    <g class="scene__body">
      <path d="M40 140 C 40 80, 80 50, 150 46 L 250 44 C 268 44, 276 60, 276 80 L 276 140 Z" fill="url(#${id}-panel)" stroke="#2c2c2c" stroke-width="2"/>
      <path d="M58 140 C 58 92, 92 66, 150 62 L 252 60 C 262 60, 266 70, 266 82 L 266 140" fill="none" stroke="#b9bdc1" stroke-width="1" opacity=".55"/>
      ${[[86, 92], [112, 74], [178, 56], [214, 55], [246, 55]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#7a7e83" stroke="#9fa3a8" stroke-width=".8"/>`).join("")}
      <path d="M70 118 C 74 84, 100 66, 150 63 L 244 62" fill="none" stroke="#000" stroke-width="7" stroke-linecap="round" opacity=".35" transform="translate(1 2)"/>
      <g filter="url(#${id}-lit)">
        <path class="scene__bead" d="M70 118 C 74 84, 100 66, 150 63 L 244 62" fill="none" stroke="#cbc2ab" stroke-width="5.5" stroke-linecap="round" pathLength="100"/>
      </g>
    </g>
    <g class="scene__robot" stroke="#1d1d1d" stroke-width="2">
      <rect x="196" y="0" width="22" height="18" fill="#4a4a4a"/>
      <path d="M207 18 L 207 34 L 196 46" fill="none" stroke="#5a5a5a" stroke-width="6" stroke-linecap="round"/>
      <circle cx="196" cy="48" r="4" fill="#d9d3c3"/>
    </g>
    <path class="scene__cone" d="M300 8 L 120 150 L 300 150 Z" fill="rgba(255,255,255,.05)" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 4"/>
    <rect x="292" y="2" width="18" height="10" rx="2" fill="#555"/>
  </svg>`;
}

function feedHTML(cam, { focus = false, compact = false, frameAlert = false } = {}) {
  const offline = cam.state === "offline";
  const showAlertFrame = frameAlert && cam.alert;
  let media;
  if (offline) media = sealerScene({ animated: false });
  else if (showAlertFrame) media = beadSVG("BEAD_BREAK");
  else if (cam.source === "clip")
    media = `<video src="assets/video/cams/${cam.clip}.mp4" poster="assets/video/cams/${cam.clip}.jpg" muted loop playsinline preload="none" ${focus ? "autoplay" : ""} aria-hidden="true"></video>`;
  else media = sealerScene({ animated: focus && !compact });

  const tone = offline ? "stop" : cam.alert ? "caution" : cam.review ? "instruct" : "ok";
  const sourceLabel = showAlertFrame
    ? `Alert frame ${fmt(cam.alert.at)}:17 · simulated`
    : cam.source === "clip"
      ? "Test clip · no annotation"
      : "Simulated scene";
  return `
  <div class="feed" data-tone="${tone}" data-offline="${offline}" data-focus="${focus}">
    ${media}
    ${focus && !offline && !compact ? '<span class="feed__sweep" aria-hidden="true"></span>' : ""}
    ${offline ? `<div class="feed__lost"><strong>Signal lost</strong><span>${cam.note ?? "No frames"}</span></div>` : ""}
    <div class="feed__top">
      <span class="feed__chip"><span class="feed__pip" data-tone="${tone}"></span><span class="mono">${cam.station}</span>${compact ? "" : ` · ${cam.name}`}</span>
      ${offline ? "" : `<span class="feed__chip num">${showAlertFrame ? fmt(cam.alert.at) + ":17" : "LIVE"}</span>`}
    </div>
    ${compact || offline ? "" : `<div class="feed__bottom"><span class="feed__chip feed__chip--quiet">${sourceLabel}</span><span class="feed__chip feed__rec"><span class="feed__pip" data-tone="stop"></span>REC</span></div>`}
  </div>`;
}

/* ---------- Wall ---------- */
let focusId = "sealer-edge-04/cam-01";
let playhead = 8 * 60 + 42;
let layout = "3";

function renderWall() {
  const wall = document.getElementById("wall");
  wall.dataset.cols = layout;
  const list = CAMERAS.slice(0, layout === "2" ? 4 : CAMERAS.length);
  wall.innerHTML = list
    .map((c) => `<button class="tile-cam" data-id="${c.id}" aria-pressed="${c.id === focusId}" aria-label="${c.name}, ${c.state}${c.alert ? ", alert waiting" : ""}">${feedHTML(c, { compact: layout === "4", focus: c.id === focusId, frameAlert: false })}</button>`)
    .join("");
  wall.querySelectorAll("video").forEach((v) => { if (v.closest('[data-focus="true"]')) v.play().catch(() => {}); });
  placeBeads(wall);
}

function renderFocus() {
  const cam = CAMERAS.find((c) => c.id === focusId);
  const nearAlert = cam.alert && Math.abs(playhead - cam.alert.at) <= 3;
  document.getElementById("focus-feed").innerHTML = feedHTML(cam, { focus: true, frameAlert: nearAlert });
  placeBeads(document.getElementById("focus-feed"));
  const v = document.querySelector("#focus-feed video");
  if (v) v.play().catch(() => {});
  document.getElementById("focus-title").innerHTML = `${cam.name} <small class="mono">${cam.id}</small>`;
  document.getElementById("focus-facts").innerHTML = `
    <dt>Status</dt><dd>${cam.state === "online" ? "Online" : cam.state === "attention" ? "Needs attention" : "Offline"}</dd>
    <dt>Model</dt><dd class="mono">${cam.model}</dd>
    <dt>Lens cleaned</dt><dd>${cam.lens}</dd>
    <dt>Stream</dt><dd class="num">1920×1080 · 25 fps</dd>`;
  const note = document.getElementById("focus-note");
  note.innerHTML = cam.alert
    ? `<span class="badge badge--caution">Yellow andon</span> ${cam.alert.label}`
    : cam.review
      ? `<span class="badge badge--instruct">Model review needed</span> ${cam.note}`
      : cam.note ?? "Running normally.";
  document.getElementById("focus-open").href = `station.html${cam.station === "st-04" ? "" : ""}`;
  renderTimeline(cam);
}

function renderTimeline(cam) {
  const r = seeded(cam.id);
  const slots = 102; // 5-minute slots, 07:00 to 15:30
  const ev = EVENTS.filter((e) => e.cam === cam.id);
  const gapUntil = cam.state === "offline" ? Infinity : -1;
  const pct = (m) => ((m - SHIFT.start) / (SHIFT.end - SHIFT.start)) * 100;
  document.getElementById("tl-cov").innerHTML = Array.from({ length: slots }, (_, i) => {
    const m = SHIFT.start + i * 5;
    const gap = cam.state === "offline" && m > 6 * 60 + 12 && m < gapUntil;
    const h = gap ? 100 : 82 + r() * 18;
    return `<span class="${gap ? "gap" : ""}" style="height:${h}%"></span>`;
  }).join("");
  document.getElementById("tl-events").innerHTML = ev
    .filter((e) => e.at >= SHIFT.start)
    .map((e) => `<button class="tl-ev" data-kind="${e.kind}" style="left:${pct(e.at)}%" data-at="${e.at}" title="${fmt(e.at)} · ${e.label}" aria-label="${fmt(e.at)} ${e.label}"></button>`)
    .join("");
  document.getElementById("tl-head").style.left = `${pct(playhead)}%`;
  document.getElementById("tl-time").textContent = fmt(playhead);
  const list = document.getElementById("tl-list");
  list.innerHTML = ev.length
    ? ev.map((e) => `<li data-kind="${e.kind}"><span class="num">${fmt(e.at)}</span><span>${e.label}</span></li>`).join("")
    : `<li class="muted">No events on this camera this shift.</li>`;
  const scrub = document.getElementById("tl-scrub");
  scrub.value = String(playhead);
}

function renderHealth() {
  document.getElementById("health").innerHTML = CAMERAS.map((c) => {
    const r = seeded("up" + c.id);
    const bars = Array.from({ length: 14 }, (_, i) => {
      let v = 0.86 + r() * 0.14;
      if (c.state === "offline" && i > 11) v = 0.15;
      if (c.state === "attention" && r() > 0.72) v = 0.35 + r() * 0.2;
      return v;
    });
    const tone = c.state === "online" ? "ok" : c.state === "attention" ? "caution" : "stop";
    return `
    <article class="hc" data-tone="${tone}">
      <div class="hc__top"><span><span class="feed__pip" data-tone="${tone}"></span><strong>${c.name}</strong> <span class="mono muted">${c.station}</span></span>
        <b class="num">${c.state === "offline" ? "Offline" : c.uptime.toFixed(1) + "%"}</b></div>
      <div class="hc__bars" aria-label="Uptime, last 14 days">${bars.map((v) => `<span style="height:${Math.round(v * 100)}%" class="${v < 0.6 ? "low" : ""}"></span>`).join("")}</div>
      <div class="hc__meta"><span>Lens cleaned ${c.lens}</span><span class="mono">${c.model}</span></div>
      ${c.note ? `<p class="hc__note">${c.note}</p>` : ""}
      ${c.state !== "online" ? `<button class="btn btn--ghost hc__btn" data-ticket="${c.id}">Create maintenance ticket</button>` : ""}
    </article>`;
  }).join("");
}

document.addEventListener("shell:ready", () => {
  if (!document.getElementById("wall")) return;
  renderWall();
  renderFocus();
  renderHealth();
  document.getElementById("wall").addEventListener("click", (e) => {
    const t = e.target.closest(".tile-cam");
    if (!t) return;
    focusId = t.dataset.id;
    const cam = CAMERAS.find((c) => c.id === focusId);
    playhead = cam.alert ? cam.alert.at : playhead;
    renderWall();
    renderFocus();
  });
  document.getElementById("layouts").addEventListener("change", (e) => { layout = e.target.value; renderWall(); });
  document.getElementById("tl-scrub").addEventListener("input", (e) => { playhead = Number(e.target.value); renderFocus(); });
  document.getElementById("tl-events").addEventListener("click", (e) => {
    const b = e.target.closest(".tl-ev");
    if (b) { playhead = Number(b.dataset.at); renderFocus(); }
  });
  document.getElementById("tabs-cam").addEventListener("change", (e) => {
    document.getElementById("view-wall").hidden = e.target.value !== "wall";
    document.getElementById("view-health").hidden = e.target.value !== "health";
  });
  document.getElementById("health").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ticket]");
    if (b) { b.disabled = true; b.textContent = "Ticket created (simulated)"; LL.toast("Maintenance ticket created for " + b.dataset.ticket); }
  });
});

window.LLCam = { feedHTML, sealerScene, CAMERAS };
