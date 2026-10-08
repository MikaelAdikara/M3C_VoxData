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
import type { CameraEventView, ReasonCode, ShiftDecision, StationView } from "@/lib/types";

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
  cameraEvents = [],
  canDecide,
  notice,
}: {
  view: StationView;
  /** The station's camera or tablet (BE-4 camera view); shown whether or not an alert is open. */
  camera?: FeedCamera | null;
  /** This camera's events this shift (alerts, decisions, recording gaps). */
  cameraEvents?: CameraEventView[];
  canDecide: boolean;
  notice?: ReactNode;
}) {
  const { station, openAlert: alert, reasonCodes, ideasOpen, decisionHistory } = view;
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [feedMode, setFeedMode] = useState<"alert" | "current">("alert");
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

        <div className="station">
          <section className="station__media" aria-label="Station camera">
            {camera ? (
              <>
                <div className="media-head">
                  {alert && camera.media ? (
                    <div className="seg" role="radiogroup" aria-label="Camera view">
                      {(["alert", "current"] as const).map((m) => (
                        <label key={m}>
                          <input type="radio" name="feed-mode" checked={feedMode === m} onChange={() => setFeedMode(m)} />
                          <span>{m === "alert" ? "Alert replay" : "Current view"}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <span className="media-head__title">{camera.media ? "Station camera · current view" : "Paint body-map tablet"}</span>
                  )}
                  <Link className="link-quiet" href="/cameras"><Icon name="video-camera" />All cameras</Link>
                </div>
                <CameraFeed
                  cam={camera}
                  focus
                  replay={alert && feedMode === "alert" && alert.defectType ? { kind: "alert", at: alert.createdAt, defect: alert.defectType.id, id: alert.id } : null}
                />
              </>
            ) : alert ? (
              <div className="bead">
                <BeadIllustration defect={alert.defectType?.id ?? null} id={`bead-${alert.id}`} />
                <span className="bead__tag">Illustration · simulated</span>
              </div>
            ) : null}
            {alert ? (
              <div className="bead__cap">
                <span>
                  Region <span className="mono">{alert.roi}</span>
                </span>
                <span>
                  Model <span className="mono">{alert.modelVersion}</span>
                </span>
              </div>
            ) : null}
            {camera ? <CameraHealth camera={camera} events={cameraEvents} /> : null}
            <History items={decisionHistory} reasonCodes={reasonCodes} />
          </section>

          <section className="decide" aria-label="Decision">
            {alert && !shown ? (
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
            ) : shown ? (
              <OutcomePlate outcome={shown} stationId={station.id} />
            ) : (
              <LatestState station={station.id} items={decisionHistory} reasonCodes={reasonCodes} offline={camera?.state === "offline"} />
            )}
            <IdeaRow sent={ideaSent} ideasOpen={ideasOpen} disabled={!canDecide} onOpen={() => setIdeaOpen(true)} />
          </section>
        </div>
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

/** What the operator sees when no alert is open: the last outcome at this station, or a calm "nothing open". */
function LatestState({
  station,
  items,
  reasonCodes,
  offline,
}: {
  station: string;
  items: StationView["decisionHistory"];
  reasonCodes: StationView["reasonCodes"];
  offline: boolean;
}) {
  const last = [...items].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
  if (offline) {
    return (
      <EmptyState title={`No alerts from ${station} while the camera is offline`}>
        The camera cannot check beads until it is back online. Nothing here is a defect; see camera health on the left.
      </EmptyState>
    );
  }
  if (last && last.operatorDecision.kind === "confirm" && !last.teamLeaderDecision) {
    return (
      <Plate tone="caution" icon="bell-ringing" title="Confirmed: waiting for team leader" subtitle={`${last.alert.defectType?.name ?? "Bead anomaly"} · body ${last.alert.bodyId} · ${plantTime(last.operatorDecision.createdAt).slice(0, 5)}`}>
        <p className="next">
          <Icon name="arrow-right" weight="bold" />
          <span>The yellow andon is with the team leader: stop and fix, contain, or continue with check.</span>
        </p>
      </Plate>
    );
  }
  if (last && last.teamLeaderDecision) {
    const label = DECISION_LABEL[last.teamLeaderDecision.kind as ShiftDecision] ?? last.teamLeaderDecision.kind;
    return (
      <Plate tone={last.teamLeaderDecision.kind === "stop_fix" ? "stop" : "neutral"} icon="check" title={`Last alert: ${label.toLowerCase()}`} subtitle={`Decided by team leader · ${plantTime(last.teamLeaderDecision.createdAt).slice(0, 5)}`}>
        <p className="next">
          <Icon name="check" weight="bold" />
          <span>No open alert at {station} now. New alerts appear here within a few seconds.</span>
        </p>
      </Plate>
    );
  }
  if (last && last.operatorDecision.kind === "reject") {
    const reason = reasonCodes.find((r) => r.value === last.operatorDecision.reasonCode)?.label ?? "reason given";
    return (
      <Plate tone="neutral" icon="x-circle" title={`Last alert rejected: ${reason.toLowerCase()}`} subtitle={`Decided by operator · ${plantTime(last.operatorDecision.createdAt).slice(0, 5)}`}>
        <p className="next">
          <Icon name="arrow-right" weight="bold" />
          <span>Waiting for the team leader to verify the rejection. No open alert at {station} now.</span>
        </p>
      </Plate>
    );
  }
  return (
    <EmptyState title={`No open alert at ${station}`}>
      The camera has not flagged anything this shift. New alerts appear here within a few seconds.
    </EmptyState>
  );
}

/** Camera health for this station, current state only; replay lives on the camera wall. */
function CameraHealth({ camera, events }: { camera: FeedCamera; events: CameraEventView[] }) {
  const gaps = events.filter((e) => e.kind === "gap");
  const avg = camera.uptime14d.length ? camera.uptime14d.reduce((a, b) => a + b, 0) / camera.uptime14d.length : null;
  const state = camera.state === "offline" ? "Offline" : camera.state === "attention" ? "Needs attention" : "Online";
  return (
    <section className="panel cam-health" aria-labelledby="cam-health-title" data-state={camera.state}>
      <div className="panel__head">
        <h2 id="cam-health-title">{camera.media ? "Camera health" : "Tablet"}</h2>
        <Badge tone={camera.state === "offline" ? "stop" : camera.state === "attention" ? "instruct" : "outline"}>{state}</Badge>
      </div>
      <div className="panel__body">
        {camera.note ? <p className="cam-health__note">{camera.note}</p> : null}
        <dl className="facts">
          {avg !== null ? (<><dt>Uptime, 14 days</dt><dd className="num">{(avg * 100).toFixed(1)}%</dd></>) : null}
          {camera.media ? (<><dt>Model</dt><dd className="mono">{camera.modelVersion}</dd></>) : null}
          <dt>Lens cleaned</dt><dd>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(camera.lastLensCleanAt))}</dd>
          {gaps.map((g) => (
            <span key={g.at} style={{ display: "contents" }}>
              <dt>Recording gap</dt>
              <dd>{plantTime(g.at).slice(0, 5)}{g.endsAt ? `–${plantTime(g.endsAt).slice(0, 5)}` : " to now"}</dd>
            </span>
          ))}
          {camera.maintenanceTicketId ? (<><dt>Maintenance</dt><dd className="mono">{camera.maintenanceTicketId} open</dd></>) : null}
        </dl>
        {camera.state !== "online" && !camera.maintenanceTicketId ? (
          <p className="muted cam-health__foot">The team leader or a DX cell engineer opens a maintenance ticket from <Link href="/cameras">Camera health</Link>.</p>
        ) : null}
      </div>
    </section>
  );
}
