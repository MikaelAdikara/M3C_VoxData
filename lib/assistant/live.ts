import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

import { ASSISTANT_SYSTEM_PROMPT, buildGroundedQuestion } from "@/lib/assistant/prompt";
import type { LiveAnswerGenerator } from "@/lib/assistant/service";

/** What Claude must return: sentences, each with the cards that support it. */
export const LiveDraftSchema = z.object({
  covered: z.boolean(),
  sentences: z.array(
    z.object({
      text: z.string(),
      citations: z.array(z.object({ cardId: z.string(), revision: z.number().int() })),
    }),
  ),
});

export type LiveDraft = z.infer<typeof LiveDraftSchema>;

export function createClaudeAnswerer(client: Anthropic, model: string): LiveAnswerGenerator {
  return async (question, cards) => {
    const response = await client.messages.parse({
      model,
      max_tokens: 2000,
      system: ASSISTANT_SYSTEM_PROMPT,
      output_config: { effort: "low", format: zodOutputFormat(LiveDraftSchema) },
      messages: [{ role: "user", content: buildGroundedQuestion(question, cards) }],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      throw new Error(`No structured answer (stop_reason ${response.stop_reason}).`);
    }
    return response.parsed_output;
  };
}
