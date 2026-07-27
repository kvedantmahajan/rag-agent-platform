# Session 5 — Vercel AI SDK

Next.js client (`:3001`) → NestJS backend (`:3000`). No Next.js API routes.

## Layout

```
app/          Next.js UI (useChat / useObject)
lib/          Client config + shared schemas
server/       NestJS API (AI SDK + RAG)
```

## Run

```bash
npm install
npm run dev:api   # Nest → http://localhost:3000
npm run dev:web   # Next → http://localhost:3001
# or: npm run dev
```

Copy `.env.example` to `.env` and `.env.local`. LLM config lives in `server/model.ts`.

## Nest endpoints

| Route | UI page |
|-------|---------|
| `POST /rag/chat-basic` | `/chat-basic` |
| `POST /rag/chat-rag` | `/chat-rag` |
| `POST /rag/chat` | `/chat` |
| `POST /rag/cited-answer` | `/cited-answer` |

Client API URLs: `lib/api-config.ts` (`NEXT_PUBLIC_API_URL`).
