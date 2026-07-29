const sleep = ms => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try { return await fn(); }
        catch (err) {
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
}


async function generateWithFallback(
    systemPrompt, userPrompt, preferredModel
) {
    // Attempt 1: preferred model with retry
    try {
        return await withRetry(async () => {
            const res = await groq.chat.completions.create({
                model: preferredModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0, max_tokens: 300,
            });
            return {
                answer: res.choices[0].message.content,
                source: preferredModel,
            };
        });
    } catch {
        console.warn(`${preferredModel} unavailable. Trying fallback.`);
    }
    // Attempt 2: smallest model
    try {
        const fb = "llama-3.1-8b-instant";
        const res = await groq.chat.completions.create({
            model: fb,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            temperature: 0, max_tokens: 300,
        });
        return {
            answer: res.choices[0].message.content,
            source: fb,
            degraded: true,
        };
    } catch {
        console.warn("Fallback also unavailable. Returning static.");
    }
    // Attempt 3: static graceful degradation
    return {
        answer: null,
        source: "static",
        degraded: true,
        message:
            "Our AI assistant is temporarily unavailable. "
            + "Here are the most relevant articles.",
    };
}