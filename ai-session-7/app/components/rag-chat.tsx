"use client";

import { useEffect, useRef, useState } from "react";
import { ragQuery } from "@/lib/api";

type Source = { title: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  meta?: string;
  streaming?: boolean;
};

const EXAMPLE_QUESTIONS = [
  "How do I get a refund?",
  "How do I reset my password?",
  "How do I cancel my subscription?",
  "How can I track my order?",
  "How do I update my billing information?",
  "How do I set up two-factor authentication?",
];

/** Reveal buffered text on a cadence so fast SSE is still visible. */
function createReveal(
  onFrame: (shown: string) => void,
  charsPerTick = 3,
  intervalMs = 18,
) {
  let pending = "";
  let shown = "";
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;
  let resolveDone: (() => void) | null = null;

  const schedule = () => {
    if (timer != null || closed) return;
    timer = setTimeout(tick, intervalMs);
  };

  const tick = () => {
    timer = null;
    if (shown.length < pending.length) {
      shown = pending.slice(
        0,
        Math.min(pending.length, shown.length + charsPerTick),
      );
      onFrame(shown);
      schedule();
      return;
    }
    if (resolveDone) {
      const done = resolveDone;
      resolveDone = null;
      done();
    }
  };

  return {
    push(chunk: string) {
      if (!chunk) return;
      pending += chunk;
      schedule();
    },
    /** Wait until UI has caught up to all pushed text. */
    flush(): Promise<void> {
      if (shown.length >= pending.length) return Promise.resolve();
      return new Promise((resolve) => {
        resolveDone = resolve;
        schedule();
      });
    },
    cancel() {
      closed = true;
      if (timer != null) clearTimeout(timer);
      timer = null;
      if (resolveDone) {
        resolveDone();
        resolveDone = null;
      }
    },
  };
}

export function RagChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<ReturnType<typeof createReveal> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    return () => revealRef.current?.cancel();
  }, []);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

    revealRef.current?.cancel();
    setInput("");
    setError(null);
    setBusy(true);

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      text: q,
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((m) => [
      ...m,
      userMsg,
      { id: assistantId, role: "assistant", text: "", streaming: true },
    ]);

    const reveal = createReveal((shown) => {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: shown, streaming: true }
            : msg,
        ),
      );
    });
    revealRef.current = reveal;

    try {
      const res = await ragQuery(q);
      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }

      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          answer?: string;
          sources?: Source[];
        };
        const answer = data.answer ?? "No answer.";
        reveal.push(answer);
        await reveal.flush();
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  text: answer,
                  sources: data.sources ?? [],
                  streaming: false,
                }
              : msg,
          ),
        );
        return;
      }

      if (!res.body) throw new Error("Empty response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";
      let sources: Source[] = [];
      let meta = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part
            .split("\n")
            .find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as {
            token?: string;
            done?: boolean;
            sources?: Source[];
            model?: string;
            category?: string;
            error?: string;
          };
          if (payload.error) throw new Error(payload.error);
          if (payload.token) {
            fullText += payload.token;
            reveal.push(payload.token);
          }
          if (payload.done) {
            sources = payload.sources ?? [];
            meta = [payload.category, payload.model]
              .filter(Boolean)
              .join(" · ");
          }
        }
      }

      await reveal.flush();
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: fullText || msg.text,
                sources,
                meta,
                streaming: false,
              }
            : msg,
        ),
      );
    } catch (err) {
      reveal.cancel();
      const message =
        err instanceof Error ? err.message : "Request failed";
      setError(message);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: msg.text || "Something went wrong. Please try again.",
                streaming: false,
              }
            : msg,
        ),
      );
    } finally {
      revealRef.current = null;
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div className="chat-shell">
      <div className="chat-toolbar">
        <span className="live-pill">
          {busy ? "Streaming answer" : "Live · grounded retrieval"}
        </span>
        <span>Sources cited when matched</span>
      </div>

      <div className="examples">
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="example-chip"
            disabled={busy}
            onClick={() => void ask(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-state">
            Start with an example above — you will see tokens stream in as the
            model answers from retrieved articles.
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`msg ${
              message.role === "user" ? "msg-user" : "msg-assistant"
            }${message.streaming ? " msg-streaming" : ""}`}
          >
            <span className="msg-role">
              {message.role === "user" ? "You" : "Fathom"}
            </span>
            <span className="msg-text">{message.text}</span>
            {message.sources && message.sources.length > 0 && (
              <ul className="sources">
                {message.sources.map((s, i) => (
                  <li key={`${s.title}-${i}`}>{s.title}</li>
                ))}
              </ul>
            )}
            {message.meta && <p className="msg-meta">{message.meta}</p>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <p className="chat-error">
          {error}. Check that the API is reachable and try again.
        </p>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask a support question…"
          aria-label="Ask a support question"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
