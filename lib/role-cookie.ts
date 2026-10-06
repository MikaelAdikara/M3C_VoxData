import type { Role } from "@/lib/types";

export const ROLE_COOKIE_NAME = "learning-line-role";
export const DEFAULT_ROLE: Role = "operator";
export const ROLE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

export const ROLES: readonly Role[] = [
  "operator",
  "team_leader",
  "engineer",
  "senior_expert",
  "management",
];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.includes(value as Role);
}
