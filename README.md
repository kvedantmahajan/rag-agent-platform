# Knowledge-Base Q&A Platform

Grounded document Q&A with **cited sources**, confidence-gated retrieval, streaming answers, and optional **human-in-the-loop** agents — built as a full-stack NestJS + Next.js system on PostgreSQL (`pgvector`) with Groq-hosted LLMs.

|                  |                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Repo**         | [github.com/kvedantmahajan/rag-agent-platform](https://github.com/kvedantmahajan/rag-agent-platform) |
| **API (Render)** | `https://rag-agent-platform.onrender.com` — set after first deploy                                   |
| **UI (Vercel)**  | _Add after Vercel deploy_                                                                            |
| **Stack**        | NestJS · Next.js · PostgreSQL / pgvector · Groq · Vercel AI SDK · LangGraph                          |

**Note:** Render free tier sleeps after idle time. The first request after sleep can take ~30 seconds while the embedding model loads.

---

## Why this exists

Support and internal-docs Q&A fails in two common ways: the model **hallucinates** when retrieval is weak, or the UI streams fluent answers with **no audit trail**. This project focuses on production RAG patterns used in real backend systems: retrieve with a similarity gate, generate only from context, cite sources, stream to the client, and (for agents) require human approval before irreversible actions.

---

## Architecture

```text
Browser (Next.js · Vercel · ai-session-5)
        │
        ▼
NestJS API (Render · ai-session-7)
        │
        ├──► Postgres + pgvector (Neon)
        └──► Groq HTTPS API
```

The browser talks only to NestJS. LLM calls and vector search stay on the API — not in Next.js route handlers — so auth, retrieval policy, and model choice remain server-side.

Deploy details: [docs/deployment.md](docs/deployment.md). Blueprint: [render.yaml](render.yaml).

### Production API

| Method | Path         | Notes                                     |
| ------ | ------------ | ----------------------------------------- |
| `GET`  | `/health`    | Warm check for Render                     |
| `POST` | `/rag/query` | Body `{ "question": "..." }` — SSE stream |

---

## Capabilities

| Area           | What shipped                                                                               |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Retrieval**  | Embeddings → `pgvector` similarity search, confidence thresholding, chunking / MMR options |
| **Generation** | Context-only prompting, citations / `SOURCES`, streaming SSE, model routing + retry        |
| **UI**         | Next.js chat surfaces via Vercel AI SDK (`useChat` / structured outputs)                   |
| **Agents**     | LangGraph tool-calling flows with interrupt / resume (e.g. refund approval)                |
| **Ops**        | Health checks, CORS, env fail-fast, RAGAS eval harness as CI gate                          |

---

## Tech stack

- **API:** NestJS, TypeScript, Zod (`ai-session-7`)
- **Data:** PostgreSQL, pgvector, Xenova embeddings
- **LLM:** Groq (production); Ollama optional locally
- **Frontend:** Next.js App Router, Vercel AI SDK (`ai-session-5`)
- **Agents:** LangGraph.js, human-in-the-loop (`ai-session-6`)
- **Hosting:** Render · Neon · Vercel

---

## Quick start (developers)

```bash
cd ai-session-7
cp .env.example .env   # GROQ_API_KEY, DATABASE_URL
npm install
npm run seed:kb        # no-op if kb_articles already filled
npm run dev:api        # http://localhost:3000

# UI (separate terminal)
cd ../ai-session-5
cp .env.example .env
npm install
npm run dev:web        # http://localhost:3001
```

Production build (Render):

```bash
cd ai-session-7 && npm run build && npm run start
```

---

## Repository map

| Path               | Role                                  |
| ------------------ | ------------------------------------- |
| `ai-session-7`     | **Production Nest API** (deploy unit) |
| `ai-session-5`     | Next.js RAG UI (Vercel)               |
| `ai-session-6`     | LangGraph agents + HITL UI            |
| `ai-session-1`–`4` | Curriculum building blocks            |

---

## Author

Built as applied AI engineering practice alongside production NestJS backend experience (fintech / lending systems). Resume: Knowledge-Base Q&A Platform (RAG + Evals).
