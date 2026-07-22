import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function timedCall(model, prompt) {
    const start = Date.now();
    const response = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0,
        max_tokens: 200,
    });
    return {
        model,
        answer: response.choices[0].message.content,
        tokens: response.usage.total_tokens,
        ms: Date.now() - start,
    };
}
const prompt = `
Extract the following fields from this text as JSON:
- name
- amount
- currency
- date
Text: "John Doe transferred 4500 rupees to vendor account on 14th March 2025."
Return only valid JSON, nothing else.
`;
const [small, mid] = await Promise.all([
    timedCall("llama-3.1-8b-instant", prompt),
    timedCall("llama-3.3-70b-versatile", prompt),
]);
console.log("=== Small model (8B) ===");
console.log("Answer:", small.answer);
console.log(`Time: ${small.ms}ms | Tokens: ${small.tokens}`);
console.log("\n=== Mid model (70B) ===");
console.log("Answer:", mid.answer);
console.log(`Time: ${mid.ms}ms | Tokens: ${mid.tokens}`);
console.log("\n--- Decision ---");
console.log("If both outputs are correct JSON -> use small model (30x cheaper).");
console.log("If small model hallucinated a field -> you need mid-tier.");



//OBSERVE: For simple structured extraction, the 8B model is often as accurate as the
// 70B but significantly faster. This is the model routing decision you will make in
// Session 7 when optimising production costs. The cost difference is not small — at
// scale a 30x cost difference between small and mid-tier models is the difference
// between a feature being economically viable or not.