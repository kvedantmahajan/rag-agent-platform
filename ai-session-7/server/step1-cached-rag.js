import Anthropic from "@anthropic-ai/sdk";
import { pipeline } from "@xenova/transformers";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: true });

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

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

async function generateCached(question, chunks) {
    const ctx = chunks
        .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
        .join("\n\n");
    const response = await anthropic.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system: [
            {
                type: "text",
                // Identical on every call — cache this prefix
                text:
                    "You are a helpful customer support assistant.\n"
                    + "Answer using ONLY the information in the context.\n"
                    + "If context is insufficient, say so explicitly.\n"
                    + "If partially answered, state what is missing.\n"
                    + "After your answer, write SOURCES: [n] "
                    + "for each article you used.",
                cache_control: { type: "ephemeral" },
            },
        ],
        messages: [{
            role: "user",
            content:
                `<context>\n${ctx}\n</context>\n`
                + `<question>${question}</question>`,
        }],
    });
    const u = response.usage;
    console.log(
        `Tokens: input=${u.input_tokens} `
        + `cached_read=${u.cache_read_input_tokens ?? 0} `
        + `cached_create=${u.cache_creation_input_tokens ?? 0} `
        + `output=${u.output_tokens}`
    );
    return response.content[0].text;
}

const q = "How do I get a refund?";
const chunks = await retrieve(q);
console.log("\n--- First call (cache miss) ---");
await generateCached(q, chunks);
console.log("\n--- Second call within 5 min (cache hit) ---");
await generateCached(q, chunks);

await db.end();
