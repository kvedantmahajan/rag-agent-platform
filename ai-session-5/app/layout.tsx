import { EndpointGuide } from "@/app/components/endpoint-guide";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          maxWidth: 720,
          margin: "2rem auto",
          padding: "0 1rem",
          lineHeight: 1.5,
        }}
      >
        <header style={{ marginBottom: "1.5rem" }}>
          <p
            style={{
              margin: "0 0 1rem",
              fontSize: 13,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Session 5 — Vercel AI SDK
          </p>
          <nav
            style={{
              display: "flex",
              gap: "1rem",
              flexWrap: "wrap",
              marginBottom: "1rem",
            }}
          >
            <a href="/chat-basic">Chat (basic)</a>
            <a href="/chat-rag">Chat (RAG)</a>
            <a href="/chat">Chat (tools)</a>
            <a href="/cited-answer">Cited answer</a>
          </nav>
        </header>
        <EndpointGuide />
        {children}
      </body>
    </html>
  );
}
