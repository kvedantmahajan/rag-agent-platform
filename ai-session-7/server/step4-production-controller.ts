import {
    Controller, Post, Body, Res,
    HttpCode
} from "@nestjs/common";
import { Response } from "express";
import { z } from "zod";
import Groq from "groq-sdk";
import {
    propagateAttributes,
    startActiveObservation,
} from "@langfuse/tracing";
import { KnowledgeBaseService } from "./knowledge-base.service.js";
import { flushLangfuse, isLangfuseEnabled } from "./langfuse.js";

const QuerySchema = z.object({
    question: z.string().min(3).max(500),
    topK: z.number().min(1).max(10).default(3),
});

const MISS_ANSWER =
    "I do not have information about that in the knowledge base. "
    + "I can help with: password reset, refunds, cancelling a "
    + "subscription, order tracking, updating billing "
    + "information, and two-factor authentication (2FA). "
    + "Try one of those topics, or pick an example question above.";

const CLASSIFY_SYSTEM =
    "Classify into SIMPLE, CLASSIFICATION, "
    + "SYNTHESIS, or REASONING. "
    + "Reply with only the label.";

const GENERATE_SYSTEM =
    "You are a helpful customer support assistant. "
    + "Answer using ONLY the context below — do not invent policies. "
    + "Write a full, readable reply of about 6–10 sentences "
    + "(or a short intro, then numbered steps, then a brief closing tip). "
    + "Explain each step clearly so a customer can follow without guessing. "
    + "End with SOURCES: [n] for each context chunk you used "
    + "(for example: SOURCES: [1]). "
    + "If the context is insufficient, say so plainly.";

@Controller("rag")
export class ProductionRagController {
    private readonly groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    private readonly kb: KnowledgeBaseService;

    constructor(kb: KnowledgeBaseService) {
        this.kb = kb;
    }

