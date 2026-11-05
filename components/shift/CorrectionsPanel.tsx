"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { plantTime } from "@/components/format";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { approveCorrection, rejectCorrection, reverseCorrection, setAutonomy } from "@/lib/actions/corrections";
import type { CorrectionItemView, CorrectionsView } from "@/lib/learning-layer-views";
import type { ActionResult } from "@/lib/types";

const STATUS_TEXT: Record<CorrectionItemView["status"], string> = {
  proposed: "Waiting for team leader",
  approved: "Approved · robot routine runs it",
  rejected: "Rejected by team leader",
  auto_executed: "Auto within window · team leader notified",
  escalated: "Sent to the engineer",
  reversed: "Reversed by team leader",
};

const hhmm = (iso: string | null) => (iso ? plantTime(iso).slice(0, 5) : "");

/**
 * Bounded correction with earned autonomy. Only corrections listed in the station's
 * standardized work are proposed; the team leader approves or rejects with one tap.
 * The app records decisions only and never writes to line control.
 */
export function CorrectionsPanel({ view, canDecide }: { view: CorrectionsView; canDecide: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setError(r.error);
    });
  }

  return (
    <section className="panel corr" aria-labelledby="corr-title">
      <div className="panel__head">
        <h2 id="corr-title">Bounded corrections</h2>
        <span className="muted">From standardized work only · simulated values</span>
      </div>
      <div className="panel__body corr__body">
        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}

        {view.pending.length ? (
          <ul className="corr__pending">
            {view.pending.map((c) => (
              <li key={c.id}>
                <div className="corr__what">
                  <strong>{c.label}</strong> <span className="mono">{c.stationId}</span>
                  <small>
                    {c.bodyId
                      ? `Confirmed repeat of ${c.defectName?.toLowerCase() ?? "a bead defect"} · body ${c.bodyId} · proposed ${hhmm(c.createdAt)}`
                      : `Demo proposal (fast-forward) for ${c.defectName?.toLowerCase() ?? "a bead defect"} · ${hhmm(c.createdAt)}`}
                  </small>
                </div>
                <div className="corr__btns">
                  <Button size="xl" disabled={!canDecide || pending} onClick={() => run(() => approveCorrection(c.id))} icon={<Icon name="check" weight="bold" />}>
                    Approve
                  </Button>
                  <Button size="xl" variant="ghost" disabled={!canDecide || pending} onClick={() => run(() => rejectCorrection(c.id))} icon={<Icon name="x" weight="bold" />}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted corr__empty">
            No correction waiting. When a bead defect is confirmed again in the same shift, the system proposes one correction from the station&apos;s standardized work.
          </p>
        )}

        <h3 className="corr__h">Earned autonomy</h3>
        <p className="corr__rule">
          <Icon name="users-three" />
          <span>
            Team rule: <strong>auto within window</strong> unlocks for a correction only after{" "}
            <strong className="num">{view.rule.minApprovals}</strong> approvals and <strong className="num">{view.rule.maxReversals}</strong> reversals.
            The team leader can switch it off with one tap. Anything outside the window goes to the engineer.
          </span>
        </p>
        <ul className="corr__ladder">
          {view.ladders.map((l) => {
            const pct = Math.min(100, Math.round((l.approvals / view.rule.minApprovals) * 100));
            return (
              <li key={`${l.stationId}-${l.correctionType}`} data-level={l.level}>
                <div className="corr__ladder-top">
                  <strong>
                    {l.label} · <span className="mono">{l.stationId}</span>
                  </strong>
                  <Badge tone={l.level === "auto" ? "instruct" : "outline"}>{l.level === "auto" ? "Auto within window" : "Propose"}</Badge>
                </div>
                <div className="corr__meter" role="img" aria-label={`${l.approvals} of ${view.rule.minApprovals} approvals`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="corr__stats num">
                  Approvals {Math.min(l.approvals, 999)} / {view.rule.minApprovals} · reversals {l.reversals} · auto runs {l.autoExecutions}
                  {l.windowPercent !== null ? ` · window ±${l.windowPercent}% (this shift ${l.netPercent! > 0 ? "+" : ""}${l.netPercent}%)` : ""}
                </p>
                {l.reversals > view.rule.maxReversals ? (
                  <p className="corr__note">Locked: a reversal is logged, so this correction stays with the team leader.</p>
                ) : l.switchedOff && l.unlocked ? (
                  <p className="corr__note">Switched off by the team leader{l.lastSwitch ? ` at ${hhmm(l.lastSwitch.createdAt)}` : ""}. Proposals come to you again.</p>
                ) : null}
                {l.level === "auto" ? (
                  <Button variant="ghost" disabled={!canDecide || pending} onClick={() => run(() => setAutonomy(l.stationId, l.correctionType, "off"))} icon={<Icon name="hand-palm" weight="bold" />}>
                    Switch auto off
                  </Button>
                ) : l.unlocked && l.switchedOff ? (
                  <Button variant="ghost" disabled={!canDecide || pending} onClick={() => run(() => setAutonomy(l.stationId, l.correctionType, "on"))} icon={<Icon name="play" weight="bold" />}>
                    Switch auto on
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>

        {view.recent.length ? (
          <>
            <h3 className="corr__h">Latest</h3>
            <ul className="corr__log">
              {view.recent.map((c) => (
                <li key={c.id} data-status={c.status}>
                  <span className="num">{hhmm(c.reversedAt ?? c.decidedAt ?? c.createdAt)}</span>
                  <span>
                    <strong>{c.label}</strong> · <span className="mono">{c.stationId}</span>
                    <small>
                      {STATUS_TEXT[c.status]}
                      {c.status === "escalated" ? (c.escalationReason === "outside_window" ? ": outside the window" : ": not in the standardized work") : ""}
                    </small>
                  </span>
                  {c.canReverse ? (
                    <Button variant="ghost" disabled={!canDecide || pending} onClick={() => run(() => reverseCorrection(c.id))} icon={<Icon name="arrow-counter-clockwise" />}>
                      Reverse
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <details className="corr__standard">
          <summary>What the standardized work allows</summary>
          <p className="muted">{view.standard.reference}</p>
          <ul>
            {view.standard.corrections.map((s) => (
              <li key={s.type}>
                <strong>{s.label}</strong> for {s.answers}
                {s.window ? `; ${s.window}` : ""}
              </li>
            ))}
          </ul>
        </details>
        <p className="muted corr__foot">
          The app records the decision only; the robot&apos;s own routine runs the correction. Nothing here writes to line control.{" "}
          <Link href="/simulator#corrections">Fast-forward approvals in Demo control</Link>
        </p>
      </div>
    </section>
  );
}
