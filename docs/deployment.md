# Deployment guide (internal)

Target stack for `rag-agent-platform` production demos and resume live URLs.

```text
Browser (Next.js on Vercel)
        │
        ▼
NestJS API (Render / Railway / Fly)
        │
        ├──► Postgres + pgvector (Neon / Supabase)
        └──► Groq HTTPS API  (managed model)
```

This path **does not** require Anthropic, AWS GPUs, Ollama in the cloud, or Session 7 prompt caching.

---

## 1. What to deploy

The monorepo is session-based. Deploy **applications**, not every CLI exercise.

| App                                            | Source         | Public surface                |
| ---------------------------------------------- | -------------- | ----------------------------- |
| **RAG + streaming UI** (primary)               | `ai-session-5` | Next.js pages → Nest `/rag/*` |
| **Agents + HITL UI** (optional second service) | `ai-session-6` | Next.js → Nest `/agent/*`     |

Sessions 1–4 remain local learning steps. Session 7 caching demos stay optional/local.

**Suggested first ship:** Session 5 only. Add Session 6 when the HITL agent should be publicly demoable.

---

## 2. Component choices

| Layer    | Recommended               | Alternatives | Notes                                                                    |
| -------- | ------------------------- | ------------ | ------------------------------------------------------------------------ |
| Frontend | **Vercel**                | Netlify      | Set `NEXT_PUBLIC_API_URL` to the Nest public URL                         |
| API      | **Render** or **Railway** | Fly.io       | Long-lived Node process; enable CORS for the Vercel origin               |
| Database | **Neon**                  | Supabase     | Enable `vector` extension; use connection pooler URL carefully with Nest |
| LLM      | **Groq**                  | —            | `GROQ_API_KEY` only; no GPU infra                                        |

Pick one option per row and stick to it for a given environment (`staging` / `prod`).

---

## 3. Database (Neon or Supabase)

1. Create a Postgres project.
2. Enable pgvector:

   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. Seed `kb_articles` from Session 7 fixture JSON (Nest boot does this
   automatically if the table is empty):

   ```bash
   cd ai-session-7
   npm run seed:kb              # Nest CLI context; skip if rows exist
   npm run seed:kb -- --force   # clear + reload fixtures/kb-articles.json
   ```

4. Copy the connection string into the API host as `DATABASE_URL`.

**Pooling:** Neon’s pooled endpoint is fine for many serverless clients. Nest on Render/Railway is a long-lived process — prefer the **direct** or documented Nest-friendly URL if you see flaky connects; follow Neon’s Nest/pg guidance for your plan.

**Embeddings / seed:** On API startup, `KnowledgeBaseService` loads the embedder and seeds from `fixtures/kb-articles.json` if `kb_articles` is empty. Use `SEED_KB=force` or `npm run seed:kb -- --force` to reload.

---

## 4. NestJS API (Render / Railway / Fly)

### Build & start (Session 5 example)

From `ai-session-5`:

| Setting        | Value                                                                             |
| -------------- | --------------------------------------------------------------------------------- |
| Root directory | `ai-session-5`                                                                    |
| Install        | `npm install`                                                                     |
| Start          | `npm run start:api` (or `npx tsx --tsconfig server/tsconfig.json server/main.ts`) |
| Health         | `GET /` may 404 — use a known route or add a `/health` later                      |

### Required env (API)

```bash
GROQ_API_KEY=...
DATABASE_URL=postgresql://...
API_PORT=3000
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
LLM_MODEL_TOOLS=llama-3.3-70b-versatile
```

Do **not** set Ollama overrides in production unless the API can reach an Ollama host.

### CORS

Session 5/6 enable CORS for `http://localhost:3001`. For production, update `server/main.ts` (or equivalent) to allow:

- `https://<your-app>.vercel.app`
- optional custom domain

Redeploy API after changing allowed origins.

### Cold starts / timeouts

- Prefer a **non-sleeping** plan on Render if demos must be snappy.
- Streaming RAG responses need a host that supports long-lived HTTP; avoid forcing the Nest LLM stack through Vercel serverless functions.

---

## 5. Next.js (Vercel)

1. Import the GitHub repo in Vercel.
2. Set **Root Directory** to `ai-session-5` (or `ai-session-6`).
3. Framework preset: Next.js.
4. Env:

   ```bash
   NEXT_PUBLIC_API_URL=https://<your-nestjs-host>
   ```

5. Deploy. Confirm the browser calls Nest (Network tab), not a missing relative `/api`.

`NEXT_PUBLIC_*` is baked in at build time — redeploy the frontend if the API URL changes.

---

## 6. Groq

1. Create a key at [console.groq.com](https://console.groq.com/).
2. Set `GROQ_API_KEY` only on the **API** service (never in the Next.js client).
3. Use production model IDs already referenced in sessions (e.g. `llama-3.3-70b-versatile`). Update if Groq deprecates an ID.

---

## 7. End-to-end checklist

- [ ] `vector` extension enabled; `kb_articles` populated
- [ ] Nest reachable over HTTPS; `GROQ_API_KEY` + `DATABASE_URL` set
- [ ] CORS allows the Vercel origin
- [ ] `NEXT_PUBLIC_API_URL` points at Nest
- [ ] Smoke test: Session 5 chat / RAG page returns a grounded answer
- [ ] (Optional) Session 6: refund HITL approve/deny flow
- [ ] README / resume live URL updated

---

## 8. Local vs production

| Concern | Local                             | Production                      |
| ------- | --------------------------------- | ------------------------------- |
| LLM     | Groq and/or Ollama (`.env.local`) | Groq only                       |
| DB      | Local Postgres or Neon branch     | Neon/Supabase                   |
| Front   | `localhost:3001`                  | Vercel                          |
| API     | `localhost:3000`                  | Render/Railway/Fly              |
| Secrets | `.env` (gitignored)               | Host dashboards / secret stores |

---

## 9. Cost posture (default path)

- **Vercel / Render / Neon free or low tiers** are enough for portfolio demos.
- **Groq:** pay-per-token; usually cheap at demo traffic.
- **Avoid** always-on AWS GPU for this architecture — out of scope for the chosen deploy path.

---

## 10. Out of scope (for now)

- Anthropic prompt caching as a production dependency
- Self-hosted Ollama/vLLM on AWS GPU
- Multi-region HA, GPU autoscaling, custom CUDA stacks

Document any future self-host experiment separately; do not mix it into this default pipeline without an explicit env/provider switch.
