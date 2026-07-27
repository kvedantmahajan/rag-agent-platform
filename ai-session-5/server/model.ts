import { groq } from "@ai-sdk/groq";
import { createOllama } from "ai-sdk-ollama";
import type { streamText } from "ai";

type ChatModel = NonNullable<Parameters<typeof streamText>[0]["model"]>;

/** .env = Groq/prod · .env.local = Ollama/local overrides */
export type LlmProvider = "ollama" | "groq";

const provider = (process.env.LLM_PROVIDER ?? "ollama") as LlmProvider;

const defaultModels: Record<LlmProvider, string> = {
    ollama: "gpt-oss:latest",
    groq: "llama-3.3-70b-versatile",
};

const toolModels: Record<LlmProvider, string> = {
    ollama: "gpt-oss:latest",
    groq: "llama3-groq-70b-8192-tool-use-preview",
};

function resolveModelId(override: string | undefined, fallback: string): string {
    return override?.trim() || process.env.LLM_MODEL?.trim() || fallback;
}

function createLanguageModel(modelId: string): ChatModel {
    switch (provider) {
        case "groq":
            return groq(modelId) as unknown as ChatModel;
        case "ollama":
        default: {
            const ollama = createOllama({
                baseURL: process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434",
            });
            return ollama(modelId) as ChatModel;
        }
    }
}

export const chatModel = createLanguageModel(
    resolveModelId(undefined, defaultModels[provider] ?? defaultModels.ollama),
);

export const toolModel = createLanguageModel(
    resolveModelId(
        process.env.LLM_MODEL_TOOLS,
        toolModels[provider] ?? toolModels.ollama,
    ),
);
