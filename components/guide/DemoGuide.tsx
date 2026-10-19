"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Icon } from "@/components/ui/Icon";
import { setRole } from "@/lib/actions/role";
import type { GuideProgress } from "@/lib/guide/progress";

import { GUIDE_STEPS, ROLE_LABEL, type GuideLocal } from "./steps";

const KEY = "learning-line-guide-v1";

interface Saved {
  open: boolean;
  step: number;
  seen: boolean;
  local: GuideLocal;
}

function load(): Saved | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(s: Saved) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private window or blocked storage: the guide still works for this page view
  }
}

const pathOf = (href: string) => href.split("?")[0];

/** Find the control a step points at by its visible text, placeholder or label. */
function findTarget(text: string): HTMLElement | null {
  const main = document.querySelector("main") ?? document.body;
  const byPlaceholder = main.querySelector<HTMLElement>(`[placeholder="${CSS.escape(text)}"]`);
  if (byPlaceholder) return byPlaceholder;
  const candidates = main.querySelectorAll<HTMLElement>("button, a, label");
  let best: HTMLElement | null = null;
  for (const el of candidates) {
    const t = el.textContent?.replace(/\s+/g, " ").trim() ?? "";
    if (!t || el.closest(".guide")) continue;
    if (t === text) return el;
    if (!best && t.startsWith(text)) best = el;
  }
  return best;
}

/**
 * Guided demo: nine steps through the Shift loop, the Kaizen loop and the plan. Each step says
 * who acts, what to press and what to notice, and ticks itself off from the visitor's own demo
 * state. It never acts for the visitor: every decision is still a button the visitor presses.
 */
