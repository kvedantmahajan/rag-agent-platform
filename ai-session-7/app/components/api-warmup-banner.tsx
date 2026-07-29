"use client";

import { useEffect, useState } from "react";
import { healthCheck } from "@/lib/api";

type Status = "warming" | "ready" | "error";

/**
 * Proactively hits Nest /health so a free-tier Render cold start
 * often finishes before the visitor tries the chat.
 */
export function ApiWarmupBanner() {
  const [status, setStatus] = useState<Status>("warming");
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const tick = window.setInterval(() => {
      setSeconds(Math.floor((Date.now() - started) / 1000));
    }, 1000);

    async function warm() {
      const deadline = Date.now() + 120_000;
      while (!cancelled && Date.now() < deadline) {
        try {
          const res = await healthCheck({ signal: AbortSignal.timeout(55_000) });
          if (res.ok) {
            if (!cancelled) setStatus("ready");
            return;
          }
        } catch {
          // cold start / network — keep retrying
        }
        await new Promise((r) => setTimeout(r, 2500));
      }
      if (!cancelled) setStatus("error");
    }

    void warm();
    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, []);

  return (
    <div
      className={`api-warmup api-warmup-${status}`}
      role="status"
      aria-live="polite"
    >
      {status === "warming" && (
        <>
          <strong>Waking the API…</strong>
          <span>
            Free-tier Render sleeps when idle. This page pings{" "}
            <code>/health</code> on load so the chat is usually ready when you
            try it (often ~30–60s on first wake · {seconds}s).
          </span>
        </>
      )}
      {status === "ready" && (
        <>
          <strong>API ready</strong>
          <span>
            Nest is warm — ask a question below. If you hit this after a long
            idle, the first request can still take a moment.
          </span>
        </>
      )}
      {status === "error" && (
        <>
          <strong>API still waking</strong>
          <span>
            The free instance may need another minute. Wait briefly, then retry
            an example — or open{" "}
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/health`}
              target="_blank"
              rel="noopener noreferrer"
            >
              /health
            </a>{" "}
            in a new tab.
          </span>
        </>
      )}
    </div>
  );
}
