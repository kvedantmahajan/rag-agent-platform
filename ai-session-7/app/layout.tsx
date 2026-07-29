import type { Metadata } from "next";
import { Figtree, Syne } from "next/font/google";
import "./globals.css";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  display: "swap",
});

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Knowledge-Base Q&A Platform · RAG + Evals",
  description:
    "Grounded docs Q&A with cited sources — NestJS RAG, pgvector confidence-gating, streaming SSE, and RAGAS evals. Deployed on Render, Neon, and Vercel.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${syne.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
