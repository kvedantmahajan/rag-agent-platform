import { pipeline } from "@xenova/transformers";
import pg from "pg";
import * as dotenv from "dotenv";
dotenv.config();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
async function embed(text) {
    const out = await embedder(text, { pooling: "mean", normalize: true });
    return Array.from(out.data);
}

async function search(query, topK = 3) {
    const queryVector = await embed(query);
    const queryStr = `[${queryVector.join(",")}]`;
    // <=> = cosine DISTANCE (lower = more similar)
    // 1 - distance = cosine SIMILARITY (higher = more similar)
    const result = await db.query(
        `SELECT
        title,
        content,
        1 - (embedding <=> $1::vector) AS similarity
        FROM kb_articles
        ORDER BY embedding <=> $1::vector
        LIMIT $2`,
        [queryStr, topK]
    );
    return result.rows;
}
const queries = [
    "I forgot my password and cant get in",
    "I want my money back",
    "stop my monthly payment",
    "where is my package",
    "add a new credit card",
    "make my account more secure",
    "I was charged twice",
];
for (const query of queries) {
    console.log(`Query: "${query}"`);
    const results = await search(query, 3);
    results.forEach((r, i) => {
        const pct = (r.similarity * 100).toFixed(1);
        console.log(` ${i + 1}. [${pct}%] ${r.title}`);
    });
    console.log();
}
await db.end();