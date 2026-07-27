"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";

type ChatPanelProps = {
  api: string;
  title: string;
  description: string;
  showTools?: boolean;
};

export function ChatPanel({
  api,
  title,
  description,
  showTools = false,
}: ChatPanelProps) {
  const { messages, sendMessage, status, stop, error } = useChat({
    transport: new DefaultChatTransport({ api }),
  });
  const [input, setInput] = useState("");

  return (
    <>
      <h1>{title}</h1>
      <p style={{ color: "#555", fontSize: 14 }}>{description}</p>

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
            <strong>{message.role === "user" ? "You" : "Assistant"}: </strong>
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return <span key={i}>{part.text}</span>;
              }

              if (showTools && part.type === "tool-searchKnowledgeBase") {
                switch (part.state) {
                  case "input-streaming":
                    return <em key={i}> Preparing search...</em>;
                  case "input-available":
                    return (
                      <em key={i}>
                        {" "}
                        Searching for &quot;
                        {(part.input as { query?: string })?.query}&quot;...
                      </em>
                    );
                  case "output-available":
                    return (
                      <details key={i} style={{ marginTop: 8 }}>
                        <summary>Searched knowledge base</summary>
                        <pre style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
                          {String(part.output)}
                        </pre>
                      </details>
                    );
                  case "output-error":
                    return (
                      <span key={i} style={{ color: "crimson" }}>
                        {" "}
                        Search failed: {part.errorText}
                      </span>
                    );
                }
              }

              return null;
            })}
          </div>
        ))}
      </div>

      {error && (
        <p style={{ color: "crimson" }}>
          Something went wrong. Is the Nest backend running on port 3000?
        </p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({ text: input });
            setInput("");
          }
        }}
        style={{ marginTop: 16, display: "flex", gap: 8 }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={status !== "ready"}
          placeholder="Ask something..."
          style={{ flex: 1, padding: 8 }}
        />
        {status === "streaming" || status === "submitted" ? (
          <button type="button" onClick={() => stop()}>
            Stop
          </button>
        ) : (
          <button type="submit" disabled={status !== "ready"}>
            Send
          </button>
        )}
      </form>
    </>
  );
}
