"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import type { ActionResult, Role } from "@/lib/types";

export const ROLE_COOKIE_NAME = "learning-line-role";

const roles = new Set<Role>([
  "operator",
  "team_leader",
  "engineer",
  "senior_expert",
  "management",
]);

function refreshShell() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // The cookie result remains explicit if revalidation is unavailable.
  }
}

export async function setRole(role: Role): Promise<ActionResult> {
  if (!roles.has(role)) {
    refreshShell();
    return { ok: false, error: "Invalid role." };
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(ROLE_COOKIE_NAME, role, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 12,
    });
    refreshShell();
    return { ok: true };
  } catch {
    refreshShell();
    return { ok: false, error: "Could not update the active role." };
  }
}
