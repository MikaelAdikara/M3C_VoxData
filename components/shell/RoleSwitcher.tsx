"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Icon } from "@/components/ui/Icon";
import { setRole } from "@/lib/actions/role";
import type { Role } from "@/lib/types";

import { ROLES } from "./nav";

/**
 * Demo role switcher (no accounts). Sets the role cookie through setRole(),
 * then opens that role's home screen. Actions are role-gated on the server.
 */
export function RoleSwitcher({ current }: { current: Role }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(role: Role) {
    setError(null);
    startTransition(async () => {
      const result = await setRole(role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const home = ROLES.find((r) => r.role === role)?.home;
      if (home) router.push(home);
      router.refresh();
    });
  }

  return (
    <label className="role" aria-busy={pending} title={error ?? undefined}>
      <Icon name="user-circle" />
      <span className="sr-only">Role</span>
      <select value={current} onChange={(e) => choose(e.target.value as Role)} disabled={pending}>
        {ROLES.map((r) => (
          <option key={r.role} value={r.role}>
            {r.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
