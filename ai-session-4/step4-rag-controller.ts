import { Controller, Post, Body, Res, HttpCode, Inject } from "@nestjs/common";
import { Response } from "express";
import Groq from "groq-sdk";
import { z } from "zod";
import { KnowledgeBaseService } from "./knowledge-base.service.js";

const QuerySchema = z.object({
    question: z.string().min(3).max(500),
    topK: z.number().min(1).max(10).default(3),
});

@Controller("rag")
export class RagController {
    private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    constructor(
        @Inject(KnowledgeBaseService) private readonly kb: KnowledgeBaseService,
    ) { }

    @Post("query")
    @HttpCode(200)
    async query(@Body() rawBody: unknown, @Res() res: Response) {
        // Layer 1: Zod validation (Session 2 pattern)
        const parsed = QuerySchema.safeParse(rawBody);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.issues });
            return;
        }
        const { question, topK } = parsed.data;

        // Layer 2: retrieval with threshold gate (Session 3 pattern)
        const searchResult = await this.kb.search(question, topK);
        if (!searchResult.hasConfidentMatch) {
            res.json({
                answer: "I do not have information about that.",
                sources: [],
                confident: false,
            });
            return;
        }

        // Layer 3: SSE headers for streaming
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const ctx = searchResult.results
            .map((r, i) => `[${i + 1}] "${r.title}"\n${r.content}`)
            .join("\n\n");

        // Layer 4: stream tokens via SSE
        let fullText = "";
        try {
            const stream = await this.groq.chat.completions.create({
                model: "llama-3.3-70b-versatile",
                messages: [
                    {
                        role: "system",
                        content: `You are a helpful customer support assistant.
                        Answer using ONLY the information in the context below.
                        If context does not contain enough information, say: "I do not have information about that."
                        Cite sources using bracket numbers like [1] inline where relevant.
                        End your answer with a single line: SOURCES: [n], [m] listing the articles you used.
                        Do not use any knowledge outside the provided context.`,
                    },
                    {
                        role: "user",
                        content: `<context>\n${ctx}\n</context>\n\n<question>\n${question}\n</question>`,
                    },
                ],
                temperature: 0,
                max_tokens: 300,
                stream: true,
            });

            for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta?.content || "";
                if (!token) continue;
                fullText += token;
                res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }

            // Parse and send final citation metadata
            const m = fullText.match(/SOURCES:\s*([\[\d\],\s]+)/);
            const indices = m
                ? [...m[1].matchAll(/\[(\d+)\]/g)]
                    .map((x) => parseInt(x[1]) - 1)
                    .filter((i) => i >= 0 && i < searchResult.results.length)
                : [];
            const sources = indices.map((i) => ({
                title: searchResult.results[i].title,
                similarity: searchResult.results[i].similarity,
            }));
            res.write(`data: ${JSON.stringify({ done: true, sources })}\n\n`);
        } catch {
            res.write(`data: ${JSON.stringify({ error: "Generation failed" })}\n\n`);
        } finally {
            res.end();
        }
    }
}
