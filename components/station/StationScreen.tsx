"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import Link from "next/link";

import { CameraFeed, type FeedCamera } from "@/components/cctv/CameraFeed";
import { DECISION_LABEL, plantTime } from "@/components/format";
import { Trail } from "@/components/shell/Trail";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { Plate } from "@/components/ui/Plate";
import { Sheet } from "@/components/ui/Sheet";
import { confirmAlert, rejectAlert } from "@/lib/actions/alerts";
import { submitIdea } from "@/lib/actions/ideas";
import type { ReasonCode, ShiftDecision, StationView } from "@/lib/types";

import { BeadIllustration } from "./BeadIllustration";
import { ScoreScale } from "./ScoreScale";

type Outcome =
  | { kind: "confirmed"; bodyId: string }
  | { kind: "rejected"; bodyId: string; reason: string };

/**
 * Operator station screen. Shows the open alert, takes the operator's
 * decision through the BE actions, and says what happens next.
 */
export function StationScreen({
  view,
  camera,
  canDecide,
  notice,
}: {
  view: StationView;
  /** The station's camera, when it has one (BE-4 camera view). */
  camera?: FeedCamera | null;
  canDecide: boolean;
  notice?: ReactNode;
}) {
  const { station, openAlert: alert, reasonCodes, ideasOpen, decisionHistory } = view;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feedMode, setFeedMode] = useState<"alert" | "live">("alert");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState<ReasonCode | null>(null);
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [ideaSent, setIdeaSent] = useState(false);

  const shown = outcome && (!alert || alert.bodyId === outcome.bodyId) ? outcome : null;
  const trailStep = alert && !shown ? "operator" : shown?.kind === "confirmed" ? "team_leader" : null;

  function confirm() {
    if (!alert) return;
    setError(null);
    start(async () => {
      const r = await confirmAlert(alert.id);
      if (r.ok) setOutcome({ kind: "confirmed", bodyId: alert.bodyId });
      else setError(r.error);
    });
  }

  function reject() {
    if (!alert || !reason) return;
    const label = reasonCodes.find((r) => r.value === reason)?.label ?? reason;
    setError(null);
    start(async () => {
      const r = await rejectAlert(alert.id, reason);
      setRejectOpen(false);
      if (r.ok) setOutcome({ kind: "rejected", bodyId: alert.bodyId, reason: label });
      else setError(r.error);
    });
  }

  function sendIdea() {
    start(async () => {
      const r = await submitIdea(station.id, idea);
      if (r.ok) {
        setIdea("");
        setIdeaOpen(false);
        setIdeaSent(true);
      } else setError(r.error);
    });
  }

  return (
    <>
      {trailStep ? <Trail current={trailStep} label={`Abnormality trail for ${station.id}`} /> : null}
      <main className="page">
        <div className="page__head">
          <div>
            <h1 className="page__title">
              {station.name} · {station.id}
            </h1>
            <p className="page__sub">
              {alert ? (
                <>
                  Body <span className="mono">{alert.bodyId}</span> · detected {plantTime(alert.createdAt)}
                </>
              ) : (
                `${station.line} · ${station.area}`
              )}
            </p>
          </div>
          <LoopBadge loop="shift" />
        </div>

        {notice}

        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}

        {alert ? (
          <div className="station">
            <section className="station__media" aria-label="Station camera">
              {camera ? (
                <>
                  <div className="media-head">
                    <div className="seg" role="radiogroup" aria-label="Camera view">
                      {(["alert", "live"] as const).map((m) => (
                        <label key={m}>
                          <input type="radio" name="feed-mode" checked={feedMode === m} onChange={() => setFeedMode(m)} />
                          <span>{m === "alert" ? "Alert frame" : "Live"}</span>
                        </label>
                      ))}
                    </div>
                    <Link className="link-quiet" href="/cameras"><Icon name="video-camera" />All cameras</Link>
                  </div>
                  <CameraFeed
                    cam={camera}
                    focus
                    alertFrame={feedMode === "alert" && alert.defectType ? { at: alert.createdAt, defect: alert.defectType.id, id: alert.id } : null}
                  />
                </>
              ) : (
                <div className="bead">
                  <BeadIllustration defect={alert.defectType?.id ?? null} id={`bead-${alert.id}`} />
                  <span className="bead__tag">Illustration · simulated</span>
                </div>
              )}
              <div className="bead__cap">
                <span>
                  Region <span className="mono">{alert.roi}</span>
                </span>
                <span>
                  Model <span className="mono">{alert.modelVersion}</span>
                </span>
              </div>
              <History items={decisionHistory} reasonCodes={reasonCodes} />
            </section>

            <section className="decide" aria-label="Decision">
              {shown ? (
                <OutcomePlate outcome={shown} stationId={station.id} />
              ) : (
                <>
                  <Plate
                    tone="caution"
                    title={`Caution: ${alert.defectType?.name.toLowerCase() ?? "bead anomaly"}`}
                    subtitle="Suggested by the system. You decide."
                  >
                    <ScoreScale score={alert.anomalyScore} threshold={alert.threshold} />
                    <dl className="facts">
                      <dt>Criticality</dt>
                      <dd>
                        {alert.defectType?.criticality === "leak_critical" ? (
                          <Badge tone="stop" icon={<Icon name="drop" weight="bold" />}>
                            Leak-critical
                          </Badge>
                        ) : (
                          <Badge tone="outline">Non-critical</Badge>
                        )}
                      </dd>
                    </dl>
                  </Plate>
                  <div>
                    <h2 className="decide__q">Is this a real defect?</h2>
                    <div className="decide__btns">
                      <Button
                        size="xl"
                        block
                        onClick={confirm}
                        disabled={!canDecide || pending}
                        icon={<Icon name="check" weight="bold" />}
                      >
                        Confirm defect
                      </Button>
                      <Button
                        size="xl"
                        block
                        variant="ghost"
                        onClick={() => setRejectOpen(true)}
                        disabled={!canDecide || pending}
                        icon={<Icon name="x" weight="bold" />}
                      >
                        Reject: false alarm
                      </Button>
                    </div>
                  </div>
                </>
              )}
              <IdeaRow
                sent={ideaSent}
                ideasOpen={ideasOpen}
                disabled={!canDecide}
                onOpen={() => setIdeaOpen(true)}
              />
            </section>
          </div>
        ) : (
          <div className="station station--empty">
            {shown ? <OutcomePlate outcome={shown} stationId={station.id} /> : null}
            <EmptyState title={`No open alert at ${station.id}`}>
              The camera has not flagged anything since the last decision. New alerts appear here within a few
              seconds.
            </EmptyState>
            <IdeaRow sent={ideaSent} ideasOpen={ideasOpen} disabled={!canDecide} onOpen={() => setIdeaOpen(true)} />
            <History items={decisionHistory} reasonCodes={reasonCodes} />
          </div>
        )}
      </main>

      <Sheet
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Why is this a false alarm?"
        footer={
          <Button size="xl" block disabled={!reason || pending} onClick={reject}>
            Reject with reason
          </Button>
        }
      >
        <fieldset className="choices choices--big">
          <legend className="sr-only">Reason code</legend>
          {reasonCodes.map((r) => (
            <label key={r.value} className="choice">
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
              />
              {r.label}
            </label>
          ))}
        </fieldset>
        <p className="muted sheet__note">
          Your rejection goes to the team leader. Only a verified rejection can update the model, as a 4M change.
        </p>
      </Sheet>

      <Sheet
        open={ideaOpen}
        onClose={() => setIdeaOpen(false)}
        title="Suggest an improvement"
        footer={
          <Button size="xl" block disabled={!idea.trim() || pending} onClick={sendIdea}>
            Send idea
          </Button>
        }
      >
        <div className="field">
          <label htmlFor="idea-text">Your idea for {station.id}</label>
          <textarea
            id="idea-text"
            className="textarea"
            maxLength={280}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="For example: check nozzle angle after every nozzle change"
          />
          <small className="counter num">{idea.length} / 280</small>
        </div>
        <p className="muted sheet__note">You will get an answer within 7 days.</p>
      </Sheet>
    </>
  );
}

