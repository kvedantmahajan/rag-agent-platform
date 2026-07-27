const endpoints = [
  {
    href: "/chat-basic",
    label: "Chat (basic)",
    api: "POST /rag/chat-basic",
    summary: "Plain LLM — no knowledge base",
    points: [
      "No KB lookup; general assistant only",
      "Good for: “What is 2 plus 2?”",
      "Will hallucinate product/support answers",
    ],
  },
  {
    href: "/chat-rag",
    label: "Chat (RAG)",
    api: "POST /rag/chat-rag",
    summary: "Manual RAG — always searches first",
    points: [
      "Always searches KB, then injects chunks into the system prompt",
      "Good for: “How do I get a refund?”",
      "Predictable, but searches even when unnecessary",
    ],
  },
  {
    href: "/chat",
    label: "Chat (tools)",
    api: "POST /rag/chat",
    summary: "Tool-calling RAG — LLM decides when to search",
    points: [
      "Uses searchKnowledgeBase tool only when needed",
      "Refund question → searches; math → answers directly",
      "Flexible, but depends on the model choosing the right tool",
    ],
  },
  {
    href: "/cited-answer",
    label: "Cited answer",
    api: "POST /rag/cited-answer",
    summary: "Structured output — not a chat",
    points: [
      "Single question in, JSON out with citations",
      "Returns { answer, citations: [{ chunkTitle, quote }] }",
      "Uses useObject instead of useChat",
    ],
  },
] as const;

export function EndpointGuide() {
  return (
    <section
      style={{
        marginBottom: "1.5rem",
        padding: "1rem 1.25rem",
        borderRadius: 8,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        fontSize: 14,
      }}
    >
      <h2 style={{ margin: "0 0 0.75rem", fontSize: 16 }}>
        Which endpoint should I use?
      </h2>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
        }}
      >
        {endpoints.map((ep) => (
          <article
            key={ep.href}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: 6,
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: "0.5rem",
                marginBottom: "0.35rem",
              }}
            >
              <a href={ep.href} style={{ fontWeight: 600 }}>
                {ep.label}
              </a>
              <code style={{ fontSize: 12, color: "#64748b" }}>{ep.api}</code>
            </div>
            <p style={{ margin: "0 0 0.5rem", color: "#334155" }}>
              {ep.summary}
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.25rem",
                color: "#475569",
              }}
            >
              {ep.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
