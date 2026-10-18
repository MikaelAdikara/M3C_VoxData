import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Claude client for the assistant (AI-5) and the A3 drafter (AI-4).
 * Returns null without ANTHROPIC_API_KEY, so every caller keeps its offline path.
 * The key is read only from process.env and never sent to the browser.
 */
// Haiku 5.5: the cheapest current model; the W17 live evaluation was run on it.
export const DEFAULT_CLAUDE_MODEL = "claude-haiku-5-5";

/** USD per million input / output tokens (Claude API list prices, Oct 2026). */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};

export interface ClaudeUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

export type UsageListener = (usage: ClaudeUsage, model: string) => void;

/** Cost of one response in USD; unknown models are priced as Opus so budgets err on the safe side. */
export function usageCost(usage: ClaudeUsage, model: string): number {
  const [inp, out] = PRICES[model] ?? PRICES["claude-opus-5-5"];
  const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0);
  return (input * inp + usage.output_tokens * out) / 1_000_000;
}

export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL;
}

export function getClaude(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
}
