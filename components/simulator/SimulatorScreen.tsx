"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { injectFalseAlarm, injectRepeat3, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import type { ActionResult } from "@/lib/types";

type Scenario = {
  id: string;
  title: string;
  what: string;
  next: { label: string; href: string };
  icon: IconName;
  run: () => Promise<ActionResult>;
  variant?: "ghost";
};

const SCENARIOS: Scenario[] = [
  {
    id: "true",
    title: "Inject true defect",
    what: "Bead break at st-04, seam-R-door-07, score 0.83 against 0.61. Leak-critical.",
    next: { label: "Operator confirms at Station", href: "/station" },
    icon: "warning",
    run: injectTrueDefect,
  },
  {
    id: "false",
    title: "Inject false alarm",
    what: "Reflection on new grey sealer at st-02. The operator rejects it with a reason.",
    next: { label: "Open Station st-02", href: "/station?st=st-02" },
    icon: "x-circle",
    run: injectFalseAlarm,
  },
  {
    id: "repeat",
    title: "Inject repeat ×3",
    what: "Three confirmed excess-sealer alerts at st-04. The third opens a Kaizen ticket with its data.",
    next: { label: "See the ticket in Kaizen", href: "/kaizen" },
    icon: "clipboard-text",
    run: injectRepeat3,
  },
];

const STORY = [
  { time: "0:15", step: "Inject true defect, then confirm as the operator", href: "/station" },
  { time: "0:55", step: "Team leader: Stop and fix, with a note", href: "/shift-board" },
  { time: "1:20", step: "Inject repeat ×3; the ticket opens with three alerts", href: "/kaizen" },
  { time: "1:45", step: "Engineer writes the A3 and requests validation; senior expert validates", href: "/knowledge" },
  { time: "2:15", step: "Ask the assistant; see the citation and the no-card answer", href: "/knowledge" },
  { time: "2:35", step: "Gate 1 indicators", href: "/metrics" },
];

/**
 * Presenter controls for the walkthrough video. Scenarios only add
 * simulated data: every decision still needs the operator and team leader.
 */
export function SimulatorScreen() {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function fire(id: string, run: () => Promise<ActionResult>, okText: string) {
    setError(null);
    setBusy(id);
    start(async () => {
      const r = await run();
      setBusy(null);
      if (r.ok) setDone((d) => ({ ...(id === "reset" ? {} : d), [id]: okText }));
      else setError(r.error);
    });
  }

  return (
    <main className="page">
      <div className="page__head">
        <div>
          <h1 className="page__title">Demo control</h1>
          <p className="page__sub">For the presenter. Adds simulated events; people still make every decision.</p>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          <Icon name="warning-circle" weight="bold" /> {error}
        </p>
      ) : null}

      <div className="sim">
        <section className="sim__scenarios" aria-label="Scenarios">
          {SCENARIOS.map((s) => (
            <article key={s.id} className="panel sim__card">
              <div className="panel__body">
                <h2>
                  <Icon name={s.icon} weight="bold" /> {s.title}
                </h2>
                <p className="muted">{s.what}</p>
                <div className="sim__row">
                  <Button
                    onClick={() => fire(s.id, s.run, "Added")}
                    disabled={pending}
                    aria-busy={busy === s.id}
                  >
                    {busy === s.id ? "Adding…" : s.title}
                  </Button>
                  {done[s.id] ? (
                    <span className="sim__ok" role="status">
                      <Icon name="check" weight="bold" /> {done[s.id]} ·{" "}
                      <Link href={s.next.href}>{s.next.label}</Link>
                    </span>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          <article className="panel sim__card sim__reset">
            <div className="panel__body">
              <h2>
                <Icon name="arrow-counter-clockwise" weight="bold" /> Reset demo
              </h2>
              <p className="muted">Back to the seeded start: no open alert yet, st-02 over its false-alarm budget, two open tickets. Then inject the true defect.</p>
              <div className="sim__row">
                <Button variant="ghost" onClick={() => fire("reset", resetDemo, "Demo reset")} disabled={pending}>
                  {busy === "reset" ? "Resetting…" : "Reset demo"}
                </Button>
                {done.reset ? (
                  <span className="sim__ok" role="status">
                    <Icon name="check" weight="bold" /> {done.reset}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        </section>

        <section className="panel" aria-labelledby="story-title">
          <div className="panel__head">
            <h2 id="story-title">Walkthrough, 3 minutes</h2>
            <span className="muted">From docs/DEMO_SCRIPT.md</span>
          </div>
          <ol className="story">
            {STORY.map((s) => (
              <li key={s.time}>
                <span className="story__time num">{s.time}</span>
                <span>{s.step}</span>
                <Link href={s.href} aria-label={`Open for: ${s.step}`}>
                  <Icon name="arrow-right" />
                </Link>
              </li>
            ))}
          </ol>
          <p className="muted story__tip">Start every recording with Reset demo. Switch roles in the top bar.</p>
        </section>
      </div>
    </main>
  );
}
