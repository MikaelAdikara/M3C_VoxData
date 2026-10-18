import { beforeEach, describe, expect, it, vi } from "vitest";

const context = vi.hoisted(() => ({
  role: "engineer" as string | undefined,
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => (context.role ? { value: context.role } : undefined)),
  })),
}));
vi.mock("next/cache", () => ({ revalidatePath: context.revalidatePath }));

import { advanceTicket, checkDraftSentence, draftA3, updateA3 } from "@/lib/actions/kaizen";
import { getTicketView } from "@/lib/queries";
import { resetMemoryStore } from "@/lib/store/memory";

describe("AI-drafted A3 (template mode, no API key)", () => {
  beforeEach(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    context.role = "engineer";
    await resetMemoryStore();
  });

  it("drafts only for the owner engineer", async () => {
    context.role = "team_leader";
    expect(await draftA3("KZ-SEAL-007")).toMatchObject({ ok: false });
  });

  it("drafts sourced sentences, never a countermeasure, and keeps them flagged", async () => {
    expect(await draftA3("KZ-SEAL-007")).toEqual({ ok: true });
    const view = (await getTicketView("KZ-SEAL-007"))!;
    expect(view.aiDraft?.mode).toBe("template");
    expect(view.aiDraft?.sentences.length).toBeGreaterThan(3);
    expect(view.aiDraft?.sentences.every((s) => s.sources.length > 0 && s.status === "draft")).toBe(true);
    expect(view.aiDraft?.sentences.some((s) => s.field === "countermeasure")).toBe(false);
    expect(view.a3.countermeasure).toBe("");
    expect(view.a3.rootCause).toMatch(/Candidate 1 to check at the line/);
    expect(view.aiPrefilledFields).toEqual(expect.arrayContaining(["background", "currentCondition", "rootCause"]));
    expect(view.similarCases[0]?.defectType.id).toBe("BEAD_THIN");
  });

  it("blocks the countermeasure trial until the engineer checks or edits the root-cause candidates", async () => {
    await draftA3("KZ-SEAL-007");
    await updateA3("KZ-SEAL-007", { countermeasure: "Warm-up purge trial on shift A." });
    // ticket starts at a3_in_progress
    const blocked = await advanceTicket("KZ-SEAL-007");
    expect(blocked).toMatchObject({ ok: false });
    const view = (await getTicketView("KZ-SEAL-007"))!;
    for (const s of view.aiDraft!.sentences.filter((d) => d.field === "rootCause")) {
      expect(await checkDraftSentence("KZ-SEAL-007", s.id)).toEqual({ ok: true });
    }
    expect(await advanceTicket("KZ-SEAL-007")).toEqual({ ok: true });
  });

  it("unflags a sentence once the engineer rewrites the field, and never drafts over engineer text", async () => {
    await draftA3("KZ-SEAL-007");
    await updateA3("KZ-SEAL-007", { background: "Engineer's own background after walking the line." });
    const view = (await getTicketView("KZ-SEAL-007"))!;
    expect(view.aiDraft!.sentences.filter((s) => s.field === "background").every((s) => s.status === "edited")).toBe(true);
    expect(view.aiPrefilledFields).not.toContain("background");
    await draftA3("KZ-SEAL-007");
    expect((await getTicketView("KZ-SEAL-007"))!.a3.background).toBe("Engineer's own background after walking the line.");
  });
});
