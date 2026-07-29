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
              margin: "0 0 0.5rem",
              fontSize: 13,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Session 7 — Production RAG
          </p>
        </header>
        {children}
      </body>
    </html>
  );
}
