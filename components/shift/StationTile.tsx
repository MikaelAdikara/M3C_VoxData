import { AndonBadge, Badge } from "@/components/ui/Badge";
import type { StationTileView } from "@/lib/types";

export type TileState = "andon" | "review" | "open" | null;

/** Pips for rejections against the false-alarm budget (blue past the budget). */
function BudgetMeter({ count, budget }: { count: number; budget: number }) {
  const slots = Math.max(budget, count);
  return (
    <div className="budget">
      <span className="pips" aria-hidden="true">
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={`pip${i < count ? (i >= budget ? " over" : " on") : ""}`} />
        ))}
      </span>
      <span className="num">
        {count} of {budget} false alarms
      </span>
    </div>
  );
}

/**
 * One station on the shift board. Colour only for state: yellow andon while a
 * confirmed alert waits for the team leader, blue when the station is over
 * its false-alarm budget. Confirmed defects are never hidden.
 */
export function StationTile({
  tile,
  state,
  focus,
  onSelect,
}: {
  tile: StationTileView;
  state: TileState;
  focus: boolean;
  onSelect?: () => void;
}) {
  const s = tile.station;
  return (
    <button
      type="button"
      className="tile quietable"
      data-state={state === "andon" || state === "review" ? state : undefined}
      data-focus={focus || undefined}
      aria-pressed={focus}
      onClick={onSelect}
    >
      <div className="tile__top">
        <div>
          <div className="tile__id">{s.id}</div>
          <div className="tile__type">{s.name}</div>
        </div>
      </div>
      <div className="tile__counts">
        <div>
          <b className="num">{tile.openAlerts}</b>
          <span>Open</span>
        </div>
        <div>
          <b className="num">{tile.confirmedCount}</b>
          <span>Confirmed</span>
        </div>
        <div>
          <b className="num">{tile.rejectedCount}</b>
          <span>Rejected</span>
        </div>
      </div>
      <BudgetMeter count={tile.rejectedCount} budget={tile.falseAlarmBudget} />
      {state === "andon" ? <AndonBadge state="yellow" /> : null}
      {state === "review" || (state === "andon" && tile.modelReviewNeeded) ? <AndonBadge state="review" /> : null}
      {state === "open" ? <Badge tone="outline">Alert at station</Badge> : null}
    </button>
  );
}
