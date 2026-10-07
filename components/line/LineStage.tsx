"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/ui/Icon";
import type { LineView } from "@/lib/types";

import type { EngineState, LineEngine } from "./engine";

const STATE_TEXT: Record<LineView["stations"][number]["state"], string> = {
  running: "Running",
  yellow_andon: "Yellow andon",
  model_review: "Model review",
  contained: "Contained",
  stopped: "Line stopped",
};
const LAMP_ON: Record<LineView["stations"][number]["state"], string> = {
  running: "green",
  yellow_andon: "yellow",
  model_review: "blue",
  contained: "yellow",
  stopped: "red",
};

/**
 * Shift board as a scale model of K2-Body. Three.js loads only on the client
 * and only on this view; the station strip below is the keyboard path and
 * carries the same state when WebGL is unavailable.
 */
export function LineStage({
  line,
  selected,
  onSelect,
  variant = "board",
}: {
  line: LineView;
  selected: string | null;
  onSelect: (stationId: string) => void;
  /** "hero": full-bleed, non-interactive, no strip or gemba board (landing page). */
  variant?: "board" | "hero";
}) {
  const hero = variant === "hero";
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LineEngine | null>(null);
  const onSelectRef = useRef(onSelect);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  const stations = line.stations.map((s) => ({ id: s.station.id, name: s.station.name, type: s.station.type }));
  const stationKey = stations.map((s) => s.id).join(",");

  useEffect(() => {
    let disposed = false;
    import("./engine").then(({ createLineEngine }) => {
      if (disposed || !stageRef.current || !canvasRef.current || !labelsRef.current || !tagRef.current) return;
      const engine = createLineEngine({
        stage: stageRef.current,
        canvas: canvasRef.current,
        labels: labelsRef.current,
        tag: tagRef.current,
        stations,
        interactive: !hero,
        ...(hero ? { home: { pos: [-27, 13, 27] as [number, number, number], target: [2, 0, 0] as [number, number, number] }, shiftY: heroShift } : {}),
        onSelect: (id) => onSelectRef.current(id),
      });
      if (!engine) { setFailed(true); return; }
      engineRef.current = engine;
      setPaused(matchMedia("(prefers-reduced-motion: reduce)").matches);
      engine.setState(toEngineState(line, selected, hero));
    });
    return () => {
      disposed = true;
      engineRef.current?.dispose();
      engineRef.current = null;
    };
    // the scene is built once per station list; state flows through setState below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationKey]);

  useEffect(() => {
    if (!hero) return;
    const id = window.setInterval(() => {
      const tag = tagRef.current;
      if (tag && !tag.hidden) tag.style.visibility = tagClear(tag) ? "visible" : "hidden";
    }, 250);
    return () => window.clearInterval(id);
  }, [hero]);

  useEffect(() => {
    engineRef.current?.setState(toEngineState(line, selected, hero));
  }, [line, selected, hero]);

  const stopped = line.line.state === "stopped";
  const bodies = line.line.bodiesCompleted;

  return (
    <>
      <div className="stage" ref={stageRef} data-fallback={failed} data-variant={variant}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={`Scale model of the K2-Body line. ${line.stations.filter((s) => s.state !== "running").map((s) => `${s.station.id}: ${STATE_TEXT[s.state]}`).join("; ") || "All stations running"}. Use the station buttons below to choose a station.`}
        />
        <div className="line-labels" ref={labelsRef} aria-hidden="true" />
        <div className="line-tag" ref={tagRef} hidden aria-hidden="true" />

        {hero ? null : (
        <dl className="hud" aria-label="Gemba board">
          <div className="hud__takt"><dt>Takt</dt><dd>{line.taktMinutes} <small>min</small></dd></div>
          <div>
            <dt>Bodies this shift</dt>
            <dd><span className="num">{bodies}</span> <small>of ~{line.bodiesTargetApprox}</small></dd>
            <div className="hud__bar" aria-hidden="true"><span style={{ transform: `scaleX(${Math.min(1, bodies / line.bodiesTargetApprox)})` }} /></div>
          </div>
          <div className="hud__line">
            <dt>Line</dt>
            <dd><span className="feed__pip" data-tone={stopped ? "stop" : "ok"} />{stopped ? "Stopped by team leader" : "Running"}</dd>
          </div>
        </dl>
        )}

        <div className="stage__tools">
          <button
            className="icon-btn"
            type="button"
            aria-pressed={paused}
            aria-label={paused ? "Play motion" : "Pause motion"}
            onClick={() => { const p = !paused; setPaused(p); engineRef.current?.setPaused(p); }}
          >
            <Icon name={paused ? "play" : "pause"} weight="bold" />
          </button>
          {hero ? null : (
            <button className="icon-btn" type="button" aria-label="Reset view" onClick={() => engineRef.current?.resetView()}>
              <Icon name="arrow-counter-clockwise" weight="bold" />
            </button>
          )}
        </div>

        {hero ? null : <div className="stage__legend" aria-hidden="true">
          <span><i style={{ background: "var(--caution)" }} />Needs a person</span>
          <span><i style={{ background: "var(--stop)" }} />Line stopped</span>
          <span><i style={{ background: "#2f86d6" }} />Model review</span>
          <span><i style={{ background: "#1fae55", opacity: 0.6 }} />Running</span>
        </div>}
        {hero ? null : <p className="stage__note"><span className="hud__speed">Time compressed · </span>scale model · {line.productionSourceLabel}</p>}
        <div className="stage__fallback"><p>3D view unavailable on this device. The station buttons below show the same state.</p></div>
      </div>

      {hero ? null : (
      <>
      <div className="strip" role="group" aria-label="Stations">
        {line.stations.map((s) => (
          <button key={s.station.id} type="button" className="st" aria-pressed={s.station.id === selected} onClick={() => onSelect(s.station.id)}>
            <span className="tower" aria-hidden="true">
              {["red", "yellow", "green", "blue"].map((k) => (
                <i key={k} data-on={k === LAMP_ON[s.state] || (k === "green" && s.state !== "stopped") ? k : undefined} />
              ))}
            </span>
            <span className="st__id">{s.station.id}</span>
            <span className="st__meta">{STATE_TEXT[s.state]}</span>
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: "var(--s2)" }}>
        Takt {line.taktSourceLabel} · body count {line.bodiesTargetSourceLabel}
      </p>
      </>
      )}
    </>
  );
}

/**
 * Cover framing: push the model down so the line starts below the call-to-action
 * buttons whatever the window shape (0.33 suits a 1440×900 window).
 */
function heroShift() {
  const stage = document.querySelector(".hero3 .stage");
  const cta = document.querySelector(".hero3__ctas");
  if (!stage || !cta) return 0.33;
  const s = stage.getBoundingClientRect();
  const frac = (cta.getBoundingClientRect().bottom - s.top) / s.height;
  return Math.min(0.62, Math.max(0.22, 0.33 + (frac - 0.55) * 1.6));
}

/** On the cover, hide the tag whenever it would sit on the headline, buttons or live strip. */
function tagClear(tag: HTMLElement) {
  const t = tag.getBoundingClientRect();
  return ![...document.querySelectorAll(".hero3__inner h1, .hero3__inner p, .hero3__ctas .btn, .live")].some((e) => {
    const b = e.getBoundingClientRect();
    return !(t.right < b.left || t.left > b.right || t.bottom < b.top || t.top > b.bottom);
  });
}

function toEngineState(line: LineView, selected: string | null, hero = false): EngineState {
  const f = line.flaggedBody;
  const note = !f ? "" : f.state === "held_for_repair" ? "Held for repair" : f.state === "awaiting_team_leader" ? "Waiting for team leader" : f.state === "released" ? "Released" : "Flagged";
  return {
    stations: Object.fromEntries(line.stations.map((s) => [s.station.id, s.state])),
    line: line.line.state,
    flagged: f
      ? { bodyId: f.bodyId, stationId: f.detectedAtStationId, note: hero ? `Yellow andon at ${f.detectedAtStationId} · ${note.toLowerCase()}` : `${note} · detected at ${f.detectedAtStationId}` }
      : null,
    selected,
  };
}
