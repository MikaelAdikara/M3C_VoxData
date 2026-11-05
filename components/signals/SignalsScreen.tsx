"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { actorLabel, plantTime } from "@/components/format";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { closeWorkOrder, injectRobotErrors, submitWalkCheck } from "@/lib/actions/signals";
import type { SignalsView } from "@/lib/learning-layer-views";
import { SIGNAL_SOURCE_LABEL } from "@/lib/signals/catalog";
import type { WalkCheckSymptom } from "@/lib/types";

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const fmtAvg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Line signals: robot controller error codes and member walk-checks, each with its own
 * trigger. A code that rises in the weekly Pareto, or a finding back after its work order
 * closed, opens a Kaizen ticket owned by maintenance. Bead alerts keep the shift repeat rule.
 */
export function SignalsScreen({ view, canWalkCheck }: { view: SignalsView; canWalkCheck: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [equipmentId, setEquipmentId] = useState(view.equipment.find((e) => e.stationId === "st-04")?.id ?? view.equipment[0]?.id ?? "");
  const [symptom, setSymptom] = useState<WalkCheckSymptom | null>(null);
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState("");
  const rows = view.pareto.rows;
  const maxPareto = Math.max(1, ...rows.map((p) => Math.max(p.thisWeek, p.needed)));
  const today = dayFmt.format(new Date(view.shift.startsAt));
  const demoRow = rows.find((r) => r.key === "robot_error:st-04/robot-1:E-2210");
  const dayOf = (iso: string) => dayFmt.format(new Date(iso));

  function logFinding() {
    if (!symptom) return;
    setError(null);
    setSent(null);
    start(async () => {
      const r = await submitWalkCheck({ equipmentId, symptom, photoAttached: photo, note });
      if (r.ok) {
        setSent("Finding logged. It opened a work order, or joined the open one for the same finding.");
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

  function closeOrder(id: string) {
    setError(null);
    setSent(null);
    start(async () => {
      const r = await closeWorkOrder(id);
      if (r.ok) setSent(`${id} closed. Log the same finding again to see the return rule open a ticket.`);
      else setError(r.error);
    });
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Line signals</h1>
          <p className="page__sub">
            Robot error codes and member walk-checks, each with its own trigger. Tickets from both are owned by maintenance. Bead alerts keep their shift repeat rule on the <Link href="/shift-board">shift board</Link>. Simulated data.
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
        <section className="panel" aria-labelledby="robot-title">
          <div className="panel__head">
            <h2 id="robot-title">Robot controller error codes</h2>
            <span className="muted">Weekly Pareto · simulated codes</span>
          </div>
          <div className="panel__body">
            <p className="sig__rule">
              <Icon name="chart-line" />
              <span>
                Ticket rule: <strong>{lower(view.pareto.rule)}</strong>. A code that is always high does not open a ticket; a code that rises does.
              </span>
            </p>
            <ul className="sig__pareto">
              {rows.map((p) => (
                <li key={p.key} data-rising={p.rising || undefined}>
                  <span className="sig__code">
                    <span className="mono">{p.code}</span> {p.label}
                    <small>
                      {p.equipmentName} · <span className="mono">{p.stationId}</span>
                    </small>
                  </span>
                  <span className="pareto__track sig__track" role="img" aria-label={`${p.thisWeek} this week, needs ${p.needed}`}>
                    <span className="pareto__bar" style={{ width: `${(p.thisWeek / maxPareto) * 100}%` }} />
                    <span className="sig__mark" style={{ left: `${(p.needed / maxPareto) * 100}%` }} />
                  </span>
                  <span className="sig__nums num">
                    <strong>{p.thisWeek}</strong> this week
                    <small>avg {fmtAvg(p.trailingAverage)} · needs {p.needed}</small>
                  </span>
                  <span className="sig__state">
                    {p.ticketId ? (
                      <Link className="badge badge--instruct" href={`/kaizen/${p.ticketId}`}>{p.ticketId}</Link>
                    ) : p.rising ? (
                      <Badge tone="outline">Rising</Badge>
                    ) : (
                      <span className="muted">Steady</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="sig__demo">
              <Button variant="ghost" disabled={pending} onClick={robotError} icon={<Icon name="cpu" />}>
                Demo: sealer robot 1 at st-04 reports E-2210
              </Button>
              <small className="muted">
                {demoRow && !demoRow.ticketId
                  ? `E-2210 is at ${demoRow.thisWeek} this week against an average of ${fmtAvg(demoRow.trailingAverage)}; at ${demoRow.needed} it crosses the rule and a ticket opens for maintenance, before any breakdown.`
                  : "Each tap adds one simulated report from the controller's error-code feed."}
              </small>
            </div>
          </div>
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
              {sent ?? (canWalkCheck ? "A finding opens a work order. If the same finding comes back after its work order is closed, a Kaizen ticket opens." : "Switch the role to Operator or Team leader to log a walk-check.")}
            </p>
          </div>
        </section>

        <section className="panel" aria-labelledby="wo-title">
          <div className="panel__head">
            <h2 id="wo-title">Work orders</h2>
            <span className="muted">Maintenance · simulated</span>
          </div>
          <div className="panel__body">
            <p className="sig__rule">
              <Icon name="wrench" />
              <span>
                Ticket rule: <strong>{lower(view.workOrders.rule)}</strong>. The fix did not hold, so it goes to Kaizen.
              </span>
            </p>
            {view.workOrders.open.length ? (
              <ul className="sig__orders">
                {view.workOrders.open.map((o) => (
                  <li key={o.id}>
                    <span className="sig__wo">
                      <strong className="mono">{o.id}</strong> {o.symptomLabel} · {o.equipmentName} <span className="mono muted">{o.stationId}</span>
                      <small>
                        Open since {dayOf(o.openedAt)} · {o.findings} finding{o.findings === 1 ? "" : "s"}
                        {o.returnOf ? ` · back after ${o.returnOf} closed` : ""}
                        {o.ticketId ? <> · <Link className="mono" href={`/kaizen/${o.ticketId}`}>{o.ticketId}</Link></> : null}
                      </small>
                    </span>
                    <Button variant="ghost" disabled={pending} onClick={() => closeOrder(o.id)} icon={<Icon name="check" />} aria-label={`Close ${o.id} (simulated maintenance)`}>
                      Close (simulated maintenance)
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No open work orders" />
            )}
            {view.workOrders.closed.length ? (
              <>
                <h3 className="sig__h">Recently closed</h3>
                <ul className="sig__orders">
                  {view.workOrders.closed.map((o) => (
                    <li key={o.id}>
                      <span className="sig__wo">
                        <span className="mono">{o.id}</span> {o.symptomLabel} · {o.equipmentName} <span className="mono muted">{o.stationId}</span>
                        <small>Closed {o.closedAt ? dayOf(o.closedAt) : ""} by maintenance</small>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
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
