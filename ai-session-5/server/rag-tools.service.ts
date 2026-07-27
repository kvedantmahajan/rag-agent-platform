import { Injectable, Inject } from "@nestjs/common";
import { tool } from "ai";
import { z } from "zod";
import { KnowledgeBaseService } from "./knowledge-base.service.js";

@Injectable()
export class RagToolsService {
    constructor(
        @Inject(KnowledgeBaseService) private readonly kb: KnowledgeBaseService,
    ) { }

    searchKnowledgeBase() {
        return tool({
            description:
                "Search the internal knowledge base for articles relevant to a query. " +
                "Use this for questions about product features, billing, or account setup. " +
                "Do NOT use this for general knowledge, math, or anything unrelated to this product.",
            inputSchema: z.object({
                query: z
                    .string()
                    .describe("A focused search query, not the full user message."),
            }),
            execute: async ({ query }) => {
                const result = await this.kb.search(query, 4);
                if (!result.hasConfidentMatch || result.results.length === 0) {
                    return "No relevant articles found.";
                }
                return result.results
                    .map((c) => `[${c.title}] ${c.content}`)
                    .join("\n\n");
            },
        });
    }
}
