import { beforeEach, describe, expect, it, vi } from "vitest";

const { setCookie, revalidatePath } = vi.hoisted(() => ({
  setCookie: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: setCookie })),
}));

vi.mock("next/cache", () => ({ revalidatePath }));

import { setRole } from "@/lib/actions/role";
import { ROLE_COOKIE_NAME } from "@/lib/role-cookie";

describe("setRole", () => {
  beforeEach(() => {
    setCookie.mockReset();
    revalidatePath.mockReset();
  });

  it("stores a valid role in a protected server cookie and revalidates the shell", async () => {
    await expect(setRole("team_leader")).resolves.toEqual({ ok: true });
    expect(setCookie).toHaveBeenCalledWith(
      ROLE_COOKIE_NAME,
      "team_leader",
      expect.objectContaining({ httpOnly: true, sameSite: "strict", path: "/" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("fails safely for an invalid runtime value", async () => {
    await expect(setRole("admin" as never)).resolves.toEqual({
      ok: false,
      error: "Invalid role.",
    });
    expect(setCookie).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("keeps the server-action module limited to async action exports", async () => {
    expect(Object.keys(await import("@/lib/actions/role"))).toEqual(["setRole"]);
  });
});
