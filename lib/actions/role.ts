"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import {
  isRole,
  ROLE_COOKIE_MAX_AGE_SECONDS,
  ROLE_COOKIE_NAME,
} from "@/lib/role-cookie";
import type { ActionResult, Role } from "@/lib/types";

function refreshShell() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // The cookie result remains explicit if revalidation is unavailable.
  }
}

export async function setRole(role: Role): Promise<ActionResult> {
  if (!isRole(role)) {
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
      maxAge: ROLE_COOKIE_MAX_AGE_SECONDS,
    });
    refreshShell();
    return { ok: true };
  } catch {
    refreshShell();
    return { ok: false, error: "Could not update the active role." };
  }
}
