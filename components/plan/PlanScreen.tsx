import Link from "next/link";

import { Icon } from "@/components/ui/Icon";
import { Prov } from "@/components/ui/Prov";
import {
  CUMULATIVE_CASH,
  DECISIONS,
  HEADLINE,
  KPIS,
  LEVERS,
  PHASES,
  PLAN_SOURCE,
  QUARTERS,
} from "@/lib/plan/plan-data";

const qIndex = (q: string) => QUARTERS.indexOf(q as (typeof QUARTERS)[number]);

/** Phases and decisions on one quarter axis, Q4 2026 to Q4 2030. */
function Timeline() {
  const first = qIndex("Q4 2026");
  const n = QUARTERS.length - first;
  const W = 960;
  const L = 150;
  const R = 16;
  const col = (W - L - R) / n;
  const x = (q: string) => L + (qIndex(q) - first) * col;
  const years = ["2027", "2028", "2029", "2030"];
  return (
    <svg className="chart plan-timeline" viewBox={`0 0 ${W} 250`} role="img" aria-label="Timeline: Phase 1 Prove Q4 2026 to Q4 2027, Phase 2 Standardise 2028 to mid 2029, Phase 3 Scale mid 2029 to 2030. Decisions: first release Q4 2026, Checkpoint 0 end Feb 2027, Gate 1 early Dec 2027, Gate 2 mid 2029.">
      {years.map((y) => (
        <g key={y}>
          <line className="c-grid" x1={x(`Q1 ${y}`)} x2={x(`Q1 ${y}`)} y1={18} y2={232} />
          <text x={x(`Q1 ${y}`) + 4} y={14} className="lbl-soft">{y}</text>
        </g>
      ))}
      <text x={L - 10} y={14} textAnchor="end" className="lbl-soft">2026</text>
      {PHASES.map((p, i) => {
        const y = 36 + i * 46;
        const x0 = x(p.start);
        const x1 = x(p.end) + col;
        return (
          <g key={p.id}>
            <text x={0} y={y + 20} className="lbl">{p.name.split(" · ")[1]}</text>
            <text x={0} y={y + 36} className="lbl-soft">Rp{p.investment} bn</text>
            <rect className={i === 0 ? "plan-bar plan-bar--now" : "plan-bar"} x={x0 + 2} y={y + 4} width={x1 - x0 - 4} height={28} rx={4} />
            <text x={x0 + 10} y={y + 23} className="plan-bar__txt">{p.start} – {p.end}</text>
          </g>
        );
      })}
      <text x={0} y={200} className="lbl">Decisions</text>
      {DECISIONS.map((d, i) => {
        const cx = x(d.quarter) + col * (d.when.startsWith("End Feb") ? 0.66 : d.when.startsWith("Early Dec") ? 0.7 : d.when.startsWith("Mid") ? 0.99 : 0.5);
        return (
          <g key={d.name}>
            <line className="c-ref" x1={cx} x2={cx} y1={30} y2={190} strokeDasharray="4 4" />
            <rect x={cx - 7} y={189} width={14} height={14} transform={`rotate(45 ${cx} 196)`} className="plan-diamond" />
            <text x={cx} y={226 + (i % 2) * 0} textAnchor={i === 0 ? "start" : "middle"} dx={i === 0 ? -6 : 0} className="lbl-ref">{d.name}</text>
            <text x={cx} y={242} textAnchor={i === 0 ? "start" : "middle"} dx={i === 0 ? -6 : 0} className="lbl-soft">{d.when}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Cumulative net cash by quarter, one axis in Rp bn. */
function CashChart() {
  const W = 960;
  const H = 270;
  const L = 52;
  const R = 16;
  const T = 26;
  const B = 40;
  const min = -32;
  const max = 4;
  const n = QUARTERS.length;
  const x = (i: number) => L + (i + 0.5) * ((W - L - R) / n);
  const y = (v: number) => T + ((max - v) / (max - min)) * (H - T - B);
  const pts = CUMULATIVE_CASH.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`;
  const minV = Math.min(...CUMULATIVE_CASH);
  const minI = CUMULATIVE_CASH.indexOf(minV);
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Cumulative net cash falls to minus Rp${(-minV).toFixed(1)} billion in ${QUARTERS[minI]} and recovers to minus Rp${(-CUMULATIVE_CASH[n - 1]).toFixed(1)} billion by Q4 2030; it turns positive in 2031.`}>
      {[0, -10, -20, -30].map((v) => (
        <g key={v}>
          <line className={v === 0 ? "c-ref" : "c-grid"} x1={L} x2={W - R} y1={y(v)} y2={y(v)} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="lbl-soft">{v}</text>
        </g>
      ))}
      <polygon points={area} className="plan-area" />
      <polyline points={pts} className="plan-line" />
      {CUMULATIVE_CASH.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === minI ? 5 : 3} className={i === minI ? "plan-dot plan-dot--min" : "plan-dot"} />
      ))}
      <text x={x(minI)} y={y(minV) + 22} textAnchor="middle" className="lbl">Peak need Rp{(-minV).toFixed(1)} bn</text>
      {QUARTERS.map((q, i) => (q.startsWith("Q1") ? <text key={q} x={x(i)} y={H - 14} textAnchor="middle" className="lbl-soft">{q.slice(3)}</text> : null))}
      {DECISIONS.slice(1).map((d) => {
        const i = qIndex(d.quarter);
        return (
          <g key={d.name}>
            <line className="c-ref" x1={x(i)} x2={x(i)} y1={T - 6} y2={H - B} strokeDasharray="3 4" strokeWidth={1} />
            <text x={x(i) + 4} y={T + 2} className="lbl-ref">{d.name}</text>
          </g>
        );
      })}
      <text x={L} y={12} className="lbl-soft">Rp bn, cumulative</text>
    </svg>
  );
}

export function PlanScreen() {
  const totalLevers = LEVERS.reduce((s, l) => s + l.value, 0);
  return (
    <main className="page plan">
      <div className="page__head">
        <div>
          <h1 className="page__title">Implementation plan · 2026–2030</h1>
          <p className="page__sub">
            How this prototype becomes a programme at TMMIN Karawang: three phases, four decisions that release the money, and the KPIs each one is judged on.
          </p>
        </div>
        <Prov p="projection" label={PLAN_SOURCE} />
      </div>

      <section className="plan-tiles" aria-label="Financial case">
        {HEADLINE.map((h) => (
          <div key={h.label} className="plan-tile">
            <span>{h.label}</span>
            <b className="num">{h.value}</b>
            <small>{h.note}</small>
          </div>
        ))}
      </section>

      <section className="panel plan-sec" aria-labelledby="tl-h">
        <div className="panel__head">
          <h2 id="tl-h">Phase 1 is specified in full; Phases 2 and 3 open only after a passed gate</h2>
        </div>
        <div className="panel__body"><Timeline /></div>
      </section>

      <section className="plan-sec" aria-labelledby="dec-h">
        <h2 id="dec-h" className="plan-h2">Four decisions release the money, cheapest exit first</h2>
        <ol className="plan-decisions">
          {DECISIONS.map((d) => (
            <li key={d.name} className="panel">
              <div className="panel__body">
                <p className="plan-when">{d.when}</p>
                <h3>{d.name}</h3>
                <dl>
                  <dt>Spent before it</dt>
                  <dd className="num">{d.spendBefore}</dd>
                  <dt>Must be true</dt>
                  <dd>{d.mustBeTrue}</dd>
                  <dt>If not</dt>
                  <dd>{d.ifNot}</dd>
                </dl>
                {d.proof ? (
                  <Link className="plan-link" href={d.proof.href}>
                    {d.proof.label} <Icon name="arrow-right" weight="bold" />
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="panel plan-sec" aria-labelledby="cash-h">
        <div className="panel__head">
          <h2 id="cash-h">Cash need peaks in Q1 2029, during the Phase 2 build; cumulative cash turns positive in 2031</h2>
          <Prov p="projection" label="financial model, pre-tax" />
        </div>
        <div className="panel__body">
          <CashChart />
          <p className="muted plan-note">Cumulative benefits minus investment and programme opex. Staging keeps exposure at Rp5.4 bn before the camera is proven and Rp14.5 bn before Gate 1.</p>
        </div>
      </section>

      <section className="panel plan-sec" aria-labelledby="ph-h">
        <div className="panel__head"><h2 id="ph-h">What each phase does and how it is tested</h2></div>
        <div className="panel__body plan-phases">
          {PHASES.map((p) => (
            <article key={p.id}>
              <h3>{p.name}</h3>
              <p className="muted num">{p.start} to {p.end} · Rp{p.investment} bn ({p.investmentNote})</p>
              <p>{p.objective}</p>
              <p><strong>Milestones.</strong> {p.milestones}</p>
              <p><strong>Test.</strong> {p.test}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel plan-sec" aria-labelledby="kpi-h">
        <div className="panel__head">
          <h2 id="kpi-h">KPI targets, owners and where this demo shows them</h2>
          <span className="plan-provs"><Prov p="case_data" label="2025 baseline" /> <Prov p="target" label="2028, 2030" /></span>
        </div>
        <div className="table-wrap">
          <table className="table plan-table">
            <thead>
              <tr>
                <th scope="col">KPI</th>
                <th scope="col" className="r">2025</th>
                <th scope="col" className="r">2028</th>
                <th scope="col" className="r">2030</th>
                <th scope="col">Owner · reviewed</th>
                <th scope="col">In this demo</th>
              </tr>
            </thead>
            <tbody>
              {KPIS.map((k) => (
                <tr key={k.kpi}>
                  <td>{k.kpi}</td>
                  <td className="r num">{k.y2025}</td>
                  <td className="r num">{k.y2028}</td>
                  <td className="r num"><strong>{k.y2030}</strong></td>
                  <td className="muted">{k.owner} · {k.rhythm}</td>
                  <td>{k.demo ? <Link className="plan-link" href={k.demo.href}>{k.demo.label}</Link> : <span className="muted">Pilot only</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel plan-sec" aria-labelledby="lev-h">
        <div className="panel__head">
          <h2 id="lev-h">Every lever can fall far below plan before the NPV turns negative</h2>
          <Prov p="projection" label="2030 run-rate, Rp bn" />
        </div>
        <div className="table-wrap">
          <table className="table plan-table">
            <thead>
              <tr>
                <th scope="col">Lever (loop)</th>
                <th scope="col" className="r">Rp bn</th>
                <th scope="col">Published anchor and how much we use</th>
                <th scope="col">NPV turns zero at</th>
              </tr>
            </thead>
            <tbody>
              {LEVERS.map((l) => (
                <tr key={l.lever}>
                  <td><strong>{l.lever}</strong> <span className="muted">({l.loop})</span></td>
                  <td className="r num">{l.value.toFixed(1)}</td>
                  <td>{l.anchor}</td>
                  <td>{l.breakEven}</td>
                </tr>
              ))}
              <tr>
                <td><strong>Gross benefit 2030</strong></td>
                <td className="r num"><strong>{totalLevers.toFixed(1)}</strong></td>
                <td>Rp26.5 bn after programme opex of Rp8.6 bn</td>
                <td>All benefits at 73% of plan</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="plan-sec plan-proof" aria-labelledby="proof-h">
        <h2 id="proof-h" className="plan-h2">What this prototype proves today, and what only the pilot can</h2>
        <div className="plan-proof__cols">
          <div className="panel">
            <div className="panel__body">
              <h3><Icon name="check-circle" weight="fill" /> Shown in this prototype</h3>
              <ul>
                <li>Who decides at each step: no code path stops the line or validates a card without a person. <Link href="/shift-board">Shift board</Link></li>
                <li>How the camera threshold is set from the false-alarm budget, and measured: 0.96 false alarms per station per shift on synthetic beads. <Link href="/cameras/model">Camera model</Link></li>
                <li>The same method on real Renault production images (AutoVI): image AUROC 0.71–0.94 with PatchCore-like settings (0.68–0.84 with the sealer-bead settings), but at a strict threshold only 0–5% of defects are caught. <Link href="/cameras/model#autovi">Results</Link></li>
                <li>The assistant cites only validated cards: 17 of 17 citations valid and 10 of 10 correct refusals with Claude. <Link href="/knowledge">Knowledge</Link></li>
              </ul>
            </div>
          </div>
          <div className="panel">
            <div className="panel__body">
              <h3><Icon name="flag" weight="fill" /> Only the pilot can prove</h3>
              <ul>
                <li>Detection on TMMIN&apos;s own sealer beads: Checkpoint 0 collects at least 2,400 good images per seam region before any threshold is trusted.</li>
                <li>Operator trust (≥75% say the tool helps) and override below 20% at Gate 1.</li>
                <li>Scrap −30% on targeted defects, booked by finance against Karawang I.</li>
                <li>How much freed operator time becomes cash: the 70% cash share has no published anchor.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
