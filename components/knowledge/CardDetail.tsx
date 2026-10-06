"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { plantTime } from "@/components/format";
import { orNotYet } from "@/components/kaizen/labels";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Plate, type PlateTone } from "@/components/ui/Plate";
import { Sheet } from "@/components/ui/Sheet";
import { returnCard, validateCard } from "@/lib/actions/knowledge";
import type { CardView } from "@/lib/types";

const TONE: Record<CardView["status"], PlateTone> = { validated: "safe", draft: "instruct", retired: "neutral" };
const TITLE: Record<CardView["status"], string> = {
  validated: "Validated: safe to reuse",
  draft: "Draft: awaiting validation",
  retired: "Retired card",
};

function shortDate(iso?: string) {
  return iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

/** One knowledge card with its revision history; the senior expert validates or returns drafts. */
export function CardDetail({ card, canValidate }: { card: CardView; canValidate: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);
  const [comment, setComment] = useState("");

  function act(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) after?.();
      else setError(r.error);
    });
  }

  return (
    <>
      <Plate
        tone={TONE[card.status]}
        title={TITLE[card.status]}
        subtitle={
          <>
            <span className="mono">
              {card.id} r{card.revision}
            </span>{" "}
            · {card.stationIds.join(", ")} · 4M: {card.factor4M}
          </>
        }
      >
        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}
        {card.status === "draft" && card.returnedComment ? (
          <p className="returned" role="note">
            <Icon name="arrow-counter-clockwise" weight="bold" />
            <span>
              Returned by senior expert: “{card.returnedComment}”
            </span>
          </p>
        ) : null}
        <dl className="card-fields">
          <dt>Symptom</dt>
          <dd>{card.symptom}</dd>
          <dt>Root cause</dt>
          <dd>{card.rootCause}</dd>
          <dt>Countermeasure</dt>
          <dd>{card.countermeasure}</dd>
          <dt>Standard revised</dt>
          <dd>{orNotYet(card.standardRevised)}</dd>
          <dt>Process · variants</dt>
          <dd>
            {card.process} · {card.variants.join(", ")}
          </dd>
          {card.sourceTicketId ? (
            <>
              <dt>Source</dt>
              <dd>
                Kaizen ticket <Link href={`/kaizen/${card.sourceTicketId}`} className="mono">{card.sourceTicketId}</Link>
              </dd>
            </>
          ) : null}
        </dl>

        <h3 className="revs__title">Revisions</h3>
        <ul className="revs">
          {[...card.revisions]
            .sort((a, b) => b.revision - a.revision)
            .map((r) => (
              <li key={r.revision}>
                <span className="mono">r{r.revision}</span>
                <span className="muted">
                  {r.status === "validated"
                    ? `Validated · ${r.validatedByRole ?? "senior expert"} · ${shortDate(r.validatedAt)}`
                    : r.status === "draft"
                      ? r.returnedComment
                        ? `Returned · ${shortDate(r.returnedAt)}`
                        : "Draft · awaiting senior expert"
                      : "Retired"}
                </span>
              </li>
            ))}
        </ul>

        {card.status === "draft" ? (
          <div className="card-actions">
            <Button
              size="xl"
              onClick={() => act(() => validateCard(card.id))}
              disabled={!canValidate || pending}
              icon={<Icon name="seal-check" weight="bold" />}
            >
              Validate card
            </Button>
            <Button
              size="xl"
              variant="ghost"
              onClick={() => setReturnOpen(true)}
              disabled={!canValidate || pending}
              icon={<Icon name="arrow-counter-clockwise" weight="bold" />}
            >
              Return with comment
            </Button>
          </div>
        ) : null}
        {card.status === "validated" && card.validatedAt ? (
          <p className="muted card-note">
            Revision {card.revision} revised the standard on {shortDate(card.validatedAt)}, {plantTime(card.validatedAt).slice(0, 5)} WIB.
            Yokoten carries it to stations running the same process.
          </p>
        ) : null}
      </Plate>

      <Sheet
        open={returnOpen}
        onClose={() => setReturnOpen(false)}
        title={`Return ${card.id} to the engineer`}
        footer={
          <Button
            size="xl"
            block
            disabled={comment.trim().length < 3 || pending}
            onClick={() =>
              act(() => returnCard(card.id, comment), () => {
                setReturnOpen(false);
                setComment("");
              })
            }
          >
            Return with comment
          </Button>
        }
      >
        <div className="field">
          <label htmlFor="return-comment">What must change before you can validate it?</label>
          <textarea
            id="return-comment"
            className="textarea"
            maxLength={500}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="For example: add the gun pressure range to the countermeasure"
          />
          <small className="counter num">{comment.length} / 500</small>
        </div>
      </Sheet>
    </>
  );
}
