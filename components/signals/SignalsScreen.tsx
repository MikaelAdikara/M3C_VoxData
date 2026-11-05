"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { actorLabel, plantTime } from "@/components/format";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { injectRobotErrors, submitWalkCheck } from "@/lib/actions/signals";
import type { SignalsView } from "@/lib/learning-layer-views";
import { SIGNAL_SOURCE_LABEL } from "@/lib/signals/catalog";
import type { WalkCheckSymptom } from "@/lib/types";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

/**
 * Line signals: camera bead alerts, robot controller error codes and member walk-checks
 * feed one repeat rule. The third repeat of the same thing in a shift opens a Kaizen ticket.
 */
export function SignalsScreen({ view, canWalkCheck }: { view: SignalsView; canWalkCheck: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState(view.equipment.find((e) => e.stationId === "st-04")?.id ?? view.equipment[0]?.id ?? "");
  const [symptom, setSymptom] = useState<WalkCheckSymptom | null>(null);
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState("");
  const maxPareto = Math.max(1, ...view.robotPareto.map((p) => p.count));
  const today = dayFmt.format(new Date(view.shift.startsAt));

  function logFinding() {
    if (!symptom) return;
    setError(null);
    setSent(null);
    start(async () => {
      const r = await submitWalkCheck({ equipmentId, symptom, photoAttached: photo, note });
      if (r.ok) {
        setSent("Finding logged. It counts toward the repeat rule for this equipment.");
        setSymptom(null);
        setPhoto(false);
        setNote("");
      } else setError(r.error);
    });
  }

  function robotError() {
    setError(null);
    start(async () => {
      const r = await injectRobotErrors(1);
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Line signals</h1>
          <p className="page__sub">
            Three sources, one repeat rule: the {view.threshold === 3 ? "third" : `${view.threshold}th`} repeat of the same thing at one station in a shift opens a Kaizen ticket. Simulated data.
          </p>
        </div>
        <LoopBadge loop="kaizen" />
      </div>

      {error ? (
        <p className="form-error" role="alert">
          <Icon name="warning-circle" weight="bold" /> {error}
        </p>
      ) : null}

      <div className="sig">
        <section className="panel" aria-labelledby="counters-title">
          <div className="panel__head">
            <h2 id="counters-title">Repeat counters, shift {view.shift.label}</h2>
            <span className="muted">Ticket at {view.threshold} of {view.threshold}</span>
          </div>
          {view.counters.length === 0 ? (
            <div className="panel__body">
              <EmptyState title="Nothing repeating yet this shift" />
            </div>
          ) : (
            <ul className="sig__counters">
              {view.counters.map((c) => (
                <li key={c.key} data-full={c.count >= c.threshold || undefined}>
                  <span className="sig-badge" data-source={c.source}>{SIGNAL_SOURCE_LABEL[c.source]}</span>
                  <span className="sig__subject">
                    {c.subject} <span className="mono muted">{c.stationId}</span>
                  </span>
                  <span className="sig__dots" role="img" aria-label={`${Math.min(c.count, c.threshold)} of ${c.threshold}`}>
                    {Array.from({ length: c.threshold }, (_, i) => (
                      <span key={i} data-on={i < c.count || undefined} />
                    ))}
                  </span>
                  {c.ticketId ? (
                    <Link className="badge badge--instruct" href={`/kaizen/${c.ticketId}`}>{c.ticketId}</Link>
                  ) : (
                    <span className="muted num">{c.count} / {c.threshold}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-labelledby="walk-title">
          <div className="panel__head">
            <h2 id="walk-title">Member walk-check</h2>
            <span className="muted">Tablet form · about 20 seconds</span>
          </div>
          <div className="panel__body sig__form">
            <div className="field">
              <label htmlFor="walk-equipment">Equipment</label>
              <select id="walk-equipment" className="input" value={equipmentId} onChange={(e) => setEquipmentId(e.target.value)}>
                {view.equipment.map((e) => (
                  <option key={e.id} value={e.id}>{e.stationId} · {e.name}</option>
                ))}
              </select>
            </div>
            <fieldset className="choices">
              <legend className="sig__legend">What did you find?</legend>
              {view.symptoms.map((s) => (
                <label key={s.value} className="choice">
                  <input type="radio" name="walk-symptom" value={s.value} checked={symptom === s.value} onChange={() => setSymptom(s.value)} />
                  {s.label}
                </label>
              ))}
            </fieldset>
            <button type="button" className="sig__photo" aria-pressed={photo} onClick={() => setPhoto((p) => !p)}>
              <Icon name="camera" />
              <span>
                {photo ? "Photo attached (placeholder)" : "Add a photo (optional)"}
                <small>Placeholder only: no image is stored in this demo</small>
              </span>
            </button>
            <div className="field">
              <label htmlFor="walk-note">Note (optional)</label>
              <input id="walk-note" className="input" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: squeal at the wrist joint on return" />
              <small>Stays on the record; never sent in events.</small>
            </div>
            <Button size="xl" block disabled={!canWalkCheck || !symptom || pending} onClick={logFinding} icon={<Icon name="check" weight="bold" />}>
              Log finding
            </Button>
            <p className="muted sig__hint" role="status">
              {sent ?? (canWalkCheck ? "Members on the line are sensors too: three of the same finding in a shift open a ticket." : "Switch the role to Operator or Team leader to log a walk-check.")}
            </p>
          </div>
        </section>

        <section className="panel" aria-labelledby="robot-title">
          <div className="panel__head">
            <h2 id="robot-title">Robot controller error codes</h2>
            <span className="muted">Minor codes, last 7 days · simulated codes</span>
          </div>
          <div className="panel__body">
            <ul className="sig__pareto">
              {view.robotPareto.map((p) => (
                <li key={p.code}>
                  <span><span className="mono">{p.code}</span> {p.label}</span>
                  <span className="pareto__track"><span className="pareto__bar" style={{ width: `${(p.count / maxPareto) * 100}%` }} /></span>
                  <span className="num">{p.count}</span>
                </li>
              ))}
            </ul>
            <div className="sig__demo">
              <Button variant="ghost" disabled={pending} onClick={robotError} icon={<Icon name="cpu" />}>
                Demo: sealer robot 1 at st-04 reports E-2210
              </Button>
              <small className="muted">The same code three times in a shift opens a ticket before any breakdown.</small>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="recent-title">
          <div className="panel__head">
            <h2 id="recent-title">Latest signals</h2>
            <Link className="link-quiet" href="/events">Event outbox</Link>
          </div>
          <ol className="sig__recent">
            {view.recent.map((s) => {
              const day = dayFmt.format(new Date(s.createdAt));
              return (
                <li key={s.id}>
                  <span className="num muted">{day === today ? "" : `${day} `}{plantTime(s.createdAt).slice(0, 5)}</span>
                  <span className="sig-badge" data-source={s.source}>{SIGNAL_SOURCE_LABEL[s.source]}</span>
                  <span>
                    {s.label} · {s.equipmentName} <span className="mono muted">{s.stationId}</span>
                    {s.photoAttached ? <Badge tone="outline">photo</Badge> : null}
                  </span>
                  <span className="muted">{actorLabel(s.actor)}</span>
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </main>
  );
}
