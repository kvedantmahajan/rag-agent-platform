import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
const response = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
        { role: "user", content: "What is a token in an LLM? Answer in 3 sentences." }
    ],
    temperature: 0,
    max_tokens: 200,
});
console.log(response.choices[0].message.content);
console.log("\n--- Usage ---");
console.log("Prompt tokens: ", response.usage.prompt_tokens);
console.log("Completion tokens: ", response.usage.completion_tokens);
console.log("Total tokens: ", response.usage.total_tokens);