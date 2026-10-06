import type { Role } from "@/lib/types";

export const SCREENS = [
  { href: "/station", label: "Station", icon: "ph-monitor" },
  { href: "/shift-board", label: "Shift board", icon: "ph-squares-four" },
  { href: "/kaizen", label: "Kaizen", icon: "ph-clipboard-text" },
  { href: "/knowledge", label: "Knowledge", icon: "ph-books" },
  { href: "/metrics", label: "Metrics", icon: "ph-chart-line" },
] as const;

export const ROLES: { role: Role; label: string; home: string }[] = [
  { role: "operator", label: "Operator · st-04", home: "/station" },
  { role: "team_leader", label: "Team leader", home: "/shift-board" },
  { role: "engineer", label: "Engineer", home: "/kaizen" },
  { role: "senior_expert", label: "Senior expert", home: "/knowledge" },
  { role: "management", label: "Management", home: "/metrics" },
];
