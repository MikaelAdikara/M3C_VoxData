/* Landing v3 behaviour: live strip fed by the line model, the tag on the
   center spine, the camera mosaic and reveal on scroll. */

/* ---------- Hero ---------- */
function wireHero() {
  const L = window.LLLine;
  const btn = document.getElementById("btn-motion");
  const sync = () => {
    btn.setAttribute("aria-pressed", String(L.state.paused));
    btn.setAttribute("aria-label", L.state.paused ? "Play motion" : "Pause motion");
    btn.querySelector("i").className = "ph-bold " + (L.state.paused ? "ph-play" : "ph-pause");
  };
  btn.addEventListener("click", () => { L.setPaused(!L.state.paused); sync(); });
  sync();
  document.addEventListener("line:takt", (e) => { document.getElementById("live-bodies").textContent = e.detail.bodiesDone; });
}
if (window.LLLine) wireHero(); else document.addEventListener("line:ready", wireHero);

/* ---------- Trail on the spine ---------- */
const tag = document.getElementById("tag");
const photo = document.getElementById("tag-photo");
photo.insertAdjacentHTML("afterbegin", beadSVG("BEAD_BREAK"));
placeBeads(photo);

const subs = [
  "Sealer station st-04 · Shift A",
  "Flagged by camera · waiting for operator",
  "Confirmed · yellow andon",
  "Decided by team leader",
  "Kaizen loop · A3 open",
  "Validated · reusable by every station",
];
const logItems = [...document.querySelectorAll("#tag-log li")];
const beats = [...document.querySelectorAll(".beat")];

function setStep(n) {
  if (String(n) === tag.dataset.step) return;
  tag.dataset.step = String(n);
  document.getElementById("tag-kind").innerHTML = `${n === 5 ? "Standard" : "Abnormality"}<small>${subs[n]}</small>`;
  logItems.forEach((li, i) => { li.dataset.on = String(i < n); li.dataset.last = String(i === n - 1); });
  beats.forEach((b) => { const k = Number(b.dataset.step); b.dataset.active = String(k === n); b.dataset.done = String(k < n); });
}
const io1 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) setStep(Number(e.target.dataset.step)); }), { rootMargin: "-45% 0px -45% 0px" });
beats.forEach((b) => io1.observe(b));
new IntersectionObserver(([e]) => { if (e.isIntersecting && e.boundingClientRect.top > 0) setStep(0); }, { rootMargin: "0px 0px -55% 0px" })
  .observe(document.getElementById("trail-title"));
setStep(0);

/* ---------- Camera mosaic: the alert frame sits in the middle ---------- */
const C = window.LLCam.CAMERAS;
const by = (st) => C.find((c) => c.station === st);
const tiles = [
  { cam: by("st-02"), o: { compact: true } },
  { cam: by("st-04"), o: { focus: true, frameAlert: true }, big: true },
  { cam: by("st-03"), o: { focus: true } },
  { cam: by("st-06"), o: { compact: true } },
  { cam: by("final-01"), o: { focus: true } },
];
const mosaic = document.getElementById("mosaic");
mosaic.innerHTML = tiles.map((t) => `<div class="${t.big ? "big" : ""}">${window.LLCam.feedHTML(t.cam, t.o)}</div>`).join("");
placeBeads(mosaic);
// videos only play while the band is on screen, and never with reduced motion
const vids = [...mosaic.querySelectorAll("video")];
const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
vids.forEach((v) => { v.removeAttribute("autoplay"); v.preload = "metadata"; });
new IntersectionObserver(([e]) => vids.forEach((v) => (e.isIntersecting && !still ? v.play().catch(() => {}) : v.pause())), { threshold: 0.15 }).observe(mosaic);

/* ---------- Reveal once ---------- */
const reveals = document.querySelectorAll(".reveal");
reveals.forEach((el) => {
  const sib = [...el.parentElement.children].filter((c) => c.classList.contains("reveal"));
  el.style.setProperty("--i", Math.max(0, sib.indexOf(el)));
});
const io2 = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io2.unobserve(e.target); } }), { threshold: 0.12 });
reveals.forEach((el) => io2.observe(el));
