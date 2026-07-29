import {
    Controller, Post, Body, Res,
    HttpCode
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import { KnowledgeBaseService } from "./knowledge-base.service.js";

const QuerySchema = z.object({
    question: z.string().min(3).max(500),
    topK: z.number().min(1).max(10).default(3),
});

@Controller("rag")
export class ProductionRagController {
    private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    private readonly kb: KnowledgeBaseService;

    constructor(kb: KnowledgeBaseService) {
        this.kb = kb;
    }

    private async classifyQuery(q: string) {
        const r = await this.groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content:
                        "Classify into SIMPLE, CLASSIFICATION, "
                        + "SYNTHESIS, or REASONING. "
                        + "Reply with only the label."
                },
                { role: "user", content: q },
            ],
            temperature: 0, max_tokens: 10,
        });
        return r.choices[0].message.content?.trim() ?? "SYNTHESIS";
    }

    private selectModel(cat: string) {
        return ["SIMPLE", "CLASSIFICATION"].includes(cat)
            ? "llama-3.1-8b-instant"
            : "llama-3.3-70b-versatile";
    }

    private async withRetry<T>(
        fn: () => Promise<T>, maxAttempts = 3
    ): Promise<T> {
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try { return await fn(); }
            catch (err: any) {
                const retryable = [429, 503, 504].includes(err.status);
                if (!retryable || attempt === maxAttempts) throw err;
                // Exponential backoff with jitter prevents retry storms
                const base = 1000 * Math.pow(2, attempt - 1); // 1s 2s 4s
                const jitter = Math.random() * 500; // 0-500ms
                const delay = Math.min(base + jitter, 8000);
                console.warn(
                    `Attempt ${attempt} failed (${err.status}). `
                    + `Retry in ${Math.round(delay)}ms`
                );
                await sleep(delay);
            }
        }
        throw new Error("Max retries");
    }

    @Post("query") @HttpCode(200)
    async query(@Body() raw: unknown, @Res() res: Response) {
        const parsed = QuerySchema.safeParse(raw);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.issues });
            return;
        }
        const { question, topK } = parsed.data;
        const searchResult = await this.kb.search(question, topK);
        if (!searchResult.hasConfidentMatch) {
            res.json({
                answer: "I do not have information about that.",
                sources: [], confident: false,
            });
            return;
        }
        const category = await this.classifyQuery(question);
        const model = this.selectModel(category);
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        const ctrl = new AbortController();
        const timeoutId = setTimeout(() => ctrl.abort(), 30_000);
        res.on("close", () => {
            ctrl.abort();
            clearTimeout(timeoutId);
        });

        const ctx = searchResult.results
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
            .join("\n\n");
        const sys =
            "Answer using ONLY the context. "
            + "SOURCES: [n] for each used. "
            + "If insufficient, say so.";
        const usr =
            `<context>\n${ctx}\n</context>\n`
            + `<question>${question}</question>`;
        let fullText = ""; let usedModel = model;
        try {
            let stream;
            try {
                stream = await this.withRetry(() =>
                    this.groq.chat.completions.create({
                        model,
                        messages: [
                            { role: "system", content: sys },
                            { role: "user", content: usr },
                        ],
                        temperature: 0, max_tokens: 400,
                        stream: true,
                    }));
            } catch {
                usedModel = "llama-3.1-8b-instant";
                stream = await this.groq.chat.completions.create({
                    model: usedModel,
                    messages: [
                        { role: "system", content: sys },
                        { role: "user", content: usr },
                    ],
                    temperature: 0, max_tokens: 400,
                    stream: true,
                });
            }
            for await (const chunk of stream) {
                if (res.writableEnded) break;
                const token = chunk.choices[0]?.delta?.content ?? "";
                fullText += token;
                res.write(`data: ${JSON.stringify({ token })}\n\n`);
            }
            const m = fullText.match(/SOURCES:\s*([\[\d\],\s]+)/);
            const idxs = m
                ? [...m[1].matchAll(/\[(\d+)\]/g)]
                    .map(x => parseInt(x[1]) - 1)
                    .filter(i => i >= 0 && i < searchResult.results.length)
                : [];
            if (!res.writableEnded)
                res.write(`data: ${JSON.stringify({
                    done: true,
                    sources: idxs.map(i => ({
                        title: searchResult.results[i].title
                    })),
                    model: usedModel,
                    category,
                })}\n\n`);
        } catch (err: any) {
            if (!res.writableEnded && !ctrl.signal.aborted)
                res.write(`data: ${JSON.stringify({
                    error: "Generation failed. Please try again."
                })}\n\n`);
        } finally {
            clearTimeout(timeoutId);
            if (!res.writableEnded) res.end();
        }
    }
}