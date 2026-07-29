import Groq from "groq-sdk";
import { z } from "zod";
import * as dotenv from "dotenv";
dotenv.config();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const FaithfulnessSchema = z.object({
    claims: z.array(z.object({
        claim: z.string(),
        supported: z.boolean(),
        reason: z.string(),
    })),
    faithfulness: z.number().min(0).max(1),
});

export async function evaluateFaithfulness(
    question, context, answer
) {
    const res = await groq.chat.completions.create({
        // Use 70B as judge — faithfulness needs careful reasoning
        model: "llama-3.3-70b-versatile",
        messages: [{
            role: "system",
            content:
                "You are an evaluation assistant.\n"
                + "Given a question, retrieved context, and answer:\n"
                + "1. Identify all factual claims in the answer\n"
                + "2. For each claim, determine if it can be "
                + " inferred from the context\n"
                + "3. faithfulness = supported / total\n"
                + "Respond in JSON only:\n"
                + "{\"claims\":["
                + "{\"claim\":\"...\",\"supported\":true,"
                + " \"reason\":\"...\"}],"
                + "\"faithfulness\":0.0}",
        }, {
            role: "user",
            content:
                `Question: ${question}\n\n`
                + `Context: ${context}\n\n`
                + `Answer: ${answer}`,
        }],
        temperature: 0,
        max_tokens: 500,
    });

    const raw = res.choices[0].message.content.trim();
    let parsed;
    try { parsed = JSON.parse(raw); }
    catch { return { faithfulness: 0, claims: [], parseError: true }; }
    const result = FaithfulnessSchema.safeParse(parsed);
    return result.success
        ? result.data
        : { faithfulness: 0, claims: [], schemaError: true };
}