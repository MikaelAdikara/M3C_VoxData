import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { contextForPrompt, type DraftContext, type RawSentence } from "@/lib/kaizen/a3-draft";

const Sentence = z.object({ text: z.string(), sources: z.array(z.string()) });

const A3DraftSchema = z.object({
  background: z.array(Sentence),
  currentCondition: z.array(Sentence),
  rootCauseCandidates: z.array(Sentence),
});

const SYSTEM = `You draft parts of an A3 problem-solving report for the owner engineer of a Kaizen ticket on a car-body sealer line.
Use only the facts in the JSON you are given: the ticket and its trigger alerts, similar closed cases and validated knowledge cards.

Return JSON with three lists of sentences:
- background: why this ticket exists (what happened, where, how often), at most 3 sentences.
- currentCondition: what the data shows today, at most 3 sentences.
- rootCauseCandidates: up to 3 candidate causes to check at the line, most likely first, each one sentence starting "Candidate N to check at the line:". Say what evidence points to it.

Every sentence lists in "sources" the IDs it rests on, exactly as written in the JSON: the ticket ID, a case ID (HC-…), or a card ID with revision ("KC-SEAL-014 r3"). A sentence with no source will be deleted.
Leave a list empty when its field is not in fieldsToDraft.
Do not write a countermeasure, a decision or a conclusion: the engineer confirms the root cause at the line and writes the countermeasure. Never suggest stopping the line; that is the team leader's decision.`;

export function createClaudeA3Drafter(client: Anthropic, model: string) {
  return async (ctx: DraftContext): Promise<RawSentence[]> => {
    const response = await client.messages.parse({
      model,
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(A3DraftSchema) },
      messages: [{ role: "user", content: JSON.stringify(contextForPrompt(ctx), null, 1) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`No structured A3 draft (stop_reason ${response.stop_reason}).`);
    }
    const d = response.parsed_output;
    return [
      ...d.background.map((s) => ({ field: "background" as const, ...s })),
      ...d.currentCondition.map((s) => ({ field: "currentCondition" as const, ...s })),
      ...d.rootCauseCandidates.map((s) => ({ field: "rootCause" as const, ...s })),
    ];
  };
}
