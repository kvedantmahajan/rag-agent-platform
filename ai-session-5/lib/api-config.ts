/** Session 5 Nest backend — all LLM/RAG lives in server/, not Next.js API routes. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const ragApi = {
  chat: `${API_URL}/rag/chat`,
  chatBasic: `${API_URL}/rag/chat-basic`,
  chatRag: `${API_URL}/rag/chat-rag`,
  citedAnswer: `${API_URL}/rag/cited-answer`,
} as const;
