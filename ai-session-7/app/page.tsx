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
              Semantic chunking, MMR, pgvector confidence-gating, streaming SSE,
              prompt caching, and model routing
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
            <strong>Agents &amp; RAGAS CI gates</strong>
            <span>
              LangGraph human-in-the-loop interrupts; faithfulness, relevancy,
              and context precision evals
            </span>
          </li>
        </ul>
      </section>

      <section className="content-section" id="how">
        <div className="section-label">How I built it</div>
        <h2>Architecture &amp; tech stack</h2>
        <p>
          Applied AI and GenAI patterns I used on this project — Retrieval-Augmented
          Generation, prompt engineering, human-in-the-loop ML, and a TypeScript
          backend stack.
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
            <strong>Semantic chunking &amp; MMR</strong>
            <span>
              Chunk and diversify retrieved context so the model sees relevant,
              non-redundant passages before generation.
            </span>
          </li>
          <li>
            <strong>Model routing + prompt caching</strong>
            <span>
              Route simple vs synthesis queries to the right LLM tier; cache
              stable prompt prefixes where the provider supports it.
            </span>
          </li>
          <li>
            <strong>Streaming SSE</strong>
            <span>
              Token streaming from Nest to the browser for realtime chat, not a
              single blocking JSON response.
            </span>
          </li>
          <li>
            <strong>Human-in-the-loop + RAGAS gates</strong>
            <span>
              LangGraph interrupt / resume before irreversible tools; CI-oriented
              faithfulness, relevancy, and context precision checks.
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
            <span>Model routing, streaming generation, retries</span>
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
            <strong>RAGAS-style evals</strong>
            <span>Faithfulness · relevancy · context precision</span>
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
              NestJS web service · <code>/health</code> · TypeScript build ·{" "}
              <code>node dist/main.js</code>
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
            <strong>Secrets</strong>
            <span>
              <code>GROQ_API_KEY</code>, <code>DATABASE_URL</code>,{" "}
              <code>FRONTEND_URL</code> for CORS — host dashboards only
            </span>
          </li>
        </ul>
      </section>

      <footer className="site-footer">
        Knowledge-Base Q&amp;A Platform · RAG + Evals
      </footer>
    </div>
  );
}
