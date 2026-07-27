import { ChatPanel } from "@/app/components/chat-panel";
import { ragApi } from "@/lib/api-config";

export default function ChatToolsPage() {
  return (
    <ChatPanel
      api={ragApi.chat}
      title="Session 5 — Tool-calling RAG"
      description={`LLM decides when to search (${ragApi.chat}). Try “How do I get a refund?” vs “What is 2 plus 2?”`}
      showTools
    />
  );
}
