/*
Reusable frontend rate limiting utility.

Features:
- RateLimiter class with last request tracking
- waitForRateLimit helper to delay until allowed
- Global email rate limiter instance
- React hook and presentational components for countdown/progress
- localStorage persistence across refreshes (per key)

This ensures admin-triggered email actions respect provider limits (e.g., Resend).
*/

import React, { useEffect, useMemo, useRef, useState } from "react";

// Default limits for email providers (tunable). Example: 1 request per second.
// Adjust as needed based on Resend's documented limits or your plan.
const DEFAULT_MIN_INTERVAL_MS = 1000; // minimum interval between requests
const DEFAULT_BURST_LIMIT = 1; // simple fixed window of 1 per interval

type PersistentState = {
  lastRequestAtMs: number;
  tokens: number;
};

export type RateLimiterOptions = {
  storageKey: string; // unique key for persistence (e.g., "email.global")
  minIntervalMs?: number; // minimum milliseconds between requests
  burstLimit?: number; // allowed number of requests per interval
};

export class RateLimiter {
  private readonly storageKey: string;
  private readonly minIntervalMs: number;
  private readonly burstLimit: number;
  private lastRequestAtMs: number;
  private tokens: number;

  constructor(options: RateLimiterOptions) {
    this.storageKey = options.storageKey;
    this.minIntervalMs = options.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
    this.burstLimit = Math.max(1, options.burstLimit ?? DEFAULT_BURST_LIMIT);

    const persisted = this.readPersisted();
    this.lastRequestAtMs = persisted?.lastRequestAtMs ?? 0;
    this.tokens = persisted?.tokens ?? this.burstLimit;
  }

  private readPersisted(): PersistentState | null {
    try {
      if (typeof window === "undefined") return null;
      const raw = window.localStorage.getItem(this.storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as PersistentState;
      if (
        typeof parsed.lastRequestAtMs === "number" &&
        typeof parsed.tokens === "number"
      ) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    try {
      if (typeof window === "undefined") return;
      const state: PersistentState = {
        lastRequestAtMs: this.lastRequestAtMs,
        tokens: this.tokens,
      };
      window.localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // noop
    }
  }

  // Compute remaining wait time until the next token is available
  public getWaitMs(nowMs: number = Date.now()): number {
    // Basic fixed-window: allow burstLimit requests per minIntervalMs
    // If tokens are available, no wait; otherwise wait until interval since last request
    if (this.tokens > 0) return 0;
    const elapsed = nowMs - this.lastRequestAtMs;
    const remaining = this.minIntervalMs - elapsed;
    return Math.max(0, remaining);
  }

  // Reserve a token and update timestamps; call when request starts
  public markRequest(nowMs: number = Date.now()): void {
    // Refill tokens if interval elapsed
    const elapsed = nowMs - this.lastRequestAtMs;
    if (elapsed >= this.minIntervalMs) {
      this.tokens = this.burstLimit;
    }
    if (this.tokens > 0) {
      this.tokens -= 1;
    }
    this.lastRequestAtMs = nowMs;
    this.persist();
  }

  // For UI: when is the next request allowed
  public getNextAllowedAtMs(nowMs: number = Date.now()): number {
    const waitMs = this.getWaitMs(nowMs);
    return nowMs + waitMs;
  }

  // Reset limiter state (e.g., admin override)
  public reset(): void {
    this.lastRequestAtMs = 0;
    this.tokens = this.burstLimit;
    this.persist();
  }
}

// Await until allowed by limiter, then optionally mark the request
export async function waitForRateLimit(
  limiter: RateLimiter,
  options: { autoMark?: boolean } = { autoMark: true }
): Promise<void> {
  let waitMs = limiter.getWaitMs();
  while (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(waitMs, 250)));
    waitMs = limiter.getWaitMs();
  }
  if (options.autoMark !== false) {
    limiter.markRequest();
  }
}

// Global email rate limiter shared across admin components
export const emailRateLimiter = new RateLimiter({
  storageKey: "rateLimiter.email.global",
  // Tune these to your provider's constraints; default is conservative
  minIntervalMs: DEFAULT_MIN_INTERVAL_MS,
  burstLimit: DEFAULT_BURST_LIMIT,
});

// React hook that exposes countdown/progress for a given limiter
export function useRateLimitCountdown(limiter: RateLimiter) {
  const [nowMs, setNowMs] = useState<number>(Date.now());
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      setNowMs(Date.now());
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const waitMs = useMemo(() => limiter.getWaitMs(nowMs), [limiter, nowMs]);
  const nextAllowedAtMs = useMemo(
    () => limiter.getNextAllowedAtMs(nowMs),
    [limiter, nowMs]
  );
  const progress = useMemo(() => {
    // 1 means ready, 0 means just started waiting
    const remaining = waitMs;
    const total = (limiter as any)["minIntervalMs"] as number; // internal access for visual only
    if (remaining <= 0) return 1;
    return Math.max(0, Math.min(1, 1 - remaining / total));
  }, [waitMs, limiter]);

  return { waitMs, nextAllowedAtMs, progress, ready: waitMs <= 0 };
}

// Lightweight timer text component
export function RateLimitCountdown(props: {
  limiter?: RateLimiter;
  render?: (ms: number) => React.ReactNode;
}) {
  const limiter = props.limiter ?? emailRateLimiter;
  const { waitMs } = useRateLimitCountdown(limiter);
  const seconds = Math.ceil(waitMs / 1000);
  if (waitMs <= 0) return React.createElement(React.Fragment, null);
  if (props.render) return React.createElement(React.Fragment, null, props.render(waitMs));
  return React.createElement(React.Fragment, null, `${seconds}s`);
}

// Lightweight progress bar component (unstyled; admin can wrap with UI lib)
export function RateLimitProgress(props: {
  limiter?: RateLimiter;
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  const limiter = props.limiter ?? emailRateLimiter;
  const { progress } = useRateLimitCountdown(limiter);
  const outerStyle: React.CSSProperties = {
    width: props.width ?? "100%",
    height: props.height ?? 6,
    background: "rgba(0,0,0,0.1)",
    borderRadius: 4,
    overflow: "hidden",
  };
  const innerStyle: React.CSSProperties = {
    width: `${Math.round(progress * 100)}%`,
    height: "100%",
    background: progress >= 1 ? "#16a34a" : "#2563eb",
    transition: "width 100ms linear, background 200ms ease",
  };
  return React.createElement(
    "div",
    { className: props.className, style: outerStyle },
    React.createElement("div", { style: innerStyle })
  );
}

// Helper: wrap an async fn so that each call respects the limiter
export function withRateLimit<Args extends any[], R>(
  limiter: RateLimiter,
  fn: (...args: Args) => Promise<R>,
  options?: { autoMark?: boolean }
) {
  return async (...args: Args): Promise<R> => {
    await waitForRateLimit(limiter, options);
    return fn(...args);
  };
}

// Convenience: wrap with the global email limiter
export function withEmailRateLimit<Args extends any[], R>(
  fn: (...args: Args) => Promise<R>,
  options?: { autoMark?: boolean }
) {
  return withRateLimit(emailRateLimiter, fn, options);
}

// Example usage (not executed):
// const sendWeekly = withEmailRateLimit(async () => { ... });
// await sendWeekly();