export function DemoGuide() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<Saved>({ open: false, step: 0, seen: false, local: {} });
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<GuideProgress | null>(null);
  const [pending, start] = useTransition();
  const [listOpen, setListOpen] = useState(false);
  const highlighted = useRef<HTMLElement | null>(null);

  const update = useCallback((patch: Partial<Saved> | ((s: Saved) => Partial<Saved>)) => {
    setState((s) => {
      const next = { ...s, ...(typeof patch === "function" ? patch(s) : patch) };
      save(next);
      return next;
    });
  }, []);

  // restore, or open on the first visit / when the cover's "guided demo" link is used
  useEffect(() => {
    const saved = load();
    const startNow = params.get("guide") === "start";
    const base: Saved = saved ?? { open: true, step: 0, seen: false, local: {} };
    const next = startNow ? { ...base, open: true, seen: true, step: 0 } : base;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from browser storage
    setState(next);
    save(next);
    setReady(true);
  }, [params]);

  const fetchProgress = useCallback(async () => {
    try {
      const res = await fetch("/api/guide", { cache: "no-store" });
      if (res.ok) setProgress((await res.json()) as GuideProgress);
    } catch {
      // offline: keep the last known progress
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh on navigation
    void fetchProgress();
    if (path === "/cameras/model") update((s) => ({ local: { ...s.local, sawModel: true } }));
    if (path === "/plan") update((s) => ({ local: { ...s.local, sawPlan: true } }));
  }, [path, ready, fetchProgress, update]);

  useEffect(() => {
    if (!ready || !state.open) return;
    const id = window.setInterval(fetchProgress, 2500);
    return () => window.clearInterval(id);
  }, [ready, state.open, fetchProgress]);

  useEffect(() => {
    const onAsk = () => update((s) => ({ local: { ...s.local, askedAssistant: true } }));
    window.addEventListener("learning-line:assistant-answered", onAsk);
    return () => window.removeEventListener("learning-line:assistant-answered", onAsk);
  }, [update]);

  const step = GUIDE_STEPS[Math.min(state.step, GUIDE_STEPS.length - 1)];
  const href = step.href(progress);
  const onPage = path === pathOf(href);
  const done = step.done(progress, state.local);
  const doneCount = GUIDE_STEPS.filter((s) => s.done(progress, state.local)).length;
  const wrongRole = Boolean(step.role && progress && progress.role !== step.role);

  // point at the control this step needs, on the page where it lives
  useEffect(() => {
    highlighted.current?.classList.remove("guide-target");
    highlighted.current = null;
    if (!ready || !state.open || !state.seen || !onPage || done || !step.target) return;
    const mark = () => {
      const el = findTarget(step.target!);
      if (el && el !== highlighted.current) {
        highlighted.current?.classList.remove("guide-target");
        el.classList.add("guide-target");
        highlighted.current = el;
      }
    };
    mark();
    const id = window.setInterval(mark, 1000);
    return () => {
      window.clearInterval(id);
      highlighted.current?.classList.remove("guide-target");
    };
  }, [ready, state.open, state.seen, onPage, done, step, path]);

  function go() {
    start(async () => {
      if (step.role && progress?.role !== step.role) await setRole(step.role);
      if (!onPage || href !== `${path}${window.location.search}`) router.push(href);
      else router.refresh();
      await fetchProgress();
      window.setTimeout(() => highlighted.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 600);
    });
  }

  function actAs() {
    if (!step.role) return;
    start(async () => {
      await setRole(step.role!);
      router.refresh();
      await fetchProgress();
    });
  }

  if (!ready || path === "/") return null;

  if (!state.open) {
    return (
      <button type="button" className="guide-pill" onClick={() => update({ open: true })} aria-label={`Open guided demo, ${doneCount} of ${GUIDE_STEPS.length} steps done`}>
        <Icon name="flag" weight="bold" />
        <span>Guided demo</span>
        <span className="num">{doneCount}/{GUIDE_STEPS.length}</span>
      </button>
    );
  }

  if (!state.seen) {
    return (
      <aside className="guide guide--welcome" aria-label="Guided demo">
        <p className="guide__eyebrow">New here?</p>
        <h2 className="guide__title">Take the 4-minute guided demo</h2>
        <p className="guide__text">
          Follow one sealer defect from the camera to a revised standard. Each step says who acts, what to press and what to notice. You press every button yourself; the demo is private to your browser.
        </p>
        <div className="guide__actions">
          <button type="button" className="btn" onClick={() => update({ seen: true, step: 0 })}>
            <Icon name="play" weight="bold" /> Start
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => update({ seen: true, open: false })}>
            Explore on my own
          </button>
        </div>
      </aside>
    );
  }

  return (
    <aside className="guide" aria-label="Guided demo">
      <div className="guide__head">
        <span className="guide__eyebrow">
          {step.loop} · step <span className="num">{state.step + 1}</span> of <span className="num">{GUIDE_STEPS.length}</span>
        </span>
        <button type="button" className="guide__icon" aria-label="Minimise guided demo" onClick={() => update({ open: false })}>
          <Icon name="x" weight="bold" />
        </button>
      </div>
      <div className="guide__bar" aria-hidden="true">
        {GUIDE_STEPS.map((s, i) => (
          <span key={s.id} data-state={s.done(progress, state.local) ? "done" : i === state.step ? "now" : undefined} />
        ))}
      </div>

      <h2 className="guide__title">{step.title}</h2>
      {step.role ? (
        <p className="guide__role">
          As <strong>{ROLE_LABEL[step.role]}</strong>
          {wrongRole ? (
            <>
              {" "}· you are {ROLE_LABEL[progress!.role].toLowerCase()} now{" "}
              <button type="button" className="guide__link" onClick={actAs} disabled={pending}>
                switch
              </button>
            </>
          ) : null}
        </p>
      ) : null}

      {done ? (
        <p className="guide__done" role="status">
          <Icon name="check-circle" weight="fill" /> Done. {step.notice}
        </p>
      ) : (
        <>
          <ol className="guide__todo">
            {step.todo.map((t) => <li key={t}>{t}</li>)}
          </ol>
          <p className="guide__notice"><strong>Notice:</strong> {step.notice}</p>
        </>
      )}

      <div className="guide__actions">
        {done ? (
          state.step < GUIDE_STEPS.length - 1 ? (
            <button type="button" className="btn" onClick={() => update({ step: state.step + 1 })}>
              Next step <Icon name="arrow-right" weight="bold" />
            </button>
          ) : (
            <p className="guide__end">That is the whole story. Explore any screen freely, or restart from step 1.</p>
          )
        ) : onPage && !wrongRole ? (
          <button type="button" className="btn btn--ghost" onClick={() => highlighted.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <Icon name="hand-pointing" weight="bold" /> Show me where
          </button>
        ) : (
          <button type="button" className="btn" onClick={go} disabled={pending}>
            {pending ? "Opening…" : wrongRole ? `Act as ${ROLE_LABEL[step.role!].toLowerCase()} and go` : "Take me there"} <Icon name="arrow-right" weight="bold" />
          </button>
        )}
        <div className="guide__nav">
          <button type="button" className="guide__icon" aria-label="Previous step" disabled={state.step === 0} onClick={() => update({ step: state.step - 1 })}>
            <span className="flip"><Icon name="arrow-right" weight="bold" /></span>
          </button>
          <button type="button" className="guide__icon" aria-label="Next step" disabled={state.step === GUIDE_STEPS.length - 1} onClick={() => update({ step: state.step + 1 })}>
            <Icon name="arrow-right" weight="bold" />
          </button>
        </div>
      </div>

      <details className="guide__all" open={listOpen} onToggle={(e) => setListOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{`All steps · ${doneCount} of ${GUIDE_STEPS.length} done`}</summary>
        <ol>
          {GUIDE_STEPS.map((s, i) => (
            <li key={s.id} data-done={s.done(progress, state.local) || undefined} aria-current={i === state.step ? "step" : undefined}>
              <button type="button" onClick={() => update({ step: i })}>
                <Icon name={s.done(progress, state.local) ? "check-circle" : "flag"} weight={s.done(progress, state.local) ? "fill" : "regular"} />
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <button type="button" className="guide__link" onClick={() => update({ step: 0, local: {} })}>Restart the guide</button>
      </details>
    </aside>
  );
}
