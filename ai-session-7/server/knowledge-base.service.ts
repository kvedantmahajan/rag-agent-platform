import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { pipeline } from "@xenova/transformers";
import pg from "pg";

export interface SearchResult {
    id: number;
    title: string;
    content: string;
    similarity: number;
}

export interface SearchResponse {
    query: string;
    results: SearchResult[];
    topResult: SearchResult | null;
    hasConfidentMatch: boolean;
}

type ArticleFixture = { title: string; content: string };

@Injectable()
export class KnowledgeBaseService implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(KnowledgeBaseService.name);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private embedder: any = null;
    private readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    private readonly SIMILARITY_THRESHOLD = 0.42;

    async onModuleInit() {
        this.embedder = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2",
        );
        await this.ensureSchema();
        const force = process.env.SEED_KB === "force";
        await this.seedFromFixture({ force });
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    private async embed(text: string): Promise<number[]> {
        if (!this.embedder) throw new Error("Model not initialised");
        const out = await this.embedder(text, { pooling: "mean", normalize: true });
        return Array.from(out.data as Float32Array);
    }

    async ensureSchema(): Promise<void> {
        await this.pool.query(`CREATE EXTENSION IF NOT EXISTS vector`);
        await this.pool.query(`
            CREATE TABLE IF NOT EXISTS kb_articles (
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding vector(384)
            )
        `);
        await this.pool.query(`
            CREATE INDEX IF NOT EXISTS kb_embedding_idx
            ON kb_articles
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        `);
    }

    /** Same pattern as Session 4 ingestArticle. */
    async ingestArticle(title: string, content: string): Promise<void> {
        const vec = await this.embed(`${title}. ${content}`);
        await this.pool.query(
            `INSERT INTO kb_articles (title, content, embedding)
             VALUES ($1, $2, $3)`,
            [title, content, `[${vec.join(",")}]`],
        );
    }

    /**
     * Read fixtures/kb-articles.json and seed.
     * Default: no-op if rows already exist. force=true clears and reloads.
     */
    async seedFromFixture(opts: { force?: boolean } = {}): Promise<number> {
        const force = opts.force === true;
        const { rows } = await this.pool.query<{ n: number }>(
            "SELECT COUNT(*)::int AS n FROM kb_articles",
        );
        if (rows[0].n > 0 && !force) {
            this.logger.log(`kb_articles already has ${rows[0].n} row(s); skip seed`);
            return rows[0].n;
        }

        const articles = this.loadFixtureArticles();
        if (force) await this.pool.query("DELETE FROM kb_articles");

        for (const article of articles) {
            await this.ingestArticle(article.title, article.content);
            this.logger.log(`Seeded: "${article.title}"`);
        }
        return articles.length;
    }

    private loadFixtureArticles(): ArticleFixture[] {
        const root = join(dirname(fileURLToPath(import.meta.url)), "..");
        const path = join(root, "fixtures", "kb-articles.json");
        return JSON.parse(readFileSync(path, "utf8")) as ArticleFixture[];
    }

    async search(query: string, topK = 5): Promise<SearchResponse> {
        const vec = await this.embed(query);
        const vecStr = `[${vec.join(",")}]`;
        const { rows } = await this.pool.query<SearchResult>(
            `SELECT id, title, content,
            (1-(embedding<=>$1::vector))::float AS similarity
            FROM kb_articles
            WHERE 1-(embedding<=>$1::vector) > $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3`,
            [vecStr, this.SIMILARITY_THRESHOLD * 0.5, topK],
        );
        const above = rows.filter((r) => r.similarity >= this.SIMILARITY_THRESHOLD);
        return {
            query,
            results: rows,
            topResult: rows[0] ?? null,
            hasConfidentMatch: above.length > 0,
        };
    }
}
