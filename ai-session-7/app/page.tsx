import { ApiWarmupBanner } from "@/app/components/api-warmup-banner";
import { RagChat } from "@/app/components/rag-chat";

export default function Home() {
  return (
    <div className="page-shell">
      <nav className="site-nav">
        <a className="brand" href="#chat">
          <span className="brand-mark" aria-hidden />
          Fathom
        </a>
        <div className="nav-links">
          <a href="#chat">Chat</a>
          <a href="#use-cases">Use cases</a>
          <a href="#built">What I built</a>
          <a href="#how">How I built it</a>
          <a href="#impact">Why it matters</a>
          <a href="#deploy">How I deployed</a>
        </div>
      </nav>

      <header className="hero">
        <p className="hero-kicker">Knowledge-Base Q&amp;A · RAG + Evals</p>
        <h1>Grounded docs Q&amp;A with cited sources</h1>
        <p className="hero-lead">
          I built a production RAG system that answers only from retrieved docs,
          streams responses in real time, and cites its sources — with
          confidence-gating so weak matches don’t hallucinate.
        </p>
        <div className="hero-actions">
          <a className="btn-primary" href="#chat">
            Try the chat
          </a>
          <a className="btn-ghost" href="#built">
            Architecture &amp; stack
          </a>
        </div>
      </header>

      <section className="use-cases" id="use-cases">
        <div className="section-label">Business use cases</div>
        <h2>Where this shows up in a real company</h2>
        <p>
          Same pattern teams use when wrong answers cost money, trust, or
          compliance — not a toy chatbot.
        </p>
        <ul className="use-case-grid">
          <li>
            <strong>Customer support</strong>
            <span>
              Shoppers ask about refunds, passwords, tracking, or billing and get
              answers only from approved help articles — with the article cited.
            </span>
          </li>
          <li>
            <strong>Support agent assist</strong>
            <span>
              Agents on a call get a grounded draft in seconds instead of hunting
              through a wiki, and can verify the source before sending.
            </span>
          </li>
          <li>
            <strong>Internal ops &amp; policy</strong>
            <span>
              Employees query SOPs and policy docs and see which document the
              answer came from — useful for onboarding and audit trails.
            </span>
          </li>
          <li>
            <strong>Safe “I don’t know”</strong>
            <span>
              When the knowledge base doesn’t cover the question, the system
              refuses clearly instead of inventing a confident wrong answer.
            </span>
          </li>
        </ul>
      </section>

      <section className="demo-section" id="chat">
        <div className="section-label">Live chat</div>
        <h2>Ask the knowledge base</h2>
        <p>
          Pick an example or type your own. Answers stream over SSE and surface
          cited sources when retrieval clears the confidence gate.
        </p>
        <ApiWarmupBanner />
        <RagChat />
      </section>

      <section className="content-section" id="built">
        <div className="section-label">What I built</div>
        <h2>Knowledge-Base Q&amp;A Platform</h2>
        <p>
          Grounded document Q&amp;A end to end: NestJS RAG, vector retrieval,
          streaming answers with citation parsing, human-in-the-loop agents, and
          RAGAS-style evaluation gates.
        </p>
        <ul className="stack-list">
          <li>
            <strong>NestJS RAG API</strong>
            <span>
              Confidence-gating, classification, model routing, prompt caching,
              retry/fallback, and SSE with abort/timeouts
            </span>
          </li>
          <li>
            <strong>Vector database</strong>
            <span>
              PostgreSQL + pgvector on Neon with MiniLM embeddings for semantic
              search
            </span>
          </li>
          <li>
            <strong>Next.js UI</strong>
            <span>
              Streaming chat client with cited sources rendered from{" "}
              <code>SOURCES</code> / retrieval metadata
            </span>
          </li>
          <li>
            <strong>Evals &amp; agents</strong>
            <span>
              Golden dataset, LLM-as-judge (faithfulness / relevancy / context
              precision), LangGraph human-in-the-loop
            </span>
          </li>
        </ul>
      </section>

      <section className="content-section" id="how">
        <div className="section-label">How I built it</div>
        <h2>Architecture &amp; production fixes</h2>
        <p>
          Beyond “call an LLM”: retrieval controls, cost-aware routing, resilient
          streaming, and automated evals — the same failure modes that show up
          when a demo becomes production traffic.
        </p>

        <h3 className="subhead">Architecture decisions</h3>
        <ol className="decision-list">
          <li>
            <strong>pgvector confidence-gating</strong>
            <span>
              Embed → semantic search → generate only when similarity clears the
              gate; weak retrieval refuses instead of hallucinating.
            </span>
          </li>
          <li>
            <strong>Citation parsing</strong>
            <span>
              Context-only generation with <code>SOURCES: [n]</code> parsing so
              every answer carries an audit trail of grounded articles.
            </span>
          </li>
          <li>
            <strong>Query classification + model routing</strong>
            <span>
              Classify SIMPLE / CLASSIFICATION / SYNTHESIS / REASONING, then route
              to a fast vs capable model — paying the right price per task.
            </span>
          </li>
          <li>
            <strong>Prompt caching</strong>
            <span>
              Cache stable system / context prefixes so unchanged prompt tokens
              are not fully re-billed on every request.
            </span>
          </li>
          <li>
            <strong>Retry + fallback</strong>
            <span>
              Exponential backoff with jitter on 429/5xx, then fall back to a
              smaller model so a single provider blip does not take down the
              feature.
            </span>
          </li>
          <li>
            <strong>Production streaming</strong>
            <span>
              SSE with connection management: client disconnect aborts generation,
              request timeouts via <code>AbortController</code>, and no hanging
              writes after the socket closes.
            </span>
          </li>
          <li>
            <strong>Golden dataset + LLM-as-judge + Langfuse</strong>
            <span>
              Fixed questions with expected retrieve / refuse behavior; automated
              faithfulness, relevancy, and context-precision checks; optional
              Langfuse traces (retrieval → classify → generation) when keys are set.
            </span>
          </li>
          <li>
            <strong>Human-in-the-loop agents</strong>
            <span>
              LangGraph interrupt / resume before irreversible tools — agents with
              a control plane, not autopilot.
            </span>
          </li>
        </ol>

        <h3 className="subhead">Tech stack</h3>
        <ul className="stack-list">
          <li>
            <strong>NestJS · Node.js · TypeScript · Zod</strong>
            <span>Production RAG API and validation</span>
          </li>
          <li>
            <strong>PostgreSQL · pgvector · Neon</strong>
            <span>Vector database for semantic retrieval</span>
          </li>
          <li>
            <strong>LLMs · Groq · Prompt engineering</strong>
            <span>Classification, routing, caching, streaming, retries</span>
          </li>
          <li>
            <strong>Next.js · React</strong>
            <span>Streaming UI and product homepage</span>
          </li>
          <li>
            <strong>LangGraph.js · HITL</strong>
            <span>Tool-calling agents with human approval</span>
          </li>
          <li>
            <strong>Golden set · LLM-as-judge · Langfuse</strong>
            <span>Evals + optional production tracing</span>
          </li>
        </ul>
      </section>

      <section className="content-section" id="impact">
        <div className="section-label">Why it matters</div>
        <h2>What breaks when demos meet production</h2>
        <p>
          These are the failure modes I designed the stack around — the difference
          between a local prototype and something you can put behind a real
          product surface.
        </p>
        <ul className="use-case-grid">
          <li>
            <strong>Cost spirals</strong>
            <span>
              Ten local queries feel free; 10,000 production queries/day do not. A
              2,000-token system prompt that never changes still bills those tokens
              on every call unless you cache and route by task difficulty.
            </span>
          </li>
          <li>
            <strong>Inconsistent latency</strong>
            <span>
              800ms locally can become 8 seconds in production. One slow provider
              call cascades through the feature — hence timeouts, abort-on-disconnect,
              retries with jitter, and fallback models.
            </span>
          </li>
          <li>
            <strong>Silent quality degradation</strong>
            <span>
              A bug crashes your server. An AI regression returns a confident,
              fluent, wrong answer with HTTP error rate still zero — golden
              datasets and LLM-as-judge evals catch that class of failure.
            </span>
          </li>
          <li>
            <strong>Tool-use failures</strong>
            <span>
              An agent works with one model; switch providers to cut cost and the
              new model emits malformed tool calls — silent failure on a large
              slice of traffic without schema validation and HITL on irreversible
              actions.
            </span>
          </li>
        </ul>
      </section>

      <section className="content-section" id="deploy">
        <div className="section-label">How I deployed</div>
        <h2>Full-stack on Render, Neon, and Vercel</h2>
        <p>
          I deployed the stack split for API warmth and UI speed — browser talks
          only to NestJS; no Next.js API proxy in the production path.
        </p>
        <div className="deploy-flow" aria-hidden="true">
          <span>Next.js · Vercel</span>
          <span className="deploy-arrow">→</span>
          <span>NestJS · Render</span>
          <span className="deploy-arrow">→</span>
          <span>Neon pgvector · Groq</span>
        </div>
        <ul className="stack-list">
          <li>
            <strong>Render</strong>
            <span>
              NestJS web service · <code>/health</code> · free tier sleeps when
              idle (page warms API on load; first wake ~30–60s)
            </span>
          </li>
          <li>
            <strong>Neon</strong>
            <span>Serverless PostgreSQL + pgvector (pooled connection)</span>
          </li>
          <li>
            <strong>Vercel</strong>
            <span>
              Next.js frontend · <code>NEXT_PUBLIC_API_URL</code> → Render
            </span>
          </li>
          <li>
            <strong>Langfuse · optional</strong>
            <span>
              Env-gated traces for retrieval, classify, and generation on{" "}
              <code>/rag/query</code> — off unless keys are set
            </span>
          </li>
          <li>
            <strong>Secrets</strong>
            <span>
              <code>GROQ_API_KEY</code>, <code>DATABASE_URL</code>,{" "}
              <code>FRONTEND_URL</code>, optional <code>LANGFUSE_*</code> — host
              dashboards only
            </span>
          </li>
        </ul>

        <a
          className="repo-embed"
          href="https://github.com/kvedantmahajan/rag-agent-platform"
          target="_blank"
          rel="noopener noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="repo-embed-og"
            src="https://opengraph.githubassets.com/1/kvedantmahajan/rag-agent-platform"
            alt="GitHub repository preview for rag-agent-platform"
            width={1200}
            height={600}
          />
          <span className="repo-embed-meta">
            <span className="repo-embed-label">Source on GitHub</span>
            <strong>kvedantmahajan/rag-agent-platform</strong>
            <span>
              NestJS RAG API · Next.js UI · pgvector · evals — open the repo for
              implementation details
            </span>
          </span>
        </a>
      </section>

      <footer className="site-footer">
        Knowledge-Base Q&amp;A Platform · RAG + Evals
      </footer>
    </div>
  );
}
