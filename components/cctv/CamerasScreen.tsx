"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { CameraFeed, feedTone, type FeedCamera, type FeedReplay } from "@/components/cctv/CameraFeed";
import { plantTime } from "@/components/format";
import { Icon } from "@/components/ui/Icon";
import { createCameraTicket } from "@/lib/actions/camera";
import type { CameraEventView, CameraView } from "@/lib/types";

const hhmm = (iso: string) => plantTime(iso).slice(0, 5);

type Layout = "2" | "3" | "4";

export function CamerasScreen({ view, canTicket }: { view: CameraView; canTicket: boolean }) {
  const cams = view.cameras;
  const start = Date.parse(view.shift.startsAt);
  const end = Date.parse(view.shift.endsAt);
  // the simulation clock from the backend is "now"; the timeline never runs past it
  const now = Math.min(end, Math.max(start, Date.parse(view.asOf)));

  // open on the camera behind the most recent alert, the one the team is talking about
  const latestAlert = [...view.events].filter((e) => e.kind === "alert").sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  const firstPending = (latestAlert && cams.find((c) => c.id === latestAlert.cameraId)) ?? cams.find((c) => c.pendingDecisionAlertIds.length || c.openAlertIds.length);
  const [tab, setTab] = useState<"wall" | "health">("wall");
  const [layout, setLayout] = useState<Layout>("3");
  const [focusId, setFocusId] = useState(firstPending?.id ?? cams.find((c) => c.stationId === "st-04")?.id ?? cams[0].id);
  // null = current view (follows the simulation clock); a time = replaying history
  const [history, setHistory] = useState<number | null>(() => latestAlertOf(view.events, firstPending?.id));
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const focus = cams.find((c) => c.id === focusId) ?? cams[0];
  const focusEvents = view.events.filter((e) => e.cameraId === focus.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const replaying = history !== null && history >= start && history <= now;
  const playhead = replaying ? history : now;
  const gapAt = (t: number) => focusEvents.find((e) => e.kind === "gap" && t >= Date.parse(e.at) && t <= (e.endsAt ? Date.parse(e.endsAt) : now));
  // replay: a recording gap shows "no recording"; otherwise the latest typed alert within 30 minutes
  const gapEvent = replaying ? gapAt(playhead) : undefined;
  const frameEvent = replaying && !gapEvent
    ? [...focusEvents].reverse().find((e) => e.kind === "alert" && e.defectTypeId && Date.parse(e.at) <= playhead && playhead - Date.parse(e.at) < 30 * 60_000)
    : undefined;
  const replay: FeedReplay | null = gapEvent
    ? { kind: "gap", at: new Date(playhead).toISOString(), reason: gapEvent.label.replace(/^Recording gap · /, "") }
    : frameEvent?.defectTypeId
      ? { kind: "alert", at: frameEvent.at, defect: frameEvent.defectTypeId, id: frameEvent.alertId ?? frameEvent.at }
      : null;
  const shown = layout === "2" ? cams.slice(0, 4) : cams;

  const slots = (() => {
    const n = Math.ceil((end - start) / (5 * 60_000));
    return Array.from({ length: n }, (_, i) => {
      const t = start + i * 5 * 60_000;
      if (t > now) return "future";
      return gapAt(t) ? "gap" : "rec";
    });
  })();
  const pct = (t: number) => ((t - start) / (end - start)) * 100;

  function pick(c: FeedCamera) {
    setFocusId(c.id);
    setHistory(latestAlertOf(view.events, c.id));
  }

  function ticket(c: FeedCamera) {
    startTransition(async () => {
      const res = await createCameraTicket(c.id, c.note ?? (c.state === "offline" ? "Camera offline" : "Camera needs attention"));
      setMessage(res.ok ? `Maintenance ticket created for ${c.stationId}.` : res.error);
    });
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Cameras · K2-Body</h1>
          <p className="page__sub">Repurposed CCTV at each station · fixed lighting · faces masked at the edge · {view.sourceLabel}</p>
        </div>
        <div className="cam-head">
          <div className="seg" role="radiogroup" aria-label="View">
            {(["wall", "health"] as const).map((t) => (
              <label key={t}>
                <input type="radio" name="cam-view" checked={tab === t} onChange={() => setTab(t)} />
                <span>{t === "wall" ? "Camera wall" : "Camera health"}</span>
              </label>
            ))}
          </div>
          <span className="loop loop--shift">Shift loop</span>
        </div>
      </div>

      {message ? <p className="form-note" role="status">{message}</p> : null}

      {tab === "wall" ? (
        <>
          <div className="cams">
            <div>
              <div className="tl-row" style={{ margin: "0 0 var(--s3)" }}>
                <span>Shift {view.shift.label} · select a camera to focus</span>
                <div className="seg" role="radiogroup" aria-label="Layout">
                  {(["2", "3", "4"] as const).map((l) => (
                    <label key={l}>
                      <input type="radio" name="cam-layout" checked={layout === l} onChange={() => setLayout(l)} />
                      <span>{l}×{l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="wall" data-cols={layout}>
                {shown.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="tile-cam"
                    aria-pressed={c.id === focus.id}
                    aria-label={`${c.name}, ${c.state}${feedTone(c) === "caution" ? ", alert waiting" : ""}`}
                    onClick={() => pick(c)}
                  >
                    <CameraFeed cam={c} compact={layout === "4"} />
                  </button>
                ))}
              </div>
            </div>

            <aside className="panel" aria-label="Focused camera">
              <div className="panel__body focus">
                <h2>{focus.name}<small>{focus.id}</small></h2>
                <div className="seg seg--sm" role="radiogroup" aria-label="Camera mode">
                  <label>
                    <input type="radio" name="cam-mode" checked={!replaying} onChange={() => setHistory(null)} />
                    <span>Current</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="cam-mode"
                      checked={replaying}
                      disabled={latestAlertOf(view.events, focus.id) === null}
                      onChange={() => setHistory(latestAlertOf(view.events, focus.id))}
                    />
                    <span>Replay</span>
                  </label>
                </div>
                <CameraFeed cam={focus} focus replay={replay} />
                {replay?.kind === "alert" && frameEvent ? (
                  <p className="focus__note"><span className="badge badge--caution">Alert replay</span>{frameEvent.label.replace("Alert · ", "")} at {hhmm(frameEvent.at)} · illustration</p>
                ) : replay?.kind === "gap" ? (
                  <p className="focus__note"><span className="badge badge--stop">Recording gap</span>Nothing was recorded at {hhmm(new Date(playhead).toISOString())}.</p>
                ) : replaying ? (
                  <p className="focus__note muted">No alert on this camera near {hhmm(new Date(playhead).toISOString())}.</p>
                ) : focus.note ? (
                  <p className="focus__note">{focus.note}</p>
                ) : null}
                <dl className="facts">
                  <dt>Status</dt><dd>{focus.state[0].toUpperCase() + focus.state.slice(1)}</dd>
                  <dt>Model</dt><dd className="mono">{focus.modelVersion}</dd>
                  <dt>Lens cleaned</dt><dd>{hhmmDate(focus.lastLensCleanAt)}</dd>
                  <dt>Stream</dt><dd className="num">{focus.resolution} · {focus.fps} fps</dd>
                </dl>
                <div className="chips">
                  <span className="badge badge--outline">Faces masked at edge</span>
                  <span className="badge badge--outline">Fixed lighting</span>
                  <span className="badge badge--outline">On-premise inference</span>
                </div>
                <div className="focus__actions">
                  <Link className="btn" href={`/station?st=${focus.stationId}`}><Icon name="arrow-right" weight="bold" />Open station</Link>
                </div>
              </div>
            </aside>
          </div>

          <section className="panel timeline" aria-labelledby="tl-title">
            <div className="panel__head">
              <h2 id="tl-title">Shift timeline · {focus.stationId} · <span className="num">{replaying ? `replay ${hhmm(new Date(playhead).toISOString())}` : "current"}</span></h2>
              <span className="muted">{hhmm(view.shift.startsAt)} to {hhmm(view.shift.endsAt)} · now {hhmm(view.asOf)} (simulation clock) · drag to replay</span>
            </div>
            <div className="panel__body">
              <div className="tl">
                <div className="tl__cov" aria-hidden="true">
                  {slots.map((s, i) => <span key={i} className={s === "gap" ? "gap" : undefined} style={{ height: s === "future" ? "0" : "100%" }} />)}
                </div>
                <div className="tl__events">
                  {focusEvents.filter((e) => e.kind !== "gap").map((e, i) => (
                    <button
                      key={`${e.at}-${i}`}
                      type="button"
                      className="tl-ev"
                      data-kind={eventKind(e)}
                      style={{ left: `${pct(Date.parse(e.at))}%` }}
                      aria-label={`${hhmm(e.at)} ${e.label}`}
                      onClick={() => setHistory(Date.parse(e.at))}
                    />
                  ))}
                </div>
                <span className="tl__head" style={{ left: `${pct(playhead)}%` }} />
                <div className="tl__axis"><span>{hhmm(view.shift.startsAt)}</span><span>{hhmm(new Date(start + (end - start) / 2).toISOString())}</span><span>{hhmm(view.shift.endsAt)}</span></div>
              </div>
              <label className="sr-only" htmlFor="tl-scrub">Replay time</label>
              <input id="tl-scrub" className="tl-scrub" type="range" min={start} max={now} step={60_000} value={playhead} onChange={(e) => { const t = Number(e.target.value); setHistory(t >= now ? null : t); }} />
              <div className="tl-row">
                <div className="tl-key">
                  <span><i style={{ background: "rgba(120,120,120,.6)" }} />Recorded</span>
                  <span><i style={{ background: "rgba(235,10,30,.7)" }} />Recording gap</span>
                  <span><i style={{ background: "var(--caution)" }} />Alert</span>
                  <span><i style={{ background: "#fff", outline: "1px solid #999" }} />Confirmed or decided</span>
                  <span><i style={{ background: "#5f5f5f" }} />Rejected</span>
                </div>
              </div>
              {focusEvents.length ? (
                <ul className="tl-list">
                  {focusEvents.map((e, i) => (
                    <li key={`${e.at}-${i}`} data-kind={e.kind}><span className="num">{hhmm(e.at)}</span><span>{e.label}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="muted" style={{ marginTop: "var(--s3)" }}>No events on this camera this shift.</p>
              )}
            </div>
          </section>
        </>
      ) : (
        <section aria-label="Camera health">
          <p className="page__sub" style={{ marginBottom: "var(--s4)" }}>Lens cleaning is on the maintenance checklist. A station over its false-alarm budget points to the camera to check first.</p>
          <div className="health-grid">
            {cams.map((c) => {
              const tone = c.state === "offline" ? "stop" : c.state === "attention" ? "caution" : "ok";
              const avg = c.uptime14d.reduce((a, b) => a + b, 0) / c.uptime14d.length;
              return (
                <article key={c.id} className="hc" data-tone={tone}>
                  <div className="hc__top">
                    <span><span className="feed__pip" data-tone={tone} /><strong>{c.name}</strong> <span className="mono muted">{c.stationId}</span></span>
                    <b className="num">{c.state === "offline" ? "Offline" : `${(avg * 100).toFixed(1)}%`}</b>
                  </div>
                  <div className="hc__bars" role="img" aria-label={`Uptime over 14 days, average ${(avg * 100).toFixed(1)}%`}>
                    {c.uptime14d.map((u, i) => <span key={i} className={u < 0.9 ? "low" : undefined} style={{ height: `${Math.max(8, u * 100)}%` }} />)}
                  </div>
                  <div className="hc__meta"><span>Lens cleaned {hhmmDate(c.lastLensCleanAt)}</span><span className="mono">{c.modelVersion}</span></div>
                  {c.note ? <p className="hc__note">{c.note}</p> : null}
                  {c.state !== "online" ? (
                    c.maintenanceTicketId ? (
                      <span className="badge badge--outline">Ticket {c.maintenanceTicketId} open</span>
                    ) : (
                      <button type="button" className="btn btn--ghost hc__btn" disabled={!canTicket || pending} onClick={() => ticket(c)}>
                        Create maintenance ticket
                      </button>
                    )
                  ) : null}
                </article>
              );
            })}
          </div>
          {!canTicket ? <p className="muted" style={{ marginTop: "var(--s3)" }}>Only the team leader or an engineer can create a maintenance ticket.</p> : null}
        </section>
      )}
    </main>
  );
}

/** Time of a camera's latest alert that has a defect type, or null for the current view. */
function latestAlertOf(events: CameraEventView[], cameraId: string | undefined): number | null {
  const e = events.filter((x) => x.cameraId === cameraId && x.kind === "alert" && x.defectTypeId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at))[0];
  return e ? Date.parse(e.at) : null;
}

function eventKind(e: CameraEventView) {
  if (e.kind === "alert") return "alert";
  if (e.kind === "reject") return "reject";
  return "confirm";
}

function hhmmDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}
