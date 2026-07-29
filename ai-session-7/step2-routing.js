import Groq from "groq-sdk";
import { pipeline } from "@xenova/transformers";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
async function embed(text) {
    const out = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
}

// retrieve() from Session 4 — unchanged
async function retrieve(query, topK = 3, threshold = 0.55) {
    const vec = await embed(query);
    const vs = `[${vec.join(",")}]`;
    const r = await db.query(
        `SELECT title, content, 1-(embedding<=>$1::vector) AS similarity
        FROM kb_articles
        WHERE 1-(embedding<=>$1::vector) > $2
        ORDER BY embedding<=>$1::vector LIMIT $3`,
        [vs, threshold * 0.5, topK]
    );
    return r.rows.filter(r => r.similarity >= threshold);
}

async function classifyQuery(query) {
    const res = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            {
                role: "system",
                content:
                    "Classify this query into exactly one category.\n"
                    + "Reply with ONLY the label.\n"
                    + "SIMPLE: factual question with a direct answer\n"
                    + "CLASSIFICATION: needs to be routed or labelled\n"
                    + "SYNTHESIS: requires combining multiple sources\n"
                    + "REASONING: ambiguous, multi-step, needs judgment",
            },
            { role: "user", content: query }
        ],
        temperature: 0,
        max_tokens: 10,
    });
    return res.choices[0].message.content.trim();
}

function selectModel(category) {
    const routing = {
        SIMPLE: { model: "llama-3.1-8b-instant", temp: 0 },
        CLASSIFICATION: { model: "llama-3.1-8b-instant", temp: 0 },
        SYNTHESIS: { model: "llama-3.3-70b-versatile", temp: 0 },
        REASONING: { model: "llama-3.3-70b-versatile", temp: 0 },
    };
    return routing[category]
        ?? { model: "llama-3.3-70b-versatile", temp: 0 };
}

async function routedRag(question, chunks) {
    const category = await classifyQuery(question);
    const { model, temp } = selectModel(category);
    console.log(`Category: ${category} -> ${model}`);
    const ctx = chunks
        .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
        .join("\n\n");
    const res = await groq.chat.completions.create({
        model,
        messages: [
            {
                role: "system",
                content:
                    "Answer using ONLY the context. "
                    + "SOURCES: [n] for each article used."
            },
            {
                role: "user",
                content:
                    `<context>\n${ctx}\n</context>\n`
                    + `<question>${question}</question>`
            },
        ],
        temperature: temp, max_tokens: 300,
    });
    return {
        answer: res.choices[0].message.content,
        model,
        category,
    };
}

const tests = [
    "What is your refund policy?", "Is my issue billing or technical?",
    "What happens to billing AND data if I cancel?",
    "Charged twice and cannot log in -- what first?",
];
for (const q of tests) {
    const chunks = await retrieve(q);
    const result = await routedRag(q, chunks);
    console.log(`Q: ${q}`);
    console.log(` -> ${result.model} (${result.category})\n`);
}
await db.end();
