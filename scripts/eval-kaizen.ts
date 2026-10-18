/**
 * AI-3 and AI-4 evaluation.
 *   npm run eval:kaizen            # template drafter (no key needed)
 *   npm run eval:kaizen -- --live  # Claude drafter; needs ANTHROPIC_API_KEY in the shell
 *
 * AI-3: leave-one-out Precision@3 over the case history (a hit shares the root-cause group),
 *       with and without the shop-floor vocabulary, against picking same-defect cases at random.
 * AI-4: 10 test tickets (the 2 open seeded tickets + 8 built from held-out history cases, one
 *       per root-cause group). Counts sentences shipped without a valid source (target 0),
 *       sentences the drafter wrote without a source (removed), countermeasure sentences (must
 *       be 0) and whether the held-out case's root-cause group is among the candidates.
 * Writes eval/results/kaizen-<mode>.json. The engineer rating (1-5) is filled in by the team.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildDraftContext } from "@/lib/kaizen/a3-draft";
import { runA3Drafter } from "@/lib/kaizen/drafter";
import { HISTORY_CASES } from "@/lib/kaizen/history";
import { precisionAtK, sameDefectBaseline, setVocabulary } from "@/lib/kaizen/similar";
import { claudeModel, getClaude } from "@/lib/llm/claude";
import { DRAFT_FIELDS, draftableFields } from "@/lib/rules/ai-draft";
import { createSeedData, defectTypes } from "@/lib/seed";
import type { Alert, DefectTypeId, Ticket } from "@/lib/types";

const live = process.argv.includes("--live");
const name = (id: DefectTypeId) => defectTypes.find((d) => d.id === id)!.name;

async function main() {
  if (live && !getClaude()) throw new Error("--live needs ANTHROPIC_API_KEY in the environment.");

  // ---- AI-3
  setVocabulary(false);
  const plain = precisionAtK(name).precision;
  setVocabulary(true);
  const withVocab = precisionAtK(name);
  const ceiling = HISTORY_CASES.reduce((s, c) => s + Math.min(3, HISTORY_CASES.filter((o) => o.id !== c.id && o.rootCauseGroup === c.rootCauseGroup).length), 0) / (HISTORY_CASES.length * 3);
  const ai3 = {
    cases: HISTORY_CASES.length,
    groups: new Set(HISTORY_CASES.map((c) => c.rootCauseGroup)).size,
    precisionAt3: Number(withVocab.precision.toFixed(3)),
    precisionAt3PlainBm25: Number(plain.toFixed(3)),
    randomSameDefectBaseline: Number(sameDefectBaseline().toFixed(3)),
    ceiling: Number(ceiling.toFixed(3)),
  };
  console.log("AI-3", ai3);

  // ---- AI-4
  const snapshot = createSeedData();
  const heldOut = [...new Map(HISTORY_CASES.filter((c) => !c.ticketId).map((c) => [c.rootCauseGroup, c])).values()].slice(0, 8);
  const tests: { ticket: Ticket; exclude?: string; group?: string }[] = snapshot.tickets
    .filter((t) => t.status !== "closed")
    .map((ticket) => ({ ticket }));
  heldOut.forEach((c, i) => {
    const alerts: Alert[] = [0, 1, 2].map((k) => ({
      id: `eval-${c.id}-${k}`, stationId: c.stationId, bodyId: `EVAL-${i}${k}`, roi: k % 2 ? "seam-R-door-07" : "seam-L-door-03",
      defectTypeId: c.defectTypeId, anomalyScore: 0.7 + k * 0.05, threshold: 0.61, modelVersion: "sealer-st04-v1.3",
      image: "", mask: "", createdAt: `2027-03-14T0${7 + k}:${10 + i}:00.000+07:00`, status: "confirmed",
    }));
    snapshot.alerts.push(...alerts);
    tests.push({
      exclude: c.id,
      group: c.rootCauseGroup,
      ticket: {
        id: `KZ-EVAL-${String(i + 1).padStart(2, "0")}`, stationId: c.stationId, defectTypeId: c.defectTypeId,
        triggerAlertIds: alerts.map((a) => a.id), ownerRole: "role:engineer@body", status: "a3_in_progress",
        a3: { background: c.symptom, currentCondition: "", rootCause: "", countermeasure: "", check: "", standardise: "" },
        aiPrefilledFields: [], createdAt: alerts[2].createdAt,
      },
    });
  });

  const rows = [];
  for (const t of tests) {
    const fields = draftableFields(t.ticket.a3, t.ticket.aiPrefilledFields).filter((f) => DRAFT_FIELDS.includes(f));
    const ctx = buildDraftContext(snapshot, t.ticket, fields, t.exclude);
    const draft = await runA3Drafter(ctx, "2027-03-14T09:00:00.000+07:00", { live });
    const candidateGroups = new Set(
      draft.sentences
        .filter((s) => s.field === "rootCause")
        .flatMap((s) => s.sources.filter((src) => src.kind === "case").map((src) => HISTORY_CASES.find((c) => c.id === src.id)?.rootCauseGroup)),
    );
    const row = {
      ticket: t.ticket.id,
      mode: draft.mode,
      sentences: draft.sentences.length,
      unsourcedShipped: draft.sentences.filter((s) => s.sources.length === 0).length,
      unsourcedRemoved: draft.rejected,
      countermeasureSentences: draft.sentences.filter((s) => s.field === "countermeasure").length,
      rootCauseCandidates: draft.sentences.filter((s) => s.field === "rootCause").length,
      heldOutGroupInCandidates: t.group ? candidateGroups.has(t.group as never) : null,
      engineerRating: null as number | null,
      draft: draft.sentences.map((s) => ({ field: s.field, text: s.text, sources: s.sources.map((x) => x.id) })),
    };
    rows.push(row);
    console.log(`${row.ticket} ${row.mode} sentences ${row.sentences} unsourced ${row.unsourcedShipped} removed ${row.unsourcedRemoved} candidates ${row.rootCauseCandidates} hit ${row.heldOutGroupInCandidates}`);
  }
  const constructed = rows.filter((r) => r.heldOutGroupInCandidates !== null);
  const ai4 = {
    mode: live ? `live (${claudeModel()})` : "template",
    tickets: rows.length,
    sentences: rows.reduce((s, r) => s + r.sentences, 0),
    unsourcedClaimsShipped: rows.reduce((s, r) => s + r.unsourcedShipped, 0),
    unsourcedSentencesRemoved: rows.reduce((s, r) => s + r.unsourcedRemoved, 0),
    countermeasureSentences: rows.reduce((s, r) => s + r.countermeasureSentences, 0),
    rootCauseGroupInCandidates: { hit: constructed.filter((r) => r.heldOutGroupInCandidates).length, of: constructed.length },
  };
  console.log("AI-4", ai4);
  writeFileSync(join(process.cwd(), `eval/results/kaizen-${live ? "live" : "template"}.json`), JSON.stringify({ runAt: new Date().toISOString(), ai3, ai4, perCase: withVocab.perCase, rows }, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
