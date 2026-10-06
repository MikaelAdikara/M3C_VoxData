export type TrailStep = "detected" | "operator" | "team_leader" | "kaizen" | "card" | "done";

const STEPS: { id: Exclude<TrailStep, "done">; step: string; who: string; icon: string; pending?: boolean }[] = [
  { id: "detected", step: "Detected", who: "Camera flags the bead", icon: "ph-camera" },
  { id: "operator", step: "Operator", who: "Confirms at the station", icon: "ph-hand-pointing", pending: true },
  { id: "team_leader", step: "Team leader", who: "Stop, contain or continue", icon: "ph-users-three", pending: true },
  { id: "kaizen", step: "Kaizen ticket", who: "Engineer writes the A3", icon: "ph-clipboard-text" },
  { id: "card", step: "Validated card", who: "Senior expert validates", icon: "ph-seal-check" },
];

/**
 * The abnormality trail: where one case stands and who decides next.
 * Yellow only marks a pending operator or team-leader decision.
 */
export function Trail({ current, label }: { current: TrailStep; label: string }) {
  const idx = current === "done" ? STEPS.length : STEPS.findIndex((s) => s.id === current);
  return (
    <nav className="trail" aria-label={label}>
      <ol>
        {STEPS.map((s, i) => {
          const state = i < idx ? "done" : i === idx ? "now" : "next";
          return (
            <li
              key={s.id}
              data-state={state}
              data-tone={state === "now" && s.pending ? "caution" : undefined}
              aria-current={state === "now" ? "step" : undefined}
            >
              <span className="trail__dot">
                <i className={`ph-bold ${state === "done" ? "ph-check" : s.icon}`} aria-hidden="true" />
              </span>
              <span className="trail__text">
                <span className="trail__step">{s.step}</span>
                <span className="trail__who">{s.who}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
