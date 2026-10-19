import type { A3, A3AiDraft, A3DraftSentence, A3Field } from "@/lib/types";

/**
 * Rules for AI-drafted A3 sentences (AI-4). A sentence stays flagged "AI draft" until the
 * engineer edits it in the A3 field or marks it checked. Root-cause candidates must be
 * dealt with before the countermeasure trial, and nothing may stay flagged when the
 * engineer requests validation: AI drafts, people decide and sign.
 */

export const DRAFT_FIELDS: A3Field[] = ["background", "currentCondition", "rootCause"];

export function sentenceLine(sentence: Pick<A3DraftSentence, "text" | "sources">): string {
  const tags = sentence.sources.map((s) => `[${s.id}]`).join(" ");
  return tags ? `${sentence.text} ${tags}` : sentence.text;
}

export function composeField(field: A3Field, sentences: readonly A3DraftSentence[]): string {
  const lines = sentences.filter((s) => s.field === field).map(sentenceLine);
  return field === "rootCause" ? lines.join("\n") : lines.join(" ");
}

/** After the engineer saves a field: draft sentences no longer present verbatim count as edited. */
export function markEditedSentences(draft: A3AiDraft | undefined, field: A3Field, value: string): A3AiDraft | undefined {
  if (!draft) return draft;
  return {
    ...draft,
    sentences: draft.sentences.map((s) =>
      s.field === field && s.status === "draft" && !value.includes(sentenceLine(s)) ? { ...s, status: "edited" } : s,
    ),
  };
}

/**
 * The engineer selects one root-cause candidate after checking at the line. Only that cause stays in
 * the A3 (and later on the card); the other candidates are dropped.
 */
export function chooseRootCause(draft: A3AiDraft, sentenceId: string): { draft: A3AiDraft; rootCause: string } | null {
  const chosen = draft.sentences.find((s) => s.id === sentenceId && s.field === "rootCause");
  if (!chosen) return null;
  const cause = chosen.text.replace(/^Candidate \d+ to check at the line:\s*/i, "").trim();
  const text = cause.charAt(0).toUpperCase() + cause.slice(1);
  return {
    rootCause: sentenceLine({ text, sources: chosen.sources }),
    draft: {
      ...draft,
      sentences: draft.sentences.map((s) =>
        s.field !== "rootCause" || (s.status !== "draft" && s.id !== sentenceId)
          ? s
          : { ...s, status: s.id === sentenceId ? "chosen" : "dropped" },
      ),
    },
  };
}

export function openDraftSentences(draft: A3AiDraft | undefined, fields: readonly A3Field[] = DRAFT_FIELDS): A3DraftSentence[] {
  return (draft?.sentences ?? []).filter((s) => s.status === "draft" && fields.includes(s.field));
}

export function fieldsWithOpenDraft(draft: A3AiDraft | undefined): A3Field[] {
  return [...new Set(openDraftSentences(draft).map((s) => s.field))];
}

/** Fields the drafter may fill: empty, or still holding only AI text. Engineer text is never overwritten. */
export function draftableFields(a3: A3, aiPrefilledFields: readonly A3Field[]): A3Field[] {
  return DRAFT_FIELDS.filter((f) => !a3[f].trim() || aiPrefilledFields.includes(f));
}
