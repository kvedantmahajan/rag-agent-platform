import { ChatPanel } from "@/app/components/chat-panel";
import { ragApi } from "@/lib/api-config";

export default function ChatRagPage() {
  return (
    <ChatPanel
      api={ragApi.chatRag}
      title="Session 5 — Manual RAG"
      description={`Always searches the knowledge base before answering (${ragApi.chatRag}). Try “How do I get a refund?”`}
    />
  );
}
