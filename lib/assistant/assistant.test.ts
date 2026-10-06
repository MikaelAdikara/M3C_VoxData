import { describe, expect, it } from "vitest";

import { FixedWindowRateLimiter } from "@/lib/assistant/rate-limit";
import { retrieveValidatedCards } from "@/lib/assistant/retrieve";
import { answerAssistantQuestion } from "@/lib/assistant/service";
import { createSeedData } from "@/lib/seed";

describe("validated knowledge assistant", () => {
  const cards = createSeedData().cards;

  it.each([
    ["Thin bead at the start of shift on st-04, what do we do?", "KC-SEAL-014"],
    ["Bead break near the right door after a nozzle change?", "KC-SEAL-021"],
    ["Why are we getting false alarms on the grey sealer?", "KC-SEAL-009"],
  ])("retrieves the calibrated validated card for %s", (question, cardId) => {
    expect(retrieveValidatedCards(cards, question)[0]?.card.id).toBe(cardId);
  });

  it("never retrieves draft or retired cards", () => {
    const retiredRevision = {
      ...cards.find((card) => card.id === "KC-SEAL-014")!,
      revision: 4,
      status: "retired" as const,
    };
    const matches = retrieveValidatedCards(
      [...cards, retiredRevision],
      "thin bead shift start st-04 offset bead operator rotation old pump regulator",
    );
    expect(matches.map((match) => match.card.id)).not.toContain("KC-SEAL-014");
    expect(matches.map((match) => match.card.id)).not.toContain("KC-SEAL-030");
    expect(matches.map((match) => match.card.id)).not.toContain("KC-SEAL-004");
  });

  it("returns an offline grounded answer with a stable citation when no key path is supplied", async () => {
    const answer = await answerAssistantQuestion(
      "Bead break near the right door after a nozzle change?",
      cards,
    );
    expect(answer).toMatchObject({
      mode: "offline",
      citations: [{ cardId: "KC-SEAL-021", revision: 2 }],
    });
    expect(answer.text).toContain("[KC-SEAL-021 r2]");
    expect(answer.text).toContain("Angle gauge check");
  });

  it("returns no_card without fabricated instructions when no validated card matches", async () => {
    const answer = await answerAssistantQuestion("How do we fix paint orange peel?", cards);
    expect(answer).toEqual({
      mode: "no_card",
      text: "No validated card covers this. Route the question to the owner engineer.",
      citations: [],
    });
  });

  it("accepts a live answer only when every citation belongs to supplied cards", async () => {
    const valid = await answerAssistantQuestion(
      "bead break after nozzle change",
      cards,
      async () => "Use the nozzle angle gauge. [KC-SEAL-021 r2]",
    );
    expect(valid.mode).toBe("live");

    const invalid = await answerAssistantQuestion(
      "bead break after nozzle change",
      cards,
      async () => "Use an uncited procedure. [KC-FAKE-999 r1]",
    );
    expect(invalid.mode).toBe("offline");
    expect(invalid.text).toContain("[KC-SEAL-021 r2]");
  });

  it("falls back offline when the optional model fails", async () => {
    const answer = await answerAssistantQuestion(
      "thin bead at shift start st-04",
      cards,
      async () => { throw new Error("unavailable"); },
    );
    expect(answer.mode).toBe("offline");
  });
});

describe("assistant rate limit", () => {
  it("allows normal requests, rejects over limit, and recovers next window", () => {
    let now = 1_000;
    const limiter = new FixedWindowRateLimiter(2, 60_000, () => now);
    expect(limiter.check("demo")).toMatchObject({ allowed: true, remaining: 1 });
    expect(limiter.check("demo")).toMatchObject({ allowed: true, remaining: 0 });
    expect(limiter.check("demo")).toMatchObject({ allowed: false, remaining: 0 });
    now += 60_000;
    expect(limiter.check("demo")).toMatchObject({ allowed: true, remaining: 1 });
  });
});
