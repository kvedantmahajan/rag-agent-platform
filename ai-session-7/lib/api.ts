// All API calls go to NestJS on Render.
// No api/ folder in this Next.js project — NestJS is the API.
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function ragQuery(question: string) {
  // SSE stream from NestJS /rag/query endpoint
  return fetch(`${API_BASE}/rag/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, topK: 3 }),
  });
}

export async function agentChat(message: string) {
  return fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
}

export async function healthCheck() {
  return fetch(`${API_BASE}/health`);
}
