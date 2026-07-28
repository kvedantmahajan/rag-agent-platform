"use client";

import { useState } from "react";
import { agentApi } from "@/lib/api-config";

type Approval = {
  prompt: string;
  orderId: string;
  amount: number;
  message: string;
};

type AgentResult =
  | { status: "approval_required"; threadId: string; approval: Approval }
  | { status: "done"; threadId: string; reply: string }
  | { status: "error"; error: string };

type ChatLine =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string }
  | { role: "approval"; approval: Approval; threadId: string };

export default function Home() {
  const [input, setInput] = useState(
    "Please process a refund for my order #4821",
  );
  const [threadId, setThreadId] = useState<string | null>(null);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResult(result: AgentResult, asUser?: string) {
    if (result.status === "error") {
      setError(result.error);
      return;
    }
    setThreadId(result.threadId);
    setError(null);

    const next: ChatLine[] = [];
    if (asUser) next.push({ role: "user", text: asUser });

    if (result.status === "approval_required") {
      next.push({
        role: "approval",
        approval: result.approval,
        threadId: result.threadId,
      });
    } else {
      next.push({ role: "assistant", text: result.reply });
    }
    setLines((prev) => [...prev, ...next]);
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    const message = input.trim();
    if (!message || busy) return;
    setBusy(true);
    setInput("");
    try {
      const res = await fetch(agentApi.chat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message }),
      });
      const result = (await res.json()) as AgentResult;
      await handleResult(result, message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: "yes" | "no", forThread: string) {
    setBusy(true);
    try {
      const res = await fetch(agentApi.resume, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: forThread, decision }),
      });
      const result = (await res.json()) as AgentResult;
      // Replace the pending approval card with the outcome
      setLines((prev) => prev.filter((l) => l.role !== "approval"));
      await handleResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Resume failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h1>Session 6 — LangGraph HITL</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Next (:3001) → Nest (:3000). Try: “Please process a refund for my order
        #4821”
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {lines.map((line, i) => {
          if (line.role === "user") {
            return (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#eef2ff",
                }}
              >
                <strong>You: </strong>
                {line.text}
              </div>
            );
          }
          if (line.role === "assistant") {
            return (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "#f5f5f5",
                }}
              >
                <strong>Agent: </strong>
                {line.text}
              </div>
            );
          }
          return (
            <div
              key={i}
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#fff7ed",
                border: "1px solid #fdba74",
              }}
            >
              <strong>{line.approval.prompt}</strong>
              <p style={{ margin: "8px 0" }}>{line.approval.message}</p>
              <p style={{ margin: "0 0 12px", fontSize: 14, color: "#555" }}>
                Order {line.approval.orderId} · ${line.approval.amount}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide("yes", line.threadId)}
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => decide("no", line.threadId)}
                >
                  Deny
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <form
        onSubmit={sendMessage}
        style={{ marginTop: 16, display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          placeholder="Ask the support agent..."
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </>
  );
}
