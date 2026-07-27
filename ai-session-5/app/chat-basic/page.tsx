import { ChatPanel } from "@/app/components/chat-panel";
import { ragApi } from "@/lib/api-config";

export default function ChatBasicPage() {
  return (
    <ChatPanel
      api={ragApi.chatBasic}
      title="Session 5 — Plain chat"
      description={`No RAG — LLM only (${ragApi.chatBasic}). Try “What is 2 plus 2?”`}
    />
  );
}
