import { BeadIllustration } from "@/components/station/BeadIllustration";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Prov } from "@/components/ui/Prov";
import type { KpiView, MetricsView, PilotView } from "@/lib/types";

/* ---------- Gate 1: distance to target ---------- */

type Mark = { v: number; label: string; val: string; k?: "now" | "none" };
type Track = { min: number; max: number; zone: [number, number]; reverse?: boolean; marks: Mark[]; zoneLabel?: string };

const num = (v: number | string) => (typeof v === "number" ? v : Number.NaN);

function trackFor(k: KpiView, m: MetricsView): Track | null {
  if (k.id === "override-rate") {
    const o = m.overrideRate;
    return {
      min: 0, max: 35, zone: [0, o.gate1TargetPercent],
      marks: [
        { v: o.baselinePercent, label: "Baseline", val: `${o.baselinePercent}%` },
        { v: o.currentPercent, label: "Now", val: `${o.currentPercent}%`, k: "now" },
        { v: o.year2030TargetPercent, label: "2030", val: `${o.year2030TargetPercent}%` },
      ],
    };
  }
  if (k.id === "operator-help" && !Number.isNaN(num(k.baseline))) {
    return { min: 40, max: 100, zone: [75, 100], marks: [{ v: num(k.baseline), label: "Baseline", val: `${k.baseline}%` }, { v: 64, label: "Pilot survey", val: "due", k: "none" }] };
  }
  if (k.id === "limit-sample-detection") {
    return { min: 0, max: 59, zone: [59, 59], marks: [{ v: 0, label: "Run", val: "0 of 59", k: "none" }], zoneLabel: "59 per defect type; leak-critical 100% plus a manual check" };
  }
  if (k.id === "scrap-index" && !Number.isNaN(num(k.baseline)) && !Number.isNaN(num(k.target))) {
    return {
      min: 75, max: 115, zone: [75, num(k.target)], reverse: true,
      marks: [{ v: num(k.baseline), label: "Baseline", val: String(k.baseline) }, { v: num(k.target), label: "Gate 1", val: String(k.target) }],
    };
  }
  return null;
}

function TrackViz({ t, label }: { t: Track; label: string }) {
  const pct = (v: number) => {
    const r = (v - t.min) / (t.max - t.min);
    return (t.reverse ? 1 - r : r) * 100;
  };
  let [z0, z1] = t.zone.map(pct).sort((a, b) => a - b);
  if (z1 - z0 < 3) { z0 -= 1.5; z1 += 1.5; }
  return (
    <>
      <div className="track" role="img" aria-label={`${label}: ${t.marks.map((m) => `${m.label} ${m.val}`).join(", ")}`}>
        <span className="track__rail" />
        <span className="track__zone" style={{ left: `${z0}%`, width: `${z1 - z0}%` }} />
        {t.marks.map((m) => (
          <span key={m.label} className="track__mark" data-k={m.k ?? "ref"} style={{ left: `${pct(m.v)}%` }}>
            <span>{m.label}</span><i /><b>{m.val}</b>
          </span>
        ))}
      </div>
      {t.zoneLabel ? <p className="muted" style={{ fontSize: 12.5 }}>{t.zoneLabel}</p> : null}
    </>
  );
}

