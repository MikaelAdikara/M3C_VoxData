import { tokenize } from "@/lib/assistant/retrieve";
import { HISTORY_CASES, type HistoryCase } from "@/lib/kaizen/history";
import type { DefectTypeId } from "@/lib/types";

/**
 * AI-3: similar past cases for a Kaizen ticket. BM25 over the closed-case history
 * (symptom counted twice, root cause and countermeasure once), plus a small bonus for
 * the same defect type and the same station. It only ranks and shows cases; choosing
 * the root cause stays with the engineer.
 */

const K1 = 1.2;
const B = 0.75;
const SAME_DEFECT_BONUS = 1.5;
const SAME_STATION_BONUS = 0.5;

export interface CaseQuery {
  stationId: string;
  defectTypeId: DefectTypeId;
  defectName: string;
  text: string;
}

export interface SimilarCase {
  case: HistoryCase;
  score: number;
  /** Query words that also appear in the case, so the engineer sees why it was picked. */
  matched: string[];
}

/**
 * Shop-floor vocabulary: words that name the same thing map to one term before ranking
 * (written from general sealer know-how; reported separately from plain BM25 in the evaluation).
 */
const VOCABULARY: Record<string, string> = Object.fromEntries(
  Object.entries({
    thin: ["thin", "thinner", "thin-bead", "narrow", "width"],
    startup: ["start", "start-up", "startup", "restart", "first", "morning", "monday", "overnight"],
    cold: ["cold", "cool", "cooled", "temperature", "heater", "viscosity", "stiff"],
    gap: ["break", "broken", "tear", "gap", "interrupted"],
    unsealed: ["missing", "unsealed"],
    excess: ["excess", "blob", "heavy", "wide", "drip", "stringing"],
    offset: ["offset", "off"],
    nozzle: ["nozzle", "tip"],
    change: ["change", "changeover", "swap", "replaced", "replacement", "edit"],
    recovery: ["recovery", "recovered", "fault", "reset", "collision", "jog"],
    corner: ["corner", "radius", "slow", "slows", "transition", "pillar"],
    pressure: ["pressure", "regulator", "fluctuation"],
    air: ["air", "bleed", "spitting", "pocket"],
    camera: ["camera", "alarm", "reflection", "glare", "lighting", "lamp", "contrast"],
    locating: ["jig", "fixture", "carrier", "locating", "clamp", "pin"],
  }).flatMap(([term, words]) => words.map((w) => [w, term])),
);

let useVocabulary = true;

/** For the evaluation only: compare ranking with and without the vocabulary. */
export function setVocabulary(on: boolean) {
  useVocabulary = on;
  defaultIndex = buildIndex(HISTORY_CASES);
}

function terms(text: string): string[] {
  const tokens = tokenize(text);
  return useVocabulary ? tokens.map((t) => VOCABULARY[t] ?? t) : tokens;
}

function docTokens(c: HistoryCase): string[] {
  const symptom = terms(c.symptom);
  return [...symptom, ...symptom, ...terms(c.rootCause), ...terms(c.countermeasure)];
}

interface Index {
  docs: { case: HistoryCase; tf: Map<string, number>; len: number }[];
  df: Map<string, number>;
  avgLen: number;
}

function buildIndex(cases: readonly HistoryCase[]): Index {
  const docs = cases.map((c) => {
    const tokens = docTokens(c);
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { case: c, tf, len: tokens.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const avgLen = docs.reduce((s, d) => s + d.len, 0) / Math.max(1, docs.length);
  return { docs, df, avgLen };
}

let defaultIndex = buildIndex(HISTORY_CASES);

/** The case's own words behind the matched terms, for display ("excess", not the stem "exces"). */
export function matchedWords(c: HistoryCase, matched: readonly string[]): string[] {
  const want = new Set(matched);
  const words = `${c.symptom} ${c.rootCause}`.split(/[^A-Za-z0-9-]+/).filter(Boolean);
  const out = new Map<string, string>();
  for (const w of words) {
    const [t] = terms(w);
    if (t && want.has(t) && !out.has(t)) out.set(t, w.toLowerCase());
  }
  return [...out.values()];
}

export function findSimilarCases(
  query: CaseQuery,
  options: { limit?: number; cases?: readonly HistoryCase[] } = {},
): SimilarCase[] {
  const index = options.cases ? buildIndex(options.cases) : defaultIndex;
  const qTokens = [...new Set(terms(`${query.defectName} ${query.text}`))];
  const n = index.docs.length;
  return index.docs
    .map((d) => {
      let score = 0;
      const matched: string[] = [];
      for (const t of qTokens) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = index.df.get(t) ?? 0;
        const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
        score += idf * ((f * (K1 + 1)) / (f + K1 * (1 - B + (B * d.len) / index.avgLen)));
        matched.push(t);
      }
      if (d.case.defectTypeId === query.defectTypeId) score += SAME_DEFECT_BONUS;
      if (d.case.stationId === query.stationId) score += SAME_STATION_BONUS;
      return { case: d.case, score: Number(score.toFixed(3)), matched };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.case.id.localeCompare(b.case.id))
    .slice(0, options.limit ?? 5);
}

/** Leave-one-out Precision@k on the history: a hit is a retrieved case with the same root-cause group. */
export function precisionAtK(
  defectName: (id: DefectTypeId) => string,
  k = 3,
  cases: readonly HistoryCase[] = HISTORY_CASES,
): { precision: number; perCase: { id: string; hits: number }[] } {
  const perCase = cases.map((held) => {
    const rest = cases.filter((c) => c.id !== held.id);
    const top = findSimilarCases(
      { stationId: held.stationId, defectTypeId: held.defectTypeId, defectName: defectName(held.defectTypeId), text: held.symptom },
      { limit: k, cases: rest },
    );
    return { id: held.id, hits: top.filter((r) => r.case.rootCauseGroup === held.rootCauseGroup).length };
  });
  const precision = perCase.reduce((s, c) => s + c.hits, 0) / (cases.length * k);
  return { precision, perCase };
}

/** Baseline: pick k cases of the same defect type at random (expected Precision@k). */
export function sameDefectBaseline(k = 3, cases: readonly HistoryCase[] = HISTORY_CASES): number {
  let total = 0;
  for (const held of cases) {
    const pool = cases.filter((c) => c.id !== held.id && c.defectTypeId === held.defectTypeId);
    if (!pool.length) continue;
    const same = pool.filter((c) => c.rootCauseGroup === held.rootCauseGroup).length;
    total += (same / pool.length) * Math.min(k, pool.length);
  }
  return total / (cases.length * k);
}
