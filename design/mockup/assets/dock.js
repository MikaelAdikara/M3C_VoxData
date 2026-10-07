/* "Ask the line": the assistant, reachable from every screen.
   Answers only from validated knowledge cards, always cites card and revision,
   and routes uncovered questions to the owner engineer. Mockup answers come
   from docs/SEED_DATA.md section 5 and 6. */

(function () {
  const CARDS = {
    "KC-SEAL-014": { rev: "r3", station: "st-04", factor: "Machine", symptom: "Thin bead on door seams at shift start",
      cause: "Sealer viscosity is high when the material is cold after the overnight stop.",
      steps: ["Run a 30 s warm-up purge before the first body.", "Check gun pressure at start-up."], std: "Standardized work st-04, step 2" },
    "KC-SEAL-021": { rev: "r2", station: "st-04", factor: "Method", symptom: "Bead break at seam-R-door-07",
      cause: "The nozzle angle drifts after a nozzle change.",
      steps: ["Check the angle with the gauge after every nozzle change.", "The check is on the change checklist."], std: "QC process chart, sealer section" },
    "KC-SEAL-009": { rev: "r1", station: "st-02", factor: "Material", symptom: "False alarms on new grey sealer",
      cause: "Lower contrast under the current lighting.",
      steps: ["Add a polarising filter.", "Re-validate the model as a 4M change."], std: "Inspection standard, camera set-up" },
  };
  const QUESTIONS = [
    { q: "Thin bead at the start of shift on st-04, what do we do?", card: "KC-SEAL-014" },
    { q: "Bead break near the right door after a nozzle change?", card: "KC-SEAL-021" },
    { q: "Why are we getting false alarms on the grey sealer?", card: "KC-SEAL-009" },
    { q: "How do we fix paint orange peel?", card: null },
  ];

  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "assets/dock.css";
  document.head.append(css);

  const root = document.createElement("div");
  root.className = "dock";
  root.innerHTML = `
    <button class="dock__fab" type="button" aria-expanded="false" aria-controls="dock-panel">
      <i class="ph-bold ph-chat-circle-text" aria-hidden="true"></i><span>Ask the line</span>
    </button>
    <section class="dock__panel" id="dock-panel" role="dialog" aria-modal="false" aria-labelledby="dock-title" hidden>
      <header class="dock__head">
        <div><h2 id="dock-title">Ask the line</h2><p>Answers only from validated knowledge cards, and cites the one it used.</p></div>
        <button class="dock__close" type="button" aria-label="Close assistant"><i class="ph-bold ph-x" aria-hidden="true"></i></button>
      </header>
      <div class="dock__log" id="dock-log" aria-live="polite">
        <p class="dock__hint">Try one of these, or type your own.</p>
        <div class="dock__chips">${QUESTIONS.map((x, i) => `<button type="button" data-q="${i}">${x.q}</button>`).join("")}</div>
      </div>
      <form class="dock__form" autocomplete="off">
        <label class="sr-only" for="dock-input">Question</label>
        <input id="dock-input" class="input" placeholder="Ask about a defect, a station or a standard" maxlength="160">
        <button class="btn dock__send" type="submit" aria-label="Ask"><i class="ph-bold ph-arrow-up" aria-hidden="true"></i></button>
      </form>
      <footer class="dock__foot">Offline answers from 9 validated cards · simulated</footer>
    </section>`;
  document.body.append(root);
  document.body.classList.add("has-dock");

  const fab = root.querySelector(".dock__fab");
  const panel = root.querySelector(".dock__panel");
  const log = root.querySelector("#dock-log");
  const input = root.querySelector("#dock-input");

  function open() {
    panel.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => panel.dataset.open = "true");
    input.focus();
  }
  function close() {
    panel.dataset.open = "false";
    fab.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (panel.dataset.open === "false") panel.hidden = true; }, 180);
    fab.focus();
  }
  fab.addEventListener("click", () => (panel.hidden ? open() : close()));
  root.querySelector(".dock__close").addEventListener("click", close);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) close(); });

  function answerHTML(id) {
    if (!id) return `
      <div class="ans ans--none">
        <p><strong>No validated card covers this yet.</strong> I won't guess.</p>
        <p class="muted">Paint orange peel has no card in the knowledge base. The question can go to the owner engineer, who may open a Kaizen ticket.</p>
        <button class="btn btn--ghost ans__route" type="button"><i class="ph-bold ph-paper-plane-tilt" aria-hidden="true"></i>Route to owner engineer</button>
      </div>`;
    const c = CARDS[id];
    return `
      <div class="ans">
        <p>${c.cause}</p>
        <ol>${c.steps.map((s) => `<li>${s}</li>`).join("")}</ol>
        <a class="ans__cite" href="knowledge.html"><i class="ph-fill ph-seal-check" aria-hidden="true"></i><span><b>${id} ${c.rev}</b> · validated by senior expert<small>${c.symptom} · ${c.factor} · ${c.std}</small></span></a>
      </div>`;
  }

  function ask(text, card) {
    log.querySelector(".dock__hint")?.remove();
    log.querySelector(".dock__chips")?.remove();
    log.insertAdjacentHTML("beforeend", `<p class="q">${text.replace(/</g, "&lt;")}</p><div class="thinking" aria-label="Searching validated cards"><span></span><span></span><span></span></div>`);
    log.scrollTop = log.scrollHeight;
    setTimeout(() => {
      log.querySelector(".thinking")?.remove();
      log.insertAdjacentHTML("beforeend", answerHTML(card));
      log.scrollTop = log.scrollHeight;
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 650);
  }

  log.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-q]");
    if (chip) { const x = QUESTIONS[+chip.dataset.q]; ask(x.q, x.card); return; }
    const route = e.target.closest(".ans__route");
    if (route) { route.disabled = true; route.innerHTML = '<i class="ph-bold ph-check" aria-hidden="true"></i>Routed to role:engineer@paint'; window.LL?.toast("Question routed to the owner engineer"); }
  });
  root.querySelector(".dock__form").addEventListener("submit", (e) => {
    e.preventDefault();
    const t = input.value.trim();
    if (!t) return;
    input.value = "";
    const l = t.toLowerCase();
    const card = /thin|start of shift|viscos/.test(l) ? "KC-SEAL-014" : /break|nozzle|door/.test(l) ? "KC-SEAL-021" : /false alarm|grey|gray|reflect/.test(l) ? "KC-SEAL-009" : null;
    ask(t, card);
  });
})();
