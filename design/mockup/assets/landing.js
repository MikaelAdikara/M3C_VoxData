/* Landing page behaviour: hero demo loop, cover bar state, reveal on scroll. */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Hero video: keep the poster still when motion is reduced. */
const video = document.getElementById("video");
if (reduceMotion && video) { video.removeAttribute("autoplay"); video.pause(); video.style.display = "none"; }

/* Demo: scan → heatmap → caution plate → confirm press → confirmed. */
const demo = document.getElementById("demo");
const media = document.getElementById("demo-media");
media.insertAdjacentHTML("afterbegin", beadSVG("BEAD_BREAK"));
placeBeads(media);

const plate = document.getElementById("demo-plate");
const title = document.getElementById("demo-title");
const status = document.getElementById("demo-status");

function setStep(n) {
  demo.dataset.step = String(n);
  if (n === 4) {
    plate.dataset.tone = "caution";
    plate.querySelector(".plate__icon i").className = "ph-fill ph-bell-ringing";
    title.innerHTML = "Yellow andon: st-04<small>Confirmed by operator · team leader decides next</small>";
    status.textContent = "Next: the team leader decides";
  } else if (n === 0) {
    plate.dataset.tone = "caution";
    plate.querySelector(".plate__icon i").className = "ph-fill ph-warning";
    title.innerHTML = "Caution: bead break<small>Suggested by the system. You decide.</small>";
    status.textContent = "Operator at st-04 decides";
  }
}

if (reduceMotion) {
  setStep(2);
  const b = document.getElementById("pause"); if (b) b.hidden = true;
} else {
  const timeline = [[0, 0], [1, 1700], [2, 2300], [3, 3900], [4, 4200]];
  const cycle = 8000;
  let timers = [];
  const run = () => {
    timers.forEach(clearTimeout);
    timers = timeline.map(([step, at]) => setTimeout(() => {
      if (step === 0) { demo.dataset.step = ""; void demo.offsetWidth; }
      setStep(step);
    }, at));
  };
  let loop = null;
  const start = () => { if (loop) return; run(); loop = setInterval(run, cycle); };
  const stop = () => { clearInterval(loop); loop = null; timers.forEach(clearTimeout); };
  let paused = false;
  new IntersectionObserver(([e]) => (e.isIntersecting && !paused ? start() : stop()), { threshold: 0.2 }).observe(demo);
  document.addEventListener("visibilitychange", () => (document.hidden || paused ? stop() : start()));
  const btn = document.getElementById("pause");
  btn.addEventListener("click", () => {
    paused = !paused;
    btn.setAttribute("aria-pressed", String(paused));
    btn.setAttribute("aria-label", paused ? "Play video and demo" : "Pause video and demo");
    btn.querySelector("i").className = paused ? "ph-bold ph-play" : "ph-bold ph-pause";
    if (paused) { stop(); setStep(0); setStep(2); if (video) video.pause(); }
    else { start(); if (video) video.play(); }
  });
}

/* Cover bar turns light once the hero has scrolled away. */
const bar = document.getElementById("bar");
new IntersectionObserver(([e]) => { bar.dataset.light = e.isIntersecting ? "false" : "true"; }, { rootMargin: "-64px 0px 0px 0px" })
  .observe(document.querySelector(".hero"));

/* Reveal once on scroll. */
const reveals = document.querySelectorAll(".reveal");
reveals.forEach((el) => {
  const sib = el.parentElement ? [...el.parentElement.children].filter((c) => c.classList.contains("reveal")) : [];
  el.style.setProperty("--i", Math.max(0, sib.indexOf(el)));
});
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
}, { threshold: 0.12 });
reveals.forEach((el) => io.observe(el));
