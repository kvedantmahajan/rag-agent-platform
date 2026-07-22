import { pipeline } from "@xenova/transformers";
import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
// vector(384) matches all-MiniLM-L6-v2 output dimensions
await db.query(`
    CREATE TABLE IF NOT EXISTS kb_articles (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding vector(384)
    )
`);
// ivfflat index for fast approximate nearest-neighbour search

// lists=100 is a good default for up to ~1M rows
await db.query(`
    CREATE INDEX IF NOT EXISTS kb_embedding_idx
    ON kb_articles
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100)
    `);
console.log("Table and index created.");
// First run downloads model (~25MB). Subsequent runs use cache.
const embedder = await pipeline(
    "feature-extraction",
    "Xenova/all-MiniLM-L6-v2"
);
const output = await embedder("test sentence", {
    pooling: "mean",
    normalize: true,
});
const vector = Array.from(output.data);
console.log("Dimensions:", vector.length); // should be 384
console.log("First 5:", vector.slice(0, 5)); // small floats
await db.end();

// OBSERVE
// You should see exactly 384 dimensions. The values will be small floats between
// roughly -1 and 1. The model is downloaded once and cached — subsequent runs skip the
// download.