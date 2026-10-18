/**
 * AI-5 evaluation: 30 questions (eval/assistant-questions.json), 20 that a validated card
 * answers and 10 that none does. Scores citation validity and correct refusals.
 *
 *   npm run eval:assistant            # offline mode (retrieval + guardrails, no key needed)
 *   npm run eval:assistant -- --live  # Claude live mode; needs ANTHROPIC_API_KEY in the shell
 *
 * Writes eval/results/assistant-<mode>.json.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { createClaudeAnswerer } from "@/lib/assistant/live";
import { answerAssistantQuestion } from "@/lib/assistant/service";
import { claudeModel, getClaude, usageCost, type ClaudeUsage } from "@/lib/llm/claude";
import { createSeedData } from "@/lib/seed";

interface EvalQuestion { id: string; question: string; expectedCard: string | null; note?: string }

const live = process.argv.includes("--live");
/** Hard spend cap for one live run (USD). The run stops before the next call once it is reached. */
const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? 0.12);
let spent = 0;
let calls = 0;
function track(usage: ClaudeUsage, model: string) {
  spent += usageCost(usage, model);
  calls += 1;
}

const root = process.cwd();
const { questions } = JSON.parse(readFileSync(join(root, "eval/assistant-questions.json"), "utf8")) as { questions: EvalQuestion[] };
const cards = createSeedData().cards;
const validated = new Set(cards.filter((c) => c.status === "validated").map((c) => `${c.id}:${c.revision}`));

async function main() {
  const client = live ? getClaude() : null;
  if (live && !client) throw new Error("--live needs ANTHROPIC_API_KEY in the environment.");
  const generator = client ? createClaudeAnswerer(client, claudeModel(), track) : undefined;

  const rows = [];
  for (const q of questions) {
    if (live && spent >= BUDGET_USD) {
      console.log(`Budget of $${BUDGET_USD} reached after ${calls} calls; stopping early.`);
      break;
    }
    const answer = await answerAssistantQuestion(q.question, cards, generator);
    const answered = answer.mode !== "no_card";
    const citationsValid = answer.citations.every((c) => validated.has(`${c.cardId}:${c.revision}`));
    const expectedCited = q.expectedCard !== null && answer.citations.some((c) => c.cardId === q.expectedCard);
    const pass = q.expectedCard === null ? !answered : answered && citationsValid && expectedCited;
    rows.push({ id: q.id, expectedCard: q.expectedCard, mode: answer.mode, citations: answer.citations.map((c) => `${c.cardId} r${c.revision}`), citationsValid, pass, text: answer.text });
    console.log(`${pass ? "PASS" : "FAIL"} ${q.id} ${answer.mode.padEnd(7)} ${answer.citations.map((c) => c.cardId).join(",") || "-"}  expected ${q.expectedCard ?? "refusal"}`);
  }

  const withCard = rows.filter((r) => r.expectedCard !== null);
  const noCard = rows.filter((r) => r.expectedCard === null);
  const cited = rows.filter((r) => r.citations.length > 0);
  const summary = {
    mode: live ? `live (${claudeModel()})` : "offline",
    runAt: new Date().toISOString(),
    questions: rows.length,
    citationValidity: { valid: cited.filter((r) => r.citationsValid).length, of: cited.length, target: "100%" },
    answeredWithRightCard: { pass: withCard.filter((r) => r.pass).length, of: withCard.length },
    wrongRefusals: withCard.filter((r) => r.mode === "no_card").length,
    correctRefusals: { pass: noCard.filter((r) => r.pass).length, of: noCard.length, target: ">= 9 of 10" },
    claudeCalls: calls,
    budgetUsd: BUDGET_USD,
    costUsd: Number(spent.toFixed(4)),
  };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(join(root, `eval/results/assistant-${live ? "live" : "offline"}.json`), JSON.stringify({ summary, rows }, null, 2) + "\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
