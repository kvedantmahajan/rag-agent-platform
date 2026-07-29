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
Browser (Next.js · Vercel · ai-session-7/app)
        │
        ▼
NestJS API (Render · ai-session-7/server)
        │
        ├──► Postgres + pgvector (Neon)
        └──► Groq HTTPS API
```

Both UI and API live in `ai-session-7`. The browser talks only to NestJS (`lib/api.ts` → `NEXT_PUBLIC_API_URL`). No Next.js `app/api` routes.

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
| **UI**         | Next.js chat in `ai-session-7` streaming Nest `POST /rag/query` via `lib/api.ts`           |
| **Agents**     | LangGraph tool-calling flows with interrupt / resume (e.g. refund approval)                |
| **Ops**        | Health checks, CORS, env fail-fast, RAGAS eval harness as CI gate                          |

---

## Tech stack

- **API:** NestJS, TypeScript, Zod (`ai-session-7/server`)
- **Data:** PostgreSQL, pgvector, Xenova embeddings
- **LLM:** Groq (production); Ollama optional locally
- **Frontend:** Next.js App Router (`ai-session-7/app`, `lib/api.ts`)
- **Agents:** LangGraph.js, human-in-the-loop (`ai-session-6`)
- **Hosting:** Render · Neon · Vercel

---

## Quick start (developers)

```bash
cd ai-session-7
cp .env.example .env   # GROQ_API_KEY, DATABASE_URL, NEXT_PUBLIC_API_URL
npm install
npm run seed:kb        # no-op if kb_articles already filled
npm run dev:api        # Nest http://localhost:3001
npm run dev:web        # Next http://localhost:3000  (separate terminal)
```

Production Nest (Render): `npm run build && npm run start`  
Production Next (Vercel): root `ai-session-7`, build `npm run build:web`

---

## Repository map

| Path               | Role                                              |
| ------------------ | ------------------------------------------------- |
| `ai-session-7`     | **Prod unit** — Nest API (Render) + Next UI (Vercel) |
| `ai-session-5`     | Curriculum RAG UI (earlier session; not deploy unit) |
| `ai-session-6`     | LangGraph agents + HITL UI                        |
| `ai-session-1`–`4` | Curriculum building blocks                        |

---

## Author

Built as applied AI engineering practice alongside production NestJS backend experience (fintech / lending systems). Resume: Knowledge-Base Q&A Platform (RAG + Evals).
