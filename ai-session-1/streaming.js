import Groq from "groq-sdk";
import * as dotenv from "dotenv";
dotenv.config();
const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
console.log("Streaming response:\n");
const stream = await client.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [
        {
            role: "user",
            content: "Explain how a transformer predicts the next token. Use a simple analogy."
        }
    ],
    temperature: 0.7,
    max_tokens: 300,
    stream: true, // important
});
for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content || "";
    process.stdout.write(token);
}
console.log("\n\nDone.");