# Knowledge-Base Q&A Platform

Grounded docs Q&A with **cited sources**: NestJS RAG (semantic chunking, MMR, pgvector **confidence-gating**, streaming SSE, prompt caching, model routing), Next.js UI, plus **RAGAS** CI gates on faithfulness / relevancy / context precision — deployed on **Render**, **Neon**, and **Vercel**.

|                  |                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| **Repo**         | [github.com/kvedantmahajan/rag-agent-platform](https://github.com/kvedantmahajan/rag-agent-platform) |
| **API (Render)** | `https://rag-agent-platform.onrender.com`                                                            |
| **UI (Vercel)**  | [rag-agent-platform.vercel.app](https://rag-agent-platform.vercel.app)                               |
| **Stack**        | NestJS · Next.js · PostgreSQL / pgvector · Groq · LangGraph · RAGAS-style evals                      |

**Note:** Render free tier sleeps after idle time. The first request after sleep can take ~30 seconds while the embedding model loads.

---

## Why this exists

Support and internal-docs Q&A fails in two common ways: the model **hallucinates** when retrieval is weak, or the UI streams fluent answers with **no audit trail**. I focused this project on production RAG with confidence-gating and citation parsing: retrieve with a similarity gate, generate only from context, cite sources, stream over SSE, and (for agents) require human approval before irreversible actions.

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

Both UI and API live in `ai-session-7`. The browser talks only to NestJS (`NEXT_PUBLIC_API_URL`). No Next.js `app/api` routes.

Deploy details: [docs/deployment.md](docs/deployment.md). Blueprint: [render.yaml](render.yaml).

### Production API

| Method | Path         | Notes                                     |
| ------ | ------------ | ----------------------------------------- |
| `GET`  | `/health`    | Warm check for Render                     |
| `POST` | `/rag/query` | Body `{ "question": "..." }` — SSE stream |

---

## Capabilities

| Area           | What shipped                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------------- |
| **Retrieval**  | Embeddings → `pgvector` similarity search, confidence-gating, semantic chunking / MMR              |
| **Generation** | Context-only prompting, citation parsing / `SOURCES`, streaming SSE, prompt caching, model routing |
| **UI**         | Next.js chat streaming Nest `POST /rag/query`                                                      |
| **Agents**     | LangGraph tool-calling with human-in-the-loop interrupt / resume (e.g. refund approval)            |
| **Ops**        | Health checks, CORS, env fail-fast, RAGAS CI gates (faithfulness / relevancy / context precision)  |

---

## Tech stack

- **Applied AI & GenAI:** RAG, LLMs, prompt engineering, LangGraph, human-in-the-loop, vector databases, RAGAS-style evals
- **API:** NestJS, Node.js, TypeScript, Zod (`ai-session-7/server`)
- **Data:** PostgreSQL, pgvector, Xenova embeddings (Neon in production)
- **LLM:** Groq (production); Ollama optional locally
- **Frontend:** Next.js, React (`ai-session-7/app`)
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

| Path               | Role                                                   |
| ------------------ | ------------------------------------------------------ |
| `ai-session-7`     | Shipped unit — Nest API (Render) + Next UI (Vercel)    |
| `ai-session-5`     | Earlier RAG UI (not the deploy unit)                   |
| `ai-session-6`     | LangGraph agents + human-in-the-loop UI                |
| `ai-session-1`–`4` | Foundational modules leading up to the production path |

---

## Author

I built this as applied AI engineering practice alongside NestJS backend work in fintech / lending systems.
