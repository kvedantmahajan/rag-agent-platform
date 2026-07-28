import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
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

@Injectable()
export class KnowledgeBaseService implements OnModuleInit, OnModuleDestroy {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private embedder: any = null;
    private readonly pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
    private readonly SIMILARITY_THRESHOLD = 0.55;

    // Runs once at module startup. Model loads here, NOT per-request.
    async onModuleInit() {
        this.embedder = await pipeline(
            "feature-extraction",
            "Xenova/all-MiniLM-L6-v2",
        );
    }

    async onModuleDestroy() {
        await this.pool.end();
    }

    private async embed(text: string): Promise<number[]> {
        if (!this.embedder) throw new Error("Model not initialised");
        const out = await this.embedder(text, { pooling: "mean", normalize: true });
        return Array.from(out.data as Float32Array);
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
