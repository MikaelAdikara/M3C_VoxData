import { createClaudeA3Drafter } from "@/lib/kaizen/a3-claude";
import { templateDraft, validateSentences, type DraftContext } from "@/lib/kaizen/a3-draft";
import { claudeModel, getClaude } from "@/lib/llm/claude";
import type { A3AiDraft } from "@/lib/types";

/** Draft with Claude when a key is set; otherwise, or if Claude fails, use the template. */
export async function runA3Drafter(ctx: DraftContext, generatedAt: string, options: { live?: boolean } = {}): Promise<A3AiDraft> {
  const client = options.live === false ? null : getClaude();
  if (client) {
    try {
      const raw = await createClaudeA3Drafter(client, claudeModel())(ctx);
      const { sentences, rejected } = validateSentences(raw, ctx);
      if (sentences.length) return { mode: "live", model: claudeModel(), generatedAt, sentences, rejected };
    } catch {
      // fall through to the template
    }
  }
  const { sentences, rejected } = validateSentences(templateDraft(ctx), ctx);
  return { mode: "template", generatedAt, sentences, rejected };
}
