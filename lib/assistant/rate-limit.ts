export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface RateLimitWindow {
  count: number;
  resetsAt: number;
}

export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, RateLimitWindow>();

  constructor(
    private readonly limit = 20,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  check(key: string): RateLimitResult {
    const currentTime = this.now();
    const current = this.windows.get(key);
    const window = !current || currentTime >= current.resetsAt
      ? { count: 0, resetsAt: currentTime + this.windowMs }
      : current;
    window.count += 1;
    this.windows.set(key, window);
    const allowed = window.count <= this.limit;
    return {
      allowed,
      remaining: Math.max(0, this.limit - window.count),
      retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((window.resetsAt - currentTime) / 1_000)),
    };
  }
}
