import { Controller, Post, Body, Res, Inject } from "@nestjs/common";
import type { Response } from "express";
import {
    convertToModelMessages,
    Output,
    stepCountIs,
    streamText,
    type UIMessage,
} from "ai";
import { chatModel, toolModel } from "./model.js";
import { citedAnswerSchema } from "../lib/citation-schema.js";
import { KnowledgeBaseService } from "./knowledge-base.service.js";
import { RagToolsService } from "./rag-tools.service.js";

function lastUserText(messages: UIMessage[]): string {
    return (
        messages
            .at(-1)
            ?.parts.find((p): p is { type: "text"; text: string } => p.type === "text")
            ?.text ?? ""
    );
}

@Controller("rag")
export class ChatController {
    constructor(
        @Inject(KnowledgeBaseService) private readonly kb: KnowledgeBaseService,
        @Inject(RagToolsService) private readonly ragTools: RagToolsService,
    ) { }

    @Post("chat-basic")
    async chatBasic(@Body() body: { messages: UIMessage[] }, @Res() res: Response) {
        const result = streamText({
            model: chatModel,
            system: "You are a helpful assistant.",
            messages: await convertToModelMessages(body.messages),
        });
        result.pipeUIMessageStreamToResponse(res);
    }

    @Post("chat-rag")
    async chatRag(@Body() body: { messages: UIMessage[] }, @Res() res: Response) {
        const query = lastUserText(body.messages);
        const search = await this.kb.search(query, 4);
        const chunks = search.hasConfidentMatch ? search.results : [];

        const system =
            chunks.length === 0
                ? "Tell the user their question is outside what the knowledge base covers. Do not guess."
                : `Answer using only the context below. If the context only partially
                answers the question, explicitly state what is missing.

                Context:
                ${chunks.map((c) => `[${c.title}]\n${c.content}`).join("\n\n")}`;

        const result = streamText({
            model: chatModel,
            system,
            messages: await convertToModelMessages(body.messages),
        });
        result.pipeUIMessageStreamToResponse(res);
    }

    @Post("chat")
    async chat(@Body() body: { messages: UIMessage[] }, @Res() res: Response) {
        const result = streamText({
            model: toolModel,
            system:
                "You are a support assistant. Use the searchKnowledgeBase tool for product, billing, refund, password, or account questions. Answer math/general knowledge directly without tools.",
            messages: await convertToModelMessages(body.messages),
            tools: { searchKnowledgeBase: this.ragTools.searchKnowledgeBase() },
            stopWhen: stepCountIs(5),
        });
        result.pipeUIMessageStreamToResponse(res);
    }

    @Post("cited-answer")
    async citedAnswer(@Body() body: { query: string }, @Res() res: Response) {
        const search = await this.kb.search(body.query, 4);
        const chunks = search.hasConfidentMatch ? search.results : [];

        const result = streamText({
            model: chatModel,
            output: Output.object({ schema: citedAnswerSchema }),
            prompt: `Question: ${body.query}

            Context chunks:
            ${chunks.map((c) => `[${c.title}] ${c.content}`).join("\n\n")}

            Answer the question and cite the exact chunk title and a verbatim
            supporting quote for every claim.`,
        });
        result.pipeTextStreamToResponse(res);
    }
}
