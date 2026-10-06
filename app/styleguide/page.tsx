import { Trail } from "@/components/shell/Trail";
import { SheetDemo } from "@/components/styleguide/SheetDemo";
import { AndonBadge, Badge, LoopBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DataTable } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { KpiTile } from "@/components/ui/KpiTile";
import { Plate } from "@/components/ui/Plate";
import { getShiftBoardView, reasonCodes } from "@/lib/queries";
import type { StationTileView } from "@/lib/types";

export const metadata = { title: "UI kit · Learning Line" };

/** UI-0 component sheet: every primitive with live data from lib/queries. */
export default async function StyleguidePage() {
  const board = await getShiftBoardView();

  return (
    <>
      <Trail current="operator" label="Abnormality trail (example)" />
      <main className="page" style={{ display: "grid", gap: "var(--s6)" }}>
        <div className="page__head">
          <div>
            <h1 className="page__title">UI kit</h1>
            <p className="page__sub">The Plant Sign components for UI-1 to UI-3. Try the theme toggle in the top bar.</p>
          </div>
          <LoopBadge loop="shift" />
        </div>

        <section className="panel" aria-labelledby="sg-buttons">
          <div className="panel__head"><h2 id="sg-buttons">Buttons</h2></div>
          <div className="panel__body" style={{ display: "flex", flexWrap: "wrap", gap: "var(--s3)" }}>
            <Button icon={<Icon name="check" weight="bold" />}>Confirm defect</Button>
            <Button variant="ghost">Contain</Button>
            <Button variant="stop" icon={<Icon name="hand-palm" weight="bold" />}>Stop and fix</Button>
            <Button variant="quiet">Undo</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink href="/station" size="xl">Open station</ButtonLink>
          </div>
        </section>

        <section className="panel" aria-labelledby="sg-badges">
          <div className="panel__head"><h2 id="sg-badges">Badges and loops</h2></div>
          <div className="panel__body" style={{ display: "flex", flexWrap: "wrap", gap: "var(--s3)", alignItems: "center" }}>
            <AndonBadge state="yellow" />
            <AndonBadge state="review" />
            <AndonBadge state="stopped" />
            <Badge tone="stop" icon={<Icon name="drop" weight="bold" />}>Leak-critical</Badge>
            <Badge tone="safe" icon={<Icon name="seal-check" weight="bold" />}>Validated</Badge>
            <Badge tone="outline">Draft</Badge>
            <Badge tone="ai" icon={<Icon name="sparkle" />}>Drafted by AI, check</Badge>
            <LoopBadge loop="shift" />
            <LoopBadge loop="kaizen" />
            <LoopBadge loop="launch" />
          </div>
        </section>

        <section aria-labelledby="sg-plates" style={{ display: "grid", gap: "var(--s4)", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <h2 id="sg-plates" className="sr-only">Sign plates</h2>
          <Plate tone="caution" title="Caution: bead break" subtitle="Suggested by the system. You decide.">
            <p>Score 0.83 against threshold 0.61</p>
          </Plate>
          <Plate tone="stop" title="Stop and fix: st-04" subtitle="Decided by team leader" />
          <Plate tone="safe" title="Validated: safe to reuse" subtitle="KC-SEAL-014 r3" />
          <Plate tone="instruct" title="Draft: awaiting validation" subtitle="KC-SEAL-021 r3" />
        </section>

        <section className="panel" aria-labelledby="sg-table">
          <div className="panel__head"><h2 id="sg-table">Data table (live: getShiftBoardView)</h2><span className="muted">Shift {board.shift.label}</span></div>
          <div className="panel__body">
            <DataTable<StationTileView>
              caption="Stations this shift"
              rows={board.stations}
              rowKey={(r) => r.station.id}
              selectedKey="st-04"
              columns={[
                { key: "id", header: "Station", render: (r) => r.station.id },
                { key: "type", header: "Type", render: (r) => r.station.name },
                { key: "open", header: "Open", align: "right", render: (r) => r.openAlerts },
                { key: "confirmed", header: "Confirmed", align: "right", render: (r) => r.confirmedCount },
                { key: "rejected", header: "Rejected", align: "right", render: (r) => r.rejectedCount },
                { key: "flag", header: "State", render: (r) => (r.modelReviewNeeded ? <AndonBadge state="review" /> : null) },
              ]}
            />
          </div>
        </section>

        <section className="panel" aria-labelledby="sg-kpi">
          <div className="panel__head"><h2 id="sg-kpi">KPI row</h2></div>
          <div className="panel__body">
            <KpiTile kpi={{ id: "override", label: "Operators often overriding alerts", value: 24, unit: "%", baseline: 31, target: "< 20%", sourceLabel: "Casebook survey; ES Section 3" }} />
          </div>
        </section>

        <section className="panel" aria-labelledby="sg-sheet">
          <div className="panel__head"><h2 id="sg-sheet">Sheet and empty state</h2></div>
          <div className="panel__body" style={{ display: "grid", gap: "var(--s4)" }}>
            <div><SheetDemo reasonCodes={reasonCodes} /></div>
            <EmptyState title="No open alert at this station">
              The camera has not flagged anything since the last decision. New alerts appear here automatically.
            </EmptyState>
          </div>
        </section>
      </main>
    </>
  );
}
