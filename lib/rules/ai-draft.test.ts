import { describe, expect, it } from "vitest";

import { chooseRootCause, composeField, draftableFields, markEditedSentences, openDraftSentences, sentenceLine } from "@/lib/rules/ai-draft";
import type { A3AiDraft } from "@/lib/types";

const draft: A3AiDraft = {
  mode: "template",
  generatedAt: "2027-03-14T09:00:00.000+07:00",
  rejected: 0,
  sentences: [
    { id: "background-1", field: "background", text: "Three thin-bead alerts at st-04.", sources: [{ kind: "ticket", id: "KZ-SEAL-007" }], status: "draft" },
    { id: "rootCause-1", field: "rootCause", text: "1. Cold material after the overnight stop.", sources: [{ kind: "case", id: "HC-001" }, { kind: "card", id: "KC-SEAL-014 r3" }], status: "draft" },
    { id: "rootCause-2", field: "rootCause", text: "2. Regulator lag.", sources: [{ kind: "case", id: "HC-021" }], status: "draft" },
  ],
};

describe("AI-drafted A3 sentences", () => {
  it("writes every sentence with its sources", () => {
    expect(sentenceLine(draft.sentences[1])).toBe("1. Cold material after the overnight stop. [HC-001] [KC-SEAL-014 r3]");
    expect(composeField("rootCause", draft.sentences).split("\n")).toHaveLength(2);
  });

  it("keeps a sentence flagged while it is unchanged, and unflags it once the engineer edits it", () => {
    const field = composeField("rootCause", draft.sentences);
    const unchanged = markEditedSentences(draft, "rootCause", field);
    expect(openDraftSentences(unchanged, ["rootCause"])).toHaveLength(2);
    const edited = markEditedSentences(draft, "rootCause", field.replace("Regulator lag.", "Regulator lag confirmed on the trend."));
    expect(openDraftSentences(edited, ["rootCause"]).map((s) => s.id)).toEqual(["rootCause-1"]);
    expect(edited?.sentences.find((s) => s.id === "rootCause-2")?.status).toBe("edited");
  });

  it("keeps only the root cause the engineer selects", () => {
    const r = chooseRootCause(draft, "rootCause-2")!;
    expect(r.rootCause).toBe("2. Regulator lag. [HC-021]");
    expect(r.draft.sentences.find((s) => s.id === "rootCause-2")?.status).toBe("chosen");
    expect(r.draft.sentences.find((s) => s.id === "rootCause-1")?.status).toBe("dropped");
    expect(openDraftSentences(r.draft, ["rootCause"])).toHaveLength(0);
    expect(chooseRootCause(draft, "background-1")).toBeNull();
  });

  it("strips the candidate label when the engineer selects a cause", () => {
    const d: A3AiDraft = { ...draft, sentences: [{ ...draft.sentences[1], text: "Candidate 1 to check at the line: cold material after the overnight stop." }] };
    expect(chooseRootCause(d, "rootCause-1")!.rootCause).toBe("Cold material after the overnight stop. [HC-001] [KC-SEAL-014 r3]");
  });

  it("never drafts over text the engineer wrote", () => {
    const a3 = { background: "Engineer text", currentCondition: "", rootCause: "AI text", countermeasure: "", check: "", standardise: "" };
    expect(draftableFields(a3, ["rootCause"])).toEqual(["currentCondition", "rootCause"]);
  });
});
