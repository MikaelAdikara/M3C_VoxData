"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { setRole } from "@/lib/actions/role";
import type { Role } from "@/lib/types";

const LABEL: Record<Role, string> = {
  operator: "operator",
  team_leader: "team leader",
  engineer: "engineer",
  senior_expert: "senior expert",
  management: "management",
};

/**
 * Shown when the active demo role cannot take this screen's decisions.
 * The server still enforces the role; this only explains and offers a switch.
 */
export function RoleGate({ need, current, children }: { need: Role; current: Role; children: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (need === current) return null;

  return (
    <div className="role-gate" role="note">
      <Icon name="info" />
      <p>
        You are viewing as <strong>{LABEL[current]}</strong>. {children}
      </p>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await setRole(need);
            if (r.ok) router.refresh();
          })
        }
      >
        Act as {LABEL[need]}
      </Button>
    </div>
  );
}
