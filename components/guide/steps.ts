import type { GuideProgress } from "@/lib/guide/progress";
import type { Role } from "@/lib/types";

/** Things the server cannot see; the browser remembers them for this visitor. */
export interface GuideLocal {
  sawModel?: boolean;
  askedAssistant?: boolean;
  sawPlan?: boolean;
}

export interface GuideStep {
  id: string;
  loop: "Shift loop" | "Kaizen loop" | "Results";
  title: string;
  /** Role the step is done as; null when any role works. */
  role: Role | null;
  href: (p: GuideProgress | null) => string;
  /** Visible text of the button or field to point at on that page. */
  target?: string;
  todo: string[];
  notice: string;
  done: (p: GuideProgress | null, local: GuideLocal) => boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  operator: "Operator",
  team_leader: "Team leader",
  engineer: "Engineer",
  senior_expert: "Senior expert",
  management: "Management",
};

export const GUIDE_STEPS: GuideStep[] = [
  {
    id: "inject",
    loop: "Shift loop",
    title: "Start a defect",
    role: null,
    href: () => "/simulator",
    target: "Inject true defect",
    todo: ["Press Reset demo for a clean start.", "Press Inject true defect."],
    notice: "This plays the camera at st-04 flagging a broken bead on seam-R-door-07. Your demo is private to your browser.",
    done: (p) => Boolean(p?.defectInjected),
  },
  {
    id: "operator",
    loop: "Shift loop",
    title: "The operator confirms at the station",
    role: "operator",
    href: () => "/station?st=st-04",
    target: "Confirm defect",
    todo: ["Look at the heatmap and the score against the threshold.", "Press Confirm defect."],
    notice: "The alert reaches the station that made the defect, not final inspection. A false alarm would be rejected with a reason instead.",
    done: (p) => Boolean(p?.operatorConfirmed),
  },
  {
    id: "team_leader",
    loop: "Shift loop",
    title: "The team leader decides",
    role: "team_leader",
    href: () => "/shift-board",
    target: "Stop and fix",
    todo: ["Write a short note, for example: nozzle check.", "Press Stop and fix."],
    notice: "The system only suggests. The line stops because a person decides. Station st-02 is over its false-alarm budget and goes to model review.",
    done: (p) => Boolean(p?.teamLeaderDecided),
  },
  {
    id: "model",
    loop: "Shift loop",
    title: "See how the camera scores a bead",
    role: null,
    href: () => "/cameras/model",
    target: "Break",
    todo: ["Pick a defect type, or paint on the bead with Remove sealer.", "Watch the score and heatmap change."],
    notice: "A real anomaly model, trained only on synthetic good beads, runs in your browser. The evaluation table below it is honest about what it misses.",
    done: (_p, l) => Boolean(l.sawModel),
  },
  {
    id: "repeat",
    loop: "Kaizen loop",
    title: "A repeat opens a Kaizen ticket",
    role: null,
    href: () => "/simulator",
    target: "Inject repeat ×3",
    todo: ["Press Inject repeat ×3."],
    notice: "The third confirmed repeat of the same defect in one shift opens a ticket with its alerts attached. No one has to file it.",
    done: (p) => Boolean(p?.repeatTicketId),
  },
  {
    id: "a3",
    loop: "Kaizen loop",
    title: "The engineer drafts the A3",
    role: "engineer",
    href: (p) => `/kaizen/${p?.repeatTicketId ?? "KZ-SEAL-007"}`,
    target: "Draft",
    todo: ["Read the similar closed cases.", "Press Draft from data (Draft with Claude when the key is set)."],
    notice: "Each AI sentence cites its source and stays marked AI draft until the engineer edits or checks it. The AI never writes the countermeasure.",
    done: (p) => Boolean(p?.a3Drafted),
  },
  {
    id: "card",
    loop: "Kaizen loop",
    title: "The senior expert validates a card",
    role: "senior_expert",
    href: () => "/knowledge?card=KC-SEAL-030",
    target: "Validate card",
    todo: ["Read draft card KC-SEAL-030.", "Press Validate card."],
    notice: "Only a validated card revises the standard and is used by the assistant. Drafts and retired cards never are.",
    done: (p) => Boolean(p?.cardValidated),
  },
  {
    id: "assistant",
    loop: "Kaizen loop",
    title: "Ask the line",
    role: null,
    href: () => "/knowledge",
    target: "Describe the problem at the line",
    todo: ["Ask: Bead break near the right door after a nozzle change?", "Then ask: How do we fix paint orange peel?"],
    notice: "Answers come only from validated cards, with the card and revision cited. With no card, it says so and routes the question to the owner engineer.",
    done: (_p, l) => Boolean(l.askedAssistant),
  },
  {
    id: "plan",
    loop: "Results",
    title: "Results and the plan",
    role: "management",
    href: () => "/plan",
    todo: ["Read the four decisions and what each one must prove.", "Open Metrics for the Gate 1 indicators."],
    notice: "Every number on the plan comes from the proposal and its financial model, with the source next to it.",
    done: (_p, l) => Boolean(l.sawPlan),
  },
];
