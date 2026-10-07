import { FalseAlarmChart } from "@/components/metrics/Charts";
import { GateTracks, KaizenFlow, KnowledgeIdeas, OverrideTrend, ParetoBeads } from "@/components/metrics/MetricsV2";
import { LoopBadge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Prov } from "@/components/ui/Prov";
import { getMetricsView, getPilotView } from "@/lib/queries";

import "./metrics2.css";

export const metadata = { title: "Loop metrics · Learning Line" };

export default async function MetricsPage() {
  const [view, pilot] = await Promise.all([getMetricsView(), getPilotView()]);

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Loop metrics · K2-Body pilot</h1>
          <p className="page__sub">Gate 1 indicators, how far each one is from its target, and where every number comes from</p>
        </div>
        <div className="head-badges">
          <LoopBadge loop="shift" />
          <LoopBadge loop="kaizen" />
        </div>
      </div>

      <div className="m2">
        <section className="panel" aria-labelledby="gate-title">
          <div className="panel__head">
            <h2 id="gate-title">Gate 1: distance to target</h2>
            <span className="muted">The pilot passes Gate 1 only when every row reaches its shaded zone</span>
          </div>
          <div className="panel__body">
            <GateTracks view={view} />
            <div className="legend-key">
              <span><i className="dot" />Now</span>
              <span><i style={{ width: 2, height: 12, border: 0, background: "var(--muted)" }} />Baseline or later target</span>
              <span><i style={{ width: 16, height: 10, border: "1px dashed var(--line-strong)", background: "var(--panel)" }} />Gate 1 zone</span>
              <span><i style={{ width: 10, height: 10, border: "2px dashed var(--muted)", borderRadius: "50%" }} />Not measured yet</span>
            </div>
          </div>
        </section>

        <div className="m2-row">
          <section className="panel" aria-labelledby="ov-title">
            <div className="panel__head">
              <h2 id="ov-title">Operators overriding alerts, last 30 days</h2>
              <Prov p="simulated" label="history" />
            </div>
            <div className="panel__body">
              <OverrideTrend pilot={pilot} year2030={view.overrideRate.year2030TargetPercent} />
              <div className="legend-key">
                <span><i className="dot" />Daily rate</span>
                <span><i />7-day average</span>
                <span><i className="dash" />Gate 1</span>
                <span><i className="dash" style={{ borderTopColor: "var(--muted)" }} />2030</span>
              </div>
              <p className="chart-note">
                Moving toward Gate 1, not there yet. The {pilot.baselinePercent}% baseline is {pilot.baselineSourceLabel.toLowerCase()} data; the days after it are {pilot.sourceLabel.toLowerCase()}.
              </p>
            </div>
          </section>

          <section className="panel" aria-labelledby="fa-title">
            <div className="panel__head">
              <h2 id="fa-title">False alarms this shift</h2>
              <Prov p="simulated" />
            </div>
            <div className="panel__body">
              <FalseAlarmChart data={view.falseAlarms} />
              <p className="chart-note">Over budget sends the station to model review. Confirmed defects are never hidden.</p>
            </div>
          </section>
        </div>

        <div className="m2-row m2-row--3">
          <section className="panel" aria-labelledby="pa-title">
            <div className="panel__head"><h2 id="pa-title">What st-04 confirms</h2><Prov p="simulated" /></div>
            <div className="panel__body">
              <ParetoBeads rows={view.pareto} />
              <p className="chart-note">Share of confirmed defects, last 30 days. Images are illustrations.</p>
            </div>
          </section>
          <section className="panel" aria-labelledby="kz-title">
            <div className="panel__head"><h2 id="kz-title">Problem to standard</h2><LoopBadge loop="kaizen" /></div>
            <div className="panel__body"><KaizenFlow view={view} /></div>
          </section>
          <section className="panel" aria-labelledby="kn-title">
            <div className="panel__head"><h2 id="kn-title">Know-how and ideas</h2><LoopBadge loop="kaizen" /></div>
            <div className="panel__body"><KnowledgeIdeas view={view} /></div>
          </section>
        </div>

        <div className="seed">
          <Icon name="fingerprint" />
          <span>Seed <span className="mono">{view.seedVersion}</span> · fingerprint <span className="mono">{view.seedFingerprint.slice(0, 8)}…{view.seedFingerprint.slice(-4)}</span></span>
          <span>Reset demo restores this exact state.</span>
          <Prov p="simulated" label="not TMMIN data" />
        </div>
      </div>
    </main>
  );
}
