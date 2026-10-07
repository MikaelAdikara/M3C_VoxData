import { FalseAlarmChart, OverrideChart } from "@/components/metrics/Charts";
import { Badge, LoopBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { getMetricsView } from "@/lib/queries";
import type { KpiView } from "@/lib/types";

export const metadata = { title: "Loop metrics · Learning Line" };

function fmt(v: number | string, unit: string) {
  if (typeof v === "string") return v;
  if (unit === "%") return `${v}%`;
  return unit && unit !== "index" && unit !== "stations" ? `${v} ${unit}` : String(v);
}

/** Status words, not colour alone. Colour only where something needs attention. */
function status(k: KpiView, overBudget: string[]) {
  if (k.id === "false-alarms") {
    return overBudget.length ? (
      <Badge tone="instruct" icon={<Icon name="wrench" weight="bold" />}>
        {overBudget.join(", ")} in model review
      </Badge>
    ) : (
      <Badge tone="safe" icon={<Icon name="check" weight="bold" />}>
        All within budget
      </Badge>
    );
  }
  if (k.id === "override-rate" && typeof k.value === "number") {
    return k.value < 20 ? (
      <Badge tone="safe" icon={<Icon name="check" weight="bold" />}>
        Met
      </Badge>
    ) : (
      <Badge tone="outline">Not yet</Badge>
    );
  }
  return <Badge tone="outline">Planned</Badge>;
}

export default async function MetricsPage() {
  const view = await getMetricsView();
  const overBudget = view.falseAlarms.filter((f) => !f.withinBudget).map((f) => f.station.id);
  const ideaRate = view.ideas.submitted ? Math.round((view.ideas.implemented / view.ideas.submitted) * 100) : 0;

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Loop metrics</h1>
          <p className="page__sub">K2-Body pilot · Gate 1 indicators · {view.dataLabel.toLowerCase()}</p>
        </div>
        <div className="head-badges">
          <LoopBadge loop="shift" />
          <LoopBadge loop="kaizen" />
        </div>
      </div>

      <div className="m-grid">
        <section className="panel wide" aria-labelledby="gate-title">
          <div className="panel__head">
            <h2 id="gate-title">Gate 1 indicators</h2>
            <span className="muted">The pilot passes Gate 1 only when every row is met</span>
          </div>
          <div className="panel__body">
            <div className="table-wrap">
              <table className="table gate">
                <thead>
                  <tr>
                    <th scope="col">Indicator</th>
                    <th scope="col" className="r">Baseline</th>
                    <th scope="col" className="r">Now</th>
                    <th scope="col" className="r">Gate 1</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {view.gate1.map((k) => (
                    <tr key={k.id} title={`Source: ${k.sourceLabel}`}>
                      <td>
                        {k.label}
                        <span className="src">{k.sourceLabel}</span>
                      </td>
                      <td className="r num" data-h="Baseline">{fmt(k.baseline, k.unit)}</td>
                      <td className="r num" data-h="Now">
                        <b>{fmt(k.value, k.unit)}</b>
                      </td>
                      <td className="r num" data-h="Gate 1">{fmt(k.target, k.unit)}</td>
                      <td data-h="Status">{status(k, overBudget)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel" aria-labelledby="override-title">
          <div className="panel__head">
            <h2 id="override-title">Operators overriding alerts</h2>
            <LoopBadge loop="shift" />
          </div>
          <div className="panel__body">
            <OverrideChart data={view.overrideRate} />
            <p className="chart-note">Rejected ÷ (confirmed + rejected). Baseline from the casebook survey.</p>
          </div>
        </section>

        <section className="panel" aria-labelledby="fa-title">
          <div className="panel__head">
            <h2 id="fa-title">False alarms this shift</h2>
            <span className="muted">Budget {view.falseAlarms[0]?.budget ?? 2} per station</span>
          </div>
          <div className="panel__body">
            <FalseAlarmChart data={view.falseAlarms} />
            <p className="chart-note">Over budget sends the station to model review. Confirmed defects are never hidden.</p>
          </div>
        </section>

        <section className="panel wide" aria-labelledby="learn-title">
          <div className="panel__head">
            <h2 id="learn-title">Learning and ideas</h2>
            <LoopBadge loop="kaizen" />
          </div>
          <div className="panel__body">
            <div className="table-wrap">
              <table className="table gate">
                <thead>
                  <tr>
                    <th scope="col">Measure</th>
                    <th scope="col" className="r">Now</th>
                    <th scope="col">Basis</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      Median learning cycle time<span className="src">First alert to validated card</span>
                    </td>
                    <td className="r num" data-h="Now">
                      <b>{Number.isInteger(view.learningCycleDays) ? view.learningCycleDays : view.learningCycleDays.toFixed(1)} days</b>
                    </td>
                    <td data-h="Basis">Tickets with a validated card</td>
                  </tr>
                  <tr>
                    <td>
                      Ideas answered within 7 days<span className="src">Operator suggestions</span>
                    </td>
                    <td className="r num" data-h="Now">
                      <b>
                        {view.ideas.answeredWithin7Days} of {view.ideas.submitted}
                      </b>
                    </td>
                    <td data-h="Basis">This period</td>
                  </tr>
                  <tr>
                    <td>
                      Improvement ideas implemented<span className="src">ES Table 4 · baseline 28%, 2028 target 40%</span>
                    </td>
                    <td className="r num" data-h="Now">
                      <b>{ideaRate}%</b>
                    </td>
                    <td data-h="Basis">
                      {view.ideas.implemented} of {view.ideas.submitted}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
