# Deployment guide (internal)

Target stack for `rag-agent-platform` production demos and resume live URLs.

```text
Browser (Next.js on Vercel — ai-session-7/app)
        │
        ▼
NestJS API (Render — ai-session-7/server)
        │
        ├──► Postgres + pgvector (Neon, pooled URL)
        └──► Groq HTTPS API  (managed model)
```

This path **does not** require Anthropic, AWS GPUs, or Ollama in the cloud. UI and API both live under `ai-session-7` (no Next `app/api` folder — `lib/api.ts` calls Nest).

---

## 1. What to deploy

| App                     | Source                                        | Host                   |
| ----------------------- | --------------------------------------------- | ---------------------- |
| **Production Nest API** | `ai-session-7` (`npm run build` → `dist/`)    | Render (`render.yaml`) |
| **RAG UI**              | `ai-session-7` Next app (`npm run build:web`) | Vercel                 |

Path filters avoid rebuilding both on every push:

- **Render** (`render.yaml` `buildFilter`): Nest only when `server/`, `fixtures/`, or shared `package.json` / lockfile / `render.yaml` change
- **Vercel** (`vercel.json` `ignoreCommand`): Next skipped unless `app/`, `lib/`, Next config, or shared package files change

Shared `package.json` changes still trigger both (expected).

Primary API routes on Render:

| Route             | Purpose                                   |
| ----------------- | ----------------------------------------- |
| `GET /health`     | Render health check (after embedder warm) |
| `POST /rag/query` | Production RAG (routing, retry, SSE)      |

First Nest boot with pooled `DATABASE_URL` runs `KnowledgeBaseService` schema + seed-from-fixtures if empty.

---

## 2. Neon

1. Create project (e.g. Singapore / `ap-southeast-1`).
2. Enable extension: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy **pooled** connection string (`…-pooler.…`, `sslmode=require`) into Render `DATABASE_URL`.
4. On first Nest boot, `KnowledgeBaseService` ensures schema and seeds from `fixtures/kb-articles.json` if empty.
5. Verify after deploy: `SELECT COUNT(*) FROM kb_articles;` → **6**

**Never commit** Neon passwords. Rotate if a URL was pasted into chat/logs.

---

## 3. Render (Nest — `ai-session-7`)

Blueprint: repo-root [`render.yaml`](../render.yaml) (`rootDir: ai-session-7`).

| Setting | Value                                 |
| ------- | ------------------------------------- |
| Build   | `npm install && npm run build`        |
| Start   | `npm run start` → `node dist/main.js` |
| Health  | `/health`                             |

### Env (dashboard secrets)

| Key            | Value                                               |
| -------------- | --------------------------------------------------- |
| `GROQ_API_KEY` | Groq key                                            |
| `DATABASE_URL` | Neon **pooled** URL                                 |
| `FRONTEND_URL` | `https://<your-app>.vercel.app` (no trailing slash) |
| `NODE_ENV`     | `production`                                        |
| `PORT`         | **Do not set** — Render injects it                  |

Cold start on free tier can take ~30s (embedder load in `onModuleInit`). Health check waits until modules init.

---

## 4. Vercel (Next — `ai-session-7`)

1. Import repo; **Root Directory** = `ai-session-7`
2. Build command: `npm run build:web` (see `vercel.json`)
3. Env: `NEXT_PUBLIC_API_URL=https://rag-agent-platform.onrender.com` (your Render URL, no trailing slash)
4. Redeploy after changing `NEXT_PUBLIC_*`
5. Set matching `FRONTEND_URL` on Render, then redeploy Nest

---

## 5. Local vs production

| Concern | Local                       | Production              |
| ------- | --------------------------- | ----------------------- |
| API     | `npm run dev:api` → `:3001` | Render `npm run start`  |
| DB      | `rag_kb` or Neon            | Neon pooled             |
| Front   | `npm run dev:web` → `:3000` | Vercel (`ai-session-7`) |
| LLM     | Groq (optional Ollama)      | Groq only               |

---

## 6. Checklist

- [ ] Neon `vector` + 6 `kb_articles` rows
- [ ] Render env: `GROQ_API_KEY`, pooled `DATABASE_URL`, `FRONTEND_URL`
- [ ] `GET /health` → 200
- [ ] `POST /rag/query` streams tokens
- [ ] Vercel `NEXT_PUBLIC_API_URL` → Render
- [ ] CORS: no trailing slash mismatch
- [ ] README Live URLs + cold-start note
- [ ] Rotate Neon password if it was exposed

---

## 7. Out of scope

- Anthropic prompt caching as a prod dependency
- AWS GPU / self-hosted Ollama
- Session 6 HITL UI on Vercel (follow-up)
