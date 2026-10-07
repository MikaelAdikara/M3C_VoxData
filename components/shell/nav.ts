import type { IconName } from "@/components/ui/Icon";
import type { Role } from "@/lib/types";

export const SCREENS: { href: string; label: string; icon: IconName }[] = [
  { href: "/station", label: "Station", icon: "monitor" },
  { href: "/shift-board", label: "Shift board", icon: "squares-four" },
  { href: "/cameras", label: "Cameras", icon: "video-camera" },
  { href: "/kaizen", label: "Kaizen", icon: "clipboard-text" },
  { href: "/knowledge", label: "Knowledge", icon: "books" },
  { href: "/metrics", label: "Metrics", icon: "chart-line" },
];

export const ROLES: { role: Role; label: string; home: string }[] = [
  { role: "operator", label: "Operator · st-04", home: "/station" },
  { role: "team_leader", label: "Team leader", home: "/shift-board" },
  { role: "engineer", label: "Engineer", home: "/kaizen" },
  { role: "senior_expert", label: "Senior expert", home: "/knowledge" },
  { role: "management", label: "Management", home: "/metrics" },
];
