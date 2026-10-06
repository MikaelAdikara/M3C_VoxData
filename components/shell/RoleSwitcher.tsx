"use client";

import { usePathname, useRouter } from "next/navigation";

import type { Role } from "@/lib/types";

import { ROLES } from "./nav";

/**
 * Demo role switcher (no accounts). The active role follows the screen, and
 * choosing a role opens that role's home screen.
 *
 * Calling setRole() from lib/actions/role.ts is blocked until BE fixes the
 * non-function export in that "use server" file (COLLAB.md §6, request UI-0).
 */
export function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const current: Role =
    ROLES.find((r) => pathname === r.home || pathname.startsWith(`${r.home}/`))?.role ?? "operator";

  return (
    <label className="role">
      <i className="ph ph-user-circle" aria-hidden="true" />
      <span className="sr-only">Role</span>
      <select
        value={current}
        onChange={(e) => {
          const home = ROLES.find((r) => r.role === e.target.value)?.home;
          if (home) router.push(home);
        }}
      >
        {ROLES.map((r) => (
          <option key={r.role} value={r.role}>
            {r.label}
          </option>
        ))}
      </select>
    </label>
  );
}
