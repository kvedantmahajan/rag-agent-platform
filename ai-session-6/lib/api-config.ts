/** Session 6 Nest backend — LangGraph HITL agent. */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

export const agentApi = {
  chat: `${API_URL}/agent/chat`,
  resume: `${API_URL}/agent/resume`,
} as const;
