import { retrieveValidatedCards } from "@/lib/assistant/retrieve";
import { findSimilarCases, type SimilarCase } from "@/lib/kaizen/similar";
import { DRAFT_FIELDS } from "@/lib/rules/ai-draft";
import type { A3DraftSentence, A3DraftSource, A3Field, Alert, DefectType, KnowledgeCard, StoreSnapshot, Ticket } from "@/lib/types";

/**
 * AI-4: draft the background, current condition and ranked root-cause candidates of an
 * A3 from data only: the ticket and its trigger alerts, similar closed cases and
 * validated cards. Every sentence carries its sources; a sentence without a valid source
 * is dropped. The drafter never writes a countermeasure.
 */

export interface DraftContext {
  ticket: Ticket;
  defect: DefectType;
  alerts: Alert[];
  cases: SimilarCase[];
  cards: KnowledgeCard[];
  fields: A3Field[];
}

/** Raw sentence from a drafter, before validation. */
export interface RawSentence {
  field: A3Field;
  text: string;
  sources: string[];
}

export function cardRef(card: Pick<KnowledgeCard, "id" | "revision">): string {
  return `${card.id} r${card.revision}`;
}

export function buildDraftContext(snapshot: StoreSnapshot, ticket: Ticket, fields: A3Field[] = DRAFT_FIELDS, exclude?: string): DraftContext {
  const defect = snapshot.defectTypes.find((d) => d.id === ticket.defectTypeId)!;
  const alerts = ticket.triggerAlertIds
    .map((id) => snapshot.alerts.find((a) => a.id === id))
    .filter((a): a is Alert => a !== undefined)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const cases = findSimilarCases(
    {
      stationId: ticket.stationId,
      defectTypeId: ticket.defectTypeId,
      defectName: defect.name,
      // Only text the engineer wrote: AI-drafted text must not steer its own retrieval.
      text: [
        ...(["background", "currentCondition"] as const).filter((f) => !ticket.aiPrefilledFields.includes(f)).map((f) => ticket.a3[f]),
        ...alerts.map((a) => a.roi.replace(/-/g, " ")),
      ].join(" "),
    },
    { limit: 4 + (exclude ? 1 : 0) },
  ).filter((c) => c.case.id !== exclude && c.case.ticketId !== ticket.id).slice(0, 4);
  const validated = new Map(
    retrieveValidatedCards(snapshot.cards, `${defect.name} ${ticket.stationId}`, 5).map((m) => [m.card.id, m.card]),
  );
  // Cards written from the similar cases count only if they are validated.
  for (const c of cases) {
    const card = c.case.cardId ? latestValidated(snapshot.cards, c.case.cardId) : undefined;
    if (card) validated.set(card.id, card);
  }
  return { ticket, defect, alerts, cases, cards: [...validated.values()], fields };
}

function latestValidated(cards: readonly KnowledgeCard[], id: string): KnowledgeCard | undefined {
  const revisions = cards.filter((c) => c.id === id).sort((a, b) => b.revision - a.revision);
  if (revisions[0]?.status === "retired") return undefined;
  return revisions.find((c) => c.status === "validated");
}

/** IDs a sentence may cite, mapped to their source kind. */
export function allowedSources(ctx: DraftContext): Map<string, A3DraftSource["kind"]> {
  const allowed = new Map<string, A3DraftSource["kind"]>([[ctx.ticket.id, "ticket"]]);
  for (const c of ctx.cases) allowed.set(c.case.id, "case");
  for (const card of ctx.cards) allowed.set(cardRef(card), "card");
  return allowed;
}

const hhmm = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(new Date(iso));

