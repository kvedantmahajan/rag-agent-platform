import { pipeline } from "@xenova/transformers";
import pg from "pg";
import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
async function embed(text) {
    const out = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
}

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

function buildPrompt(chunks, question) {
    const ctx = chunks.map(c => `Article: ${c.title}\n${c.content}`).join("\n\n---\n\n");
    return {
        system: `You are a helpful customer support assistant.
        Answer using ONLY the information in the context below.
        If context does not contain enough information, say: "I do not have information about that."
        If context only partially answers, state what information is missing.
        Do not use any knowledge outside the provided context.`,
        user: `<context>\n${ctx}\n</context>\n\n<question>\n${question}\n</question>`
    };
}

async function rag(question) {
    console.log(`\nQ: "${question}"`);
    const chunks = await retrieve(question);
    if (chunks.length === 0) {
        console.log("No confident match. Returning fallback.");
        return;
    }
    console.log(`Retrieved ${chunks.length} chunks:`);
    chunks.forEach(c => console.log(` [${(c.similarity * 100).toFixed(1)}%] ${c.title}`));
    const prompt = buildPrompt(chunks, question);
    const res = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
        temperature: 0, max_tokens: 300
    });
    console.log("A:", res.choices[0].message.content);
}
const questions = [
    "How do I get a refund?",
    "I forgot my password",
    "Can I cancel my plan mid-month?",
    "Do you offer crypto payments?", // not in KB -- should trigger fallback
];
for (const q of questions) await rag(q);
await db.end();

// OBSERVE
// The crypto payments question should trigger 'No confident match' -- the threshold
// filter caught it before generation. If the model answers that question with invented
// information, your threshold is too low.