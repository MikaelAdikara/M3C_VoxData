"use client";

import { useEffect, useRef, useState } from "react";

import { plantTime } from "@/components/format";
import { BeadIllustration } from "@/components/station/BeadIllustration";
import { Icon, type IconName } from "@/components/ui/Icon";
import type { TrailStepView, TrailView } from "@/lib/types";

/* The five hand-offs, in order. Text is how the loop works; the stamps on
   the tag come only from steps that really exist in the trail. */
const BEATS: { kind: TrailStepView["kind"]; n: string; title: string; sys: string; who: string; icon: IconName; stamp: string }[] = [
  { kind: "flagged", n: "1 · Camera", title: "A bead that doesn't match the good ones", sys: "System flags it and marks where", who: "Next: operator", icon: "video-camera", stamp: "Flagged" },
  { kind: "confirmed", n: "2 · Operator", title: "The station that made it confirms it", sys: "Or rejects it, with a reason", who: "Decides: operator", icon: "hand-pointing", stamp: "Confirmed" },
  { kind: "team_leader_decision", n: "3 · Team leader", title: "A person chooses what the line does", sys: "System suggests, never stops the line", who: "Decides: team leader", icon: "users-three", stamp: "Decided" },
  { kind: "a3_open", n: "4 · Engineer", title: "The third repeat opens an A3", sys: "AI drafts two blocks, and says so", who: "Decides: engineer", icon: "clipboard-text", stamp: "A3 open" },
  { kind: "validated_standard", n: "5 · Senior expert", title: "The fix becomes the standard", sys: "Yokoten to every same-process station", who: "Decides: senior expert", icon: "seal-check", stamp: "Validated" },
];

const SUBS = ["Waiting at the station", "Flagged by camera · waiting for operator", "Confirmed · yellow andon", "Decided by team leader", "Kaizen loop · A3 open", "Validated · reusable by every station"];

export function TrailSpine({ trail }: { trail: TrailView | null }) {
  const [step, setStep] = useState(0);
  const beats = useRef<(HTMLDivElement | null)[]>([]);
  const head = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step)); }),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    beats.current.forEach((b) => b && io.observe(b));
    const top = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.boundingClientRect.top > 0) setStep(0); }, { rootMargin: "0px 0px -55% 0px" });
    if (head.current) top.observe(head.current);
    return () => { io.disconnect(); top.disconnect(); };
  }, []);

  const alert = trail?.alert;
  const real = (kind: TrailStepView["kind"]) =>
    trail?.steps.find((s) => s.kind === kind || (kind === "confirmed" && s.kind === "rejected"));

  return (
    <section className="sec wrap" id="trail" aria-labelledby="trail-title">
      <h2 id="trail-title" ref={head} className="display h-sec center">One defect.<br />Five pairs of hands.</h2>

      <div className="spine">
        <div className="spine__tag">
          <article className="tag2" data-step={step} aria-label={alert ? `Abnormality tag for body ${alert.bodyId}` : "Abnormality tag"}>
            <div className="tag2__band">
              <span className="tag2__hole" aria-hidden="true" />
              <p className="tag2__kind">{step === 5 ? "Standard" : "Abnormality"}<small>{alert ? `${alert.stationId} · ${SUBS[step]}` : SUBS[step]}</small></p>
            </div>
            {alert ? (
              <div className="tag2__body">
                <figure className="tag2__photo">
                  <BeadIllustration defect={alert.defectType?.id ?? null} id={`tag-${alert.id}`} />
                  <figcaption>Illustration · simulated</figcaption>
                </figure>
                <dl className="tag2__fields">
                  <dt>Body</dt><dd>{alert.bodyId}</dd>
                  <dt>Defect</dt><dd>{alert.defectType?.name ?? "Anomaly"}</dd>
                  <dt>Region</dt><dd>{alert.roi}</dd>
                  <dt>Score</dt><dd>{alert.anomalyScore.toFixed(2)} vs {alert.threshold.toFixed(2)}</dd>
                  <dt>Criticality</dt><dd>{alert.defectType?.criticality === "leak_critical" ? "Leak-critical" : "Non-critical"}</dd>
                </dl>
              </div>
            ) : null}
            <ol className="tag2__log">
              {BEATS.map((b, i) => {
                const r = real(b.kind);
                const on = i < step;
                return (
                  <li key={b.kind} data-on={on && Boolean(r)} data-last={i === step - 1} data-pending={on && !r}>
                    <Icon name={b.icon} />
                    <span>
                      {r ? r.label[0].toUpperCase() + r.label.slice(1) : b.n.split(" · ")[1]}
                      <small>{r ? `${r.actor === "system" ? "system" : r.actor} · ${plantTime(r.at).slice(0, 5)}` : "Not reached yet in the live demo"}</small>
                    </span>
                    {r ? <span className="stamp">{b.stamp}</span> : <span className="stamp stamp--pending">Waiting</span>}
                  </li>
                );
              })}
            </ol>
            <div className="tag2__foot"><span>Learning Line · K2-Body</span><span>{trail?.sourceLabel ?? "Concept prototype · simulated"}</span></div>
          </article>
        </div>

        {BEATS.map((b, i) => (
          <div
            key={b.kind}
            ref={(el) => { beats.current[i] = el; }}
            className={`beat beat--${i % 2 ? "r" : "l"}`}
            data-step={i + 1}
            data-active={step === i + 1}
            data-done={step > i + 1}
            style={{ gridRow: i + 1 }}
          >
            <span className="beat__n">{b.n}</span>
            <h3>{b.title}</h3>
            <span className="sys">{b.sys}</span>
            <span className="who"><Icon name="user-circle" weight="bold" />{b.who}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