/** Deterministic drafter used without an API key. */
export function templateDraft(ctx: DraftContext): RawSentence[] {
  const { ticket, defect, alerts, cases } = ctx;
  const out: RawSentence[] = [];
  const add = (field: A3Field, text: string, sources: string[]) => {
    if (ctx.fields.includes(field)) out.push({ field, text, sources });
  };
  const seams = [...new Set(alerts.map((a) => a.roi))];
  const name = defect.name.toLowerCase();
  if (alerts.length) {
    add("background", `${alerts.length} confirmed ${name} alerts at ${ticket.stationId} on ${seams.join(", ")} between ${hhmm(alerts[0].createdAt)} and ${hhmm(alerts.at(-1)!.createdAt)} opened this ticket under the repeat rule.`, [ticket.id]);
  } else {
    add("background", `This ticket covers repeated ${name} at ${ticket.stationId}.`, [ticket.id]);
  }
  add(
    "background",
    defect.criticality === "leak_critical"
      ? `${defect.name} is leak-critical, so affected bodies keep the manual check while the cause is open.`
      : `${defect.name} is non-critical; the cost is rework and repeat alerts at the station.`,
    [ticket.id],
  );
  if (alerts.length) {
    const scores = alerts.map((a) => a.anomalyScore);
    add("currentCondition", `Anomaly scores were ${Math.min(...scores).toFixed(2)} to ${Math.max(...scores).toFixed(2)} against a threshold of ${alerts[0].threshold.toFixed(2)} on model ${alerts[0].modelVersion}.`, [ticket.id]);
  }
  if (cases.length) {
    add("currentCondition", `Closest closed cases: ${cases.slice(0, 2).map((c) => `${c.case.id} (${c.case.symptom.toLowerCase()} at ${c.case.stationId})`).join("; ")}.`, cases.slice(0, 2).map((c) => c.case.id));
  }
  const seenGroups = new Set<string>();
  let rank = 0;
  for (const c of cases) {
    if (seenGroups.has(c.case.rootCauseGroup) || rank >= 3) continue;
    seenGroups.add(c.case.rootCauseGroup);
    rank += 1;
    const card = c.case.cardId ? ctx.cards.find((k) => k.id === c.case.cardId) : undefined;
    add("rootCause", `Candidate ${rank} to check at the line: ${c.case.rootCause.charAt(0).toLowerCase()}${c.case.rootCause.slice(1)} (seen in ${c.case.id}${card ? `, written up in ${card.id}` : ""}).`, card ? [c.case.id, cardRef(card)] : [c.case.id]);
  }
  return out;
}

const LINE_STOP = /\b(stop the line|line stop|shut down the line)\b/i;

/** Keep sentences with at least one valid source; count the rest as rejected. */
export function validateSentences(raw: readonly RawSentence[], ctx: DraftContext): { sentences: A3DraftSentence[]; rejected: number } {
  const allowed = allowedSources(ctx);
  const sentences: A3DraftSentence[] = [];
  let rejected = 0;
  const counters = new Map<A3Field, number>();
  for (const r of raw) {
    const text = r.text.trim();
    const ids = [...new Set(r.sources.map((s) => s.trim()))];
    const valid = text.length > 0 && ids.length > 0 && ids.every((id) => allowed.has(id));
    if (!valid || !ctx.fields.includes(r.field) || r.field === "countermeasure" || LINE_STOP.test(text)) {
      rejected += 1;
      continue;
    }
    const n = (counters.get(r.field) ?? 0) + 1;
    counters.set(r.field, n);
    sentences.push({ id: `${r.field}-${n}`, field: r.field, text, sources: ids.map((id) => ({ kind: allowed.get(id)!, id })), status: "draft" });
  }
  return { sentences, rejected };
}

/** The facts a live drafter may use, as compact JSON for the prompt. */
export function contextForPrompt(ctx: DraftContext) {
  return {
    ticket: {
      id: ctx.ticket.id,
      station: ctx.ticket.stationId,
      defect: ctx.defect.name,
      criticality: ctx.defect.criticality,
      existingA3: { background: ctx.ticket.a3.background, currentCondition: ctx.ticket.a3.currentCondition },
      triggerAlerts: ctx.alerts.map((a) => ({ time: hhmm(a.createdAt), body: a.bodyId, seam: a.roi, score: a.anomalyScore, threshold: a.threshold, model: a.modelVersion })),
    },
    similarClosedCases: ctx.cases.map((c) => ({ id: c.case.id, station: c.case.stationId, defect: c.case.defectTypeId, symptom: c.case.symptom, rootCause: c.case.rootCause, countermeasure: c.case.countermeasure })),
    validatedCards: ctx.cards.map((k) => ({ id: cardRef(k), station: k.stationIds, symptom: k.symptom, rootCause: k.rootCause, countermeasure: k.countermeasure })),
    fieldsToDraft: ctx.fields,
  };
}
