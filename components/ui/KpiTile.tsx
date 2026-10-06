import type { KpiView } from "@/lib/types";

function fmt(value: number | string, unit: string) {
  if (typeof value === "string") return value;
  return unit === "%" ? `${value}%` : `${value}${unit ? ` ${unit}` : ""}`;
}

/**
 * One KPI as a ruled row (value, baseline, target), never a big-number card.
 * The source label is visible and also in the tooltip.
 */
export function KpiTile({ kpi }: { kpi: KpiView }) {
  return (
    <div className="kpi" title={`Source: ${kpi.sourceLabel}`}>
      <div className="kpi__label">
        {kpi.label}
        <small>{kpi.sourceLabel}</small>
      </div>
      <dl className="kpi__nums">
        <div>
          <dt>Now</dt>
          <dd className="num">{fmt(kpi.value, kpi.unit)}</dd>
        </div>
        <div>
          <dt>Baseline</dt>
          <dd className="num">{fmt(kpi.baseline, kpi.unit)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd className="num">{fmt(kpi.target, kpi.unit)}</dd>
        </div>
      </dl>
    </div>
  );
}
