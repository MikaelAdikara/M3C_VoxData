"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { DECISION_LABEL, plantTime } from "@/components/format";
import { LineStage } from "@/components/line/LineStage";
import { Trail } from "@/components/shell/Trail";
import { AndonBadge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Plate } from "@/components/ui/Plate";
import { decideShift, restartLine, verifyRejection } from "@/lib/actions/shift";
import type { AlertView, LineView, ShiftBoardView, ShiftDecision } from "@/lib/types";

import { StationTile, type TileState } from "./StationTile";

const DECISIONS: { kind: ShiftDecision; icon: IconName; variant: "stop" | "ghost" }[] = [
  { kind: "stop_fix", icon: "hand-palm", variant: "stop" },
  { kind: "contain", icon: "funnel", variant: "ghost" },
  { kind: "continue", icon: "arrow-right", variant: "ghost" },
];

type Logged = { stationId: string; decision: ShiftDecision; note: string };

/**
 * Team leader shift board. The system only suggests; the team leader's
 * decision (with a one-line note) is the only thing that acts on the line.
 */
export function ShiftBoardScreen({
  view,
  line,
  canDecide,
  notice,
}: {
  view: ShiftBoardView;
  /** BE-4 line view; when present the board opens on the 3D line. */
  line?: LineView;
  canDecide: boolean;
  notice?: ReactNode;
}) {
  const [mode, setMode] = useState<"line" | "grid">(line ? "line" : "grid");
  const [focusStation, setFocusStation] = useState<string | null>(null);
  // Newest confirmation first: the andon the team leader just heard.
  const pending = [...view.pendingDecisions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pendingByStation = new Map(pending.map((a) => [a.stationId, a]));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: AlertView | undefined = pending.find((a) => a.id === selectedId) ?? pending[0];
  const [logged, setLogged] = useState<Logged | null>(null);

  const totals = view.stations.reduce(
    (t, s) => ({
      open: t.open + s.openAlerts,
      confirmed: t.confirmed + s.confirmedCount,
      rejected: t.rejected + s.rejectedCount,
    }),
    { open: 0, confirmed: 0, rejected: 0 },
  );
  const decided = totals.confirmed + totals.rejected;
  const override = decided === 0 ? 0 : Math.round((totals.rejected / decided) * 100);

  const stateOf = (stationId: string, review: boolean, open: number): TileState =>
    pendingByStation.has(stationId) ? "andon" : review ? "review" : open > 0 ? "open" : null;

  return (
    <>
      {logged && !selected ? (
        <Trail current="kaizen" label={`Abnormality trail for ${logged.stationId}`} />
      ) : selected ? (
        <Trail current="team_leader" label={`Abnormality trail for ${selected.stationId}`} />
      ) : null}
      <main className="page">
        <div className="page__head">
          <div>
            <h1 className="page__title">Shift board · K2-Body</h1>
            <p className="page__sub">
              Shift {view.shift.label} · {plantTime(view.shift.startsAt).slice(0, 5)} to{" "}
              {plantTime(view.shift.endsAt).slice(0, 5)} · false-alarm budget{" "}
              {view.stations[0]?.falseAlarmBudget ?? 2} per station per shift
            </p>
          </div>
          <div className="cam-head">
            {line ? (
              <div className="seg" role="radiogroup" aria-label="Board view">
                {(["line", "grid"] as const).map((m) => (
                  <label key={m}>
                    <input type="radio" name="board-view" checked={mode === m} onChange={() => setMode(m)} />
                    <span>{m === "line" ? "Line" : "Grid"}</span>
                  </label>
                ))}
              </div>
            ) : null}
            <LoopBadge loop="shift" />
          </div>
        </div>

        {notice}

        <div className="board" data-quiet={selected ? "true" : "false"}>
          <section aria-label="Stations">
            <p className="totals">
              Shift {view.shift.label} so far: <b className="num">{totals.open}</b> open ·{" "}
              <b className="num">{totals.confirmed}</b> confirmed · <b className="num">{totals.rejected}</b>{" "}
              rejected · override rate <b className="num">{override}%</b>
            </p>
            {mode === "line" && line ? (
              <LineStage
                line={line}
                selected={selected?.stationId ?? focusStation ?? null}
                onSelect={(id) => {
                  setFocusStation(id);
                  const a = pendingByStation.get(id);
                  if (a) setSelectedId(a.id);
                }}
              />
            ) : (
            <div className="grid">
              {view.stations.map((t) => (
                <StationTile
                  key={t.station.id}
                  tile={t}
                  state={stateOf(t.station.id, t.modelReviewNeeded, t.openAlerts)}
                  focus={selected?.stationId === t.station.id}
                  onSelect={() => {
                    const a = pendingByStation.get(t.station.id);
                    if (a) setSelectedId(a.id);
                  }}
                />
              ))}
            </div>
            )}
            <ReviewQueue reviews={view.modelReviews} canVerify={canDecide} />
            <div className="legend">
              <AndonBadge state="yellow" />
              <AndonBadge state="review" />
              <span>No colour: running normally</span>
            </div>
          </section>

          <aside className="rec" aria-label="Team leader decision">
            {line?.line.state === "stopped" ? <RestartPanel line={line} canDecide={canDecide} /> : null}
            {logged ? (
              <div className="rec__logged" role="status">
                <Plate
                  tone={logged.decision === "stop_fix" ? "stop" : "neutral"}
                  title={`${DECISION_LABEL[logged.decision]}: ${logged.stationId}`}
                  subtitle="Decided by team leader · role:team_leader@body"
                >
                  <p className="next">
                    <Icon name="check" weight="bold" />
                    <span>Logged with note: {logged.note}</span>
                  </p>
                </Plate>
              </div>
            ) : null}
            {selected ? (
              <DecisionPanel
                key={selected.id}
                alert={selected}
                canDecide={canDecide}
                onLogged={(l) => {
                  setLogged(l);
                  setSelectedId(null);
                }}
              />
            ) : logged ? null : (
              <EmptyState title="No decision waiting">
                When an operator confirms a defect, the yellow andon and the system&apos;s suggestion appear here.
              </EmptyState>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

function DecisionPanel({
  alert,
  canDecide,
  onLogged,
}: {
  alert: AlertView;
  canDecide: boolean;
  onLogged: (l: Logged) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const rec = alert.recommendation;

  function decide(kind: ShiftDecision) {
    setError(null);
    if (!note.trim()) {
      setError("Add a one-line note for the log first.");
      return;
    }
    start(async () => {
      const r = await decideShift(alert.id, kind, note);
      if (r.ok) onLogged({ stationId: alert.stationId, decision: kind, note: note.trim() });
      else setError(r.error);
    });
  }

  return (
    <Plate
      tone="caution"
      icon="bell-ringing"
      title={`Yellow andon: ${alert.stationId}`}
      subtitle={`${alert.defectType?.name ?? "Bead anomaly"} · confirmed by operator · ${plantTime(alert.createdAt).slice(0, 5)}`}
    >
      {rec ? (
        <>
          <p className="rec__by">
            <Icon name="cpu" /> Suggested by the system
          </p>
          <p className="rec__text">{rec.text}</p>
        </>
      ) : null}
      <dl className="facts">
        <dt>Body</dt>
        <dd className="mono">{alert.bodyId}</dd>
        <dt>Region</dt>
        <dd className="mono">{alert.roi}</dd>
        {rec ? (
          <>
            <dt>Confirmed repeats this shift</dt>
            <dd className="num">{rec.confirmedRepeatCount}</dd>
          </>
        ) : null}
      </dl>
      <div className="field rec__note">
        <label htmlFor={`note-${alert.id}`}>Note for the log (required)</label>
        <input
          id={`note-${alert.id}`}
          className="input"
          value={note}
          maxLength={280}
          onChange={(e) => setNote(e.target.value.replace(/[\r\n]/g, " "))}
          placeholder="For example: nozzle check"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `err-${alert.id}` : undefined}
        />
        {error ? (
          <small id={`err-${alert.id}`} className="field__error" role="alert">
            {error}
          </small>
        ) : null}
      </div>
      <div className="rec__btns">
        {DECISIONS.map((d) => (
          <Button
            key={d.kind}
            size="xl"
            block
            variant={d.variant}
            disabled={!canDecide || pending}
            onClick={() => decide(d.kind)}
            icon={<Icon name={d.icon} weight="bold" />}
          >
            {DECISION_LABEL[d.kind]}
            {rec?.decision === d.kind ? <span className="rec__tag">Suggested</span> : null}
          </Button>
        ))}
      </div>
      <p className="muted rec__foot">Nothing stops the line until you choose.</p>
    </Plate>
  );
}

/** Rejections waiting for a team leader check. Only verified rejections may update the model (4M change). */
function ReviewQueue({ reviews, canVerify }: { reviews: ShiftBoardView["modelReviews"]; canVerify: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (reviews.length === 0) return null;
  return (
    <section className="panel reviews" aria-labelledby="reviews-title">
      <div className="panel__head">
        <h2 id="reviews-title">Rejections to verify</h2>
        <span className="muted">Verified rejections may update the model as a 4M change</span>
      </div>
      <div className="panel__body">
        {error ? (
          <p className="form-error" role="alert">
            <Icon name="warning-circle" weight="bold" /> {error}
          </p>
        ) : null}
        <ul className="reviews__list">
          {reviews.map((r) => (
            <li key={r.id}>
              <span>
                <strong>{r.stationId}</strong> · {r.alertIds.length} rejected alert{r.alertIds.length === 1 ? "" : "s"}
              </span>
              {r.status === "verified" ? (
                <span className="reviews__done">
                  <Icon name="check" weight="bold" /> Verified{r.verifiedByRole ? ` · ${r.verifiedByRole}` : ""}
                </span>
              ) : (
                <Button
                  variant="ghost"
                  disabled={!canVerify || pending}
                  onClick={() =>
                    start(async () => {
                      setError(null);
                      const res = await verifyRejection(r.id);
                      if (!res.ok) setError(res.error);
                    })
                  }
                  icon={<Icon name="wrench" weight="bold" />}
                >
                  Verify rejection
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function RestartPanel({ line, canDecide }: { line: LineView; canDecide: boolean }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const held = line.line.heldBodyId;

  return (
    <Plate tone="stop" title="Line stopped" subtitle={`Stopped by team leader${line.line.stoppedAt ? ` · ${plantTime(line.line.stoppedAt).slice(0, 5)}` : ""}`}>
      {held ? <p className="next"><Icon name="hand-palm" weight="bold" /><span>Body <span className="mono">{held}</span> held for repair.</span></p> : null}
      <div className="field" style={{ marginTop: "var(--s3)" }}>
        <label htmlFor="restart-note">Repair note</label>
        <input id="restart-note" className="input" maxLength={120} placeholder="For example: nozzle replaced, bead rechecked" value={note} onChange={(e) => setNote(e.target.value)} disabled={!canDecide} />
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="rec__btns">
        <Button
          size="xl"
          block
          icon={<Icon name="play" weight="bold" />}
          disabled={!canDecide || pending}
          onClick={() => {
            setError(null);
            if (!note.trim()) { setError("Add a one-line repair note first."); return; }
            start(async () => {
              const r = await restartLine(note);
              if (!r.ok) setError(r.error);
            });
          }}
        >
          Repair done · restart line
        </Button>
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: "var(--s3)" }}>Only the team leader restarts the line.</p>
    </Plate>
  );
}
