"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { plantTime } from "@/components/format";
import { Trail } from "@/components/shell/Trail";
import { BeadIllustration } from "@/components/station/BeadIllustration";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { advanceTicket, requestValidation, updateA3 } from "@/lib/actions/kaizen";
import type { A3Field, TicketStatus, TicketView } from "@/lib/types";

import { A3_BLOCKS, DEFECT_DISPLAY, TICKET_LABEL, TICKET_STEPS } from "./labels";

const ADVANCE_LABEL: Partial<Record<TicketStatus, string>> = {
  open: "Start the A3",
  a3_in_progress: "Start countermeasure trial",
  validated: "Close ticket",
};

/** Kaizen ticket with its A3. The engineer writes; AI may only pre-fill, and says so. */
export function TicketScreen({
  view,
  canEdit,
  notice,
}: {
  view: TicketView;
  canEdit: boolean;
  notice?: ReactNode;
}) {
  const { ticket, triggerAlerts, a3, aiPrefilledFields, validation } = view;
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stepIndex = TICKET_STEPS.findIndex((s) => s.status === ticket.status);
  // The ticket's own defect type, not the trigger alerts' (they can differ in seed data).
  const defect = triggerAlerts.find((a) => a.defectType?.id === ticket.defectTypeId)?.defectType ?? DEFECT_DISPLAY[ticket.defectTypeId];
  const editable = canEdit && ["open", "a3_in_progress", "countermeasure_trial"].includes(ticket.status);
  const advanceLabel = ADVANCE_LABEL[ticket.status];
  const advanceReady =
    ticket.status !== "a3_in_progress" ||
    (["background", "currentCondition", "rootCause", "countermeasure"] as A3Field[]).every((f) => a3[f].trim());

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  }

  const left = A3_BLOCKS.slice(0, 3);
  const right = A3_BLOCKS.slice(3);

  return (
    <>
      <Trail
        current={ticket.status === "validated" || ticket.status === "closed" ? "done" : validation.draftCardId ? "card" : "kaizen"}
        label={`Abnormality trail for ${ticket.id}`}
      />
      <main className="page">
        <p className="crumb">
          <Link href="/kaizen">Kaizen cockpit</Link> / <span className="mono">{ticket.id}</span>
        </p>
        <div className="page__head">
          <div>
            <h1 className="page__title">
              <span className="mono">{ticket.id}</span> · {defect.name} at {ticket.stationId}
            </h1>
            <p className="page__sub">
              Opened {plantTime(ticket.createdAt).slice(0, 5)} · owner {ticket.ownerRole} · trigger:{" "}
              {ticket.triggerAlertIds.length} confirmed alert{ticket.triggerAlertIds.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="head-badges">
            {defect.criticality === "leak_critical" ? (
              <Badge tone="stop" icon={<Icon name="drop" weight="bold" />}>
                Leak-critical
              </Badge>
            ) : null}
            <LoopBadge loop="kaizen" />
          </div>
        </div>

        {notice}

        <ol className="stepper" aria-label="Ticket status">
          {TICKET_STEPS.map((s, i) => (
            <li
              key={s.status}
              data-s={i < stepIndex ? "done" : i === stepIndex ? "now" : undefined}
              aria-current={i === stepIndex ? "step" : undefined}
            >
              {s.label}
            </li>
          ))}
        </ol>

        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}

        {triggerAlerts.length > 0 ? (
          <section className="panel trigger" aria-labelledby="trigger-title">
            <div className="panel__head">
              <h2 id="trigger-title">Trigger: confirmed alerts</h2>
              <span className="muted">Same scale and framing, so they compare directly</span>
            </div>
            <div className="panel__body trio">
              {triggerAlerts.map((a) => (
                <figure key={a.id}>
                  <div className="bead bead--thumb">
                    <BeadIllustration defect={a.defectType?.id ?? null} id={`t-${a.id}`} />
                  </div>
                  <figcaption>
                    <span className="mono">{a.bodyId}</span> · {plantTime(a.createdAt).slice(0, 5)} ·{" "}
                    <span className="mono">{a.roi}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className="a3" aria-label="A3 problem-solving report">
          {[left, right].map((col, ci) => (
            <div className="a3__col" key={ci}>
              {col.map((b) => (
                <A3Block
                  key={`${b.field}-${a3[b.field]}`}
                  ticketId={ticket.id}
                  field={b.field}
                  label={b.label}
                  hint={b.hint}
                  value={a3[b.field]}
                  ai={aiPrefilledFields.includes(b.field)}
                  editable={editable}
                  onError={setError}
                />
              ))}
            </div>
          ))}
        </section>

        <div className="a3__foot">
          <p className="muted">
            AI may only pre-fill background and data. The engineer writes root cause and countermeasure; editing a
            pre-filled block removes the AI tag.
          </p>
          <div className="a3__actions">
            {validation.draftCardId ? (
              <Link className="btn btn--ghost" href={`/knowledge?card=${validation.draftCardId}`}>
                <Icon name="seal-check" /> Draft {validation.draftCardId} awaits the senior expert
              </Link>
            ) : null}
            {ticket.status === "countermeasure_trial" ? (
              <Button
                onClick={() => run(() => requestValidation(ticket.id))}
                disabled={!canEdit || pending || !validation.canRequest}
                icon={<Icon name="paper-plane-tilt" weight="bold" />}
                title={
                  validation.canRequest
                    ? undefined
                    : validation.draftCardId
                      ? "A draft card is already waiting for validation"
                      : "Complete all six A3 blocks first"
                }
              >
                Request validation
              </Button>
            ) : null}
            {advanceLabel ? (
              <Button
                variant={ticket.status === "countermeasure_trial" ? "ghost" : "primary"}
                onClick={() => run(() => advanceTicket(ticket.id))}
                disabled={!canEdit || pending || !advanceReady}
                title={advanceReady ? undefined : "Write background, current condition, root cause and countermeasure first"}
                icon={<Icon name="arrow-right" weight="bold" />}
              >
                {advanceLabel}
              </Button>
            ) : null}
          </div>
        </div>
        {ticket.status === "countermeasure_trial" && !validation.requiredFieldsComplete ? (
          <p className="muted a3__hint">Request validation unlocks when all six blocks are written.</p>
        ) : null}
        <p className="sr-only" aria-live="polite">
          Ticket status: {TICKET_LABEL[ticket.status]}
        </p>
      </main>
    </>
  );
}

function A3Block({
  ticketId,
  field,
  label,
  hint,
  value,
  ai,
  editable,
  onError,
}: {
  ticketId: string;
  field: A3Field;
  label: string;
  hint: string;
  value: string;
  ai: boolean;
  editable: boolean;
  onError: (e: string | null) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const dirty = draft.trim() !== value.trim();
  const id = `a3-${field}`;

  function save() {
    onError(null);
    start(async () => {
      const r = await updateA3(ticketId, { [field]: draft });
      if (r.ok) setSaved(true);
      else onError(r.error);
    });
  }

  return (
    <div className="a3__block" data-ai={ai || undefined}>
      <div className="a3__head">
        <label htmlFor={id}>{label}</label>
        {ai ? (
          <Badge tone="ai" icon={<Icon name="sparkle" />}>
            Drafted by AI, check
          </Badge>
        ) : null}
      </div>
      {editable ? (
        <>
          <textarea
            id={id}
            className="textarea a3__input"
            value={draft}
            placeholder={hint}
            maxLength={2000}
            onChange={(e) => {
              setDraft(e.target.value);
              setSaved(false);
            }}
          />
          <div className="a3__save">
            <span className="muted" aria-live="polite">
              {saving ? "Saving…" : saved && !dirty ? "Saved" : dirty ? "Unsaved changes" : ""}
            </span>
            <Button variant="ghost" onClick={save} disabled={!dirty || saving}>
              Save
            </Button>
          </div>
        </>
      ) : (
        <p id={id} className={value.trim() ? "a3__text" : "a3__text muted"}>
          {value.trim() || "Not written yet."}
        </p>
      )}
    </div>
  );
}
