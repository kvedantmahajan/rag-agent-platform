# Deployment guide (internal)

Target stack for `rag-agent-platform` production demos and resume live URLs.

```text
Browser (Next.js on Vercel — ai-session-5)
        │
        ▼
NestJS API (Render — ai-session-7)
        │
        ├──► Postgres + pgvector (Neon, pooled URL)
        └──► Groq HTTPS API  (managed model)
```

This path **does not** require Anthropic, AWS GPUs, or Ollama in the cloud.

---

## 1. What to deploy

| App | Source | Host |
|-----|--------|------|
| **Production Nest API** | `ai-session-7` | Render (`render.yaml`) |
| **RAG UI** | `ai-session-5` (Next.js only) | Vercel |

Primary API routes on Render:

| Route | Purpose |
|-------|---------|
| `GET /health` | Render health check (after embedder warm) |
| `POST /rag/query` | Production RAG (routing, retry, SSE) |

Session 5 UI pages that call `/rag/chat*` expect the Session 5 Nest shape. For the Session 7 ship, smoke the API with `/health` and `/rag/query`; point `NEXT_PUBLIC_API_URL` at Render when aligning UI routes, or keep Session 5 Nest for those chat pages locally.

---

## 2. Neon

1. Create project (e.g. Singapore / `ap-southeast-1`).
2. Enable extension: `CREATE EXTENSION IF NOT EXISTS vector;`
3. Copy **pooled** connection string (`…-pooler.…`, `sslmode=require`) for Render.
4. Seed (once), using **direct** URL locally if preferred:

   ```bash
   cd ai-session-7
   DATABASE_URL='postgresql://…@ep-….neon.tech/neondb?sslmode=require' \
     npm run seed:kb -- --force
   ```

5. Verify: `SELECT COUNT(*) FROM kb_articles;` → **6**

**Never commit** Neon passwords. Rotate if a URL was pasted into chat/logs.

---

## 3. Render (Nest — `ai-session-7`)

Blueprint: repo-root [`render.yaml`](../render.yaml) (`rootDir: ai-session-7`).

| Setting | Value |
|---------|--------|
| Build | `npm install && npm run build` |
| Start | `npm run start` → `node dist/main.js` |
| Health | `/health` |

### Env (dashboard secrets)

| Key | Value |
|-----|--------|
| `GROQ_API_KEY` | Groq key |
| `DATABASE_URL` | Neon **pooled** URL |
| `FRONTEND_URL` | `https://<your-app>.vercel.app` (no trailing slash) |
| `NODE_ENV` | `production` |
| `PORT` | **Do not set** — Render injects it |

Cold start on free tier can take ~30s (embedder load in `onModuleInit`). Health check waits until modules init.

---

## 4. Vercel (Next — `ai-session-5`)

1. Import repo; **Root Directory** = `ai-session-5`
2. Env: `NEXT_PUBLIC_API_URL=https://rag-agent-platform.onrender.com` (your Render URL)
3. Redeploy after changing `NEXT_PUBLIC_*`
4. Set matching `FRONTEND_URL` on Render, then redeploy Nest

---

## 5. Local vs production

| Concern | Local | Production |
|---------|--------|------------|
| API | `npm run dev:api` / `tsx` in `ai-session-7` | Render `npm run start` |
| DB | `rag_kb` or Neon | Neon pooled |
| Front | `ai-session-5` `:3001` | Vercel |
| LLM | Groq (optional Ollama) | Groq only |

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
