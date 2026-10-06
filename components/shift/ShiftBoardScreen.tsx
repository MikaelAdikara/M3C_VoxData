"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";

import { DECISION_LABEL, plantTime } from "@/components/format";
import { Trail } from "@/components/shell/Trail";
import { AndonBadge, LoopBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Plate } from "@/components/ui/Plate";
import { decideShift } from "@/lib/actions/shift";
import type { AlertView, ShiftBoardView, ShiftDecision } from "@/lib/types";

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
  canDecide,
  notice,
}: {
  view: ShiftBoardView;
  canDecide: boolean;
  notice?: ReactNode;
}) {
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
          <LoopBadge loop="shift" />
        </div>

        {notice}

        <div className="board" data-quiet={selected ? "true" : "false"}>
          <section aria-label="Stations">
            <p className="totals">
              Shift {view.shift.label} so far: <b className="num">{totals.open}</b> open ·{" "}
              <b className="num">{totals.confirmed}</b> confirmed · <b className="num">{totals.rejected}</b>{" "}
              rejected · override rate <b className="num">{override}%</b>
            </p>
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
            <div className="legend">
              <AndonBadge state="yellow" />
              <AndonBadge state="review" />
              <span>No colour: running normally</span>
            </div>
          </section>

          <aside className="rec" aria-label="Team leader decision">
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