export function GateTracks({ view }: { view: MetricsView }) {
  const over = view.falseAlarms.filter((f) => !f.withinBudget);
  return (
    <ul className="gate1">
      {view.gate1.map((k) => {
        const t = trackFor(k, view);
        const isWord = typeof k.value === "string";
        const status =
          k.id === "false-alarms" ? (
            over.length ? <Badge tone="instruct" icon={<Icon name="wrench" weight="bold" />}>{over.map((f) => f.station.id).join(", ")} in review</Badge> : <Badge tone="safe">All within budget</Badge>
          ) : k.id === "override-rate" && typeof k.value === "number" ? (
            k.value < view.overrideRate.gate1TargetPercent ? <Badge tone="safe">Met</Badge> : <Badge tone="outline">Not yet</Badge>
          ) : (
            <Badge tone="outline">Planned</Badge>
          );
        return (
          <li key={k.id}>
            <div className="gate1__name">
              <strong>{k.label}</strong>
              <span>
                {k.baselineProvenance ? <Prov p={k.baselineProvenance} label={k.baselineSourceLabel} /> : null}
                {k.targetProvenance ? <Prov p={k.targetProvenance} label={k.targetSourceLabel} /> : null}
                {k.provenance === "simulated" && !isWord ? <Prov p="simulated" label="Now" /> : null}
              </span>
            </div>
            <div>
              {k.id === "false-alarms" ? (
                <div className="stations8" role="img" aria-label={`False alarms per station this shift: ${view.falseAlarms.map((f) => `${f.station.id} ${f.count}`).join(", ")}`}>
                  {view.falseAlarms.map((f) => (
                    <span key={f.station.id} data-over={!f.withinBudget}><b>{f.count}</b>{f.station.id === "paint-bm" ? "paint" : f.station.id === "final-01" ? "final" : f.station.id}</span>
                  ))}
                </div>
              ) : t ? (
                <TrackViz t={t} label={k.label} />
              ) : null}
            </div>
            <div className="gate1__status">
              <span className={`gate1__now${isWord ? " gate1__now--word" : ""}`}>{typeof k.value === "number" ? `${k.value}${k.unit === "%" ? "%" : ""}` : k.value}</span>
              {status}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Override trend, 30 simulated days ---------- */

export function OverrideTrend({ pilot, year2030 }: { pilot: PilotView; year2030: number }) {
  const days = pilot.dailyOverride;
  const W = 720, H = 280, L = 40, R = 96, T = 22, B = 30;
  const n = Math.max(1, days.length - 1);
  const x = (i: number) => L + (i / n) * (W - L - R);
  const y = (v: number) => T + (1 - v / 35) * (H - T - B);
  const line = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const lastI = days.length - 1;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Override rate moved from ${pilot.baselinePercent}% to ${pilot.currentPercent}% over the simulated history; Gate 1 needs below ${pilot.gate1TargetPercent}%.`}>
      <rect className="zone" x={L} y={y(pilot.gate1TargetPercent)} width={W - L - R} height={y(0) - y(pilot.gate1TargetPercent)} />
      {[0, 10, 20, 30].map((t) => (
        <g key={t}>
          <line className="grid" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
          <text x={L - 8} y={y(t) + 4} textAnchor="end">{t}%</text>
        </g>
      ))}
      <line className="target" x1={L} x2={W - R} y1={y(pilot.gate1TargetPercent)} y2={y(pilot.gate1TargetPercent)} />
      <text className="lbl" x={W - R + 8} y={y(pilot.gate1TargetPercent) + 4}>Gate 1 · {pilot.gate1TargetPercent}%</text>
      <line className="target2" x1={L} x2={W - R} y1={y(year2030)} y2={y(year2030)} />
      <text x={W - R + 8} y={y(year2030) + 4}>2030 · {year2030}%</text>
      <path className="soft" d={line(days.map((d) => d.percent))} strokeWidth="1.5" />
      {days.map((d, i) => (
        <circle key={d.date} className="ink-fill" cx={x(i)} cy={y(d.percent)} r="2.4" opacity=".55">
          <title>{`${d.date}: ${d.percent}% · 7-day ${d.sevenDayAveragePercent}% · ${d.sampleSize} decisions`}</title>
        </circle>
      ))}
      <path className="ink" d={line(days.map((d) => d.sevenDayAveragePercent))} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="ink-fill" cx={x(0)} cy={y(pilot.baselinePercent)} r="5" />
      <text className="lbl-strong" x={x(0)} y={y(pilot.baselinePercent) - 14}>{pilot.baselinePercent}% baseline · casebook</text>
      <circle className="ink-fill" cx={x(lastI)} cy={y(pilot.currentPercent)} r="5" />
      <text className="lbl-strong" x={x(lastI) + 10} y={y(pilot.currentPercent) + 4}>{pilot.currentPercent}% now</text>
      {[0, Math.round(lastI / 3), Math.round((2 * lastI) / 3), lastI].map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle">Day {i + 1}</text>
      ))}
    </svg>
  );
}

/* ---------- st-04 Pareto with the bead each defect looks like ---------- */

export function ParetoBeads({ rows }: { rows: MetricsView["pareto"] }) {
  const top = Math.max(1, ...rows.map((r) => r.percent));
  return (
    <ul className="pareto">
      {rows.map((r) => (
        <li key={r.defectType.id}>
          <span className="thumb"><BeadIllustration defect={r.defectType.id} id={`pareto-${r.defectType.id}`} /></span>
          <div>
            <span className="pareto__name">{r.defectType.name}{r.defectType.criticality === "leak_critical" ? <span className="crit">Leak-critical</span> : null}</span>
            <div className="pareto__bar"><span style={{ width: `${(r.percent / top) * 100}%` }} /></div>
          </div>
          <b>{r.percent}%</b>
        </li>
      ))}
    </ul>
  );
}

/* ---------- Problem to standard ---------- */

const COLS: { status: MetricsView["ticketProgress"][number]["status"]; title: string }[] = [
  { status: "a3_in_progress", title: "A3 in progress" },
  { status: "countermeasure_trial", title: "Countermeasure trial" },
  { status: "closed", title: "Closed" },
];

export function KaizenFlow({ view }: { view: MetricsView }) {
  return (
    <>
      <div className="flow">
        {COLS.map((c) => {
          const col = view.ticketProgress.find((t) => t.status === c.status);
          const tickets = col?.tickets ?? [];
          return (
            <div key={c.status}>
              <h3>{c.title} · {col?.count ?? 0}</h3>
              {c.status === "closed" ? (
                <div className="stack">{tickets.map((t) => <span key={t.id}>{t.id.replace("KZ-SEAL-", "")}</span>)}</div>
              ) : (
                tickets.map((t) => <span key={t.id} className="kc">{t.id}<small>{t.stationId} · {t.defectType.name.toLowerCase()}</small></span>)
              )}
            </div>
          );
        })}
      </div>
      <div className="statline">
        <span className="bigstat">{Number.isInteger(view.learningCycle.days) ? view.learningCycle.days : view.learningCycle.days.toFixed(1)}<small>days</small></span>
        <span>median learning cycle, first alert to validated card</span>
        <Prov p="simulated" />
      </div>
    </>
  );
}

export function KnowledgeIdeas({ view }: { view: MetricsView }) {
  const count = (s: string) => view.knowledgeProgress.find((k) => k.status === s)?.count ?? 0;
  const [val, draft, ret] = [count("validated"), count("draft"), count("retired")];
  const ideas = view.ideas;
  const w = (n: number) => `${ideas.submitted ? (n / ideas.submitted) * 100 : 0}%`;
  return (
    <>
      <div className="units" role="img" aria-label={`${val + draft + ret} knowledge cards: ${val} validated, ${draft} draft, ${ret} retired`}>
        {Array.from({ length: val }, (_, i) => <span key={`v${i}`} className="u-val" />)}
        {Array.from({ length: draft }, (_, i) => <span key={`d${i}`} className="u-draft" />)}
        {Array.from({ length: ret }, (_, i) => <span key={`r${i}`} className="u-ret" />)}
      </div>
      <div className="legend-key"><span><i className="dot" style={{ background: "var(--safe)" }} />{val} validated, the assistant may cite</span><span>{draft} draft</span><span>{ret} retired</span></div>
      <div className="funnel" aria-label="Improvement ideas">
        <div><span><small>Submitted by operators</small><i style={{ width: "100%" }} /></span><b>{ideas.submitted}</b></div>
        <div><span><small>Answered within 7 days</small><i style={{ width: w(ideas.answeredWithin7Days) }} /></span><b>{ideas.answeredWithin7Days}</b></div>
        <div><span><small>Implemented · Gate 1 wants 40%</small><i style={{ width: w(ideas.implemented) }} /></span><b>{ideas.implemented}</b></div>
      </div>
      <p style={{ fontSize: 13, marginTop: "var(--s3)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Prov p="case_data" label="28% implemented today" />
        <Prov p="target" label="40%" />
      </p>
    </>
  );
}
