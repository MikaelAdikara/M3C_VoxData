import { createClaudeAnswerer } from "@/lib/assistant/live";
import { FixedWindowRateLimiter } from "@/lib/assistant/rate-limit";
import { answerAssistantQuestion, type LiveAnswerGenerator } from "@/lib/assistant/service";
import { claudeModel, getClaude } from "@/lib/llm/claude";
import { getStore } from "@/lib/store";

const MAX_QUESTION_LENGTH = 500;

const globalAssistant = globalThis as typeof globalThis & {
  learningLineAssistantLimiter?: FixedWindowRateLimiter;
};

function getLimiter(): FixedWindowRateLimiter {
  globalAssistant.learningLineAssistantLimiter ??= new FixedWindowRateLimiter(20, 60_000);
  return globalAssistant.learningLineAssistantLimiter;
}

function requestKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "local-demo";
}

function createLiveGenerator(): LiveAnswerGenerator | undefined {
  const client = getClaude();
  return client ? createClaudeAnswerer(client, claudeModel()) : undefined;
}

export async function POST(request: Request): Promise<Response> {
  const rate = getLimiter().check(requestKey(request));
  if (!rate.allowed) {
    return Response.json(
      { error: "Assistant rate limit exceeded. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const question =
    body && typeof body === "object" && "question" in body
      ? (body as { question?: unknown }).question
      : undefined;
  if (typeof question !== "string" || !question.trim() || question.trim().length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Question must be between 1 and ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const snapshot = await getStore().getSnapshot();
  const answer = await answerAssistantQuestion(question.trim(), snapshot.cards, createLiveGenerator());
  return Response.json(answer, {
    headers: { "X-RateLimit-Remaining": String(rate.remaining) },
  });
}
