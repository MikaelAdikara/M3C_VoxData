/* Landing v2 behaviour: hero motion toggle, the abnormality tag that is
   stamped as the reader scrolls, the camera trio and reveal on scroll. */

/* ---------- Hero: pause the line (WCAG 2.2.2) ---------- */
function wireHero() {
  const btn = document.getElementById("btn-motion");
  const sync = () => {
    const p = window.LLLine.state.paused;
    btn.setAttribute("aria-pressed", String(p));
    btn.setAttribute("aria-label", p ? "Play motion" : "Pause motion");
    btn.querySelector("i").className = "ph-bold " + (p ? "ph-play" : "ph-pause");
  };
  btn.addEventListener("click", () => { window.LLLine.setPaused(!window.LLLine.state.paused); sync(); });
  sync();
}
if (window.LLLine) wireHero(); else document.addEventListener("line:ready", wireHero);

/* ---------- The Trail ---------- */
const tag = document.getElementById("tag");
const photo = document.getElementById("tag-photo");
photo.insertAdjacentHTML("afterbegin", beadSVG("BEAD_BREAK"));
placeBeads(photo);

const kinds = ["Abnormality", "Abnormality", "Abnormality", "Abnormality", "Abnormality", "Standard"];
const subs = [
  "Sealer station st-04 · Shift A",
  "Flagged by camera · waiting for operator",
  "Confirmed · yellow andon",
  "Decided by team leader",
  "Kaizen loop · A3 open",
  "Validated · reusable by every station",
];
const logItems = [...document.querySelectorAll("#tag-log li")];
const steps = [...document.querySelectorAll(".step2")];

function setStep(n) {
  if (String(n) === tag.dataset.step) return;
  tag.dataset.step = String(n);
  document.getElementById("tag-kind").innerHTML = `${kinds[n]}<small>${subs[n]}</small>`;
  logItems.forEach((li, i) => {
    li.dataset.on = String(i < n);
    li.dataset.last = String(i === n - 1);
  });
  steps.forEach((s) => {
    const k = Number(s.dataset.step);
    s.dataset.active = String(k === n);
    s.dataset.done = String(k < n);
  });
}

const stepIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) setStep(Number(e.target.dataset.step)); });
}, { rootMargin: "-45% 0px -45% 0px" });
steps.forEach((s) => stepIO.observe(s));
// scrolling back above the first step clears the tag
new IntersectionObserver(([e]) => { if (e.isIntersecting && e.boundingClientRect.top > 0) setStep(0); }, { rootMargin: "0px 0px -55% 0px" })
  .observe(document.querySelector(".trail2__head"));
setStep(0);

/* ---------- Cameras: three honest sources ---------- */
const cams = window.LLCam.CAMERAS;
const trio = [
  { cam: cams.find((c) => c.station === "st-03"), opts: { focus: true }, title: "Public visual reference, no boxes", text: "Real body-shop footage in CCTV grade. We have no per-frame annotation for it, so it never carries a detection box." },
  { cam: cams.find((c) => c.station === "st-01"), opts: { focus: true }, title: "Generated simulation", text: "Stations without footage show a drawn scene of the sealer robot at takt, and say so on the frame." },
  { cam: cams.find((c) => c.station === "st-04"), opts: { focus: true, frameAlert: true }, title: "Alert replay, illustration", text: "Only our own simulated bead image carries a heatmap: the region the model found unlike the good beads." },
];
const grid = document.getElementById("cams-grid");
grid.innerHTML = trio.map((t) => `
  <figure class="reveal">${window.LLCam.feedHTML(t.cam, t.opts)}
    <figcaption><strong>${t.title}</strong>${t.text}</figcaption>
  </figure>`).join("");
placeBeads(grid);
if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  grid.querySelectorAll("video").forEach((v) => { v.removeAttribute("autoplay"); v.pause(); });
}

/* ---------- Reveal once on scroll ---------- */
const reveals = document.querySelectorAll(".reveal");
reveals.forEach((el) => {
  const sib = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains("reveal")) : [];
  el.style.setProperty("--i", Math.max(0, sib.indexOf(el)));
});
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
reveals.forEach((el) => io.observe(el));
