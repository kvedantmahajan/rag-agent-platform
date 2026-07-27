"use client";

import { experimental_useObject as useObject } from "@ai-sdk/react";
import { citedAnswerSchema } from "@/lib/citation-schema";
import { ragApi } from "@/lib/api-config";
import { useState } from "react";

export default function CitedAnswerPage() {
  const { object, submit, isLoading } = useObject({
    api: ragApi.citedAnswer,
    schema: citedAnswerSchema,
  });
  const [query, setQuery] = useState("");

  return (
    <>
      <h1>Cited answer (structured stream)</h1>
      <p style={{ color: "#555", fontSize: 14 }}>
        Nest backend: {ragApi.citedAnswer}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="How do I get a refund?"
          style={{ flex: 1, padding: 8 }}
        />
        <button onClick={() => submit({ query })} disabled={isLoading}>
          Ask
        </button>
      </div>

      <p>{object?.answer}</p>
      <ul>
        {object?.citations?.map((c, i) => (
          <li key={i}>
            <strong>{c?.chunkTitle}</strong>: &quot;{c?.quote}&quot;
          </li>
        ))}
      </ul>
    </>
  );
}
