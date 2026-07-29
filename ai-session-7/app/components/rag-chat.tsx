"use client";

import { useState } from "react";
import { ragQuery } from "@/lib/api";

type Source = { title: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  sources?: Source[];
  meta?: string;
};

const EXAMPLE_QUESTIONS = [
  "How do I get a refund?",
  "How do I reset my password?",
  "How do I cancel my subscription?",
  "How can I track my order?",
  "How do I update my billing information?",
  "How do I set up two-factor authentication?",
];

export function RagChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;

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
      { id: assistantId, role: "assistant", text: "" },
    ]);

    try {
      const res = await ragQuery(q);
      const contentType = res.headers.get("content-type") ?? "";

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || `HTTP ${res.status}`);
      }

      // Confidence miss returns plain JSON (not SSE)
      if (contentType.includes("application/json")) {
        const data = (await res.json()) as {
          answer?: string;
          sources?: Source[];
        };
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId
              ? {
                  ...msg,
                  text: data.answer ?? "No answer.",
                  sources: data.sources ?? [],
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
            const snapshot = fullText;
            setMessages((m) =>
              m.map((msg) =>
                msg.id === assistantId ? { ...msg, text: snapshot } : msg,
              ),
            );
          }
          if (payload.done) {
            sources = payload.sources ?? [];
            meta = [payload.category, payload.model]
              .filter(Boolean)
              .join(" · ");
          }
        }
      }

      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? { ...msg, text: fullText || msg.text, sources, meta }
            : msg,
        ),
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Request failed";
      setError(message);
      setMessages((m) =>
        m.map((msg) =>
          msg.id === assistantId
            ? {
                ...msg,
                text: msg.text || "Something went wrong.",
              }
            : msg,
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <>
      <h1>Knowledge-base Q&amp;A</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Ask a support question grounded in our demo knowledge base. Click an
        example to see streaming retrieval + generation:
      </p>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {EXAMPLE_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy}
            onClick={() => void ask(q)}
            style={{
              padding: "6px 10px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #cbd5e1",
              background: "#fff",
              cursor: busy ? "not-allowed" : "pointer",
              textAlign: "left",
            }}
          >
            {q}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              padding: 12,
              borderRadius: 8,
              background: message.role === "user" ? "#eef2ff" : "#f5f5f5",
            }}
          >
            <strong>
              {message.role === "user" ? "You" : "Assistant"}:{" "}
            </strong>
            <span style={{ whiteSpace: "pre-wrap" }}>{message.text}</span>
            {message.sources && message.sources.length > 0 && (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {message.sources.map((s, i) => (
                  <li key={`${s.title}-${i}`}>{s.title}</li>
                ))}
              </ul>
            )}
            {message.meta && (
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                {message.meta}
              </p>
            )}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "crimson" }}>
          {error}. Is Nest running and is{" "}
          <code>NEXT_PUBLIC_API_URL</code> correct?
        </p>
      )}

      <form
        onSubmit={onSubmit}
        style={{ marginTop: 16, display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask something..."
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </form>
    </>
  );
}
