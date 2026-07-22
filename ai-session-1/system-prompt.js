import Groq from "groq-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const client = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function ask(systemPrompt, userMessage, temperature) {
    const response = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ],
        temperature,
        max_tokens: 150,
    });
    return response.choices[0].message.content;
}
const userQ = "Should I use PostgreSQL or MongoDB for my app?";
const results = await Promise.all([
    ask("You are a helpful assistant.", userQ, 0),
    ask(
        "You are a terse senior engineer. Answer in one sentence, no fluff.",
        userQ, 0
    ),
    ask("You are a helpful assistant.", userQ, 1),
]);
console.log("=== Default system prompt, temp 0 ===");
console.log(results[0]);
console.log("\n=== Terse engineer system prompt, temp 0 ===");
console.log(results[1]);
console.log("\n=== Default system prompt, temp 1 ===");
console.log(results[2]);