function OutcomePlate({ outcome, stationId }: { outcome: Outcome; stationId: string }) {
  if (outcome.kind === "confirmed") {
    return (
      <Plate
        tone="caution"
        icon="bell-ringing"
        title="Confirmed: yellow andon sent"
        subtitle={`Decided by operator · role:operator@${stationId}`}
      >
        <p className="next">
          <Icon name="arrow-right" weight="bold" />
          <span>The team leader decides next: stop and fix, contain, or continue with check.</span>
        </p>
      </Plate>
    );
  }
  return (
    <Plate tone="neutral" icon="x-circle" title={`Rejected: ${outcome.reason.toLowerCase()}`} subtitle={`Decided by operator · role:operator@${stationId}`}>
      <p className="next">
        <Icon name="arrow-right" weight="bold" />
        <span>Queued for verified-rejection review. The model changes only after a team leader verifies it.</span>
      </p>
    </Plate>
  );
}

function IdeaRow({
  sent,
  ideasOpen,
  disabled,
  onOpen,
}: {
  sent: boolean;
  ideasOpen: number;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="idea">
      <p>
        {sent ? "Idea sent. Answer due within 7 days." : "Have an idea to stop this repeating?"}
        {ideasOpen > 0 ? (
          <small>
            {ideasOpen} idea{ideasOpen === 1 ? "" : "s"} from this station waiting for an answer
          </small>
        ) : null}
      </p>
      <Button variant="ghost" onClick={onOpen} disabled={disabled} icon={<Icon name="lightbulb" />}>
        Suggest an improvement
      </Button>
    </div>
  );
}

function History({
  items,
  reasonCodes,
}: {
  items: StationView["decisionHistory"];
  reasonCodes: StationView["reasonCodes"];
}) {
  if (items.length === 0) return null;
  const reasonLabel = (code?: string) => reasonCodes.find((r) => r.value === code)?.label ?? code ?? "";
  return (
    <section className="panel history" aria-labelledby="history-title">
      <div className="panel__head">
        <h2 id="history-title">This station, this shift</h2>
        <Badge tone="outline">{items.length} decided</Badge>
      </div>
      <ul className="history__list">
        {[...items]
          .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
          .map((h) => (
            <li key={h.alert.id}>
              <span>
                {plantTime(h.alert.createdAt).slice(0, 5)} · {h.alert.defectType?.name ?? "Bead anomaly"} ·{" "}
                <span className="mono">{h.alert.roi}</span>
              </span>
              <span className="muted">
                {h.operatorDecision.kind === "confirm"
                  ? "Confirmed"
                  : `Rejected: ${reasonLabel(h.operatorDecision.reasonCode).toLowerCase()}`}
                {h.teamLeaderDecision
                  ? ` · ${DECISION_LABEL[h.teamLeaderDecision.kind as ShiftDecision] ?? h.teamLeaderDecision.kind}`
                  : ""}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}
