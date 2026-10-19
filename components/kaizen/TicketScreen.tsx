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
import { advanceTicket, checkDraftSentence, draftA3, requestValidation, selectRootCause, updateA3 } from "@/lib/actions/kaizen";
import type { A3DraftSentence, A3Field, TicketStatus, TicketView } from "@/lib/types";

import { A3_BLOCKS, TICKET_LABEL, TICKET_STEPS } from "./labels";

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
  const { ticket, triggerAlerts, a3, aiPrefilledFields, validation, similarCases, aiDraft } = view;
  const canDraft = canEdit && ["open", "a3_in_progress"].includes(ticket.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const stepIndex = TICKET_STEPS.findIndex((s) => s.status === ticket.status);
  const { defectType: defect } = view;
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

  const openRootCause = (aiDraft?.sentences ?? []).some((d) => d.field === "rootCause" && d.status === "draft");
  const nextHint = !canEdit
    ? null
    : ticket.status === "open"
      ? openRootCause
        ? "Next: check the AI root-cause candidates at the line, select the one you confirmed, then press Start the A3."
        : aiDraft
          ? "Next: press Start the A3, then write the countermeasure."
          : "Next: draft the A3 from data, or press Start the A3 and write it yourself."
    : ticket.status === "a3_in_progress" && openRootCause
      ? "Next: check the AI root-cause candidates at the line, then select the one you confirmed."
      : ticket.status === "a3_in_progress" && !advanceReady
        ? "Next: write background, current condition, root cause and countermeasure, then start the trial."
        : ticket.status === "countermeasure_trial" && aiDraft && aiDraft.open > 0
          ? "Next: keep or edit every AI-drafted sentence, then request validation."
          : ticket.status === "countermeasure_trial" && !validation.canRequest && !validation.draftCardId
            ? "Next: complete all six A3 blocks, then request validation."
            : null;

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

        {similarCases.length > 0 ? (
          <section className="panel similar" aria-labelledby="similar-title">
            <div className="panel__head">
              <h2 id="similar-title">Similar closed cases</h2>
              <span className="muted">Ranked from the case history by words and defect type · the engineer decides what applies</span>
            </div>
            <ol className="panel__body similar__list">
              {similarCases.map((c) => (
                <li key={c.id}>
                  <div className="similar__top">
                    <span className="mono">{c.id}</span>
                    <span>{c.defectType.name} · {c.stationId}</span>
                    {c.card ? (
                      <Link className="badge badge--safe" href={`/knowledge?card=${c.card.id}`}>{c.card.id} r{c.card.revision}</Link>
                    ) : null}
                  </div>
                  <p className="similar__symptom">{c.symptom}</p>
                  <dl className="similar__facts">
                    <dt>Root cause found</dt><dd>{c.rootCause}</dd>
                    <dt>Countermeasure</dt><dd>{c.countermeasure}</dd>
                  </dl>
                  {c.matched.length ? <p className="muted similar__why">Matched on: {c.matched.join(", ")}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className="ai-bar" role="group" aria-label="AI drafting">
          <div>
            <strong><Icon name="sparkle" /> AI draft</strong>
            <span className="muted">
              {" "}Drafts background, current condition and ranked root-cause candidates from this ticket&apos;s alerts, the similar cases and validated cards.
              Every sentence cites its source and stays marked until you edit or check it. It never writes the countermeasure.
            </span>
            {aiDraft ? (
              <span className="ai-bar__meta">
                {aiDraft.mode === "live" ? `Drafted by Claude (${aiDraft.model})` : "Drafted from the ticket data (template mode)"} ·{" "}
                {aiDraft.open} sentence{aiDraft.open === 1 ? "" : "s"} to check
                {aiDraft.rejected ? ` · ${aiDraft.rejected} unsourced sentence${aiDraft.rejected === 1 ? "" : "s"} removed` : ""}
              </span>
            ) : null}
          </div>
          <Button
            variant="ghost"
            onClick={() => run(() => draftA3(ticket.id))}
            disabled={!canDraft || pending}
            title={canDraft ? undefined : "Only the owner engineer drafts, while the A3 is being written"}
            icon={<Icon name="sparkle" />}
          >
            {pending ? "Drafting…" : aiDraft ? "Draft again" : view.liveDrafting ? "Draft with Claude" : "Draft from data"}
          </Button>
        </div>

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
                  drafts={(aiDraft?.sentences ?? []).filter((d) => d.field === b.field && d.status === "draft")}
                  onError={setError}
                />
              ))}
            </div>
          ))}
        </section>

        <div className="a3__foot">
          <p className="muted">
            AI drafts background, current condition and root-cause candidates, each with its source. The engineer confirms
            the root cause at the line and writes the countermeasure; a sentence stays marked AI draft until it is edited or checked.
          </p>
          {validation.returnedCardId ? (
            <p className="returned" role="note">
              <Icon name="arrow-counter-clockwise" weight="bold" />
              <span>
                Senior expert returned <Link href={`/knowledge?card=${validation.returnedCardId}`} className="mono">{validation.returnedCardId}</Link>
                {validation.returnedComment ? `: “${validation.returnedComment}”` : ""}. Revise the A3, then request validation again.
              </span>
            </p>
          ) : null}
          {nextHint ? <p className="a3__next" role="note"><Icon name="info" weight="bold" /> {nextHint}</p> : null}
          {error ? <p className="form-error a3__error" role="alert"><Icon name="warning-circle" weight="bold" /> {error}</p> : null}
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
                      : validation.returnedCardId
                        ? "Edit the A3 after the senior expert's return first"
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
  drafts,
  onError,
}: {
  ticketId: string;
  field: A3Field;
  label: string;
  hint: string;
  value: string;
  ai: boolean;
  editable: boolean;
  drafts: A3DraftSentence[];
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
      {drafts.length ? (
        <>
        {field === "rootCause" ? (
          <p className="a3__drafts-note">AI candidates, most likely first. Check them at the line, then select the cause you confirmed; the others are dropped.</p>
        ) : null}
        <ul className="a3__drafts" aria-label={`AI-drafted sentences in ${label}`}>
          {drafts.map((d) => (
            <li key={d.id}>
              <Badge tone="ai" icon={<Icon name="sparkle" />}>AI draft</Badge>
              <span className="a3__draft-text">{d.text}</span>
              <span className="a3__sources">
                {d.sources.map((src) =>
                  src.kind === "card" ? (
                    <Link key={src.id} className="mono" href={`/knowledge?card=${src.id.split(" ")[0]}`}>{src.id}</Link>
                  ) : (
                    <span key={src.id} className="mono">{src.id}</span>
                  ),
                )}
              </span>
              {editable ? (
                <button
                  type="button"
                  className={field === "rootCause" ? "btn a3__check" : "btn btn--quiet a3__check"}
                  disabled={saving}
                  onClick={() => {
                    onError(null);
                    start(async () => {
                      const r = field === "rootCause" ? await selectRootCause(ticketId, d.id) : await checkDraftSentence(ticketId, d.id);
                      if (!r.ok) onError(r.error);
                    });
                  }}
                >
                  <Icon name="check" /> {field === "rootCause" ? "Select as root cause" : "Keep as written"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        </>
      ) : null}
    </div>
  );
}
