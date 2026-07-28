# Knowledge-Base Q&A Platform

Grounded document Q&A with **cited sources**, confidence-gated retrieval, streaming answers, and optional **human-in-the-loop** agents — built as a full-stack NestJS + Next.js system on PostgreSQL (`pgvector`) with Groq-hosted LLMs.

| | |
|---|---|
| **Repo** | [github.com/kvedantmahajan/rag-agent-platform](https://github.com/kvedantmahajan/rag-agent-platform) |
| **Live** | _Add production URL after deploy_ |
| **Stack** | NestJS · Next.js · PostgreSQL / pgvector · Groq · Vercel AI SDK · LangGraph |

---

## Why this exists

Support and internal-docs Q&A fails in two common ways: the model **hallucinates** when retrieval is weak, or the UI streams fluent answers with **no audit trail**. This project focuses on production RAG patterns used in real backend systems: retrieve with a similarity gate, generate only from context, cite sources, stream to the client, and (for agents) require human approval before irreversible actions.

---

## Architecture

```text
Browser (Next.js · Vercel)
        │
        ▼
NestJS API (Render / Railway / Fly)
        │
        ├──► Postgres + pgvector (Neon / Supabase)
        └──► Groq HTTPS API
```

The browser talks only to NestJS. LLM calls and vector search stay on the API — not in Next.js route handlers — so auth, retrieval policy, and model choice remain server-side.

Deploy details: [docs/deployment.md](docs/deployment.md).

---

## Capabilities

| Area | What shipped |
|------|----------------|
| **Retrieval** | Embeddings → `pgvector` similarity search, confidence thresholding, chunking / MMR options |
| **Generation** | Context-only prompting, inline citations / `SOURCES`, streaming SSE responses |
| **UI** | Next.js chat surfaces via Vercel AI SDK (`useChat` / structured outputs) |
| **Agents** | LangGraph tool-calling flows with interrupt / resume (e.g. refund approval) |
| **Ops-minded design** | Provider switch (Groq prod / Ollama local), Zod request validation, modular Nest services |

---

## Tech stack

- **API:** NestJS, TypeScript, Zod  
- **Data:** PostgreSQL, pgvector, Xenova embeddings (ingest / query path)  
- **LLM:** Groq (production default); Ollama supported for local runs  
- **Frontend:** Next.js App Router, Vercel AI SDK  
- **Agents:** LangGraph.js, human-in-the-loop interrupts  

---

## Quick start (developers)

```bash
# Populate kb_articles (once) — needs Postgres + pgvector
cd ai-session-3 && npm install && node step1-setup.js && node step2-ingest.js

# Full-stack RAG UI
cd ../ai-session-5
cp .env.example .env   # GROQ_API_KEY, DATABASE_URL
npm install
npm run dev:api        # http://localhost:3000
npm run dev:web        # http://localhost:3001
```

Agent + HITL UI: `ai-session-6` (`npm run dev:api` / `npm run dev:web`).

Required secrets: `GROQ_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_API_URL` (see `.env.example` files under each app).

---

## Repository map

Incremental modules under `ai-session-*` (prompts → vectors → RAG → UI → agents → production patterns). The **deployable apps** are `ai-session-5` (RAG + UI) and `ai-session-6` (agents + HITL).

---

## Author

Built as applied AI engineering practice alongside production NestJS backend experience (fintech / lending systems). Resume: Knowledge-Base Q&A Platform (RAG + Evals).
