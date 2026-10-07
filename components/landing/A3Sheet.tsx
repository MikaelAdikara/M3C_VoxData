import Link from "next/link";

import { Icon } from "@/components/ui/Icon";

/* Facts below come from the Executive Summary and docs/SEED_DATA.md. */
const BACKGROUND = [
  { label: "Conversion cost index, 2025", note: "2023 = 100; new entrants at 89", value: "106" },
  { label: "Cost gap to new entrants", note: "Up from 6.4% in 2023", value: "19.1%" },
  { label: "Electrified share of volume", note: "Case scenarios, 2026 to 2030", value: "30% to 55-70%" },
];
const CONDITION = [
  { label: "Scrap index", note: "Casebook Exhibit 4", value: "108" },
  { label: "Unplanned downtime index", value: "111" },
  { label: "Operators often overriding alerts", note: "Casebook survey", value: "31%" },
  { label: "Critical know-how documented", value: "33%" },
  { label: "Engineer hours on routine support", value: "65%" },
  { label: "Months to prepare a new variant", value: "9" },
];
const ROOT = [
  ["RC1", "Defects are found late, far from the station that made them."],
  ["RC2", "Know-how and engineer time are locked in firefighting."],
  ["RC3", "Every new variant needs new point-to-point connections."],
  ["RC4", "Flow between stations is not synchronised."],
];
const CHECK = [
  { label: "False alarms per station per shift", value: "≤ 2" },
  { label: "Operators often overriding alerts", note: "From 31%", value: "< 20%" },
  { label: "Seeded limit samples detected", note: "Per defect type", value: "59" },
  { label: "Pilot operators saying the tool helps", note: "From 54%", value: "≥ 75%" },
];

function Rows({ items }: { items: { label: string; note?: string; value: string }[] }) {
  return (
    <ul className="rows">
      {items.map((r) => (
        <li key={r.label}>
          <span>
            {r.label}
            {r.note ? <small>{r.note}</small> : null}
          </span>
          <b>{r.value}</b>
        </li>
      ))}
    </ul>
  );
}

/** The whole case on one A3 sheet, kept behind a fold on the cover page. */
export function A3Sheet() {
  return (
    <article className="a3sheet">
      <div className="a3sheet__title">
        <strong>Turn every abnormality at Karawang into a reusable standard</strong>
        <span>
          Scope <b>K2-Body, sealer pilot</b>
        </span>
        <span>
          Horizon <b>2026 to 2030</b>
        </span>
        <span>
          Owner <b>TMMIN Karawang, body line</b>
        </span>
      </div>
      <div className="a3sheet__grid">
        <div className="a3sheet__col">
          <section className="block">
            <h3>Background</h3>
            <p>TMMIN is losing cost ground every year, just as line changes multiply.</p>
            <Rows items={BACKGROUND} />
          </section>
          <section className="block">
            <h3>Current condition</h3>
            <Rows items={CONDITION} />
          </section>
          <section className="block">
            <h3>Root cause</h3>
            <p className="lead">The plant learns more slowly than its mix is changing.</p>
            <ul className="rows rows--rc">
              {ROOT.map(([id, text]) => (
                <li key={id}>
                  <b>{id}</b>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <div className="a3sheet__col">
          <section className="block">
            <h3>
              Countermeasure <small>The Learning Line</small>
            </h3>
            <p>
              Toyota&apos;s jidoka extended with AI: three loops on one data foundation. AI detects and drafts;
              operators, team leaders and engineers decide.
            </p>
            <div className="loops">
              <div className="loop-step" data-l="S">
                <h4>Shift loop</h4>
                <span className="when">Minutes</span>
                <p>The alert returns to the station that made the defect. The operator confirms; the team leader decides.</p>
              </div>
              <div className="loop-step" data-l="K">
                <h4>Kaizen loop</h4>
                <span className="when">Weeks</span>
                <p>A third repeat opens a ticket. The engineer writes the A3; the fix becomes a validated card.</p>
              </div>
              <div className="loop-step" data-l="L">
                <h4>Launch loop</h4>
                <span className="when">Per variant</span>
                <p>One interface standard lets each new variant reuse validated standards.</p>
              </div>
            </div>
            <figure className="shots">
              <Link href="/station">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/screen-station.jpg" alt="Station screen: bead break at st-04 with Confirm defect and Reject buttons" loading="lazy" />
              </Link>
              <Link href="/shift-board">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/screen-shift-board.jpg" alt="Shift board: yellow andon and the team leader decision panel" loading="lazy" />
              </Link>
              <Link href="/knowledge">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/landing/screen-knowledge.jpg" alt="Knowledge cards with validation and the assistant" loading="lazy" />
              </Link>
              <figcaption>Screens from the prototype. Simulated data.</figcaption>
            </figure>
            <div className="never">
              <ul className="rows">
                <li>
                  <span className="never__tile never__tile--stop">
                    <Icon name="hand-palm" weight="fill" />
                  </span>
                  <span>Never stops the line by itself. The team leader decides.</span>
                </li>
                <li>
                  <span className="never__tile never__tile--caution">
                    <Icon name="warning" weight="fill" />
                  </span>
                  <span>Never hides a confirmed defect. The false-alarm budget only flags a station for model review.</span>
                </li>
                <li>
                  <span className="never__tile never__tile--safe">
                    <Icon name="seal-check" weight="fill" />
                  </span>
                  <span>Never answers without a validated card, and always cites it.</span>
                </li>
              </ul>
            </div>
          </section>
          <section className="block">
            <h3>
              Check <small>Gate 1 indicators</small>
            </h3>
            <Rows items={CHECK} />
          </section>
          <section className="block">
            <h3>Standardise</h3>
            <ul className="rows">
              <li className="wide">
                <span>
                  A working countermeasure revises standardized work or the QC process chart, then yokoten carries it
                  to every station running the same process.
                </span>
              </li>
              <li>
                <span>
                  Time to introduce a new variant by 2030<small>From 9 months</small>
                </span>
                <b>~5 months</b>
              </li>
              <li>
                <span>
                  Engineer time for improvement by 2030<small>From 25%</small>
                </span>
                <b>45%</b>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </article>
  );
}
