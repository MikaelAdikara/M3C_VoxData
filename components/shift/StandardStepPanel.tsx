"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { plantTime } from "@/components/format";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { markStepDone, markStepNotDone } from "@/lib/actions/standard-steps";
import type { StandardStepItemView, StandardStepsView } from "@/lib/learning-layer-views";
import type { ActionResult } from "@/lib/types";

const hhmm = (iso: string | null) => (iso ? plantTime(iso).slice(0, 5) : "");

function CardRef({ step }: { step: StandardStepItemView }) {
  if (!step.sourceCardId) return <span>No card: not in the standard</span>;
  return (
    <span>
      Source card{" "}
      <Link className="mono" href={`/knowledge?card=${step.sourceCardId}`}>
        {step.sourceCardId}
        {step.cardRevision ? ` r${step.cardRevision}` : ""}
      </Link>
    </span>
  );
}

/**
 * Standard step. When a confirmed bead defect repeats, the shift board shows the step that
 * the station's validated card holds for it. The team leader runs it on the robot panel and
 * taps done or not done; the app records the tap only and never writes to line control.
 * A pressure change is in no standard, so it only shows as "ask the engineer".
 */
export function StandardStepPanel({ view, canRecord }: { view: StandardStepsView; canRecord: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [askingWhy, setAskingWhy] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) setAskingWhy(null);
      else setError(r.error);
    });
  }

  return (
    <section className="panel step" aria-labelledby="step-title">
      <div className="panel__head">
        <h2 id="step-title">Standard step</h2>
        <span className="muted">From validated cards only · simulated</span>
      </div>
      <div className="panel__body step__body">
        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}

        {view.waiting.length ? (
          <ul className="step__waiting">
            {view.waiting.map((s) => (
              <li key={s.id}>
                <div className="step__what">
                  <strong>
                    {s.label} · <span className="mono">{s.stationId}</span>
                  </strong>
                  <p>{s.instruction}</p>
                  <small>
                    Repeat of {s.defectName.toLowerCase()}
                    {s.bodyId ? <> · body <span className="mono">{s.bodyId}</span></> : null} · shown {hhmm(s.createdAt)} · <CardRef step={s} />
                    {s.ticketId ? <> · logged on <Link className="mono" href={`/kaizen/${s.ticketId}`}>{s.ticketId}</Link></> : null}
                  </small>
                </div>
                {askingWhy === s.id ? (
                  <div className="step__why" role="group" aria-label="Why was it not done?">
                    <span className="step__why-q">Why was it not done?</span>
                    {view.notDoneReasons.map((r) => (
                      <Button key={r.value} size="xl" variant="ghost" disabled={!canRecord || pending} onClick={() => run(() => markStepNotDone(s.id, r.value))}>
                        {r.label}
                      </Button>
                    ))}
                    <Button variant="ghost" disabled={pending} onClick={() => setAskingWhy(null)}>
                      Back
                    </Button>
                  </div>
                ) : (
                  <div className="step__btns">
                    <Button size="xl" disabled={!canRecord || pending} onClick={() => run(() => markStepDone(s.id))} icon={<Icon name="check" weight="bold" />}>
                      Done on robot panel
                    </Button>
                    <Button size="xl" variant="ghost" disabled={!canRecord || pending} onClick={() => setAskingWhy(s.id)} icon={<Icon name="x" weight="bold" />}>
                      Not done (reason)
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted step__empty">
            No step waiting. When a confirmed bead defect repeats in the shift, the step written in the station&apos;s validated card shows here.
          </p>
        )}

        {view.askEngineer.length ? (
          <ul className="step__ask">
            {view.askEngineer.map((s) => (
              <li key={s.id}>
                <Icon name="chat-circle-text" />
                <span>
                  <strong>
                    {s.label} · <span className="mono">{s.stationId}</span>: ask the engineer
                  </strong>
                  <small>
                    {s.instruction} Repeat of {s.defectName.toLowerCase()} at {hhmm(s.createdAt)}.
                    {s.ticketId ? <> Logged on <Link className="mono" href={`/kaizen/${s.ticketId}`}>{s.ticketId}</Link>.</> : null}
                  </small>
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        {view.recent.length ? (
          <>
            <h3 className="step__h">Recorded</h3>
            <ul className="step__log">
              {view.recent.map((s) => (
                <li key={s.id} data-status={s.status}>
                  <span className="num">{hhmm(s.recordedAt ?? s.createdAt)}</span>
                  <span>
                    <strong>{s.label}</strong> · <span className="mono">{s.stationId}</span>
                    <small>
                      {s.status === "done" ? "Done on robot panel" : `Not done: ${s.notDoneReason?.toLowerCase() ?? "no reason"}`} · <CardRef step={s} />
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <details className="step__standard">
          <summary>Steps written in validated cards</summary>
          <ul>
            {view.catalog.map((c) => (
              <li key={`${c.stationId}-${c.cardId}`}>
                <strong>{c.label}</strong> at <span className="mono">{c.stationId}</span> for {c.defects} · card{" "}
                <span className="mono">{c.cardId}</span>
                {c.cardValidated ? "" : " (not validated, so not shown)"}
              </li>
            ))}
            <li>A sealer pressure change is in no card, so it only shows as &ldquo;ask the engineer&rdquo;.</li>
          </ul>
        </details>
        <p className="muted step__foot">
          The team leader runs the step on the robot panel; the app records the tap only and never writes to line control. Every repeat still reaches
          the Kaizen ticket, whatever the step did. <Link href="/simulator#steps">Add a thin-bead repeat in Demo control</Link>
        </p>
      </div>
    </section>
  );
}
