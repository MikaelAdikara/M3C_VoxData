/* Light / dark theme for every mockup page.
   Default follows the device; a choice made with the toggle is remembered
   (localStorage, best effort) and passed into embedded frames. */
(function () {
  const KEY = "ll-theme";
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const effective = () => root.dataset.theme || (media.matches ? "dark" : "light");

  function sync() {
    const dark = effective() === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach((b) => {
      b.setAttribute("aria-pressed", String(dark));
      b.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
      const i = b.querySelector("i");
      if (i) i.className = "ph-bold " + (dark ? "ph-sun" : "ph-moon");
    });
  }

  function tellFrames(t) {
    document.querySelectorAll("iframe").forEach((f) => {
      try { f.contentWindow.postMessage({ llTheme: t }, "*"); } catch { /* frame not ready */ }
    });
  }

  function apply(t) {
    root.dataset.theme = t;
    try { localStorage.setItem(KEY, t); } catch { /* storage unavailable */ }
    sync();
    tellFrames(t);
  }

  window.addEventListener("message", (e) => {
    if (e.data && (e.data.llTheme === "dark" || e.data.llTheme === "light")) {
      root.dataset.theme = e.data.llTheme;
      sync();
    }
  });

  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-theme-toggle]");
    if (b) apply(effective() === "dark" ? "light" : "dark");
  });

  media.addEventListener("change", sync);

  document.addEventListener("DOMContentLoaded", () => {
    sync();
    document.querySelectorAll("iframe").forEach((f) =>
      f.addEventListener("load", () => { if (root.dataset.theme) tellFrames(root.dataset.theme); }));
  });

  window.LLTheme = { sync };
})();
