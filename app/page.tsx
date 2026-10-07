import Link from "next/link";

import { CameraFeed, defectOfEvent } from "@/components/cctv/CameraFeed";
import { A3Sheet } from "@/components/landing/A3Sheet";
import { CoverBar } from "@/components/landing/CoverBar";
import { HeroLine } from "@/components/landing/HeroLine";
import { TrailSpine } from "@/components/landing/TrailSpine";
import { Icon } from "@/components/ui/Icon";
import { Prov } from "@/components/ui/Prov";
import { getCameraView, getOverviewView, getTrailView } from "@/lib/queries";

export const metadata = {
  title: "Learning Line · AI detects, people decide",
  description:
    "Concept prototype for the M3C 2026 case on PT Toyota Motor Manufacturing Indonesia: every abnormality at Karawang becomes a reusable standard.",
};

const pct = (v: number | string) => (typeof v === "number" ? `${v}%` : v);

export default async function CoverPage() {
  const [overview, cams] = await Promise.all([getOverviewView(), getCameraView()]);
  // The tag follows the recent alert that has travelled furthest; steps are only real ones.
  const recentAlertIds = [...new Set([...cams.events].filter((e) => e.kind === "alert" && e.alertId).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((e) => e.alertId!))].slice(0, 6);
  const recentTrails = (await Promise.all(recentAlertIds.map((id) => getTrailView(id)))).filter((t) => t !== null);
  const ORDER = ["flagged", "confirmed", "team_leader_decision", "a3_open", "validated_standard"];
  const progress = (t: NonNullable<typeof overview.trail>) => {
    let n = 0;
    while (n < ORDER.length && t.steps.some((s) => s.kind === ORDER[n])) n++;
    return n;
  };
  const trail = [...recentTrails, overview.trail]
    .filter((t) => t !== null)
    .reduce<typeof overview.trail>((best, t) => (!best || progress(t) > progress(best) ? t : best), null);
  const line = overview.line;
  const andon = line.stations.find((s) => s.state === "yellow_andon" || s.state === "stopped");
  const byStation = (id: string) => cams.cameras.find((c) => c.stationId === id);
  // the alert frame in the middle is the latest camera alert, if any
  const lastAlert = [...cams.events].reverse().find((e) => e.kind === "alert");
  const alertCam = lastAlert ? cams.cameras.find((c) => c.id === lastAlert.cameraId) : undefined;
  const centre = alertCam ?? byStation("st-04");
  const side = ["st-02", "st-03", "st-06", "final-01"].map(byStation).filter((c) => c && c.id !== centre?.id);

  return (
    <>
      <CoverBar />
      <main>
        {/* 1. Centered words over the whole line */}
        <section className="hero3" id="hero" aria-labelledby="hero-title">
          <HeroLine line={line} />
          <div className="hero3__inner">
            <h1 id="hero-title" className="display">
              AI detects.
              <br />
              <span className="dim">People decide.</span>
            </h1>
            <p className="hero3__sub">Every abnormality at TMMIN Karawang becomes a standard the whole line can reuse.</p>
            <div className="hero3__ctas">
              <Link className="btn btn--xl" href="/station">
                <Icon name="arrow-right" weight="bold" />
                Enter the prototype
              </Link>
              <a className="btn btn--xl btn--ghost" href="#trail">Follow one defect</a>
            </div>
          </div>
          <dl className="live" aria-label="Line right now, simulated">
            <div><dt>Takt</dt><dd>{line.taktMinutes}<small>min</small></dd></div>
            <div><dt>Bodies this shift</dt><dd>{line.line.bodiesCompleted}<small>of ~{line.bodiesTargetApprox}</small></dd></div>
            <div>
              <dt>{line.line.state === "stopped" ? "Line" : "Andon"}</dt>
              <dd className="live__andon">
                <span className="feed__pip" data-tone={line.line.state === "stopped" ? "stop" : andon ? "caution" : "ok"} />
                {line.line.state === "stopped" ? "Stopped" : andon ? andon.station.id : "None"}
              </dd>
            </div>
          </dl>
        </section>

        {/* 2. The trail on a center spine */}
        <TrailSpine trail={trail} />

        {/* 3. Three signs */}
        <section className="sec wrap" aria-labelledby="never-title">
          <h2 id="never-title" className="display h-sec center">Three things it never does</h2>
          <div className="signs">
            <article className="sign sign--stop"><div className="sign__band"><Icon name="hand-palm" weight="fill" /><b>Never stops<br />the line</b></div><p>The team leader decides.</p></article>
            <article className="sign sign--caution"><div className="sign__band"><Icon name="eye" weight="fill" /><b>Never hides<br />a defect</b></div><p>A false-alarm budget only sends the model to review.</p></article>
            <article className="sign sign--safe"><div className="sign__band"><Icon name="seal-check" weight="fill" /><b>Never answers<br />without a card</b></div><p>Every answer cites a validated card.</p></article>
          </div>
        </section>

        {/* 4. Cameras, full bleed */}
        <section className="band" id="cams" aria-labelledby="cams-title">
          <div className="wrap center">
            <h2 id="cams-title" className="display h-sec">Cameras that say<br />what they are</h2>
            <p className="lede" style={{ marginTop: "var(--s4)" }}>Repurposed CCTV, fixed light, faces masked at the edge.</p>
          </div>
          <div className="mosaic">
            {side[0] ? <div><CameraFeed cam={side[0]} compact /></div> : null}
            {centre ? (
              <div className="big">
                <CameraFeed
                  cam={centre}
                  focus
                  alertFrame={lastAlert && alertCam ? { at: lastAlert.at, defect: defectOfEvent(lastAlert.label), id: lastAlert.alertId ?? "hero" } : null}
                />
              </div>
            ) : null}
            {side.slice(1).map((c) => (c ? <div key={c.id}><CameraFeed cam={c} focus /></div> : null))}
          </div>
          <div className="keys" aria-label="What each frame is">
            <span><Icon name="film-strip" />Test clip · never boxed</span>
            <span><Icon name="pen-nib" />Simulated scene</span>
            <span><span className="feed__pip" data-tone="caution" />Alert frame · simulated</span>
            <span><span className="feed__pip" data-tone="stop" />Signal lost</span>
          </div>
        </section>

        {/* 5. Ledger */}
        <section className="sec wrap" id="a3" aria-labelledby="num-title">
          <h2 id="num-title" className="display h-sec center">Numbers that say<br />where they come from</h2>
          <ul className="ledger">
            {overview.ledger.map((r) => (
              <li key={r.id}>
                <div className="ledger__name">
                  {r.label}
                  <span><Prov p={r.baselineProvenance} label={r.baselineSourceLabel} /><Prov p={r.targetProvenance} label={r.targetSourceLabel} /></span>
                </div>
                <span className="ledger__from">{pct(r.baseline)}<small>today</small></span>
                <span className="ledger__arrow" aria-label="to"><Icon name="arrow-right" weight="bold" /></span>
                <span className="ledger__to">{String(r.target).replace(/\s/g, "")}<small>Gate 1</small></span>
              </li>
            ))}
          </ul>
          <div className="fold-c">
            <details className="fold">
              <summary>Read the whole case on one A3 <Icon name="caret-down" weight="bold" /></summary>
              <A3Sheet />
            </details>
          </div>
        </section>

        {/* 6. Closing */}
        <section className="close3" id="try" aria-labelledby="try-title">
          <h2 id="try-title" className="display h-sec">Try every<br />decision yourself</h2>
          <Link className="btn btn--xl" href="/station"><Icon name="arrow-right" weight="bold" />Enter the prototype</Link>
          <div className="devices" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="laptop"><img src="/landing/v3-laptop.jpg" alt="" loading="lazy" /></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="phone"><img src="/landing/v3-phone.jpg" alt="" loading="lazy" /></div>
          </div>
        </section>
      </main>

      <footer className="cover-foot">
        <p>
          M3C 2026 business case. Case company: PT Toyota Motor Manufacturing Indonesia (TMMIN). Not affiliated with or
          endorsed by Toyota.
        </p>
        <p>Concept prototype · simulated data · not connected to TMMIN systems</p>
        <p>
          Camera test clips: Engin Altundağ and Parker Filme via Pexels, in black and white. Car bodies adapted from models by Daniel Zhabotinsky and Comrade1280 (CC BY 4.0, Sketchfab); line model and bead images are our own illustrations. <Link href="/simulator">Demo control</Link>
        </p>
      </footer>
    </>
  );
}
