/**
 * Optional Langfuse observability (JS SDK v5 / OpenTelemetry).
 * Enabled only when LANGFUSE_PUBLIC_KEY + LANGFUSE_SECRET_KEY are set
 * and do not look like placeholders.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { LangfuseSpanProcessor } from "@langfuse/otel";

let sdk: NodeSDK | null = null;
let processor: LangfuseSpanProcessor | null = null;

function looksLikePlaceholder(value: string): boolean {
    const v = value.trim();
    return !v || v.includes("...") || v.length < 20;
}

export function isLangfuseEnabled(): boolean {
    return sdk != null;
}

export function initLangfuseFromEnv(): void {
    const publicKey = process.env.LANGFUSE_PUBLIC_KEY?.trim();
    const secretKey = process.env.LANGFUSE_SECRET_KEY?.trim();
    if (!publicKey || !secretKey || looksLikePlaceholder(publicKey) || looksLikePlaceholder(secretKey)) {
        console.log(
            "[langfuse] disabled — set LANGFUSE_PUBLIC_KEY and "
            + "LANGFUSE_SECRET_KEY to enable tracing",
        );
        return;
    }

    // Ensure processor reads credentials from env (docs default path).
    process.env.LANGFUSE_PUBLIC_KEY = publicKey;
    process.env.LANGFUSE_SECRET_KEY = secretKey;
    if (process.env.LANGFUSE_BASE_URL?.trim()) {
        process.env.LANGFUSE_BASE_URL = process.env.LANGFUSE_BASE_URL.trim();
    }

    const environment =
        process.env.LANGFUSE_TRACING_ENVIRONMENT?.trim()
        || (process.env.NODE_ENV === "production" ? "production" : "development");

    processor = new LangfuseSpanProcessor({
        publicKey,
        secretKey,
        baseUrl: process.env.LANGFUSE_BASE_URL?.trim() || undefined,
        environment,
        flushAt: 1,
        flushInterval: 1,
    });
    sdk = new NodeSDK({
        resource: resourceFromAttributes({
            "service.name": "rag-agent-platform",
        }),
        spanProcessors: [processor],
    });
    sdk.start();
    console.log(`[langfuse] enabled (SDK v5 / OTEL, env=${environment})`);
}

export async function flushLangfuse(): Promise<void> {
    if (!processor) return;
    try {
        await processor.forceFlush();
    } catch (err) {
        console.warn("[langfuse] flush failed", err);
    }
}

export async function shutdownLangfuse(): Promise<void> {
    if (!sdk) return;
    try {
        await sdk.shutdown();
    } catch (err) {
        console.warn("[langfuse] shutdown failed", err);
    } finally {
        sdk = null;
        processor = null;
    }
}
