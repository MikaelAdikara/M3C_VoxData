"use client";

import { useSyncExternalStore } from "react";

import { Icon } from "@/components/ui/Icon";

export const THEME_KEY = "ll-theme";

/** Runs before paint (inlined in the root layout) so a stored theme never flashes. */
export const themeBootScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t;}catch(e){}`;

const media = () => window.matchMedia("(prefers-color-scheme: dark)");

function subscribe(onChange: () => void) {
  const mq = media();
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  mq.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    mq.removeEventListener("change", onChange);
  };
}

function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : media().matches;
}

/** Sun/moon toggle. Default follows the device; a choice is remembered. */
export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage can be unavailable (private mode); the theme still applies for this visit.
    }
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggle}
      aria-pressed={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <Icon name={dark ? "sun" : "moon"} weight="bold" />
    </button>
  );
}
