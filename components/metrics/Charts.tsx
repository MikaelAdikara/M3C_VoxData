import type { MetricsView } from "@/lib/types";

/**
 * Override rate on one 0 to 40% scale: baseline, current, and the two
 * targets as reference lines. One message: how far from Gate 1 we are.
 */
export function OverrideChart({ data }: { data: MetricsView["overrideRate"] }) {
  const W = 560;
  const L = 16;
  const R = 16;
  const max = 40;
  const x = (v: number) => L + (Math.min(v, max) / max) * (W - L - R);
  const rows = [
    { label: "Baseline (casebook survey)", value: data.baselinePercent, y: 62, cls: "c-bar-muted" },
    { label: data.periodLabel, value: data.currentPercent, y: 126, cls: "c-bar" },
  ];
  const refs = [
    { label: `Gate 1: below ${data.gate1TargetPercent}%`, value: data.gate1TargetPercent },
    { label: `2030: ${data.year2030TargetPercent}%`, value: data.year2030TargetPercent },
  ];
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} 210`}
      role="img"
      aria-label={`Override rate: baseline ${data.baselinePercent}%, now ${data.currentPercent}%. Gate 1 target below ${data.gate1TargetPercent}%, 2030 target ${data.year2030TargetPercent}%.`}
    >
      {[0, 10, 20, 30, 40].map((v) => (
        <g key={v}>
          <line className="c-grid" x1={x(v)} x2={x(v)} y1={26} y2={164} />
          <text x={x(v)} y={186} textAnchor="middle">
            {v}%
          </text>
        </g>
      ))}
      {rows.map((r) => (
        <g key={r.label}>
          <text x={L} y={r.y - 8} className="lbl-soft">
            {r.label}
          </text>
          <rect className={r.cls} x={L} y={r.y} width={x(r.value) - L} height={22} rx={3} />
          <text x={x(r.value) + 8} y={r.y + 16} className="lbl">
            {r.value}%
          </text>
        </g>
      ))}
      {refs.map((r, i) => (
        <g key={r.label}>
          <line className="c-ref" x1={x(r.value)} x2={x(r.value)} y1={26} y2={164} strokeDasharray="6 4" strokeWidth={1.5} />
          <text x={x(r.value)} y={16} textAnchor={i === 0 ? "start" : "end"} dx={i === 0 ? 4 : -4} className="lbl-ref">
            {r.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

/** False alarms this shift per station against the budget; over budget is blue (model review). */
export function FalseAlarmChart({ data }: { data: MetricsView["falseAlarms"] }) {
  const W = 560;
  const H = 230;
  const L = 28;
  const R = 8;
  const T = 16;
  const B = 34;
  const budget = data[0]?.budget ?? 2;
  const max = Math.max(4, budget + 1, ...data.map((d) => d.count));
  const bw = (W - L - R) / Math.max(1, data.length);
  const y = (v: number) => T + ((max - v) / max) * (H - T - B);
  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`False alarms this shift: ${data.map((d) => `${d.station.id} ${d.count}`).join(", ")}. Budget ${budget} per station.`}
    >
      {Array.from({ length: max + 1 }, (_, v) => (
        <g key={v}>
          <line className="c-grid" x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const bx = L + i * bw + bw * 0.22;
        const w = bw * 0.56;
        return (
          <g key={d.station.id}>
            <rect
              className={d.withinBudget ? "c-bar" : "c-bar-over"}
              x={bx}
              y={y(d.count)}
              width={w}
              height={Math.max(0, y(0) - y(d.count))}
              rx={2}
            />
            {d.count ? (
              <text x={bx + w / 2} y={y(d.count) - 6} textAnchor="middle" className="lbl">
                {d.count}
              </text>
            ) : null}
            <text x={bx + w / 2} y={H - 12} textAnchor="middle" className="c-axis">
              {d.station.id.replace("st-", "")}
            </text>
          </g>
        );
      })}
      <line className="c-ref" x1={L} x2={W - R} y1={y(budget)} y2={y(budget)} strokeDasharray="6 4" strokeWidth={1.5} />
      <text x={W - R} y={y(budget) - 6} textAnchor="end" className="lbl">
        Budget {budget}
      </text>
    </svg>
  );
}
