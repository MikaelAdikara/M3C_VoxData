import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Claude client for the assistant (AI-5) and the A3 drafter (AI-4).
 * Returns null without ANTHROPIC_API_KEY, so every caller keeps its offline path.
 * The key is read only from process.env and never sent to the browser.
 */
export const DEFAULT_CLAUDE_MODEL = "claude-sonnet-5-5";

export function claudeModel(): string {
  return process.env.ANTHROPIC_MODEL || DEFAULT_CLAUDE_MODEL;
}

export function getClaude(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });
}