    private async classifyQuery(q: string) {
        const model = "llama-3.1-8b-instant";
        const r = await this.groq.chat.completions.create({
            model,
            messages: [
                { role: "system", content: CLASSIFY_SYSTEM },
                { role: "user", content: q },
            ],
            temperature: 0, max_tokens: 10,
        });
        return {
            category: r.choices[0].message.content?.trim() ?? "SYNTHESIS",
            model,
            usageDetails: r.usage
                ? {
                    input: r.usage.prompt_tokens ?? 0,
                    output: r.usage.completion_tokens ?? 0,
                    total: r.usage.total_tokens ?? 0,
                }
                : undefined,
        };
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
                const base = 1000 * Math.pow(2, attempt - 1);
                const jitter = Math.random() * 500;
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

    private parseSources(
        fullText: string,
        results: { title: string }[],
    ) {
        const m = fullText.match(/SOURCES:\s*([\[\d\],\s]+)/);
        const idxs = m
            ? [...m[1].matchAll(/\[(\d+)\]/g)]
                .map((x) => parseInt(x[1]) - 1)
                .filter((i) => i >= 0 && i < results.length)
            : [];
        return idxs.map((i) => ({ title: results[i].title }));
    }

    private buildMessages(question: string, results: { title: string; content: string }[]) {
        const ctx = results
            .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
            .join("\n\n");
        return [
            { role: "system" as const, content: GENERATE_SYSTEM },
            {
                role: "user" as const,
                content:
                    `<context>\n${ctx}\n</context>\n`
                    + `<question>${question}</question>`,
            },
        ];
    }

    private async streamAnswer(opts: {
        model: string;
        messages: { role: "system" | "user"; content: string }[];
        res: Response;
        ctrl: AbortController;
        onToken?: (token: string) => void;
    }): Promise<{
        fullText: string;
        usedModel: string;
        fellBack: boolean;
        usageDetails?: { input: number; output: number; total: number };
    }> {
        let fullText = "";
        let usedModel = opts.model;
        let fellBack = false;
        let usageDetails: { input: number; output: number; total: number } | undefined;
        const createStream = async (model: string) =>
            this.groq.chat.completions.create({
                model,
                messages: opts.messages,
                temperature: 0.2,
                max_tokens: 900,
                stream: true,
                // Groq supports usage on the final stream chunk; older SDK types omit this.
                stream_options: { include_usage: true },
            } as any) as unknown as Promise<AsyncIterable<{
                choices: { delta?: { content?: string | null } }[];
                usage?: {
                    prompt_tokens?: number;
                    completion_tokens?: number;
                    total_tokens?: number;
                } | null;
            }>>;
        let stream;
        try {
            stream = await this.withRetry(() => createStream(opts.model));
        } catch {
            fellBack = true;
            usedModel = "llama-3.1-8b-instant";
            stream = await createStream(usedModel);
        }
        for await (const chunk of stream) {
            if (chunk.usage) {
                usageDetails = {
                    input: chunk.usage.prompt_tokens ?? 0,
                    output: chunk.usage.completion_tokens ?? 0,
                    total: chunk.usage.total_tokens ?? 0,
                };
            }
            if (opts.res.writableEnded) break;
            const token = chunk.choices[0]?.delta?.content ?? "";
            if (!token) continue;
            fullText += token;
            opts.onToken?.(token);
            opts.res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        return { fullText, usedModel, fellBack, usageDetails };
    }

    @Post("query") @HttpCode(200)
    async query(@Body() raw: unknown, @Res() res: Response) {
        const parsed = QuerySchema.safeParse(raw);
        if (!parsed.success) {
            res.status(400).json({ error: parsed.error.issues });
            return;
        }
        const { question, topK } = parsed.data;

        try {
            if (!isLangfuseEnabled()) {
                await this.runQuery(question, topK, res, false);
                return;
            }
            await propagateAttributes(
                {
                    tags: ["rag", "demo"],
                    metadata: { route: "POST /rag/query" },
                },
                () => this.runQuery(question, topK, res, true),
            );
        } finally {
            await flushLangfuse();
        }
    }

    private async runQuery(
        question: string,
        topK: number,
        res: Response,
        traced: boolean,
    ): Promise<void> {
        const run = async (
            updateRoot?: (attrs: {
                input?: unknown;
                output?: unknown;
                metadata?: Record<string, unknown>;
            }) => void,
        ) => {
            updateRoot?.({
                input: { question },
                metadata: { topK: String(topK), route: "POST /rag/query" },
            });

            const searchResult = traced
                ? await startActiveObservation(
                    "retrieve-context",
                    async (retriever) => {
                        retriever.update({ input: { question, topK } });
                        const result = await this.kb.search(question, topK);
                        retriever.update({
                            output: {
                                resultCount: result.results.length,
                                hasConfidentMatch: result.hasConfidentMatch,
                                topSimilarity:
                                    result.topResult?.similarity ?? null,
                                titles: result.results.map((r) => r.title),
                            },
                            metadata: { dataSource: "pgvector" },
                        });
                        return result;
                    },
                    { asType: "retriever" },
                )
                : await this.kb.search(question, topK);

            if (!searchResult.hasConfidentMatch) {
                updateRoot?.({
                    output: MISS_ANSWER,
                    metadata: { path: "confidence-miss" },
                });
                res.json({
                    answer: MISS_ANSWER,
                    sources: [],
                    confident: false,
                });
                return;
            }

            let category: string;
            let model: string;
            if (traced) {
                const classified = await startActiveObservation(
                    "classify-intent",
                    async (generation) => {
                        const messages = [
                            {
                                role: "system" as const,
                                content: CLASSIFY_SYSTEM,
                            },
                            { role: "user" as const, content: question },
                        ];
                        generation.update({
                            model: "llama-3.1-8b-instant",
                            modelParameters: {
                                temperature: 0,
                                max_tokens: 10,
                            },
                            input: messages,
                        });
                        const result = await this.classifyQuery(question);
                        const selectedModel = this.selectModel(
                            result.category,
                        );
                        generation.update({
                            output: result.category,
                            model: result.model,
                            usageDetails: result.usageDetails,
                            metadata: { selectedModel },
                        });
                        return {
                            category: result.category,
                            selectedModel,
                        };
                    },
                    { asType: "generation" },
                );
                category = classified.category;
                model = classified.selectedModel;
            } else {
                const result = await this.classifyQuery(question);
                category = result.category;
                model = this.selectModel(result.category);
            }

            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");

            const ctrl = new AbortController();
            const timeoutId = setTimeout(() => ctrl.abort(), 30_000);
            res.on("close", () => {
                ctrl.abort();
                clearTimeout(timeoutId);
            });

            const messages = this.buildMessages(
                question,
                searchResult.results,
            );

            try {
                const finish = async (
                    fullText: string,
                    usedModel: string,
                    fellBack: boolean,
                ) => {
                    const sources = this.parseSources(
                        fullText,
                        searchResult.results,
                    );
                    if (!res.writableEnded) {
                        res.write(`data: ${JSON.stringify({
                            done: true,
                            sources,
                            model: usedModel,
                            category,
                        })}\n\n`);
                    }
                    updateRoot?.({
                        output: fullText,
                        metadata: {
                            path: "confident-hit",
                            category,
                            model: usedModel,
                            fellBack: String(fellBack),
                        },
                    });
                    return sources;
                };

                if (traced) {
                    await startActiveObservation(
                        "generate-response",
                        async (generation) => {
                            generation.update({
                                model,
                                modelParameters: {
                                    temperature: 0.2,
                                    max_tokens: 900,
                                    stream: 1,
                                },
                                input: messages,
                                metadata: { category },
                            });
                            try {
                                const {
                                    fullText,
                                    usedModel,
                                    fellBack,
                                    usageDetails,
                                } = await this.streamAnswer({
                                    model,
                                    messages,
                                    res,
                                    ctrl,
                                });
                                const sources = await finish(
                                    fullText,
                                    usedModel,
                                    fellBack,
                                );
                                generation.update({
                                    output: fullText,
                                    model: usedModel,
                                    usageDetails,
                                    metadata: {
                                        fellBack: String(fellBack),
                                        category,
                                        sourceTitles: sources
                                            .map((s) => s.title)
                                            .join(", "),
                                    },
                                });
                            } catch (err: any) {
                                generation.update({
                                    output: null,
                                    level: "ERROR",
                                    statusMessage:
                                        err?.message ?? "Generation failed",
                                });
                                if (
                                    !res.writableEnded
                                    && !ctrl.signal.aborted
                                ) {
                                    res.write(`data: ${JSON.stringify({
                                        error:
                                            "Generation failed. Please try again.",
                                    })}\n\n`);
                                }
                            }
                        },
                        { asType: "generation" },
                    );
                } else {
                    try {
                        const {
                            fullText,
                            usedModel,
                            fellBack,
                        } = await this.streamAnswer({
                            model,
                            messages,
                            res,
                            ctrl,
                        });
                        await finish(fullText, usedModel, fellBack);
                    } catch {
                        if (!res.writableEnded && !ctrl.signal.aborted) {
                            res.write(`data: ${JSON.stringify({
                                error: "Generation failed. Please try again.",
                            })}\n\n`);
                        }
                    }
                }
            } finally {
                clearTimeout(timeoutId);
                if (!res.writableEnded) res.end();
            }
        };

        if (traced) {
            await startActiveObservation(
                "rag-query",
                async (chain) => {
                    await run((attrs) => chain.update(attrs));
                },
                { asType: "chain" },
            );
        } else {
            await run();
        }
    }
}
