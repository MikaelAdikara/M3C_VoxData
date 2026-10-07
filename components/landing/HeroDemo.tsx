"use client";

import { useEffect, useState } from "react";

import { BeadIllustration } from "@/components/station/BeadIllustration";
import { Icon } from "@/components/ui/Icon";
import { Plate } from "@/components/ui/Plate";

const TIMELINE: [number, number][] = [
  [0, 0],
  [1, 1700],
  [2, 2300],
  [3, 3900],
  [4, 4200],
];
const CYCLE = 8000;

/**
 * Looping demo of the mechanism: camera scan, heatmap, caution plate, the
 * operator's confirm, then the yellow andon to the team leader. One pause
 * button stops this loop and the hero video (WCAG 2.2.2).
 */
export function HeroDemo() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const video = document.getElementById("hero-video") as HTMLVideoElement | null;
    if (reduced || paused) {
      video?.pause();
      return;
    }
    void video?.play().catch(() => undefined);
    let timers: number[] = [];
    const run = () => {
      timers.forEach(clearTimeout);
      timers = TIMELINE.map(([s, at]) => window.setTimeout(() => setStep(s), at));
    };
    run();
    const loop = window.setInterval(run, CYCLE);
    return () => {
      window.clearInterval(loop);
      timers.forEach(clearTimeout);
    };
  }, [paused, reduced]);

  const shown = reduced || paused ? 2 : step;
  const confirmed = shown === 4;

  return (
    <figure className="demo" data-step={shown} aria-label="Demonstration: a camera flags a bead break and the operator confirms it">
      <div className="demo__head">
        <span>Sealer station st-04</span>
        <span className="demo__meta">
          Simulated demo
          {!reduced ? (
            <button
              type="button"
              className="icon-btn demo__pause"
              aria-pressed={paused}
              aria-label={paused ? "Play video and demo" : "Pause video and demo"}
              onClick={() => setPaused((p) => !p)}
            >
              <Icon name={paused ? "play" : "pause"} weight="fill" />
            </button>
          ) : null}
        </span>
      </div>
      <div className="demo__media">
        <BeadIllustration defect="BEAD_BREAK" id="hero-bead" />
        <div className="demo__scan" aria-hidden="true" />
      </div>
      <div className="demo__panel">
        <div className="demo__plate">
          {confirmed ? (
            <Plate tone="caution" icon="bell-ringing" as="p" title="Yellow andon: st-04" subtitle="Confirmed by operator · team leader decides next">
              <span>
                Score <b className="num">0.83</b> vs threshold <b className="num">0.61</b>
              </span>
              <span>Leak-critical</span>
            </Plate>
          ) : (
            <Plate tone="caution" as="p" title="Caution: bead break" subtitle="Suggested by the system. You decide.">
              <span>
                Score <b className="num">0.83</b> vs threshold <b className="num">0.61</b>
              </span>
              <span>Leak-critical</span>
            </Plate>
          )}
        </div>
        <div className="demo__confirm">
          <span className="btn demo-btn" aria-hidden="true">
            <Icon name="check" weight="bold" />
            Confirm defect
          </span>
          <span className="demo__status">{confirmed ? "Next: the team leader decides" : "Operator at st-04 decides"}</span>
        </div>
      </div>
    </figure>
  );
}
