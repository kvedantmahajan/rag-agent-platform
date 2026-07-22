import { Injectable, OnModuleInit } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource } from "typeorm";
import { pipeline, Pipeline } from "@xenova/transformers";
interface SearchResult {
    id: number; title: string; content: string; similarity: number;
}
interface SearchResponse {
    query: string;
    results: SearchResult[];
    topResult: SearchResult | null;
    hasConfidentMatch: boolean; // similarity above threshold
}
@Injectable()
export class KnowledgeBaseService implements OnModuleInit {
    private embedder: Pipeline | null = null;
    private readonly SIMILARITY_THRESHOLD = 0.60;
    constructor(@InjectDataSource() private readonly ds: DataSource) { }
    // Runs once at module startup. Model loads here, NOT per-request.
    // Loading takes ~500ms. You do not want this in the hot path.
    async onModuleInit() {
        this.embedder = await pipeline(
            "feature-extraction", "Xenova/all-MiniLM-L6-v2"
        );
    }

    private async embed(text: string): Promise<number[]> {
        if (!this.embedder) throw new Error("Model not initialised");
        const out = await this.embedder(text, { pooling: "mean", normalize: true });
        return Array.from(out.data as Float32Array);
    }
    async search(query: string, topK = 5): Promise<SearchResponse> {
        const vec = await this.embed(query);
        const vecStr = `[${vec.join(",")}]`;
        // Push the threshold filter into SQL to use the index.
        // Never filter in Node.js -- that causes a full table scan.
        const rows = await this.ds.query<SearchResult[]>(
            `SELECT id, title, content,
        (1-(embedding<=>$1::vector))::float AS similarity
        FROM kb_articles
        WHERE 1-(embedding<=>$1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3`,
            [vecStr, this.SIMILARITY_THRESHOLD * 0.5, topK]
        );
        const above = rows.filter(r => r.similarity >= this.SIMILARITY_THRESHOLD);
        return {
            query, results: rows,
            topResult: rows[0] ?? null,
            hasConfidentMatch: above.length > 0,
        };
    }
    async ingestArticle(title: string, content: string): Promise<void> {
        const vec = await this.embed(`${title}. ${content}`);
        await this.ds.query(
            `INSERT INTO kb_articles (title, content, embedding)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [title, content, `[${vec.join(",")}]`]
        );
    }
}