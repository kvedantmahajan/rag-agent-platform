# Session 6 — LangGraph agents + HITL UI

**CLI demos:** `step1-basic-agent.js`, `step3-langgraph-agent.js`, `step4-human-in-loop.js`  
**Web:** Next.js (`:3001`) → NestJS (`:3000`) with LangGraph interrupt / resume

## Layout

```
server/          Nest API + shared LangGraph HITL agent
app/             Next.js UI (chat + Approve/Deny)
lib/api-config.ts
step*.js         Original CLI exercises
```

## Run web (HITL)

```bash
cd ai-session-6
cp .env.example .env   # set GROQ_API_KEY
npm install
npm run dev:api        # http://localhost:3000
npm run dev:web        # http://localhost:3001
# or: npm run dev
```

Open http://localhost:3001 and send:  
`Please process a refund for my order #4821` → Approve or Deny.

## API

| Route | Body | Result |
|-------|------|--------|
| `POST /agent/chat` | `{ threadId?, message }` | `approval_required` or `done` |
| `POST /agent/resume` | `{ threadId, decision: "yes"\|"no" }` | `done` (or another interrupt) |

## CLI

```bash
node step1-basic-agent.js
node step3-langgraph-agent.js
node step4-human-in-loop.js   # terminal Approve via readline
```
