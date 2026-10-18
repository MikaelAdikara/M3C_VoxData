import { beforeEach, describe, expect, it, vi } from "vitest";

// A fake browser: every cookies() call is a new request that sends back whatever the
// previous responses set, so each read goes through the encoded cookie.
const browser = vi.hoisted(() => ({ jar: new Map<string, string>(), role: "operator" }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      if (name === "learning-line-role") return { value: browser.role };
      const value = browser.jar.get(name);
      return value === undefined ? undefined : { value };
    },
    has: (name: string) => browser.jar.has(name),
    set: (name: string, value: string) => void browser.jar.set(name, value),
    delete: (name: string) => void browser.jar.delete(name),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { confirmAlert } from "@/lib/actions/alerts";
import { advanceTicket, requestValidation, updateA3 } from "@/lib/actions/kaizen";
import { validateCard } from "@/lib/actions/knowledge";
import { decideShift, restartLine } from "@/lib/actions/shift";
import { injectFalseAlarm, injectRepeat3, injectTrueDefect, resetDemo } from "@/lib/actions/simulator";
import { getShiftBoardView, getSimulatorView, getStationView, getTicketView } from "@/lib/queries";
import { getStore, getStoreBackend } from "@/lib/store";
import { SESSION_COOKIE_PREFIX } from "@/lib/store/cookie-session";
import { createSeedData } from "@/lib/seed";
import { normalizeSnapshot } from "@/lib/store/normalize";
import { applyPatch, diffSnapshot, encodePatch, seedFingerprint } from "@/lib/store/session-patch";

const sessionCookieLength = () =>
  [...browser.jar.entries()].filter(([name]) => name.startsWith(SESSION_COOKIE_PREFIX)).reduce((sum, [, value]) => sum + value.length, 0);

describe("cookie session store", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    process.env.LEARNING_LINE_STORE = "session";
    browser.jar.clear();
    browser.role = "operator";
  });

  it("is selected on Vercel without a database", () => {
    delete process.env.LEARNING_LINE_STORE;
    process.env.VERCEL = "1";
    expect(getStoreBackend()).toBe("session");
    delete process.env.VERCEL;
    expect(getStoreBackend()).toBe("memory");
  });

  it("keeps the full walkthrough across requests in a few kilobytes of cookies", async () => {
    const initial = await getSimulatorView();
    expect(initial.isCanonicalReset).toBe(true);

    expect(await injectTrueDefect()).toEqual({ ok: true });
    expect((await getStationView("st-04"))?.openAlert).toMatchObject({ id: "alert-st04-open-001", anomalyScore: 0.83 });
    expect(await confirmAlert("alert-st04-open-001")).toEqual({ ok: true });
    browser.role = "team_leader";
    expect(await decideShift("alert-st04-open-001", "stop_fix", "Nozzle check")).toEqual({ ok: true });
    expect((await getShiftBoardView()).pendingDecisions.map((a) => a.id)).not.toContain("alert-st04-open-001");
    expect(await restartLine("Nozzle repaired; bead rechecked")).toEqual({ ok: true });
    expect(await injectFalseAlarm()).toEqual({ ok: true });
    expect(await injectRepeat3()).toEqual({ ok: true });

    const ticket = (await getStore().getSnapshot()).tickets.find((t) => t.stationId === "st-04" && t.defectTypeId === "BEAD_EXCESS" && t.status === "open");
    expect(ticket).toBeDefined();
    browser.role = "engineer";
    expect(await advanceTicket(ticket!.id)).toEqual({ ok: true });
    expect(await updateA3(ticket!.id, {
      rootCause: "Flow setpoint remains high at the corner.",
      countermeasure: "Pair corner speed with approved flow.",
      check: "Trial body meets bead profile.",
      standardise: "Revise corner flow recipe.",
    })).toEqual({ ok: true });
    expect(await advanceTicket(ticket!.id)).toEqual({ ok: true });
    expect(await requestValidation(ticket!.id)).toEqual({ ok: true });
    const draftId = (await getTicketView(ticket!.id))?.validation.draftCardId;
    browser.role = "senior_expert";
    expect(await validateCard(draftId!)).toEqual({ ok: true });
    expect((await getStore().getSnapshot()).cards.some((card) => card.id === draftId && card.status === "validated")).toBe(true);

    expect(sessionCookieLength()).toBeGreaterThan(0);
    expect(sessionCookieLength()).toBeLessThan(3_800);

    expect(await resetDemo()).toEqual({ ok: true });
    expect(sessionCookieLength()).toBe(0);
    expect((await getSimulatorView()).currentFingerprint).toBe(initial.seedFingerprint);
  });

  it("falls back to the seed for a foreign or damaged cookie", async () => {
    const seed = normalizeSnapshot(createSeedData());
    const changed = structuredClone(seed);
    changed.lineOperation.bodiesCompleted += 1;
    browser.jar.set(`${SESSION_COOKIE_PREFIX}0`, encodePatch(diffSnapshot(seed, changed, "another-seed")));
    expect((await getStore().getSnapshot()).lineOperation.bodiesCompleted).toBe(seed.lineOperation.bodiesCompleted);
    browser.jar.set(`${SESSION_COOKIE_PREFIX}0`, "not-a-patch");
    expect((await getStore().getSnapshot()).lineOperation.bodiesCompleted).toBe(seed.lineOperation.bodiesCompleted);
  });

  it("round-trips additions, changes and removals by id", () => {
    const seed = normalizeSnapshot(createSeedData());
    const current = structuredClone(seed);
    current.alerts[5].status = current.alerts[5].status === "rejected" ? "confirmed" : "rejected";
    current.alerts.splice(10, 1);
    current.ideas.push({ ...current.ideas[0], id: "idea-new" });
    current.lineOperation.bodiesCompleted = 99;
    const patch = diffSnapshot(seed, current, seedFingerprint(seed));
    expect(patch.a.alerts?.u).toHaveLength(1);
    expect(patch.a.alerts?.d).toEqual([seed.alerts[10].id]);
    expect(applyPatch(seed, patch)).toEqual(current);
  });
});
